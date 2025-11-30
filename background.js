// background.js

let state = {
  spaces: [],
  currentSpaceId: null,
  isSwitchingSpace: false,
};

let isLoadingState = false;
let isFirstLoad = true;

// --- Utils ---
function isEmoji(char) {
  if (!char) return false;
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]/u;
  return emojiRegex.test(char);
}

// --- State Management ---

async function loadState() {
  if (isLoadingState) {
    console.log("State loading already in progress. Skipping.");
    return;
  }
  isLoadingState = true;
  console.log('Loading state from bookmarks and storage...');
  try {
    const bookmarkTree = await chrome.bookmarks.getTree();
    const bookmarkBar = bookmarkTree[0].children.find(node => node.id === '1');

    if (!bookmarkBar || !bookmarkBar.children) {
      console.log('No bookmark bar found.');
      state.spaces = [];
    } else {
        const spaceFolders = bookmarkBar.children.filter(node => node.children);
        const storedData = await chrome.storage.local.get();

        state.spaces = spaceFolders.map(folder => {
          let icon = '●';
          let name = folder.title;
          if (name && name.length > 0 && isEmoji(name[0])) {
            icon = name[0];
            name = name.substring(1).trim();
          }
          const spaceId = folder.id;
          const storedTabs = storedData[`space_${spaceId}_tabs`] || [];
          
          return {
            id: spaceId,
            icon: icon,
            name: name || `Space ${folder.id}`,
            bookmarks: folder.children ? folder.children.filter(bm => bm.url) : [],
            openTabs: storedTabs,
          };
        });
    }

    const storedData = await chrome.storage.local.get('last_active_space_id');
    const lastActiveId = storedData['last_active_space_id'];

    if (state.spaces.find(s => s.id === lastActiveId)) {
        state.currentSpaceId = lastActiveId;
    } else if (state.spaces.length > 0) {
        state.currentSpaceId = state.spaces[0].id;
    } else {
        state.currentSpaceId = null;
    }
    
    console.log('State loaded:', JSON.parse(JSON.stringify(state)));
  } catch (error) {
    console.error('Error loading state:', error);
  } finally {
    isLoadingState = false;
    if (isFirstLoad) {
        isFirstLoad = false;
        // Call sync active tabs here if needed after first load
    }
  }
}


async function storeTabs(spaceId, tabs) {
    try {
        const cleanTabs = tabs.map(tab => ({
            id: tab.id,
            url: tab.url,
            title: tab.title || 'Untitled',
            favIconUrl: tab.favIconUrl || null
        }));
        await chrome.storage.local.set({ [`space_${spaceId}_tabs`]: cleanTabs });
    } catch (error) {
        console.error(`Error storing tabs for space ${spaceId}:`, error);
    }
}

async function setLastActiveSpace(spaceId) {
    state.currentSpaceId = spaceId;
    await chrome.storage.local.set({ 'last_active_space_id': spaceId });
}

// --- Core Logic ---

async function switchSpace(newSpaceId) {
  if (state.isSwitchingSpace) {
    console.log(`Switch ignored: already switching.`);
    return;
  }
  if (state.currentSpaceId === newSpaceId) {
    // If already in the space, just sync tabs and broadcast
    console.log(`Already in space ${newSpaceId}. Syncing tabs.`);
    await syncTabsForSpace(newSpaceId);
    broadcastState();
    return;
  }

  state.isSwitchingSpace = true;
  console.log(`Switching to space: ${newSpaceId}`);

  try {
    const oldSpaceId = state.currentSpaceId;
    await setLastActiveSpace(newSpaceId);

    const newSpace = state.spaces.find(s => s.id === newSpaceId);
    const oldSpace = state.spaces.find(s => s.id === oldSpaceId);

    // Close old tabs
    if (oldSpace && oldSpace.openTabs.length > 0) {
      const tabIdsToClose = oldSpace.openTabs.map(t => t.id);
      const allTabs = await chrome.tabs.query({});
      const existingTabIds = new Set(allTabs.map(t => t.id));
      const validTabIdsToClose = tabIdsToClose.filter(id => existingTabIds.has(id));
      if (validTabIdsToClose.length > 0) {
        await chrome.tabs.remove(validTabIdsToClose);
      }
    }

    // Restore new tabs
    if (newSpace) {
      let restoredTabs = [];
      if (newSpace.openTabs.length > 0) {
        for (const tabInfo of newSpace.openTabs) {
          if (tabInfo.url && !tabInfo.url.startsWith('chrome:')) {
            try {
                const newTab = await chrome.tabs.create({ url: tabInfo.url, active: false });
                restoredTabs.push({ id: newTab.id, url: newTab.url, title: newTab.title, favIconUrl: newTab.favIconUrl });
            } catch(e) {
                console.warn("Could not create tab", tabInfo.url, e);
            }
          }
        }
      } 
      
      // If no tabs were restored (either because space was empty or all URLs failed), open a new tab.
      if (restoredTabs.length === 0) {
        const newTab = await chrome.tabs.create({ active: true });
        restoredTabs.push({ id: newTab.id, url: newTab.url, title: newTab.title, favIconUrl: newTab.favIconUrl });
      }

      newSpace.openTabs = restoredTabs;
      await storeTabs(newSpaceId, restoredTabs);

      // Activate the first tab of the new space
      if (newSpace.openTabs.length > 0) {
        await chrome.tabs.update(newSpace.openTabs[0].id, { active: true });
      }
    }
    
    broadcastState();
  } catch (error) {
    console.error('Critical error in switchSpace:', error);
  } finally {
    state.isSwitchingSpace = false;
    console.log(`Switching complete for space: ${newSpaceId}`);
  }
}

async function syncTabsForSpace(spaceId) {
    const space = state.spaces.find(s => s.id === spaceId);
    if (!space) return;

    const currentTabs = await chrome.tabs.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    const validTabs = currentTabs.filter(t => t.url && !t.url.startsWith("chrome://"));

    space.openTabs = validTabs.map(t => ({ id: t.id, url: t.url, title: t.title, favIconUrl: t.favIconUrl }));
    await storeTabs(spaceId, space.openTabs);
    console.log(`Tabs for space ${spaceId} synced.`);
}


async function ensureStateLoaded() {
    if (isFirstLoad) {
        await loadState();
    }
}

// --- Event Listeners ---

chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Extension installed or updated:', details.reason);
    await loadState();
});

chrome.runtime.onStartup.addListener(async () => {
    console.log('Browser startup. Loading initial state.');
    await loadState();
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    await ensureStateLoaded(); 

    console.log('Message received:', request.action);
    switch (request.action) {
      case 'getState':
        sendResponse(state);
        break;
      
      case 'switchSpace':
        await switchSpace(request.spaceId);
        break;

      case 'addBookmark':
        const space = state.spaces.find(s => s.id === state.currentSpaceId);
        if (space) {
          await chrome.bookmarks.create({
            parentId: space.id,
            title: request.tab.title,
            url: request.tab.url,
          });
          await chrome.tabs.remove(request.tab.id);
          // onBookmarkCreated and onRemoved will handle state updates
        }
        break;
        
      case 'deleteBookmark':
        await chrome.bookmarks.remove(request.bookmarkId);
        break;

      case 'createSpace':
        await chrome.bookmarks.create({ parentId: '1', title: request.name });
        break;

      default:
        console.warn('Unknown action:', request.action);
    }
  })();

  return true; // Indicates async response
});

function broadcastState() {
  console.log('Broadcasting state update to UI');
  chrome.runtime.sendMessage({ action: 'stateUpdated', state: state }).catch(e => {
    if (e.message?.includes("Could not establish connection")) {
        // This is expected if the sidebar is closed.
    } else {
        console.error("Error broadcasting state:", e);
    }
  });
}

// --- Chrome API Event Listeners to keep state in sync ---

chrome.tabs.onCreated.addListener(async (tab) => {
  if (state.isSwitchingSpace) return;
  await ensureStateLoaded();
  
  const space = state.spaces.find(s => s.id === state.currentSpaceId);
  if (space && tab.url && !tab.url.startsWith('chrome://') && !space.openTabs.find(t => t.id === tab.id)) {
    console.log('Tab created, adding to current space', tab.id);
    space.openTabs.push({ id: tab.id, url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl });
    await storeTabs(state.currentSpaceId, space.openTabs);
    broadcastState();
  }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  if (state.isSwitchingSpace) return;
  await ensureStateLoaded();

  let changed = false;
  for (const space of state.spaces) {
      const initialCount = space.openTabs.length;
      space.openTabs = space.openTabs.filter(t => t.id !== tabId);
      if(space.openTabs.length < initialCount) {
          console.log(`Tab ${tabId} removed from space ${space.id}`);
          await storeTabs(space.id, space.openTabs);
          changed = true;
      }
  }

  if (changed) {
    broadcastState();
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (state.isSwitchingSpace || !changeInfo.url) return;
  await ensureStateLoaded();
  
  const space = state.spaces.find(s => s.id === state.currentSpaceId);
  if (space) {
    const tabIndex = space.openTabs.findIndex(t => t.id === tabId);
    if (tabIndex !== -1) {
      console.log('Tab updated, syncing state for', tabId);
      space.openTabs[tabIndex] = { id: tab.id, url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl };
      await storeTabs(state.currentSpaceId, space.openTabs);
      broadcastState();
    }
  }
});

const reloadState = async () => {
    console.log('Bookmark change detected, reloading state.');
    await loadState();
    broadcastState();
}

chrome.bookmarks.onCreated.addListener(reloadState);
chrome.bookmarks.onRemoved.addListener(reloadState);
chrome.bookmarks.onChanged.addListener(reloadState);
chrome.bookmarks.onMoved.addListener(reloadState);

console.log('Archrome background script loaded (v3).');