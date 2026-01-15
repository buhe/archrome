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
let switchSpaceTimeout = null; // ADDED: For debounce handling
let switchSpaceStartTime = null; // ADDED: Track switch start time

const bookmarksList = document.getElementById('bookmarks-list');
const tabsList = document.getElementById('tabs-list');
const spacesList = document.getElementById('spaces-list');
const pinnedList = document.getElementById('pinned-list'); // Added for pinned bookmarks

// --- Bookmarks and Spaces Logic ---
async function loadSpaces() {
  // // console.log('Loading spaces...');
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

// Key: Regular check and recovery of potentially stuck states
// Store interval ID for potential cleanup
let resetCheckInterval = setInterval(() => {
  resetIfNeeded();
}, 10000); // Check every 10 seconds
      // // console.log('Spaces loaded:', spaces);
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
      // // console.log('No bookmark bar found or no children in bookmark bar.');
      bookmarksList.innerHTML = '<li>No bookmark folders found.</li>';
    }
  } catch (error) {
    // // console.error('Error loading spaces:', error);
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
      favicon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(bookmark.url).hostname)}&sz=16`;
      favicon.onerror = () => { favicon.src = 'icons/default_favicon.png'; };
      li.appendChild(favicon);

      const textNode = document.createElement('span');
      textNode.className = 'item-text';
      textNode.textContent = bookmark.title || bookmark.url;
      li.appendChild(textNode);

      li.title = bookmark.url;
      li.addEventListener('click', (e) => {
        // Remove any existing custom context menu when a tab is normally clicked
        const existingMenu = document.getElementById('custom-context-menu');
        if (existingMenu) {
          existingMenu.remove();
        }

        if (e.target.classList.contains('delete-btn')) return;
        chrome.tabs.create({ url: bookmark.url });
      });

      const deleteBtn = document.createElement('span');
      deleteBtn.innerHTML = '&#x2715;'; // Using HTML entity for 'x'
      deleteBtn.className = 'delete-btn';
      deleteBtn.title = 'Delete bookmark';
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent li click event
        try {
          await chrome.bookmarks.remove(bookmark.id);
          space.bookmarks = space.bookmarks.filter(bm => bm.id !== bookmark.id);
          renderBookmarks(spaceId);
          // // console.log('Bookmark deleted:', bookmark.title);
        } catch (error) {
          // // console.error('Error deleting bookmark:', error);
        }
      });
      li.appendChild(deleteBtn);
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
      li.draggable = true;
      li.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', JSON.stringify({ id: tab.id, url: tab.url, title: tab.title }));
        event.dataTransfer.effectAllowed = 'move';
      });

      const favicon = document.createElement('img');
      favicon.className = 'favicon';
      if (tab.url && tab.url.startsWith('chrome://')) {
        // For all chrome:// URLs, directly use a default icon as chrome://favicon/ might be restricted.
        favicon.src = 'icons/default_favicon.png';
      } else if (tab.favIconUrl) {
        favicon.src = tab.favIconUrl;
      } else if (tab.url) {
        // Try Google's favicon service first for http/https URLs
        try {
          const hostname = new URL(tab.url).hostname;
          favicon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=16`;
        } catch (e) {
          // If URL is invalid or hostname cannot be extracted, prepare for default
          favicon.src = ''; // Will trigger onerror
        }
      } else {
        // No URL available, use default
        favicon.src = 'icons/default_favicon.png';
      }
      favicon.onerror = () => { favicon.src = 'icons/default_favicon.png'; };
      li.appendChild(favicon);

      const textNode = document.createElement('span');
      textNode.className = 'item-text';
      textNode.textContent = tab.title || tab.url;
      li.appendChild(textNode);

      li.title = tab.url;
      li.dataset.tabId = tab.id;
      li.addEventListener('click', (e) => {
        // Remove any existing custom context menu when a tab is normally clicked
        const existingMenu = document.getElementById('custom-context-menu');
        if (existingMenu) {
          existingMenu.remove();
        }

        if (e.target.classList.contains('delete-btn')) return;
        chrome.tabs.update(tab.id, { active: true });
      });

      const deleteBtn = document.createElement('span');
      deleteBtn.innerHTML = '&#x2715;'; // Using HTML entity for 'x'
      deleteBtn.className = 'delete-btn';
      deleteBtn.title = 'Close tab';
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent li click event
        try {
          await chrome.tabs.remove(tab.id)// ;
          // console.log('Tab close initiated via X button:', tab.id);
        } catch (error) {
          // console.error('Error closing tab via X button:', error);
          // Fallback UI update if onRemoved listener fails or is delayed
          const space = spaces.find(s => s.id === currentSpaceId);
          if (space) {
            space.openTabs = space.openTabs.filter(t => t.id !== tab.id);
            await storeTabs(currentSpaceId, space.openTabs);
            renderOpenTabs(currentSpaceId);
          }
        }
      });
      li.appendChild(deleteBtn);
      // Add context menu for moving tabs
      li.addEventListener('contextmenu', (e) => {
        e.preventDefault();

        // Remove any existing menu first
        const existingMenu = document.getElementById('custom-context-menu');
        if (existingMenu) {
          existingMenu.remove();
        }

        const contextMenu = document.createElement('div');
        contextMenu.id = 'custom-context-menu';
        contextMenu.className = 'custom-context-menu'; // For styling

        const moveToItem = document.createElement('div');
        moveToItem.className = 'context-menu-item';
        moveToItem.textContent = 'Move to';

        const subMenu = document.createElement('div');
        subMenu.className = 'context-submenu';

        spaces.forEach(s => {
          if (s.id !== currentSpaceId && s.name.toLowerCase() !== 'pin') { // Don't list current space or pin folder
            const spaceItem = document.createElement('div');
            spaceItem.className = 'context-menu-item'; // Can reuse item style
            spaceItem.textContent = s.name || `Space ${s.id}`;
            spaceItem.addEventListener('click', async () => {
              const tabIdToMove = parseInt(li.dataset.tabId, 10);
              const tabToMove = space.openTabs.find(t => t.id === tabIdToMove);

              if (tabToMove) {
                // 1. Remove from current space
                space.openTabs = space.openTabs.filter(t => t.id !== tabIdToMove);
                await storeTabs(currentSpaceId, space.openTabs);
                // No need to re-render current space's tabs yet, switchSpace will handle it

                // 2. Add to target space
                const targetSpace = spaces.find(ts => ts.id === s.id);
                if (targetSpace) {
                  if (!targetSpace.openTabs) targetSpace.openTabs = [];
                  targetSpace.openTabs.push(tabToMove);
                  await storeTabs(targetSpace.id, targetSpace.openTabs);
                }

                // 3. Switch to target space
                switchSpace(s.id);
              }
              contextMenu.remove(); // Close context menu
            });
            subMenu.appendChild(spaceItem);
          }
        });

        if (subMenu.children.length > 0) {
            moveToItem.appendChild(subMenu);
            // Show submenu on hover/click of moveToItem (can be CSS driven or JS)
            // For simplicity, let's make it always visible if it has items
            // Or, a simple hover effect can be added via CSS
            moveToItem.addEventListener('mouseenter', () => subMenu.style.display = 'block');
            moveToItem.addEventListener('mouseleave', () => subMenu.style.display = 'none');
            // Initial state for submenu (hidden)
            subMenu.style.display = 'none'; 
            contextMenu.appendChild(moveToItem);
        } else {
            // If no other spaces to move to, perhaps disable or don't show 'Move to'
            // For now, if no other spaces, 'Move to' won't appear if subMenu is empty
        }
        
        // Only add the menu if there are items to show
        if (contextMenu.children.length > 0) {
            document.body.appendChild(contextMenu);
            contextMenu.style.left = `${e.pageX}px`;
            contextMenu.style.top = `${e.pageY}px`;
        }

        // Close menu when clicking elsewhere
        const closeMenuHandler = (event) => {
          if (!contextMenu.contains(event.target)) {
            contextMenu.remove();
            document.removeEventListener('click', closeMenuHandler);
          }
        };
        // Use a timeout to ensure this listener doesn't immediately fire from the contextmenu event itself
        setTimeout(() => document.addEventListener('click', closeMenuHandler), 0);
      });

      tabsList.appendChild(li);
    });
  } else {
    tabsList.innerHTML = '<li>No open tabs in this space.</li>';
  }
}

// Modify the bookmarks list container to handle drop events
bookmarksList.addEventListener('dragover', (event) => {
  event.preventDefault(); // Allow drop
  event.dataTransfer.dropEffect = 'move';
});

bookmarksList.addEventListener('drop', async (event) => {
  event.preventDefault();
  if (!currentSpaceId) return;

  const space = spaces.find(s => s.id === currentSpaceId);
  if (!space) return;

  try {
    const tabData = JSON.parse(event.dataTransfer.getData('text/plain'));
    if (tabData.url && tabData.title && tabData.id) { // Check for id as well
      await chrome.bookmarks.create({
        parentId: space.id, // space.id is the bookmark folder ID
        title: tabData.title,
        url: tabData.url
      });
      // Refresh bookmarks for the current space
      const updatedBookmarkTree = await chrome.bookmarks.getSubTree(space.id);
      if (updatedBookmarkTree && updatedBookmarkTree[0] && updatedBookmarkTree[0].children) {
          space.bookmarks = updatedBookmarkTree[0].children.filter(bm => bm.url);
      }
      renderBookmarks(currentSpaceId)// ;
      // console.log('Tab dropped and bookmark created:', tabData.title);

      // Remove the tab from openTabs and close it
      const tabIdToRemove = tabData.id;
      space.openTabs = space.openTabs.filter(t => t.id !== tabIdToRemove);
      try {
        await chrome.tabs.remove(tabIdToRemove)// ;
        // console.log('Original tab closed:', tabIdToRemove);
      } catch (e) {
        // console.warn('Could not close tab, it might have been closed already:', tabIdToRemove, e);
      }
      await storeTabs(currentSpaceId, space.openTabs);
      renderOpenTabs(currentSpaceId);

    } else {
      // console.warn('Dropped data does not contain valid ID, URL and title.');
    }
  } catch (error) {
    // console.error('Error processing dropped tab:', error);
  }
});

function renderSpacesFooter() {
  spacesList.innerHTML = ''; // Clear previous spaces

  spaces.forEach(space => {
    if(space.name === 'pin') {
      return;
    }
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
    li.addEventListener('click', () => debounceSwitchSpace(space.id));
    spacesList.appendChild(li);
  });

  }

// Debounce wrapper function
function debounceSwitchSpace(newSpaceId, delay = 300) {
  if (switchSpaceTimeout) {
    clearTimeout(switchSpaceTimeout);
  }

  switchSpaceTimeout = setTimeout(() => {
    switchSpace(newSpaceId);
  }, delay);
}

async function switchSpace(newSpaceId) {
  // Key: Check and restore state before each switch
  resetIfNeeded();

  // Clear any pending timeout
  if (switchSpaceTimeout) {
    clearTimeout(switchSpaceTimeout);
    switchSpaceTimeout = null;
  }

  // Check for expired switching state (over 30 seconds considered expired)
  if (isSwitchingSpace && switchSpaceStartTime && (Date.now() - switchSpaceStartTime) > 30000) {
    // console.warn('Detected stale switching state, resetting...');
    isSwitchingSpace = false;
    switchSpaceStartTime = null;
  }

  if (isSwitchingSpace || currentSpaceId === newSpaceId) {
    // console.log(`Switch already in progress or already in space ${newSpaceId}. Ignoring.`);
    return;
  }

  isSwitchingSpace = true;
  switchSpaceStartTime = Date.now();
  let operationSuccess = false;

  try {
    // console.log(`Switching to space: ${newSpaceId}`);
    const oldSpaceId = currentSpaceId;
    currentSpaceId = newSpaceId;

    // Update UI first for immediate feedback
    try {
      renderSpacesFooter();
      renderBookmarks(newSpaceId);
    } catch (e) {
      // console.error('Error rendering UI:', e);
      // Continue even if UI fails
    }

    // Tab management with enhanced error handling
    const newSpace = spaces.find(s => s.id === newSpaceId);
    const oldSpace = spaces.find(s => s.id === oldSpaceId);

    // Step 1: Close old space tabs with smaller batches to reduce memory pressure
    if (oldSpace && oldSpace.openTabs && oldSpace.openTabs.length > 0) {
      try {
        const currentTabs = await chrome.tabs.query({});
        const currentTabIds = new Set(currentTabs.map(t => t.id));
        const tabsToClose = oldSpace.openTabs.filter(t => currentTabIds.has(t.id));

        if (tabsToClose.length > 0) {
          // Batch close tabs to improve performance and reduce memory pressure
          const tabIdsToClose = tabsToClose.map(tab => tab.id);
          try {
            // Reduce batch size to reduce memory pressure
            const batchSize = 5; // Further reduce batch size
            for (let i = 0; i < tabIdsToClose.length; i += batchSize) {
              const batch = tabIdsToClose.slice(i, i + batchSize);
              await chrome.tabs.remove(batch);
              // console.log(`Closed batch of ${batch.length} tabs from old space`);
              // Add small delay between batches to allow GC
              if (i + batchSize < tabIdsToClose.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }
          } catch (e) {
            // console.warn('Error closing tabs in batch:', e);
            // If batch close fails, fall back to individual close
            for (const tabId of tabIdsToClose) {
              try {
                await chrome.tabs.remove(tabId);
              } catch (individualError) {
                // console.warn(`Failed to close tab ${tabId}:`, individualError);
              }
            }
          }
        }
      } catch (e) {
        // console.warn('Error closing tabs from old space:', e);
      }
    }

    // Step 2: Restore new space tabs with memory-efficient approach
    if (newSpace) {
      try {
        const restoredTabs = [];

        if (newSpace.openTabs && newSpace.openTabs.length > 0) {
          // Reduce batch size and process tabs more carefully
          const maxTabsPerBatch = 3; // Further reduce batch size to reduce memory pressure
          const tabInfos = newSpace.openTabs.slice(0, 30); // Restore max 30 tabs to reduce memory pressure

          // Process tabs in smaller batches to reduce memory pressure
          for (let i = 0; i < tabInfos.length; i += maxTabsPerBatch) {
            const batch = tabInfos.slice(i, i + maxTabsPerBatch);
            try {
              // Process each tab individually to reduce memory pressure
              for (const tabInfo of batch) {
                const result = await restoreTabSafely(tabInfo);
                if (result) {
                  restoredTabs.push(result);
                }
              }

              // console.log(`Processed batch of ${batch.length} tabs, restored ${restoredTabs.length} tabs so far`);

              // Add delay between batches to allow for garbage collection
              if (i + maxTabsPerBatch < tabInfos.length) {
                await new Promise(resolve => setTimeout(resolve, 200)); // Increase delay to allow more GC time
              }
            } catch (batchError) {
              // console.warn(`Error processing batch starting at ${i}:`, batchError);
            }
          }
        } else {
          // Create empty tab if space has no tabs
          const newTab = await createTabWithRetry('about:blank', true);
          if (newTab) {
            restoredTabs.push({ id: newTab.id, url: newTab.url, title: newTab.title, favIconUrl: newTab.favIconUrl });
          }
        }

        // Update space with restored tabs
        newSpace.openTabs = restoredTabs;

        // Activate first tab if available
        if (restoredTabs.length > 0) {
          try {
            await chrome.tabs.update(restoredTabs[0].id, { active: true });
          } catch (e) {
            // console.error('Error activating first tab:', e);
          }
        }

        // Store and render with error handling
        await storeTabs(newSpace.id, newSpace.openTabs);
        renderOpenTabs(newSpace.id);

      } catch (e) {
        // console.error('Error during tab restoration:', e);
        throw e; // Re-throw to mark operation as failed
      }
    }

    // Mark operation as successful
    operationSuccess = true;

    try {
      await setLastActiveSpace(newSpaceId);
    } catch (e) {
      // console.error('Error setting last active space:', e);
    }

  } catch (error) {
    // console.error('Critical error in switchSpace:', error);
    // Attempt to restore previous state on failure
    if (oldSpaceId && currentSpaceId === newSpaceId) {
      currentSpaceId = oldSpaceId;
      // console.log('Restored previous space ID due to error');
    }
  } finally {
    isSwitchingSpace = false;
    switchSpaceStartTime = null;

    // Final cleanup and verification
    if (operationSuccess) {
      // console.log(`Successfully switched to space: ${newSpaceId}`);
    } else {
      // console.warn(`Space switch to ${newSpaceId} encountered issues`);
    }
  }
}

// Helper function to safely restore a tab
async function restoreTabSafely(tabInfo) {
  try {
    // First try to get existing tab
    let existingTab = null;
    try {
      existingTab = await chrome.tabs.get(tabInfo.id);
    } catch (e) {
      // Tab doesn't exist, will create new one
    }

    if (existingTab) {
      // Tab exists, just update it
      await chrome.tabs.update(tabInfo.id, { active: false });
      // Return minimal data to reduce memory usage
      return {
        id: tabInfo.id,
        url: existingTab.url || tabInfo.url,
        title: existingTab.title || tabInfo.title,
        favIconUrl: existingTab.favIconUrl || tabInfo.favIconUrl
      };
    } else {
      // Create new tab with enhanced validation
      if (!tabInfo.url || tabInfo.url.startsWith('chrome://') || tabInfo.url.startsWith('about:')) {
        // Skip invalid URLs and chrome:// URLs
        // console.info('Skipping invalid URL:', tabInfo.url);
        return null;
      }

      const newTab = await createTabWithRetry(tabInfo.url, false);
      if (newTab) {
        // Return minimal data to reduce memory usage
        return {
          id: newTab.id,
          url: newTab.url,
          title: newTab.title,
          favIconUrl: newTab.favIconUrl
        };
      }
    }
    return null;
  } catch (error) {
    // console.error('Error in restoreTabSafely:', error);
    return null;
  }
}

// Helper function to create tabs with retry mechanism
async function createTabWithRetry(url, active, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      // Validate URL before creating tab
      if (!url || url.startsWith('chrome://') || url.startsWith('about:')) {
        throw new Error('Invalid URL for tab creation');
      }
      return await chrome.tabs.create({ url, active });
    } catch (error) {
      // console.warn(`Tab creation attempt ${i + 1} failed:`, error);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
    }
  }
}

// Key recovery function: Reset when abnormal state is detected
function resetIfNeeded() {
  try {
    // Only check heartbeat if we have a start time to compare
    if (switchSpaceStartTime) {
      const now = Date.now();

      // If switching state is stuck for over 60 seconds, force reset
      if ((now - switchSpaceStartTime) > 60000) {
        // console.warn('Switch space timeout detected, resetting...');
        isSwitchingSpace = false;
        switchSpaceStartTime = null;
      }
    }
  } catch (error) {
    // console.error('Error in reset check:', error);
  }
}

// --- Storage Logic for Tabs and Last Active Space ---
// Use a debounced storage function to prevent too frequent writes
const debouncedStoreTabs = (() => {
  const timers = {};

  return (spaceId, tabs) => {
    // Clear previous timer for this space
    if (timers[spaceId]) {
      clearTimeout(timers[spaceId]);
    }

    // Set new timer
    timers[spaceId] = setTimeout(async () => {
      try {
        // Clean tabs data before storing to avoid quota issues
        // Limit the number of tabs stored to prevent excessive memory usage
        const limitedTabs = tabs.slice(0, 100); // Limit to 100 tabs max
        const cleanTabs = limitedTabs.map(tab => ({
          id: tab.id,
          url: tab.url,
          title: tab.title || 'Untitled',
          favIconUrl: tab.favIconUrl || null
        }));

        // Check storage quota before setting
        const serializedData = JSON.stringify(cleanTabs);
        const dataSize = new Blob([serializedData]).size;

        if (chrome.storage.local.QUOTA_BYTES && dataSize > chrome.storage.local.QUOTA_BYTES) {
          // console.warn(`Data size ${dataSize} exceeds quota, reducing data`);
          // Store minimal data if quota is exceeded
          const minimalTabs = cleanTabs.map(tab => ({
            id: tab.id,
            url: tab.url
          }));
          await chrome.storage.local.set({ [`space_${spaceId}_tabs`]: minimalTabs });
        } else {
          await chrome.storage.local.set({ [`space_${spaceId}_tabs`]: cleanTabs });
        }
        // console.log(`Tabs stored for space ${spaceId}:`, cleanTabs.length);
      } catch (error) {
        // console.error(`Error storing tabs for space ${spaceId}:`, error);
        // Continue execution even if storage fails
      } finally {
        // Clean up the timer reference
        delete timers[spaceId];
      }
    }, 300); // Debounce for 300ms
  };
})();

async function storeTabs(spaceId, tabs) {
  // Use the debounced version to prevent excessive storage operations
  debouncedStoreTabs(spaceId, tabs);
}

async function getStoredTabs(spaceId) {
  try {
    const result = await chrome.storage.local.get([`space_${spaceId}_tabs`]);
    const tabs = result[`space_${spaceId}_tabs`] || [];
    // Limit the returned tabs to prevent memory issues
    return tabs.slice(0, 100);
  } catch (error) {
    // console.error(`Error getting stored tabs for space ${spaceId}:`, error);
    return [];
  }
}

async function setLastActiveSpace(spaceId) {
    try {
        await chrome.storage.local.set({ 'last_active_space_id': spaceId });
    } catch (error) {
        // console.error('Error setting last active space:', error);
    }
}

async function getLastActiveSpace() {
    try {
        const result = await chrome.storage.local.get(['last_active_space_id']);
        return result.last_active_space_id;
    } catch (error) {
        // console.error('Error getting last active space:', error);
        return null;
    }
}

// --- Tab Event Listeners (to keep space.openTabs in sync) ---

// Removed global queue for tab operations to reduce memory usage
// Operations are now processed immediately to avoid accumulation

// When a tab is created
chrome.tabs.onCreated.addListener(async (tab) => {
    try {
        if (isSwitchingSpace) {
            // console.log('onCreated: isSwitchingSpace is true, switchSpace will handle this tab if necessary.', tab.id);
            return; // Defer to switchSpace logic during space switching
        }

        if (!currentSpaceId) return; // Only track if a space is active

        const initialUrl = tab.url || tab.pendingUrl;
        // Avoid adding tabs with internal URLs or if the URL is not yet defined.
        if (!initialUrl || initialUrl.startsWith('chrome://') || initialUrl.startsWith('about:')) {
            // console.log('Tab created with internal or undefined URL, not adding to space via onCreated:', initialUrl);
            return;
        }

        // Process immediately without queuing to reduce memory overhead
        const space = spaces.find(s => s.id === currentSpaceId);
        if (space && space.openTabs) {
            // Check if it's a tab we just opened for this space, or a genuinely new one
            if (!space.openTabs.find(t => t.id === tab.id)) {
                // console.log('Tab created (user action) and added to current space:', tab);
                const newTabInfo = { id: tab.id, url: initialUrl, title: tab.title, favIconUrl: tab.favIconUrl };

                // Use a copy to avoid direct mutation during async operations
                const updatedTabs = [...space.openTabs, newTabInfo];
                space.openTabs = updatedTabs;

                try {
                    await storeTabs(currentSpaceId, updatedTabs);
                    renderOpenTabs(currentSpaceId);
                } catch (storageError) {
                    // console.error('Storage operation failed in onCreated:', storageError);
                }
            } else {
                // console.log('onCreated: Tab already tracked or URL matched, potentially updated by onUpdated later if URL changes from pending.', tab.id);
            }
        }
    } catch (error) {
        // console.error('Error in onCreated listener:', error);
    }
});

// When a tab is removed
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    try {
        if (isSwitchingSpace) {
            // console.log('onRemoved: isSwitchingSpace is true, ignoring event.', tabId);
            return; // Do nothing during a space switch
        }

        // Logic for the current space (if any)
        if (currentSpaceId) {
            const space = spaces.find(s => s.id === currentSpaceId);
            if (space && space.openTabs) {
                const initialLength = space.openTabs.length;
                const updatedTabs = space.openTabs.filter(t => t.id !== tabId);
                if (updatedTabs.length < initialLength) {
                    // console.log('Tab removed from current space:', tabId);
                    // Update the space with the filtered tabs
                    space.openTabs = updatedTabs;

                    try {
                        await storeTabs(currentSpaceId, updatedTabs);
                        renderOpenTabs(currentSpaceId);
                    } catch (storageError) {
                        // console.error('Storage operation failed in onRemoved (current space):', storageError);
                    }
                }
            }
        }

        // Logic for inactive spaces - process with error handling
        // Process each space individually to avoid memory buildup
        for (const s of spaces) {
            if (s.id !== currentSpaceId && s.openTabs) {
                const initialLengthInactive = s.openTabs.length;
                const updatedTabs = s.openTabs.filter(t => t.id !== tabId);
                if (updatedTabs.length < initialLengthInactive) {
                    // console.log('Tab removed from inactive space:', s.id, tabId);
                    // Update the space with the filtered tabs
                    s.openTabs = updatedTabs;

                    try {
                        await storeTabs(s.id, updatedTabs);
                    } catch (error) {
                        // console.error(`Storage operation failed for space ${s.id} in onRemoved:`, error);
                    }
                }
            }
        }
    } catch (error) {
        // console.error('Error in onRemoved listener:', error);
    }
});

// When a tab is updated (e.g., URL change)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    try {
        if (isSwitchingSpace) {
            // console.log('onUpdated: isSwitchingSpace is true, ignoring event.', tabId);
            return; // Do nothing during a space switch
        }

        if (!currentSpaceId) return;

        const space = spaces.find(s => s.id === currentSpaceId);
        if (!space) return;

        let tabDataChanged = false;
        const tabIndex = space.openTabs.findIndex(t => t.id === tabId);

        if (tabIndex !== -1) {
            // Tab exists, update its info if relevant properties changed
            const currentTabData = space.openTabs[tabIndex];
            let updated = false;

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
                    // Create a new array with the updated tab to avoid direct mutation
                    const updatedTabs = [...space.openTabs];
                    updatedTabs[tabIndex] = { id: tab.id, url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl };
                    space.openTabs = updatedTabs;
                    tabDataChanged = true;
                }
            }

            if (updated) {
                tabDataChanged = true;
            }

        } else if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
            // Tab is new to this space and has completed loading with a valid URL.
            const updatedTabs = [...space.openTabs, { id: tab.id, url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl }];
            space.openTabs = updatedTabs;
            // console.log('Tab completed and added to current space:', tab);
            tabDataChanged = true;
        }

        if (tabDataChanged) {
            // console.log('Tab data changed, storing and re-rendering:', tabId, changeInfo, tab);
            try {
                await storeTabs(currentSpaceId, space.openTabs);
                renderOpenTabs(currentSpaceId);
            } catch (storageError) {
                // console.error('Storage operation failed in onUpdated:', storageError);
            }
        }
    } catch (error) {
        // console.error('Error in onUpdated listener:', error);
    }
});


// Function to render pinned bookmarks
async function renderPinnedBookmarks() {
  // console.log('Rendering pinned bookmarks...');
  pinnedList.innerHTML = ''; // Clear previous pinned bookmarks
  try {
    const bookmarkTree = await chrome.bookmarks.getTree();
    const bookmarkBar = bookmarkTree[0].children.find(node => node.id === '1'); // Bookmarks Bar

    if (bookmarkBar && bookmarkBar.children) {
      const pinFolder = bookmarkBar.children.find(node => node.title.toLowerCase() === 'pin' && node.children);
      if (pinFolder && pinFolder.children.length > 0) {
        pinFolder.children.filter(bm => bm.url).forEach(bookmark => {
          const li = document.createElement('li');
          const favicon = document.createElement('img');
          favicon.className = 'favicon';
          favicon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(bookmark.url).hostname)}&sz=16`;
          favicon.onerror = () => { favicon.src = 'icons/default_favicon.png'; };
          li.appendChild(favicon);

          const textNode = document.createElement('span');
          textNode.className = 'item-text'; // Reuse existing class for consistency
          textNode.textContent = bookmark.title || bookmark.url;
          li.appendChild(textNode);

          li.title = bookmark.url;
          li.addEventListener('click', (e) => {
        // Remove any existing custom context menu when a tab is normally clicked
        const existingMenu = document.getElementById('custom-context-menu');
        if (existingMenu) {
          existingMenu.remove();
        }

            if (e.target.classList.contains('delete-btn')) return;
            chrome.tabs.create({ url: bookmark.url });
          });

          // Optional: Add delete button for pinned items if needed, similar to other lists
          // For now, pinned items are not deletable from this view to keep it simple
          // and reflect that they are managed in the main bookmarks 'pin' folder.

          pinnedList.appendChild(li);
        });
      } else {
        pinnedList.innerHTML = '<li>No pinned bookmarks found in "pin" folder.</li>';
      }
    } else {
      pinnedList.innerHTML = '<li>Bookmark bar not found.</li>';
    }
  } catch (error) {
    // console.error('Error rendering pinned bookmarks:', error);
    pinnedList.innerHTML = '<li>Error loading pinned bookmarks.</li>';
  }
}

// Global error handler for sidebar
window.addEventListener('error', (event) => {
  // console.error('Global error in sidebar:', event.error);
  event.preventDefault();
});

window.addEventListener('unhandledrejection', (event) => {
  // console.error('Unhandled promise rejection in sidebar:', event.reason);
  event.preventDefault();
});

// Simple initial load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await renderPinnedBookmarks();
    await loadSpaces();

    // Add event listener to the green "Add Space" button
    const newSpaceBtn = document.querySelector('.new-space-btn');
    if (newSpaceBtn) {
      newSpaceBtn.addEventListener('click', async () => {
        const newSpaceName = prompt('Enter name for the new space:');
        if (newSpaceName && newSpaceName.trim() !== '') {
          try {
            // Create the new space (bookmark folder) directly under the bookmark bar (ID '1')
            const bookmarkBarId = '1';
            await chrome.bookmarks.create({
              parentId: bookmarkBarId, // Create directly under the bookmark bar
              title: newSpaceName.trim()
            });
            await loadSpaces(); // Reload spaces to reflect the new one and update UI
          } catch (error) {
            // console.error('Error creating new space:', error);
            alert('Error creating new space. Check console for details.');
          }
        }
      });
    }
  } catch (error) {
    // console.error('Error during initial load:', error);
    // Simple retry once
    setTimeout(async () => {
      try {
        await loadSpaces();
      } catch (retryError) {
        // console.error('Load retry failed:', retryError);
      }
    }, 1000);
  }
});

// Key: Regular cleanup of potentially stuck switching state to prevent permanent locking
let cleanupCheckInterval = setInterval(() => {
  if (isSwitchingSpace && switchSpaceStartTime && (Date.now() - switchSpaceStartTime) > 30000) {
    // console.error('Critical: Switching state stuck for over 30 seconds, force resetting...');
    isSwitchingSpace = false;
    switchSpaceStartTime = null;
  }
}, 5000); // Check every 5 seconds

// Cleanup function to clear intervals when sidebar is unloaded
window.addEventListener('beforeunload', () => {
  if (resetCheckInterval) {
    clearInterval(resetCheckInterval);
    resetCheckInterval = null;
  }
  if (cleanupCheckInterval) {
    clearInterval(cleanupCheckInterval);
    cleanupCheckInterval = null;
  }
});

// Also clean up when the window is hidden or page is about to be unloaded
window.addEventListener('pagehide', () => {
  if (resetCheckInterval) {
    clearInterval(resetCheckInterval);
    resetCheckInterval = null;
  }
  if (cleanupCheckInterval) {
    clearInterval(cleanupCheckInterval);
    cleanupCheckInterval = null;
  }
});