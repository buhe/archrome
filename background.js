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
  // We are removing custom logic here to avoid conflicts and user gesture issues.

  // try {
  //   if (chrome.sidePanel && typeof chrome.sidePanel.getOptions === 'function' && typeof chrome.sidePanel.setOptions === 'function' && typeof chrome.sidePanel.open === 'function') {
  //     const currentOptions = await chrome.sidePanel.getOptions({ tabId: tab.id });
  //
  //     if (currentOptions.enabled) {
  //       // If the panel is currently enabled for the tab, we want to disable it (hide it).
  //       await chrome.sidePanel.setOptions({ tabId: tab.id, enabled: false });
  //       console.log('Side panel set to disabled for tab (toggled off).');
  //     } else {
  //       // If the panel is currently disabled for the tab, we want to open it.
  //       // The open call should handle enabling it if necessary, and it's directly tied to the user gesture here.
  //       await chrome.sidePanel.open({ windowId: tab.windowId });
  //       console.log('Side panel open requested (toggled on).');
  //     }
  //   } else {
  //     console.log('Side panel API or required functions (getOptions, setOptions, open) not available.');
  //   }
  // } catch (error) {
  //   console.error('Error toggling side panel:', error);
  //   // If an error occurs, it might be beneficial to ensure the panel is at least attempted to be opened
  //   // or provide more specific feedback. For now, just logging.
  // }
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