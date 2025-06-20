// background.js

// When the extension is installed or upgraded
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed or updated:', details);

  // Ensure the side panel opens on action click by default.
  // This is often the default behavior if a side_panel is defined in manifest.json,
  // but explicitly setting it can help ensure consistency.
  if (chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === 'function') {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      console.log('Side panel behavior set to open on action click.');
    } catch (error) {
      console.error('Error setting side panel behavior:', error);
    }
  }

  // Perform any first-time setup or migration tasks here
  if (details.reason === 'install') {
    console.log('Archrome installed. User can open sidebar via toolbar icon or Alt+Q.');
  }
});

// Listen for clicks on the browser action icon (toolbar icon)
chrome.action.onClicked.addListener(async (tab) => {
  console.log('Browser action icon clicked. Default behavior should handle side panel toggle.');
  // With `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` set,
  // the browser should handle opening and closing the side panel on action click.
});

// Optional: Listen for messages from the sidebar or other parts of the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in background script:', request);
  if (request.action === "exampleAction") {
    // Process the action
    sendResponse({ status: "success", data: "Processed in background" });
  }
  return true; // Indicates that the response will be sent asynchronously
});

// Store last accessed time for tabs
const tabLastAccessed = {};

// Function to update last accessed time
function updateTabAccessTime(tabId) {
  tabLastAccessed[tabId] = Date.now();
  chrome.storage.local.set({ tabLastAccessed }); // Persist for robustness
}

// Listen for new tab
chrome.tabs.onCreated.addListener(activeInfo => {
  updateTabAccessTime(activeInfo.tabId);
});

// Listen for tab updates (e.g., URL change)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Update access time if the tab is loaded and active, or if its URL changes
  // Avoid updating for minor changes like 'favIconUrl' when tab is not active
  // if (changeInfo.status === 'complete' || changeInfo.url) {
    if (tab.active) { // Prioritize active tab updates
        updateTabAccessTime(tabId);
    }
  // }
});

// Function to archive inactive tabs
async function archiveInactiveTabs() {
  console.log('Checking for inactive tabs to archive...');
  const twoDayInMilliseconds = 0.75 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Retrieve persisted access times
  const result = await chrome.storage.local.get(['tabLastAccessed', 'archivedTabs', 'spaces']);
  const currentTabAccessTimes = result.tabLastAccessed || tabLastAccessed; // Use persisted if available
  let archivedTabs = result.archivedTabs || [];
  const spaces = result.spaces || {}; // Assuming spaces structure is { spaceId: { tabs: [...] } }

  // Get current space's tabs (this logic might need refinement based on how spaces are managed)
  // For now, let's assume we are checking all non-pinned, non-grouped tabs
  // A more robust solution would identify tabs belonging to the "Open Tabs in this Space" section of the *active* space.
  // This requires knowing the active space ID from sidebar.js, which might need inter-script communication.

  chrome.tabs.query({}, (tabs) => { // Query all tabs
    tabs.forEach(tab => {
      // Skip pinned tabs, grouped tabs, or special Chrome URLs
      if (tab.pinned || tab.groupId !== -1 || tab.url.startsWith('chrome://')) {
        return;
      }

      const lastAccessed = currentTabAccessTimes[tab.id];
      // If a tab has no access time recorded yet, or was accessed recently, skip it.
      // New tabs will get an access time when they become active or complete loading.
      if (!lastAccessed || (now - lastAccessed < twoDayInMilliseconds)) {
        return;
      }

      // Check if this tab is part of the 'Open Tabs in this Space' for any space
      // This is a simplified check. A more accurate check would involve:
      // 1. Identifying the current active space.
      // 2. Checking if this tab.id or tab.url is listed in that space's 'open tabs' (not bookmarks/pinned).
      // For now, we'll assume any non-special tab not recently accessed is eligible if it's not already archived.
      // This part needs to be more robustly tied to the space management logic in sidebar.js.

      console.log(`Archiving tab: ${tab.title} (ID: ${tab.id})`);
      const alreadyArchived = archivedTabs.some(archivedTab => archivedTab.url === tab.url);
      if (!alreadyArchived) {
        archivedTabs.push({
          id: tab.id, // Store original tab ID for potential future use, though it's transient
          title: tab.title,
          url: tab.url,
          favIconUrl: tab.favIconUrl,
          archivedAt: now
        });
      }
      
      chrome.tabs.remove(tab.id); // Close the tab
      delete currentTabAccessTimes[tab.id]; // Remove from access tracking
    });

    chrome.storage.local.set({ archivedTabs, tabLastAccessed: currentTabAccessTimes });
  });
}

// Set up an alarm to run the check periodically (e.g., every hour)
chrome.alarms.create('archiveInactiveTabsAlarm', {
  delayInMinutes: 1, // Check 1 minute after startup/install for testing
  periodInMinutes: 10 // Then check every 10 minutes
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'archiveInactiveTabsAlarm') {
    archiveInactiveTabs();
  }
});

// Load persisted access times on startup
chrome.storage.local.get(['tabLastAccessed'], (result) => {
  if (result.tabLastAccessed) {
    Object.assign(tabLastAccessed, result.tabLastAccessed);
    console.log('Loaded persisted tab access times.');
  }
});

console.log('Archrome background script loaded with auto-archive functionality.');