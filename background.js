// background.js

// --- State Management ---
// In-memory state. Volatile, needs to be re-initialized on service worker startup.
let state = {
  spaces: [],
  currentSpaceId: null,
  isSwitching: false,
};

// --- Helper Functions ---
function isEmoji(char) {
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]/u;
  return emojiRegex.test(char);
}

async function notifySidebar(action, data) {
  try {
    await chrome.runtime.sendMessage({ action, data });
  } catch (error) {
    console.log("Could not send message to sidebar, it's likely closed.", error);
  }
}

// --- Core Logic: Initialization and Space Management ---

async function initializeState() {
  console.log('Initializing state...');
  try {
    const bookmarkTree = await chrome.bookmarks.getTree();
    const bookmarkBar = bookmarkTree[0].children.find(node => node.id === '1');

    if (!bookmarkBar || !bookmarkBar.children) {
      console.warn('Bookmark bar not found or is empty.');
      state.spaces = [];
      return;
    }

    const spaceFolders = bookmarkBar.children.filter(node => node.children);
    const spacePromises = spaceFolders.map(async (folder) => {
      let icon = '●';
      let name = folder.title;
      if (name && name.length > 0 && isEmoji(name[0])) {
        icon = name[0];
        name = name.substring(1).trim();
      }
      const storedTabs = await getStoredTabs(folder.id);
      return {
        id: folder.id,
        icon: icon,
        name: name || `Space ${folder.id}`,
        bookmarks: folder.children ? folder.children.filter(bm => bm.url) : [],
        openTabs: storedTabs || [],
      };
    });

    state.spaces = await Promise.all(spacePromises);

    const lastActiveId = await getLastActiveSpace();
    if (lastActiveId && state.spaces.some(s => s.id === lastActiveId)) {
      state.currentSpaceId = lastActiveId;
    } else if (state.spaces.length > 0) {
      state.currentSpaceId = state.spaces[0].id;
    }

    console.log('State initialized:', { spaces: state.spaces.length, currentSpaceId: state.currentSpaceId });
    await syncCurrentSpaceTabs();
  } catch (error) {
    console.error('Error during state initialization:', error);
  }
}

async function switchSpace(newSpaceId) {
  if (state.isSwitching || state.currentSpaceId === newSpaceId) {
    console.log(`Switch ignored: switching=${state.isSwitching}, newSpaceId=${newSpaceId}`);
    return;
  }
  state.isSwitching = true;
  console.log(`Switching from ${state.currentSpaceId} to ${newSpaceId}`);

  try {
    const oldSpaceId = state.currentSpaceId;
    const oldSpace = state.spaces.find(s => s.id === oldSpaceId);
    const newSpace = state.spaces.find(s => s.id === newSpaceId);

    if (!newSpace) {
      throw new Error(`New space with ID ${newSpaceId} not found.`);
    }

    // Close old tabs
    if (oldSpace && oldSpace.openTabs.length > 0) {
      const tabIdsToClose = oldSpace.openTabs.map(t => t.id);
      try {
        await chrome.tabs.remove(tabIdsToClose);
      } catch (error) {
        console.warn('Error closing old tabs (some may have already been closed):', error);
      }
    }

    // Restore new tabs
    const restoredTabs = [];
    if (newSpace.openTabs.length > 0) {
      for (const tabInfo of newSpace.openTabs) {
        if (tabInfo.url && !tabInfo.url.startsWith('chrome://')) {
          try {
            const newTab = await chrome.tabs.create({
              url: tabInfo.url,
              active: false
            });
            restoredTabs.push({ id: newTab.id, url: newTab.url, title: newTab.title, favIconUrl: newTab.favIconUrl });
          } catch (error) {
            console.warn(`Error creating tab for ${tabInfo.url}:`, error);
          }
        }
      }
    } else {
      // Create a blank tab if the space is empty
      const blankTab = await chrome.tabs.create({ active: false });
      restoredTabs.push({ id: blankTab.id, url: blankTab.url, title: blankTab.title, favIconUrl: blankTab.favIconUrl });
    }
    
    newSpace.openTabs = restoredTabs;
    
    // Activate the first tab of the new space
    if (newSpace.openTabs.length > 0) {
      try {
        await chrome.tabs.update(newSpace.openTabs[0].id, { active: true });
      } catch (error) {
        console.warn(`Could not activate tab ${newSpace.openTabs[0].id}:`, error);
      }
    }

    state.currentSpaceId = newSpaceId;
    await storeTabs(newSpace.id, newSpace.openTabs);
    await setLastActiveSpace(newSpaceId);
    
    console.log(`Successfully switched to space ${newSpaceId}`);
  } catch (error) {
    console.error('Critical error in switchSpace:', error);
  } finally {
    state.isSwitching = false;
    await notifySidebar('stateUpdated', await getSidebarState());
  }
}

// --- Storage Persistence ---

async function storeTabs(spaceId, tabs) {
  try {
    const cleanTabs = tabs.map(tab => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
    }));
    await chrome.storage.local.set({ [`space_${spaceId}_tabs`]: cleanTabs });
  } catch (error) {
    console.error(`Error storing tabs for space ${spaceId}:`, error);
  }
}

async function getStoredTabs(spaceId) {
  try {
    const result = await chrome.storage.local.get([`space_${spaceId}_tabs`]);
    return result[`space_${spaceId}_tabs`] || [];
  } catch (error) {
    console.error(`Error getting stored tabs for space ${spaceId}:`, error);
    return [];
  }
}

async function setLastActiveSpace(spaceId) {
  try {
    await chrome.storage.local.set({ 'last_active_space_id': spaceId });
  } catch (error) {
    console.error('Error setting last active space:', error);
  }
}

async function getLastActiveSpace() {
  try {
    const result = await chrome.storage.local.get(['last_active_space_id']);
    return result.last_active_space_id;
  } catch (error) {
    console.error('Error getting last active space:', error);
    return null;
  }
}

// --- Sync Logic ---

async function syncCurrentSpaceTabs() {
    if (!state.currentSpaceId) return;

    const space = state.spaces.find(s => s.id === state.currentSpaceId);
    if (!space) return;

    try {
        const window = await chrome.windows.getLastFocused({ populate: true });
        const currentTabs = window.tabs.filter(t => t.url && !t.url.startsWith('chrome://newtab'));

        space.openTabs = currentTabs.map(t => ({
            id: t.id,
            url: t.url,
            title: t.title,
            favIconUrl: t.favIconUrl,
        }));

        await storeTabs(state.currentSpaceId, space.openTabs);
        console.log(`Synced tabs for current space ${state.currentSpaceId}`);
    } catch(error) {
        console.error("Error syncing current space tabs", error);
    }
}


// --- Event Listeners: Chrome API ---

chrome.runtime.onStartup.addListener(initializeState);
chrome.runtime.onInstalled.addListener(async (details) => {
  await initializeState();
  if (details.reason === 'install') {
    console.log('Archrome installed.');
  }
});


chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(error => console.error(error));

chrome.tabs.onCreated.addListener(async (tab) => {
  if (state.isSwitching || !state.currentSpaceId) return;
  const space = state.spaces.find(s => s.id === state.currentSpaceId);
  if (space && !space.openTabs.some(t => t.id === tab.id)) {
    space.openTabs.push({ id: tab.id, url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl });
    await storeTabs(state.currentSpaceId, space.openTabs);
    await notifySidebar('stateUpdated', await getSidebarState());
  }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  if (state.isSwitching || !state.currentSpaceId) return;
  const space = state.spaces.find(s => s.id === state.currentSpaceId);
  if (space) {
    const initialLength = space.openTabs.length;
    space.openTabs = space.openTabs.filter(t => t.id !== tabId);
    if(space.openTabs.length < initialLength) {
        await storeTabs(state.currentSpaceId, space.openTabs);
        await notifySidebar('stateUpdated', await getSidebarState());
    }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (state.isSwitching || !state.currentSpaceId) return;

    if (changeInfo.status === 'complete' || changeInfo.title) {
        const space = state.spaces.find(s => s.id === state.currentSpaceId);
        if (space) {
            const tabIndex = space.openTabs.findIndex(t => t.id === tabId);
            if (tabIndex !== -1) {
                space.openTabs[tabIndex] = { id: tab.id, url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl };
                await storeTabs(state.currentSpaceId, space.openTabs);
                await notifySidebar('stateUpdated', await getSidebarState());
            }
        }
    }
});


chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
    await initializeState();
    await notifySidebar('stateUpdated', await getSidebarState());
});
chrome.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
    await initializeState();
    await notifySidebar('stateUpdated', await getSidebarState());
});
chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
    await initializeState();
    await notifySidebar('stateUpdated', await getSidebarState());
});
chrome.bookmarks.onMoved.addListener(async (id, moveInfo) => {
    await initializeState();
    await notifySidebar('stateUpdated', await getSidebarState());
});


// --- Event Listeners: Message Passing from Sidebar ---

async function getSidebarState() {
  if (state.spaces.length === 0) {
      await initializeState();
  }
  // Return a copy to prevent mutation
  return JSON.parse(JSON.stringify(state));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Use a modern async approach
  const messageHandler = async () => {
    console.log('Message received:', request.action);
    switch (request.action) {
      case 'getState':
        return await getSidebarState();
      
      case 'switchSpace':
        await switchSpace(request.data.spaceId);
        return true;

      case 'addBookmark':
        const { parentId, title, url } = request.data;
        return await chrome.bookmarks.create({ parentId, title, url });

      case 'deleteBookmark':
        return await chrome.bookmarks.remove(request.data.bookmarkId);

      case 'createTab':
        return await chrome.tabs.create({ url: request.data.url });

      case 'closeTab':
        return await chrome.tabs.remove(request.data.tabId);
      
      case 'createSpace':
        const { newSpaceName } = request.data;
        const newFolder = await chrome.bookmarks.create({ parentId: '1', title: newSpaceName });
        await initializeState(); // Re-init to pick up the new space
        await switchSpace(newFolder.id); // Switch to the new space
        return true;

      default:
        console.warn('Unknown message action:', request.action);
        return null;
    }
  };

  messageHandler()
    .then(sendResponse)
    .catch(error => {
      console.error(`Error handling message ${request.action}:`, error);
      sendResponse({ error: error.message });
    });

  return true; // Indicates async response
});

console.log('Archrome background script loaded.');
