/**
 * Tab Manager - Handles all Chrome tabs API operations
 */

import type { TabData, Config, TabRestoreOptions } from '@types/index';
import { DEFAULT_CONFIG } from '@types/index';
import { isValidUrl, delay, retryWithBackoff } from '@utils/index';
import { logger } from '@utils/index';

/**
 * Tab Manager class
 */
export class TabManager {
  private config: Config;
  private chromeApiReady: boolean = true;

  constructor(config: Partial<Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.checkChromeApiAvailability();
  }

  /**
   * Check if Chrome APIs are available
   */
  private checkChromeApiAvailability(): void {
    try {
      this.chromeApiReady = !!(chrome.tabs && typeof chrome.tabs.query === 'function');
    } catch {
      this.chromeApiReady = false;
    }
  }

  /**
   * Wait for Chrome API to be ready (useful after sleep/resume)
   */
  private async ensureChromeApiReady(maxWait = 3000): Promise<boolean> {
    if (this.chromeApiReady) {
      return true;
    }

    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
      this.checkChromeApiAvailability();
      if (this.chromeApiReady) {
        logger.info('TabManager', 'Chrome API became available');
        return true;
      }
      await delay(50);
    }

    logger.error('TabManager', 'Chrome API not available after wait', { maxWait });
    return false;
  }

  /**
   * Get all tabs
   */
  async getAllTabs(): Promise<chrome.tabs.Tab[]> {
    try {
      await this.ensureChromeApiReady();
      return await chrome.tabs.query({});
    } catch (error) {
      logger.error('TabManager', 'Error getting all tabs', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get tabs for the current window
   */
  async getCurrentWindowTabs(): Promise<chrome.tabs.Tab[]> {
    try {
      return await chrome.tabs.query({ currentWindow: true });
    } catch (error) {
      logger.error('TabManager', 'Error getting current window tabs', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get a specific tab by ID
   */
  async getTab(tabId: number): Promise<chrome.tabs.Tab | null> {
    try {
      return await chrome.tabs.get(tabId);
    } catch {
      return null;
    }
  }

  /**
   * Create a new tab
   */
  async createTab(url: string, active = true): Promise<chrome.tabs.Tab | null> {
    try {
      if (!isValidUrl(url)) {
        logger.warn('TabManager', 'Invalid URL for tab creation', { url });
        return null;
      }

      return await chrome.tabs.create({ url, active });
    } catch (error) {
      logger.error('TabManager', 'Error creating tab', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Create a tab with retry mechanism
   */
  async createTabWithRetry(
    url: string,
    active = true,
    options: TabRestoreOptions = {},
  ): Promise<chrome.tabs.Tab | null> {
    const retries = options.retries ?? 3;
    const retryDelay = options.delay ?? 100;

    try {
      return await retryWithBackoff(async () => {
        const tab = await this.createTab(url, active);
        if (!tab) {
          throw new Error('Failed to create tab');
        }
        return tab;
      }, retries);
    } catch (error) {
      logger.error('TabManager', 'Error creating tab with retry', {
        url,
        retries,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Update a tab
   */
  async updateTab(tabId: number, properties: chrome.tabs.UpdateProperties): Promise<boolean> {
    try {
      await chrome.tabs.update(tabId, properties);
      return true;
    } catch (error) {
      logger.error('TabManager', 'Error updating tab', {
        tabId,
        properties,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Close tabs (batch operation)
   */
  async closeTabs(tabIds: number[]): Promise<number> {
    if (tabIds.length === 0) {
      return 0;
    }

    try {
      await chrome.tabs.remove(tabIds);
      logger.info('TabManager', 'Tabs closed', { count: tabIds.length });
      return tabIds.length;
    } catch (error) {
      logger.error('TabManager', 'Error closing tabs', {
        tabIds,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Close tabs in batches with delay to reduce memory pressure
   */
  async closeTabsBatch(tabIds: number[]): Promise<number> {
    if (tabIds.length === 0) {
      return 0;
    }

    let closedCount = 0;
    const batchSize = this.config.batchSize;

    try {
      // Get currently open tabs to avoid closing already closed tabs
      const currentTabs = await this.getAllTabs();
      const currentTabIds = new Set(currentTabs.map((t) => t.id));
      const tabsToClose = tabIds.filter((id) => currentTabIds.has(id));

      if (tabsToClose.length === 0) {
        return 0;
      }

      logger.info('TabManager', 'Closing tabs in batches', {
        total: tabsToClose.length,
        batchSize,
      });

      // Close tabs in batches
      for (let i = 0; i < tabsToClose.length; i += batchSize) {
        const batch = tabsToClose.slice(i, i + batchSize);

        try {
          await this.closeTabs(batch);
          closedCount += batch.length;

          logger.debug('TabManager', 'Batch closed', {
            batchIndex: Math.floor(i / batchSize),
            batchSize: batch.length,
            totalClosed: closedCount,
          });

          // Add delay between batches to allow GC
          if (i + batchSize < tabsToClose.length) {
            await delay(this.config.batchDelay);
          }
        } catch (batchError) {
          logger.warn('TabManager', 'Error closing batch, falling back to individual close', {
            batchIndex: Math.floor(i / batchSize),
            error: batchError instanceof Error ? batchError.message : String(batchError),
          });

          // Fallback to individual close
          for (const tabId of batch) {
            try {
              await this.closeTabs([tabId]);
              closedCount++;
            } catch (individualError) {
              logger.warn('TabManager', 'Failed to close individual tab', {
                tabId,
                error: individualError instanceof Error ? individualError.message : String(individualError),
              });
            }
          }
        }
      }

      logger.info('TabManager', 'Batch tab close completed', {
        totalToClose: tabsToClose.length,
        totalClosed: closedCount,
      });

      return closedCount;
    } catch (error) {
      logger.error('TabManager', 'Error in batch tab close', {
        error: error instanceof Error ? error.message : String(error),
      });
      return closedCount;
    }
  }

  /**
   * Restore tabs from stored data
   */
  async restoreTabs(tabData: TabData[]): Promise<chrome.tabs.Tab[]> {
    const restoredTabs: chrome.tabs.Tab[] = [];

    if (!tabData || tabData.length === 0) {
      return restoredTabs;
    }

    // Limit number of tabs to restore
    const tabsToRestore = tabData.slice(0, this.config.maxRestoreTabs);

    logger.info('TabManager', 'Restoring tabs', {
      totalStored: tabData.length,
      tabsToRestore: tabsToRestore.length,
    });

    // Process tabs in smaller batches
    const batchSize = Math.min(this.config.batchSize - 2, 3); // Smaller batch for restoration

    for (let i = 0; i < tabsToRestore.length; i += batchSize) {
      const batch = tabsToRestore.slice(i, i + batchSize);

      for (const tabInfo of batch) {
        try {
          const result = await this.restoreTabSafely(tabInfo);
          if (result) {
            restoredTabs.push(result);
          }
        } catch (tabError) {
          logger.warn('TabManager', 'Failed to restore tab', {
            tabId: tabInfo.id,
            url: tabInfo.url,
            error: tabError instanceof Error ? tabError.message : String(tabError),
          });
        }
      }

      logger.debug('TabManager', 'Restore batch progress', {
        batchIndex: Math.floor(i / batchSize),
        batchSize: batch.length,
        restoredSoFar: restoredTabs.length,
      });

      // Add delay between batches
      if (i + batchSize < tabsToRestore.length) {
        await delay(this.config.batchDelay * 2);
      }
    }

    logger.info('TabManager', 'Tab restoration completed', {
      targetCount: tabsToRestore.length,
      restoredCount: restoredTabs.length,
    });

    return restoredTabs;
  }

  /**
   * Safely restore a single tab
   */
  async restoreTabSafely(tabInfo: TabData): Promise<chrome.tabs.Tab | null> {
    try {
      // First try to get existing tab
      const existingTab = await this.getTab(tabInfo.id);

      if (existingTab) {
        // Tab exists, just update it
        await this.updateTab(tabInfo.id, { active: false });
        return existingTab;
      }

      // Create new tab with validation
      if (!isValidUrl(tabInfo.url)) {
        logger.debug('TabManager', 'Skipping invalid URL', { url: tabInfo.url });
        return null;
      }

      return await this.createTabWithRetry(tabInfo.url, false);
    } catch (error) {
      logger.error('TabManager', 'Error in restoreTabSafely', {
        tabId: tabInfo.id,
        url: tabInfo.url,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Move a tab to a different position/window
   */
  async moveTab(tabId: number, properties: { index?: number; windowId?: number }): Promise<boolean> {
    try {
      await chrome.tabs.move(tabId, properties);
      return true;
    } catch (error) {
      logger.error('TabManager', 'Error moving tab', {
        tabId,
        properties,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Duplicate a tab
   */
  async duplicateTab(tabId: number): Promise<chrome.tabs.Tab | null> {
    try {
      return await chrome.tabs.duplicate(tabId);
    } catch (error) {
      logger.error('TabManager', 'Error duplicating tab', {
        tabId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Convert Chrome tab to TabData
   */
  chromeTabToTabData(tab: chrome.tabs.Tab): TabData {
    return {
      id: tab.id,
      url: tab.url || tab.pendingUrl || '',
      title: tab.title || '',
      favIconUrl: tab.favIconUrl || null,
    };
  }

  /**
   * Filter tabs to only valid ones (exclude chrome://, about:, etc.)
   */
  filterValidTabs(tabs: chrome.tabs.Tab[]): chrome.tabs.Tab[] {
    return tabs.filter((tab) => {
      const url = tab.url || tab.pendingUrl;
      return isValidUrl(url);
    });
  }

  /**
   * Get tab IDs from TabData array
   */
  getTabIds(tabData: TabData[]): number[] {
    return tabData.map((t) => t.id);
  }

  /**
   * Set up event listeners for tab changes
   */
  onTabCreated(callback: (tab: chrome.tabs.Tab) => void | Promise<void>): void {
    chrome.tabs.onCreated.addListener(callback);
  }

  onTabUpdated(
    callback: (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void | Promise<void>,
  ): void {
    chrome.tabs.onUpdated.addListener(callback);
  }

  onTabRemoved(callback: (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => void | Promise<void>): void {
    chrome.tabs.onRemoved.addListener(callback);
  }

  onTabActivated(callback: (activeInfo: chrome.tabs.TabActiveInfo) => void | Promise<void>): void {
    chrome.tabs.onActivated.addListener(callback);
  }

  onTabDetached(callback: (tabId: number, detachInfo: chrome.tabs.TabDetachInfo) => void | Promise<void>): void {
    chrome.tabs.onDetached.addListener(callback);
  }

  onTabAttached(callback: (tabId: number, attachInfo: chrome.tabs.TabAttachInfo) => void | Promise<void>): void {
    chrome.tabs.onAttached.addListener(callback);
  }
}

// Singleton instance
export const tabManager = new TabManager();
