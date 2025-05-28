// background.js

// When the extension is installed or upgraded
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed or updated:', details);
  // Perform any first-time setup or migration tasks here
  // For example, you could open the sidebar automatically on first install
  if (details.reason === 'install') {
    // Not directly opening sidebar here as it's better controlled by user click
    // or specific sidePanel API behavior if available and configured.
    console.log('Archrome installed. User can open sidebar via toolbar icon.');
  }
});

// Listen for clicks on the browser action icon (toolbar icon)
chrome.action.onClicked.addListener(async (tab) => {
  console.log('Browser action icon clicked.');
  // The sidePanel API should handle opening the panel automatically
  // if configured in manifest.json. This listener is more for custom logic if needed.
  // For Manifest V3, if a side_panel is defined, clicking the action usually opens it.
  // However, we can explicitly try to open it if that's not the default behavior or for more control.
  try {
    // Check if sidePanel API is available and try to open it for the current tab
    if (chrome.sidePanel && typeof chrome.sidePanel.open === 'function') {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      console.log('Side panel opened via action click.');
    } else {
      console.log('Side panel API not available or not configured to open on action click directly. Ensure manifest is correct.');
      // Fallback or alternative action if sidePanel isn't automatically handled
      // For example, you could open a popup or a new tab with options if sidebar isn't the goal.
    }
  } catch (error) {
    console.error('Error opening side panel:', error);
  }
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