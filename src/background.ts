/**
 * Background Service Worker
 * Handles extension lifecycle, heartbeat mechanism, and side panel behavior
 */

import { DEFAULT_CONFIG } from '@types/index';
import { storageManager } from '@managers/index';
import { logger } from '@utils/index';

/**
 * Heartbeat interval to keep service worker alive
 */
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start heartbeat mechanism
 */
function startHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(() => {
    // Lightweight storage operation to keep service worker alive
    storageManager.updateHeartbeat();
  }, DEFAULT_CONFIG.heartbeatInterval);

  logger.debug('Background', 'Heartbeat started');
}

/**
 * Stop heartbeat mechanism
 */
function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  logger.debug('Background', 'Heartbeat stopped');
}

/**
 * Set side panel behavior with retry mechanism
 */
async function setPanelBehavior(retries = 3): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      if (chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === 'function') {
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
        logger.info('Background', 'Side panel behavior set to open on action click');
        return true;
      }
    } catch (error) {
      logger.warn('Background', `Attempt ${i + 1} failed to set panel behavior`, {
        error: error instanceof Error ? error.message : String(error),
      });

      if (i === retries - 1) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)));
    }
  }

  return false;
}

/**
 * Handle extension installation or update
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.info('Background', 'Extension installed or updated', {
    reason: details.reason,
  });

  // Set side panel behavior
  try {
    await setPanelBehavior();
  } catch (error) {
    logger.error('Background', 'Error setting side panel behavior', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Continue execution even if this fails
  }

  // First-time setup
  if (details.reason === 'install') {
    logger.info('Background', 'Archrome installed. User can open sidebar via toolbar icon or Alt+Q.');
  }
});

/**
 * Handle action icon click
 */
chrome.action.onClicked.addListener(async () => {
  logger.debug('Background', 'Browser action icon clicked');
  // Default behavior should handle side panel toggle
});

/**
 * Handle messages from other parts of the extension
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logger.debug('Background', 'Message received', { action: request.action });

  if (request.action === 'ping') {
    sendResponse({ status: 'pong' });
    return true;
  }

  if (request.action === 'getHeartbeat') {
    storageManager.getHeartbeat().then((heartbeat) => {
      sendResponse({ status: 'success', heartbeat });
    });
    return true;
  }

  return false;
});

/**
 * Handle service worker errors
 */
self.addEventListener('error', (event) => {
  logger.error('Background', 'Service worker error', {
    error: event.error?.message || String(event.error),
  });
  event.preventDefault();
});

self.addEventListener('unhandledrejection', (event) => {
  logger.error('Background', 'Unhandled promise rejection', {
    reason: event.reason,
  });
  event.preventDefault();
});

/**
 * Start heartbeat on startup
 */
startHeartbeat();

/**
 * Handle extension startup
 */
chrome.runtime.onStartup.addListener(() => {
  logger.info('Background', 'Service worker startup, restarting heartbeat...');
  startHeartbeat();
});

/**
 * Handle extension suspension
 */
chrome.runtime.onSuspend.addListener(() => {
  logger.info('Background', 'Service worker is being suspended, cleaning up...');
  stopHeartbeat();
});

// Log background script loaded
logger.info('Background', 'Background script loaded');
