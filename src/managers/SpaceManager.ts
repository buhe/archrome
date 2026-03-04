/**
 * Space Manager - Core module for managing spaces (bookmark folders)
 * Handles space loading, switching, and tab synchronization
 */

import type { Space, TabData, BookmarkData, SwitchMetric, AppEvent, EventListener } from '@types/index';
import { EventType, SwitchStatus, DEFAULT_CONFIG } from '@types/index';
import { storageManager } from './StorageManager';
import { bookmarkManager } from './BookmarkManager';
import { tabManager } from './TabManager';
import { debounce, formatDuration } from '@utils/index';
import { logger } from '@utils/index';

/**
 * Space Manager state
 */
interface SpaceManagerState {
  currentSpaceId: string | null;
  spaces: Space[];
  pinnedBookmarks: BookmarkData[];
  isSwitching: boolean;
  switchStartTime: number | null;
}

/**
 * Space Manager class
 */
export class SpaceManager {
  private state: SpaceManagerState;
  private config: typeof DEFAULT_CONFIG;
  private eventListeners: Map<EventType, Set<EventListener>>;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private debounceSwitch: (spaceId: string) => void;

  constructor() {
    this.state = {
      currentSpaceId: null,
      spaces: [],
      pinnedBookmarks: [],
      isSwitching: false,
      switchStartTime: null,
    };
    this.config = DEFAULT_CONFIG;
    this.eventListeners = new Map();

    // Create debounced switch function
    this.debounceSwitch = debounce(this.switchSpace.bind(this), this.config.switchDebounceMs);

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Initialize the space manager
   */
  async initialize(): Promise<void> {
    logger.info('SpaceManager', 'Initializing');

    // Load pinned bookmarks
    await this.loadPinnedBookmarks();

    // Load spaces
    await this.loadSpaces();

    // Restore last active space or load first space
    const lastActiveSpaceId = await storageManager.getLastActiveSpace();

    if (lastActiveSpaceId && this.hasSpace(lastActiveSpaceId)) {
      await this.switchSpace(lastActiveSpaceId);
    } else if (this.state.spaces.length > 0) {
      await this.switchSpace(this.state.spaces[0].id);
    }

    logger.info('SpaceManager', 'Initialized', {
      spaceCount: this.state.spaces.length,
      currentSpaceId: this.state.currentSpaceId,
    });
  }

  /**
   * Load all spaces from bookmark folders
   */
  async loadSpaces(): Promise<void> {
    try {
      const folders = await bookmarkManager.getSpaceFolders();

      this.state.spaces = await Promise.all(
        folders
          .filter((folder) => !bookmarkManager.isPinFolder(folder))
          .map(async (folder) => {
            const spaceInfo = bookmarkManager.folderToSpace(folder);
            const bookmarks = await bookmarkManager.getFolderBookmarks(folder.id);
            const storedTabs = await storageManager.getStoredTabs(folder.id);

            return {
              id: spaceInfo.id,
              icon: spaceInfo.icon,
              name: spaceInfo.name,
              bookmarks,
              openTabs: storedTabs,
            };
          }),
      );

      logger.info('SpaceManager', 'Spaces loaded', {
        count: this.state.spaces.length,
      });

      this.emitEvent({
        type: EventType.BOOKMARKS_UPDATED,
        timestamp: Date.now(),
        spaceId: 'all',
        bookmarks: this.state.spaces.flatMap((s) => s.bookmarks),
      });
    } catch (error) {
      logger.error('SpaceManager', 'Error loading spaces', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Load pinned bookmarks
   */
  async loadPinnedBookmarks(): Promise<void> {
    try {
      this.state.pinnedBookmarks = await bookmarkManager.getPinnedBookmarks();
      logger.debug('SpaceManager', 'Pinned bookmarks loaded', {
        count: this.state.pinnedBookmarks.length,
      });
    } catch (error) {
      logger.error('SpaceManager', 'Error loading pinned bookmarks', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Switch to a different space
   */
  async switchSpace(newSpaceId: string): Promise<void> {
    const switchStart = Date.now();
    let metricsIndex = -1;
    let operationSuccess = false;

    // Check for stale switching state
    if (this.isStateStale()) {
      logger.warn('SpaceManager', 'Detected stale switching state, resetting', {
        elapsed: this.state.switchStartTime ? Date.now() - this.state.switchStartTime : null,
      });
      this.resetSwitchingState();
    }

    // Ignore if already switching or same space
    if (this.state.isSwitching || this.state.currentSpaceId === newSpaceId) {
      logger.debug('SpaceManager', 'Switch ignored', {
        isSwitching: this.state.isSwitching,
        currentSpaceId: this.state.currentSpaceId,
        newSpaceId,
      });
      return;
    }

    // Set switching state
    this.state.isSwitching = true;
    this.state.switchStartTime = Date.now();

    const oldSpaceId = this.state.currentSpaceId;

    try {
      logger.info('SpaceManager', 'Starting space switch', {
        fromSpace: oldSpaceId,
        toSpace: newSpaceId,
      });

      // Track switch metrics
      metricsIndex = await this.trackSwitchStart(newSpaceId);

      // Get space objects
      const newSpace = this.getSpace(newSpaceId);
      const oldSpace = oldSpaceId ? this.getSpace(oldSpaceId) : null;

      if (!newSpace) {
        throw new Error(`Space not found: ${newSpaceId}`);
      }

      // Update current space ID
      this.state.currentSpaceId = newSpaceId;

      // Emit space changed event
      this.emitEvent({
        type: EventType.SPACE_CHANGED,
        timestamp: Date.now(),
        spaceId: newSpaceId,
        previousSpaceId: oldSpaceId ?? undefined,
      });

      // Step 1: Close old space tabs
      let closedTabCount = 0;
      if (oldSpace && oldSpace.openTabs.length > 0) {
        closedTabCount = await this.closeOldSpaceTabs(oldSpace);
      }

      // Step 2: Restore new space tabs
      let restoredTabs: chrome.tabs.Tab[] = [];
      if (newSpace.openTabs && newSpace.openTabs.length > 0) {
        restoredTabs = await this.restoreNewSpaceTabs(newSpace);
      } else {
        // Create empty tab if space has no tabs
        const newTab = await tabManager.createTab('about:blank', true);
        if (newTab) {
          restoredTabs = [newTab];
        }
      }

      // Update space with restored tabs
      newSpace.openTabs = restoredTabs.map((tab) => tabManager.chromeTabToTabData(tab));

      // Activate first tab if available
      if (restoredTabs.length > 0) {
        await tabManager.updateTab(restoredTabs[0].id, { active: true });
      }

      // Store and emit
      await storageManager.storeTabsImmediate(newSpaceId, newSpace.openTabs);

      this.emitEvent({
        type: EventType.TABS_UPDATED,
        timestamp: Date.now(),
        spaceId: newSpaceId,
        tabs: newSpace.openTabs,
      });

      // Save last active space
      await storageManager.setLastActiveSpace(newSpaceId);

      operationSuccess = true;

      logger.info('SpaceManager', 'Space switch completed', {
        spaceId: newSpaceId,
        closedTabCount,
        restoredTabCount: restoredTabs.length,
        duration: Date.now() - switchStart,
      });
    } catch (error) {
      logger.critical('SpaceManager', 'Space switch failed', {
        fromSpace: oldSpaceId,
        toSpace: newSpaceId,
        error: error instanceof Error ? error.message : String(error),
        elapsed: Date.now() - switchStart,
      });

      // Attempt to restore previous state
      if (oldSpaceId && this.state.currentSpaceId === newSpaceId) {
        this.state.currentSpaceId = oldSpaceId;
        logger.warn('SpaceManager', 'Restored previous space ID due to error');
      }
    } finally {
      // Reset switching state
      this.state.isSwitching = false;
      this.state.switchStartTime = null;

      // Track switch end
      const duration = Date.now() - switchStart;
      if (metricsIndex >= 0) {
        await this.trackSwitchEnd(metricsIndex, operationSuccess ? 'success' : 'failed', {
          totalDuration: duration,
        });
      }

      // Warn if switch took too long
      if (duration > 10000) {
        logger.warn('SpaceManager', 'Space switch took unusually long', {
          spaceId: newSpaceId,
          duration,
          threshold: 10000,
        });
      }
    }
  }

  /**
   * Close tabs for old space when switching
   */
  private async closeOldSpaceTabs(oldSpace: Space): Promise<number> {
    const stepStart = Date.now();

    try {
      const currentTabs = await tabManager.getAllTabs();
      const currentTabIds = new Set(currentTabs.map((t) => t.id));
      const tabsToClose = oldSpace.openTabs.filter((t) => currentTabIds.has(t.id));

      logger.info('SpaceManager', 'Closing old space tabs', {
        totalOldTabs: oldSpace.openTabs.length,
        tabsToClose: tabsToClose.length,
      });

      const closedCount = await tabManager.closeTabsBatch(tabsToClose.map((t) => t.id));

      logger.info('SpaceManager', 'Old space tabs closed', {
        count: closedCount,
        duration: Date.now() - stepStart,
      });

      return closedCount;
    } catch (error) {
      logger.error('SpaceManager', 'Error closing old space tabs', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Restore tabs for new space when switching
   */
  private async restoreNewSpaceTabs(newSpace: Space): Promise<chrome.tabs.Tab[]> {
    const stepStart = Date.now();

    try {
      logger.info('SpaceManager', 'Restoring new space tabs', {
        totalStoredTabs: newSpace.openTabs.length,
      });

      const restoredTabs = await tabManager.restoreTabs(newSpace.openTabs);

      logger.info('SpaceManager', 'New space tabs restored', {
        restoredCount: restoredTabs.length,
        duration: Date.now() - stepStart,
      });

      return restoredTabs;
    } catch (error) {
      logger.error('SpaceManager', 'Error restoring new space tabs', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Create a new space (folder)
   */
  async createSpace(name: string): Promise<Space | null> {
    try {
      const bookmarkBar = await bookmarkManager.getBookmarksBar();
      if (!bookmarkBar) {
        throw new Error('Bookmarks Bar not found');
      }

      const folder = await bookmarkManager.createFolder(bookmarkBar.id, name);

      if (!folder) {
        throw new Error('Failed to create folder');
      }

      // Add to spaces
      const spaceInfo = bookmarkManager.folderToSpace(folder);
      const newSpace: Space = {
        id: spaceInfo.id,
        icon: spaceInfo.icon,
        name: spaceInfo.name,
        bookmarks: [],
        openTabs: [],
      };

      this.state.spaces.push(newSpace);

      logger.info('SpaceManager', 'Space created', { spaceId: newSpace.id, name });

      this.emitEvent({
        type: EventType.SPACE_CREATED,
        timestamp: Date.now(),
        space: newSpace,
      });

      return newSpace;
    } catch (error) {
      logger.error('SpaceManager', 'Error creating space', {
        name,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Delete a space
   */
  async deleteSpace(spaceId: string): Promise<boolean> {
    try {
      await bookmarkManager.deleteFolder(spaceId);
      await storageManager.clearSpaceData(spaceId);

      // Remove from spaces
      this.state.spaces = this.state.spaces.filter((s) => s.id !== spaceId);

      // If current space was deleted, switch to another
      if (this.state.currentSpaceId === spaceId) {
        if (this.state.spaces.length > 0) {
          await this.switchSpace(this.state.spaces[0].id);
        } else {
          this.state.currentSpaceId = null;
        }
      }

      logger.info('SpaceManager', 'Space deleted', { spaceId });

      this.emitEvent({
        type: EventType.SPACE_DELETED,
        timestamp: Date.now(),
        spaceId,
      });

      return true;
    } catch (error) {
      logger.error('SpaceManager', 'Error deleting space', {
        spaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Add a tab to the current space
   */
  async addTabToCurrentSpace(tab: chrome.tabs.Tab): Promise<void> {
    if (!this.state.currentSpaceId) {
      return;
    }

    const space = this.getSpace(this.state.currentSpaceId);
    if (!space) {
      return;
    }

    const tabData = tabManager.chromeTabToTabData(tab);

    // Check if tab is already tracked
    if (!space.openTabs.find((t) => t.id === tab.id)) {
      space.openTabs.push(tabData);
      await storageManager.storeTabs(this.state.currentSpaceId, space.openTabs);

      this.emitEvent({
        type: EventType.TABS_UPDATED,
        timestamp: Date.now(),
        spaceId: this.state.currentSpaceId,
        tabs: space.openTabs,
      });
    }
  }

  /**
   * Remove a tab from a space
   */
  async removeTabFromSpace(spaceId: string, tabId: number): Promise<void> {
    const space = this.getSpace(spaceId);
    if (!space) {
      return;
    }

    const initialLength = space.openTabs.length;
    space.openTabs = space.openTabs.filter((t) => t.id !== tabId);

    if (space.openTabs.length < initialLength) {
      await storageManager.storeTabs(spaceId, space.openTabs);

      this.emitEvent({
        type: EventType.TABS_UPDATED,
        timestamp: Date.now(),
        spaceId,
        tabs: space.openTabs,
      });
    }
  }

  /**
   * Update a tab in a space
   */
  async updateTabInSpace(spaceId: string, tab: chrome.tabs.Tab): Promise<void> {
    const space = this.getSpace(spaceId);
    if (!space) {
      return;
    }

    const tabIndex = space.openTabs.findIndex((t) => t.id === tab.id);

    if (tabIndex !== -1) {
      space.openTabs[tabIndex] = tabManager.chromeTabToTabData(tab);
      await storageManager.storeTabs(spaceId, space.openTabs);

      this.emitEvent({
        type: EventType.TABS_UPDATED,
        timestamp: Date.now(),
        spaceId,
        tabs: space.openTabs,
      });
    }
  }

  /**
   * Move a tab to a different space
   */
  async moveTabToSpace(tabId: number, fromSpaceId: string, toSpaceId: string): Promise<boolean> {
    try {
      const fromSpace = this.getSpace(fromSpaceId);
      const toSpace = this.getSpace(toSpaceId);

      if (!fromSpace || !toSpace) {
        return false;
      }

      const tab = fromSpace.openTabs.find((t) => t.id === tabId);
      if (!tab) {
        return false;
      }

      // Remove from source space
      fromSpace.openTabs = fromSpace.openTabs.filter((t) => t.id !== tabId);
      await storageManager.storeTabsImmediate(fromSpaceId, fromSpace.openTabs);

      // Add to target space
      toSpace.openTabs.push(tab);
      await storageManager.storeTabsImmediate(toSpaceId, toSpace.openTabs);

      logger.info('SpaceManager', 'Tab moved to space', {
        tabId,
        fromSpaceId,
        toSpaceId,
      });

      return true;
    } catch (error) {
      logger.error('SpaceManager', 'Error moving tab to space', {
        tabId,
        fromSpaceId,
        toSpaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Reload bookmarks for all spaces
   */
  async reloadBookmarks(): Promise<void> {
    await this.loadSpaces();
    await this.loadPinnedBookmarks();
  }

  /**
   * Get the current space
   */
  getCurrentSpace(): Space | null {
    if (!this.state.currentSpaceId) {
      return null;
    }
    return this.getSpace(this.state.currentSpaceId);
  }

  /**
   * Get a space by ID
   */
  getSpace(spaceId: string): Space | null {
    return this.state.spaces.find((s) => s.id === spaceId) || null;
  }

  /**
   * Get all spaces
   */
  getSpaces(): Space[] {
    return [...this.state.spaces];
  }

  /**
   * Get pinned bookmarks
   */
  getPinnedBookmarks(): BookmarkData[] {
    return [...this.state.pinnedBookmarks];
  }

  /**
   * Check if a space exists
   */
  hasSpace(spaceId: string): boolean {
    return this.state.spaces.some((s) => s.id === spaceId);
  }

  /**
   * Check if currently switching spaces
   */
  isSwitching(): boolean {
    return this.state.isSwitching;
  }

  /**
   * Get current space ID
   */
  getCurrentSpaceId(): string | null {
    return this.state.currentSpaceId;
  }

  /**
   * Trigger debounced space switch
   */
  triggerSwitch(spaceId: string): void {
    this.debounceSwitch(spaceId);
  }

  /**
   * Add event listener
   */
  on<T extends AppEvent>(eventType: T['type'], listener: EventListener<T>): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener as EventListener);
  }

  /**
   * Remove event listener
   */
  off<T extends AppEvent>(eventType: T['type'], listener: EventListener<T>): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(listener as EventListener);
    }
  }

  /**
   * Emit event to all listeners
   */
  private emitEvent(event: AppEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          logger.error('SpaceManager', 'Error in event listener', {
            eventType: event.type,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  /**
   * Track switch start
   */
  private async trackSwitchStart(toSpace: string): Promise<number> {
    const metric: SwitchMetric = {
      startTime: Date.now(),
      fromSpace: this.state.currentSpaceId ?? undefined,
      toSpace,
      status: 'started',
    };

    try {
      const metrics = await storageManager.getSwitchMetrics();
      metrics.push(metric);

      if (metrics.length > this.config.maxMetrics) {
        metrics.splice(0, metrics.length - this.config.maxMetrics);
      }

      await storageManager.storeSwitchMetrics(metrics);
      return metrics.length - 1;
    } catch {
      return -1;
    }
  }

  /**
   * Track switch end
   */
  private async trackSwitchEnd(index: number, status: SwitchStatus, details?: {
    totalDuration: number;
  }): Promise<void> {
    if (index < 0) return;

    try {
      const metrics = await storageManager.getSwitchMetrics();

      if (metrics[index]) {
        metrics[index].endTime = Date.now();
        metrics[index].duration = metrics[index].endTime - metrics[index].startTime;
        metrics[index].status = status;
        metrics[index].details = details;

        await storageManager.storeSwitchMetrics(metrics);
      }
    } catch (error) {
      logger.error('SpaceManager', 'Error tracking switch end', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if switching state is stale
   */
  private isStateStale(): boolean {
    if (!this.state.isSwitching || !this.state.switchStartTime) {
      return false;
    }

    return Date.now() - this.state.switchStartTime > this.config.staleTimeout;
  }

  /**
   * Reset switching state
   */
  private resetSwitchingState(): void {
    this.state.isSwitching = false;
    this.state.switchStartTime = null;
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Cleanup old data and reset stale state
   */
  private async cleanup(): Promise<void> {
    // Reset stale switching state
    if (this.isStateStale()) {
      logger.warn('SpaceManager', 'Resetting stale switching state');
      this.resetSwitchingState();
    }

    // Cleanup old storage data
    await storageManager.cleanupOldData();
  }

  /**
   * Destroy the space manager
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.eventListeners.clear();
    storageManager.clearPendingOperations();

    logger.info('SpaceManager', 'Destroyed');
  }
}

// Singleton instance
export const spaceManager = new SpaceManager();
