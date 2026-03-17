/**
 * Storage Manager - Handles all Chrome storage operations
 * Provides debounced storage and a unified interface for data persistence
 */

import type { TabData, SwitchMetric, Config } from '@types/index';
import { STORAGE_KEYS, DEFAULT_CONFIG } from '@types/index';
import { KeyedDebounce, cleanTabsData } from '@utils/index';
import { logger } from '@utils/index';

/**
 * Storage Manager class
 */
export class StorageManager {
  private config: Config;
  private storeDebouncer: KeyedDebounce<TabData[]>;
  private lastCleanup: number;
  private chromeApiReady: boolean = true;

  constructor(config: Partial<Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storeDebouncer = new KeyedDebounce<TabData[]>(
      this.performStoreTabs.bind(this),
      this.config.storageDebounceMs,
    );
    this.lastCleanup = Date.now();
    this.checkChromeApiAvailability();
  }

  /**
   * Check if Chrome storage API is available
   */
  private checkChromeApiAvailability(): void {
    try {
      this.chromeApiReady = !!(chrome.storage && chrome.storage.local);
    } catch {
      this.chromeApiReady = false;
    }
  }

  /**
   * Wait for Chrome API to be ready (useful after sleep/resume)
   */
  private async ensureApiReady(maxWait = 3000): Promise<boolean> {
    if (this.chromeApiReady) {
      return true;
    }

    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
      this.checkChromeApiAvailability();
      if (this.chromeApiReady) {
        logger.info('StorageManager', 'Chrome storage API became available');
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    logger.error('StorageManager', 'Chrome storage API not available after wait', { maxWait });
    return false;
  }

  /**
   * Store tabs for a space (debounced)
   */
  async storeTabs(spaceId: string, tabs: TabData[]): Promise<void> {
    // Trigger debounced storage
    this.storeDebouncer.debounce(spaceId, tabs);
  }

  /**
   * Store tabs for a space immediately (bypasses debounce)
   */
  async storeTabsImmediate(spaceId: string, tabs: TabData[]): Promise<void> {
    await this.performStoreTabs(spaceId, tabs);
  }

  /**
   * Perform the actual storage operation for tabs
   */
  private async performStoreTabs(spaceId: string, tabs: TabData[]): Promise<void> {
    try {
      // Clean and limit tabs data
      const cleanTabs = cleanTabsData(tabs, this.config.maxStoredTabs);

      // Check storage quota before setting
      const serializedData = JSON.stringify(cleanTabs);
      const dataSize = new Blob([serializedData]).size;

      const key = `${STORAGE_KEYS.SPACE_TABS_PREFIX}${spaceId}${STORAGE_KEYS.SPACE_TABS_SUFFIX}`;

      if (chrome.storage.local.QUOTA_BYTES && dataSize > chrome.storage.local.QUOTA_BYTES) {
        logger.warn('StorageManager', 'Data size exceeds quota, reducing data', {
          spaceId,
          dataSize,
          quota: chrome.storage.local.QUOTA_BYTES,
        });

        // Store minimal data if quota is exceeded
        const minimalTabs = cleanTabs.map((tab) => ({ id: tab.id, url: tab.url }));
        await chrome.storage.local.set({ [key]: minimalTabs });
      } else {
        await chrome.storage.local.set({ [key]: cleanTabs });
      }
    } catch (error) {
      logger.error('StorageManager', 'Error storing tabs', {
        spaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get stored tabs for a space
   */
  async getStoredTabs(spaceId: string): Promise<TabData[]> {
    try {
      const key = `${STORAGE_KEYS.SPACE_TABS_PREFIX}${spaceId}${STORAGE_KEYS.SPACE_TABS_SUFFIX}`;
      const result = await chrome.storage.local.get([key]);
      const tabs = (result[key] as TabData[]) || [];
      // Limit the returned tabs to prevent memory issues
      return tabs.slice(0, this.config.maxStoredTabs);
    } catch (error) {
      logger.error('StorageManager', 'Error getting stored tabs', {
        spaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Set the last active space ID
   */
  async setLastActiveSpace(spaceId: string): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.LAST_ACTIVE_SPACE]: spaceId });
    } catch (error) {
      logger.error('StorageManager', 'Error setting last active space', {
        spaceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get the last active space ID
   */
  async getLastActiveSpace(): Promise<string | null> {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.LAST_ACTIVE_SPACE]);
      return (result[STORAGE_KEYS.LAST_ACTIVE_SPACE] as string) || null;
    } catch (error) {
      logger.error('StorageManager', 'Error getting last active space', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Store switch metrics
   */
  async storeSwitchMetrics(metrics: SwitchMetric[]): Promise<void> {
    try {
      // Keep only the most recent metrics
      const trimmedMetrics = metrics.slice(-this.config.maxMetrics);
      await chrome.storage.local.set({
        [STORAGE_KEYS.SWITCH_METRICS]: trimmedMetrics,
      });
    } catch (error) {
      logger.error('StorageManager', 'Error storing switch metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get switch metrics
   */
  async getSwitchMetrics(): Promise<SwitchMetric[]> {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.SWITCH_METRICS]);
      return (result[STORAGE_KEYS.SWITCH_METRICS] as SwitchMetric[]) || [];
    } catch (error) {
      logger.error('StorageManager', 'Error getting switch metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Update heartbeat timestamp
   */
  async updateHeartbeat(): Promise<void> {
    try {
      await this.ensureApiReady();
      await chrome.storage.local.set({
        [STORAGE_KEYS.LAST_HEARTBEAT]: Date.now(),
      });
    } catch (error) {
      // Silently fail - heartbeat is not critical for functionality
      // Also refresh API availability check
      this.checkChromeApiAvailability();
    }
  }

  /**
   * Get heartbeat timestamp
   */
  async getHeartbeat(): Promise<number | null> {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.LAST_HEARTBEAT]);
      return (result[STORAGE_KEYS.LAST_HEARTBEAT] as number) || null;
    } catch {
      return null;
    }
  }

  /**
   * Clear all storage data
   */
  async clearAll(): Promise<void> {
    try {
      await chrome.storage.local.clear();
      logger.info('StorageManager', 'All storage cleared');
    } catch (error) {
      logger.error('StorageManager', 'Error clearing storage', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Clear data for a specific space
   */
  async clearSpaceData(spaceId: string): Promise<void> {
    try {
      const key = `${STORAGE_KEYS.SPACE_TABS_PREFIX}${spaceId}${STORAGE_KEYS.SPACE_TABS_SUFFIX}`;
      await chrome.storage.local.remove([key]);
      logger.info('StorageManager', 'Space data cleared', { spaceId });
    } catch (error) {
      logger.error('StorageManager', 'Error clearing space data', {
        spaceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Cleanup old data to prevent storage bloat
   */
  async cleanupOldData(): Promise<void> {
    const now = Date.now();

    // Only cleanup periodically
    if (now - this.lastCleanup < this.config.cleanupInterval) {
      return;
    }

    this.lastCleanup = now;

    try {
      // Cleanup old logs
      const logsResult = await chrome.storage.local.get([STORAGE_KEYS.LOGS]);
      const logs = (logsResult[STORAGE_KEYS.LOGS] as unknown[]) || [];
      if (logs.length > this.config.maxLogs) {
        const trimmedLogs = logs.slice(-this.config.maxLogs);
        await chrome.storage.local.set({ [STORAGE_KEYS.LOGS]: trimmedLogs });
        logger.debug('StorageManager', 'Old logs cleaned up', {
          originalCount: logs.length,
          newCount: trimmedLogs.length,
        });
      }

      // Cleanup old metrics
      const metricsResult = await chrome.storage.local.get([STORAGE_KEYS.SWITCH_METRICS]);
      const metrics = (metricsResult[STORAGE_KEYS.SWITCH_METRICS] as unknown[]) || [];
      if (metrics.length > this.config.maxMetrics) {
        const trimmedMetrics = metrics.slice(-this.config.maxMetrics);
        await chrome.storage.local.set({
          [STORAGE_KEYS.SWITCH_METRICS]: trimmedMetrics,
        });
        logger.debug('StorageManager', 'Old metrics cleaned up', {
          originalCount: metrics.length,
          newCount: trimmedMetrics.length,
        });
      }
    } catch (error) {
      logger.warn('StorageManager', 'Error during cleanup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get current storage usage
   */
  async getStorageUsage(): Promise<{ bytesInUse: number; quotaBytes: number }> {
    try {
      const bytesInUse = await chrome.storage.local.getBytesInUse();
      return {
        bytesInUse,
        quotaBytes: chrome.storage.local.QUOTA_BYTES,
      };
    } catch {
      return { bytesInUse: 0, quotaBytes: chrome.storage.local.QUOTA_BYTES };
    }
  }

  /**
   * Clear all pending debounced operations
   */
  clearPendingOperations(): void {
    this.storeDebouncer.clear();
  }
}

// Singleton instance
export const storageManager = new StorageManager();
