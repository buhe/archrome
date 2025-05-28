// Helper function to check if a character is an emoji
// This is a simplified check and might need a more robust library for full Unicode emoji support
function isEmoji(char) {
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]/u;
  return emojiRegex.test(char);
}

// Function to generate a unique ID
function generateUniqueId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

let currentSpaceId = null;
let spaces = []; // Array to store space objects {id, icon, name, bookmarks, openTabs}
let isSwitchingSpace = false; // ADDED

const bookmarksList = document.getElementById('bookmarks-list');
const tabsList = document.getElementById('tabs-list');
const spacesList = document.getElementById('spaces-list');

// --- Bookmarks and Spaces Logic ---
async function loadSpaces() {
  console.log('Loading spaces...');
  try {
    const bookmarkTree = await chrome.bookmarks.getTree();
    const bookmarkBar = bookmarkTree[0].children.find(node => node.id === '1'); // '1' is usually the ID for Bookmarks Bar

    if (bookmarkBar && bookmarkBar.children) {
      spaces = bookmarkBar.children
        .filter(node => node.children) // Only consider folders
        .map(folder => {
          let icon = '●'; // Default icon
          let name = folder.title;
          if (name && name.length > 0 && isEmoji(name[0])) {
            icon = name[0];
            name = name.substring(1).trim();
          }
          return {
            id: folder.id, // Use bookmark folder ID as space ID for simplicity initially
            icon: icon,
            name: name || `Space ${folder.id}`,
            bookmarks: folder.children ? folder.children.filter(bm => bm.url) : [], // Only actual bookmarks
            openTabs: [] // Will be populated from storage or dynamically
          };
        });
      console.log('Spaces loaded:', spaces);
      await loadStoredTabsForSpaces();
      renderSpacesFooter();
      // Load the first space by default or last active space
      const lastActiveSpaceId = await getLastActiveSpace();
      if (lastActiveSpaceId && spaces.find(s => s.id === lastActiveSpaceId)) {
        switchSpace(lastActiveSpaceId);
      } else if (spaces.length > 0) {
        switchSpace(spaces[0].id);
      }
    } else {
      console.log('No bookmark bar found or no children in bookmark bar.');
      bookmarksList.innerHTML = '<li>No bookmark folders found.</li>';
    }
  } catch (error) {
    console.error('Error loading spaces:', error);
    bookmarksList.innerHTML = '<li>Error loading bookmarks.</li>';
  }
}

async function loadStoredTabsForSpaces() {
    for (const space of spaces) {
        const storedTabs = await getStoredTabs(space.id);
        space.openTabs = storedTabs || [];
    }
}

function renderBookmarks(spaceId) {
  const space = spaces.find(s => s.id === spaceId);
  bookmarksList.innerHTML = ''; // Clear previous bookmarks
  if (space && space.bookmarks.length > 0) {
    space.bookmarks.forEach(bookmark => {
      const li = document.createElement('li');
      const favicon = document.createElement('img');
      favicon.className = 'favicon';
      favicon.src = `chrome://favicon/size/16@1x/${bookmark.url}`;
      favicon.onerror = () => { favicon.src = 'icons/default_favicon.png'; }; // A default icon
      li.appendChild(favicon);
      li.appendChild(document.createTextNode(bookmark.title || bookmark.url));
      li.title = bookmark.url;
      li.addEventListener('click', () => {
        chrome.tabs.create({ url: bookmark.url });
      });
      bookmarksList.appendChild(li);
    });
  } else {
    bookmarksList.innerHTML = '<li>No bookmarks in this space.</li>';
  }
}

function renderOpenTabs(spaceId) {
  const space = spaces.find(s => s.id === spaceId);
  tabsList.innerHTML = ''; // Clear previous tabs
  if (space && space.openTabs.length > 0) {
    space.openTabs.forEach(tab => {
      const li = document.createElement('li');
      const favicon = document.createElement('img');
      favicon.className = 'favicon';
      // Attempt to get favicon, fallback if error
      favicon.src = tab.favIconUrl || `chrome://favicon/size/16@1x/${tab.url}`;
      favicon.onerror = () => { favicon.src = 'icons/default_favicon.png'; }; // A default icon

      li.appendChild(favicon);
      li.appendChild(document.createTextNode(tab.title || tab.url));
      li.title = tab.url;
      li.dataset.tabId = tab.id; // Store tabId for potential actions like closing
      li.addEventListener('click', () => {
        chrome.tabs.update(tab.id, { active: true });
        // Potentially close sidebar or switch window if needed
      });
      tabsList.appendChild(li);
    });
  } else {
    tabsList.innerHTML = '<li>No open tabs in this space.</li>';
  }
}

function renderSpacesFooter() {
  spacesList.innerHTML = ''; // Clear previous spaces
  spaces.forEach(space => {
    const li = document.createElement('li');
    // Use space.icon if it's an emoji, otherwise use first two letters of name or a default
    if (isEmoji(space.icon)) {
        li.textContent = space.icon;
    } else if (space.name && space.name.length > 0) {
        li.textContent = space.name.substring(0, 2).toUpperCase();
    } else {
        li.textContent = 'SP'; // Default placeholder if no name and no emoji
    }
    li.title = space.name;
    li.dataset.spaceId = space.id;
    if (space.id === currentSpaceId) {
      li.classList.add('active-space');
    }
    li.addEventListener('click', () => switchSpace(space.id));
    spacesList.appendChild(li);
  });
}

async function switchSpace(newSpaceId) {
  if (currentSpaceId === newSpaceId) return; // Already in this space

  isSwitchingSpace = true; // ADDED
  try { // ADDED
    console.log(`Switching to space: ${newSpaceId}`);
    const oldSpaceId = currentSpaceId;
    currentSpaceId = newSpaceId;

    // Update UI for spaces footer
    renderSpacesFooter();

    // Render bookmarks for the new space
    renderBookmarks(newSpaceId);

    // Tab management
    const newSpace = spaces.find(s => s.id === newSpaceId);
    const oldSpace = spaces.find(s => s.id === oldSpaceId);

    // Close tabs of the old space (if any)
    if (oldSpace && oldSpace.openTabs.length > 0) {
      const oldTabIds = oldSpace.openTabs.map(t => t.id);
      // Filter out tabs that might have been closed by the user manually
      const currentTabs = await chrome.tabs.query({});
      const currentTabIds = currentTabs.map(t => t.id);
      const tabsToClose = oldTabIds.filter(id => currentTabIds.includes(id));
      if (tabsToClose.length > 0) {
          try {
              await chrome.tabs.remove(tabsToClose);
              console.log('Closed tabs from old space:', tabsToClose);
          } catch (e) {
              console.warn('Some tabs might have already been closed:', e);
          }
      }
    // Note: The lines that previously cleared oldSpace.openTabs and stored it were already removed in a prior step.
    }

    // Open/restore tabs for the new space
    if (newSpace) {
      if (newSpace.openTabs && newSpace.openTabs.length > 0) { // check newSpace.openTabs exists
        for (const tabInfo of newSpace.openTabs) {
          try {
              let existingTab = null;
              try { existingTab = await chrome.tabs.get(tabInfo.id); } catch (e) { /* tab doesn't exist */ }

              if (existingTab) {
                  await chrome.tabs.update(tabInfo.id, { active: false });
              } else {
                  const newTab = await chrome.tabs.create({ url: tabInfo.url, active: false });
                  tabInfo.id = newTab.id; // Update ID in case it was restored
              }
          } catch (e) {
              console.warn(`Could not create or update tab ${tabInfo.url}:`, e);
              newSpace.openTabs = newSpace.openTabs.filter(t => t.url !== tabInfo.url);
          }
        }
        if (newSpace.openTabs.length > 0) {
          await chrome.tabs.update(newSpace.openTabs[0].id, { active: true });
        }
      } else {
        if (!newSpace.openTabs) newSpace.openTabs = []; // ADDED Ensure openTabs is an array
        const newTab = await chrome.tabs.create({ active: true });
        newSpace.openTabs.push({ id: newTab.id, url: newTab.url, title: newTab.title, favIconUrl: newTab.favIconUrl });
      }
      await storeTabs(newSpace.id, newSpace.openTabs);
      renderOpenTabs(newSpace.id);
    }
    await setLastActiveSpace(newSpaceId);
  } finally { // ADDED
    isSwitchingSpace = false; // ADDED
  } // ADDED
}

// --- Storage Logic for Tabs and Last Active Space ---
async function storeTabs(spaceId, tabs) {
  try {
    await chrome.storage.local.set({ [`space_${spaceId}_tabs`]: tabs });
    console.log(`Tabs stored for space ${spaceId}:`, tabs);
  } catch (error) {
    console.error(`Error storing tabs for space ${spaceId}:`, error);
  }
}

async function getStoredTabs(spaceId) {
  try {
    const result = await chrome.storage.local.get([`space_${spaceId}_tabs`]);
    console.log(`Tabs retrieved for space ${spaceId}:`, result[`space_${spaceId}_tabs`]);
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

// --- Tab Event Listeners (to keep space.openTabs in sync) ---

// When a tab is created
chrome.tabs.onCreated.addListener(async (tab) => {
    if (!currentSpaceId) return; // Only track if a space is active
    // Avoid adding the new tab page if it's immediately replaced or if it's a special page
    if (tab.url && tab.url.startsWith('chrome://')) return;

    const space = spaces.find(s => s.id === currentSpaceId);
    if (space) {
        // Check if it's a tab we just opened for this space, or a genuinely new one
        if (!space.openTabs.find(t => t.id === tab.id || t.url === tab.pendingUrl)) {
            console.log('Tab created and added to current space:', tab);
            space.openTabs.push({ id: tab.id, url: tab.url || tab.pendingUrl, title: tab.title, favIconUrl: tab.favIconUrl });
            await storeTabs(currentSpaceId, space.openTabs);
            renderOpenTabs(currentSpaceId);
        }
    }
});

// When a tab is removed
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    // Logic for the current space (if any)
    if (currentSpaceId) { // MODIFIED (merged !currentSpaceId check)
        const space = spaces.find(s => s.id === currentSpaceId);
        if (space && space.openTabs) { // ADDED check for space.openTabs
            const initialLength = space.openTabs.length;
            space.openTabs = space.openTabs.filter(t => t.id !== tabId);
            if (space.openTabs.length < initialLength) {
                console.log('Tab removed from current space:', tabId);
                await storeTabs(currentSpaceId, space.openTabs);
                renderOpenTabs(currentSpaceId);
            }
        }
    }

    // Logic for inactive spaces, only if not part of a space switch operation
    if (!isSwitchingSpace) { // ADDED WRAPPER
        for (const s of spaces) {
            if (s.id !== currentSpaceId && s.openTabs) { // ADDED check for s.openTabs
                const initialLengthInactive = s.openTabs.length;
                s.openTabs = s.openTabs.filter(t => t.id !== tabId);
                if (s.openTabs.length < initialLengthInactive) {
                    console.log('Tab removed from inactive space:', s.id, tabId);
                    await storeTabs(s.id, s.openTabs);
                }
            }
        }
    } // ADDED WRAPPER
});

// When a tab is updated (e.g., URL change)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!currentSpaceId) return;

    const space = spaces.find(s => s.id === currentSpaceId);
    if (!space) return;

    let tabDataChanged = false;
    const tabIndex = space.openTabs.findIndex(t => t.id === tabId);

    if (tabIndex !== -1) {
        // Tab exists, update its info if relevant properties changed
        const currentTabData = space.openTabs[tabIndex];
        let updated = false; // Flag to track if currentTabData was modified in this block

        // Check for specific changes and update currentTabData
        if (changeInfo.url && currentTabData.url !== tab.url) {
            currentTabData.url = tab.url;
            updated = true;
        }
        if (changeInfo.title && currentTabData.title !== tab.title) {
            currentTabData.title = tab.title;
            updated = true;
        }
        if (changeInfo.favIconUrl && currentTabData.favIconUrl !== tab.favIconUrl) {
            currentTabData.favIconUrl = tab.favIconUrl;
            updated = true;
        }

        // If status is complete, ensure all data is fresh from the 'tab' object.
        if (changeInfo.status === 'complete') {
            if (currentTabData.url !== tab.url ||
                currentTabData.title !== tab.title ||
                currentTabData.favIconUrl !== tab.favIconUrl ||
                currentTabData.id !== tab.id) {
                space.openTabs[tabIndex] = { id: tab.id, url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl };
                updated = true; 
            }
        }
        
        if (updated) {
            // If we directly modified currentTabData, it's already part of space.openTabs[tabIndex].
            // If we replaced space.openTabs[tabIndex], that's also fine.
            tabDataChanged = true;
        }

    } else if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
        // Tab is new to this space and has completed loading with a valid URL.
        space.openTabs.push({ id: tab.id, url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl });
        console.log('Tab completed and added to current space:', tab);
        tabDataChanged = true;
    }

    if (tabDataChanged) {
        console.log('Tab data changed, storing and re-rendering:', tabId, changeInfo, tab);
        await storeTabs(currentSpaceId, space.openTabs);
        renderOpenTabs(currentSpaceId);
    }
});


// Initial load
document.addEventListener('DOMContentLoaded', loadSpaces);