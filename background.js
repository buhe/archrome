// background.js

// Store creation time for tabs
const tabCreationTimes = {};

// Function to record tab creation time
function recordTabCreationTime(tabId) {
  if (!tabCreationTimes[tabId]) { // Only record if it doesn't exist
    tabCreationTimes[tabId] = Date.now();
    chrome.storage.local.set({ tabCreationTimes }); // Persist for robustness
  }
}

// Function to initialize creation times for existing tabs on startup
async function initializeTabTimes() {
    console.log('Initializing tab creation times...');
    const result = await chrome.storage.local.get('tabCreationTimes');
    const storedTimes = result.tabCreationTimes || {};
    
    const tabs = await chrome.tabs.query({});
    const now = Date.now();
    let needsUpdate = false;
    for (const tab of tabs) {
        if (!storedTimes[tab.id]) {
            storedTimes[tab.id] = now;
            needsUpdate = true;
        }
    }
    
    if (needsUpdate) {
        await chrome.storage.local.set({ tabCreationTimes: storedTimes });
    }
    Object.assign(tabCreationTimes, storedTimes);
    console.log('Tab creation times initialized.');
}

// When the extension is installed or upgraded
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed or updated:', details);

  // Initialize times for all tabs
  await initializeTabTimes();

  if (chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === 'function') {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      console.log('Side panel behavior set to open on action click.');
    } catch (error) {
      console.error('Error setting side panel behavior:', error);
    }
  }

  if (details.reason === 'install') {
    console.log('Archrome installed. User can open sidebar via toolbar icon or Alt+Q.');
    // Set up the alarm for the first time
    chrome.alarms.create('archiveOldTabs', {
        delayInMinutes: 1, // Check shortly after install
        periodInMinutes: 60 // And then every hour
    });
  }
});

// Also initialize on browser startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Browser startup, initializing tab times.');
    initializeTabTimes();
});

// Listen for new tab
chrome.tabs.onCreated.addListener(tab => {
  recordTabCreationTime(tab.id);
});

// Clean up when a tab is closed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    delete tabCreationTimes[tabId];
    chrome.storage.local.get('tabCreationTimes', (result) => {
        const storedTimes = result.tabCreationTimes || {};
        if (storedTimes[tabId]) {
            delete storedTimes[tabId];
            chrome.storage.local.set({ tabCreationTimes: storedTimes });
        }
    });
});

// Function to archive old tabs
async function archiveOldTabs() {
  console.log('Checking for old tabs to archive...');
  const oneDayInMilliseconds = 1 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Retrieve persisted creation times and archived tabs
  const result = await chrome.storage.local.get(['tabCreationTimes', 'archivedTabs']);
  const currentTabCreationTimes = result.tabCreationTimes || tabCreationTimes;
  let archivedTabs = result.archivedTabs || [];

  const tabs = await chrome.tabs.query({});
  
  const tabsToArchiveDetails = [];
  const tabIdsToRemove = [];

  for (const tab of tabs) {
    if (tab.pinned || tab.url.startsWith('chrome://')) {
      continue;
    }

    const creationTime = currentTabCreationTimes[tab.id];
    
    if (!creationTime || (now - creationTime < oneDayInMilliseconds)) {
      continue;
    }

    console.log(`Archiving old tab: ${tab.title} (ID: ${tab.id})`);

    const archivedTab = {
      id: `archived-${Date.now()}-${Math.random()}`,
      title: tab.title,
      url: tab.url,
      favIconUrl: tab.favIconUrl || 'icons/default_favicon.png',
      archivedAt: now
    };
    tabsToArchiveDetails.push(archivedTab);
    tabIdsToRemove.push(tab.id);
  }

  if (tabIdsToRemove.length > 0) {
    try {
      await chrome.tabs.remove(tabIdsToRemove);
      
      archivedTabs.unshift(...tabsToArchiveDetails);
      
      tabIdsToRemove.forEach(tabId => {
        delete tabCreationTimes[tabId];
        delete currentTabCreationTimes[tabId];
      });

      await chrome.storage.local.set({
        archivedTabs: archivedTabs,
        tabCreationTimes: currentTabCreationTimes
      });

      console.log(`Successfully archived ${tabIdsToRemove.length} tabs.`);
    } catch (error) {
      console.error('Error archiving tabs:', error);
    }
  } else {
    console.log('No old tabs to archive.');
  }
}

// Listen for the alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'archiveOldTabs') {
    archiveOldTabs();
  }
});

// Initial setup of the alarm if it doesn't exist
chrome.alarms.get('archiveOldTabs', (alarm) => {
    if (!alarm) {
        chrome.alarms.create('archiveOldTabs', {
            delayInMinutes: 1,
            periodInMinutes: 60
        });
        console.log('Archive alarm created.');
    }
});

// Listen for clicks on the browser action icon (toolbar icon)
chrome.action.onClicked.addListener(async (tab) => {
  console.log('Browser action icon clicked. Default behavior should handle side panel toggle.');
});

// Optional: Listen for messages from the sidebar or other parts of the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in background script:', request);
  if (request.action === "exampleAction") {
    sendResponse({ status: "success", data: "Processed in background" });
  }
  return true; // Indicates that the response will be sent asynchronously
});