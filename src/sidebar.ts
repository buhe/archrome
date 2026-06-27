/**
 * Main Sidebar Entry Point
 * Initializes the Archrome application
 */

// Import CSS to ensure it's processed by Vite
import './styles/sidebar.css';

import { spaceManager } from '@managers/index';
import { tabManager } from '@managers/index';
import { UIManager } from '@ui/index';
import { logger } from '@utils/index';
import { isValidUrl } from '@utils/index';
import { delay } from '@utils/index';

/**
 * Global UI Manager instance
 */
let uiManager: UIManager | null = null;

/**
 * Check if Chrome APIs are available
 */
function isChromeApiReady(): boolean {
  try {
    return !!(chrome.tabs && chrome.bookmarks && chrome.storage && chrome.runtime);
  } catch {
    return false;
  }
}

/**
 * Wait for Chrome APIs to be ready
 * This is critical after Service Worker resume from suspension
 */
async function waitForChromeApiReady(timeout = 10000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (isChromeApiReady()) {
      logger.info('App', 'Chrome APIs are ready');
      return true;
    }
    await delay(100);
  }

  logger.error('App', 'Chrome APIs not ready after timeout', { timeout });
  return false;
}

/**
 * Initialize the application
 */
async function initializeApp(): Promise<void> {
  try {
    logger.info('App', 'Initializing Archrome sidebar');

    // Wait for Chrome APIs to be ready before proceeding
    // This is critical after Service Worker resume from suspension
    const apiReady = await waitForChromeApiReady();

    if (!apiReady) {
      throw new Error('Chrome APIs failed to become ready');
    }

    // Additional delay to ensure all APIs are fully operational
    await delay(200);

    // Initialize space manager
    await spaceManager.initialize();

    // Create UI manager
    uiManager = new UIManager();

    // Setup tab event listeners
    setupTabEventListeners();

    // Initial UI render
    uiManager.updateState();

    logger.info('App', 'Archrome sidebar initialized successfully');
  } catch (error) {
    logger.critical('App', 'Error during initialization', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Retry once after a delay with API readiness check
    setTimeout(async () => {
      try {
        logger.info('App', 'Retrying initialization...');

        // Wait for APIs again before retry
        await waitForChromeApiReady();
        await delay(200);

        await spaceManager.initialize();
        if (!uiManager) {
          uiManager = new UIManager();
        }
        uiManager.updateState();
        logger.info('App', 'Retry successful');
      } catch (retryError) {
        logger.critical('App', 'Retry failed', {
          error: retryError instanceof Error ? retryError.message : String(retryError),
        });
      }
    }, 2000);
  }
}

/**
 * Setup tab event listeners
 */
function setupTabEventListeners(): void {
  // Handle tab creation
  tabManager.onTabCreated(async (tab) => {
    if (spaceManager.isSwitching()) {
      return; // Defer to switchSpace logic during space switching
    }

    const currentSpaceId = spaceManager.getCurrentSpaceId();
    if (!currentSpaceId) return;

    const initialUrl = tab.url || tab.pendingUrl;

    // Skip invalid URLs
    if (!isValidUrl(initialUrl)) {
      return;
    }

    await spaceManager.addTabToCurrentSpace(tab);
  });

  // Handle tab removal
  tabManager.onTabRemoved(async (tabId) => {
    if (spaceManager.isSwitching()) {
      return; // Do nothing during a space switch
    }

    const currentSpaceId = spaceManager.getCurrentSpaceId();
    if (currentSpaceId) {
      await spaceManager.removeTabFromSpace(currentSpaceId, tabId);
    }

    // Also remove from inactive spaces
    const spaces = spaceManager.getSpaces();
    for (const space of spaces) {
      if (space.id !== currentSpaceId) {
        await spaceManager.removeTabFromSpace(space.id, tabId);
      }
    }
  });

  // Handle tab updates
  tabManager.onTabUpdated(async (tabId, changeInfo, tab) => {
    if (spaceManager.isSwitching()) {
      return; // Do nothing during a space switch
    }

    const currentSpaceId = spaceManager.getCurrentSpaceId();
    if (!currentSpaceId) return;

    // Only update if tab status is complete or URL changed
    if (changeInfo.status === 'complete' || changeInfo.url) {
      const currentUrl = tab.url || tab.pendingUrl;

      // Check if URL is valid before adding/updating the tab
      if (!isValidUrl(currentUrl)) {
        return;
      }

      // Try to update the tab first
      const space = spaceManager.getSpace(currentSpaceId);
      const tabIndex = space?.openTabs.findIndex((t) => t.id === tab.id);

      if (tabIndex !== -1 && space) {
        // Tab exists, update it
        await spaceManager.updateTabInSpace(currentSpaceId, tab);
      } else {
        // Tab doesn't exist (e.g., started with chrome://newtab), add it
        await spaceManager.addTabToCurrentSpace(tab);
      }
    }
  });
}

/**
 * Cleanup function for beforeunload
 */
function cleanup(): void {
  logger.info('App', 'Cleaning up...');

  if (uiManager) {
    uiManager.destroy();
    uiManager = null;
  }

  spaceManager.destroy();

  logger.info('App', 'Cleanup completed');
}

/**
 * Setup global error handlers
 */
function setupErrorHandlers(): void {
  // Handle global errors
  window.addEventListener('error', (event) => {
    logger.error('App', 'Global error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
    event.preventDefault();
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('App', 'Unhandled promise rejection', {
      reason: event.reason,
    });
    event.preventDefault();
  });
}

/**
 * Setup cleanup handlers
 */
function setupCleanupHandlers(): void {
  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanup);

  // Cleanup on page hide
  window.addEventListener('pagehide', cleanup);
}

/**
 * Bootstrap the application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    setupErrorHandlers();
    setupCleanupHandlers();
    await initializeApp();
  } catch (error) {
    logger.critical('App', 'Fatal error during bootstrap', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Display user-friendly error message
    document.body.innerHTML = `
      <div style="padding: 20px; text-align: center; font-family: system-ui;">
        <h2>Archrome Initialization Failed</h2>
        <p>Please reload the page. If the problem persists, restart Chrome.</p>
        <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; cursor: pointer;">
          Reload
        </button>
      </div>
    `;
  }
});

// Log initial load
logger.info('App', 'Sidebar script loaded', {
  version: chrome.runtime.getManifest().version,
  timestamp: new Date().toISOString(),
});
