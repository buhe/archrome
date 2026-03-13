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

/**
 * Global UI Manager instance
 */
let uiManager: UIManager | null = null;

/**
 * Initialize the application
 */
async function initializeApp(): Promise<void> {
  try {
    logger.info('App', 'Initializing Archrome sidebar');

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

    // Retry once after a delay
    setTimeout(async () => {
      try {
        logger.info('App', 'Retrying initialization...');
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
    }, 1000);
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
  setupErrorHandlers();
  setupCleanupHandlers();
  await initializeApp();
});

// Log initial load
logger.info('App', 'Sidebar script loaded', {
  version: chrome.runtime.getManifest().version,
  timestamp: new Date().toISOString(),
});
