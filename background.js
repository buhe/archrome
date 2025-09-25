// background.js

// When the extension is installed or upgraded
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed or updated:', details);

  // Ensure the side panel opens on action click by default.
  // This is often the default behavior if a side_panel is defined in manifest.json,
  // but explicitly setting it can help ensure consistency.
  if (chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === 'function') {
    try {
      // Add retry mechanism for flaky API calls
      const setPanelBehaviorWithRetry = async (retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
            console.log('Side panel behavior set to open on action click.');
            return true;
          } catch (error) {
            console.warn(`Attempt ${i + 1} failed:`, error);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
          }
        }
      };

      await setPanelBehaviorWithRetry();
    } catch (error) {
      console.error('Error setting side panel behavior after retries:', error);
      // Continue execution even if this fails
    }
  }

  // Perform any first-time setup or migration tasks here
  if (details.reason === 'install') {
    console.log('Archrome installed. User can open sidebar via toolbar icon or Alt+Q.');
  }
});

// Keep service worker alive and responsive
let keepAliveInterval;
function startKeepAlive() {
  if (keepAliveInterval) clearInterval(keepAliveInterval);

  keepAliveInterval = setInterval(async () => {
    try {
      // Simple operation to keep service worker active
      await chrome.storage.local.get(['keep_alive']);
    } catch (error) {
      console.warn('Keep-alive check failed:', error);
    }
  }, 20000); // Check every 20 seconds
}

// Start keep-alive when extension starts
startKeepAlive();

// Clean up on extension unload
chrome.runtime.onSuspend.addListener(() => {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
  console.log('Service worker suspending...');
});

// Handle service worker errors to prevent crashes
self.addEventListener('error', (event) => {
  console.error('Service worker error:', event.error);
  event.preventDefault();
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault();
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

console.log('Archrome background script loaded.');