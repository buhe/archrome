/**
 * UI Manager - Main UI controller that manages all UI components
 * Handles rendering of bookmarks, tabs, spaces, and pinned items
 */

import type { Space, BookmarkData, TabData, AppEvent } from '@types/index';
import { EventType } from '@types/index';
import { spaceManager } from '@managers/index';
import { bookmarkManager } from '@managers/index';
import { tabManager } from '@managers/index';
import { ListItemComponent, ListComponent, ContextMenu, LogViewer } from './components';
import type { ListItemData } from './components/ListItemComponent';
import { isEmoji, getFaviconUrl, getDisplayText } from '@utils/index';
import { logger } from '@utils/index';

/**
 * UI Manager class
 */
export class UIManager {
  private pinnedList: ListComponent;
  private bookmarksList: ListComponent;
  private tabsList: ListComponent;
  private spacesList: HTMLElement;
  private logViewer: LogViewer;
  private newSpaceBtn: HTMLElement;
  private debugBtn: HTMLElement;
  private currentContextMenu: ContextMenu | null = null;
  private isRecovering: boolean = false;

  constructor() {
    // Initialize list components
    this.pinnedList = new ListComponent({
      containerId: 'pinned-list',
      emptyMessage: 'No pinned bookmarks found in "pin" folder.',
    });

    this.bookmarksList = new ListComponent({
      containerId: 'bookmarks-list',
      emptyMessage: 'No bookmarks in this space.',
      allowDrop: true,
      onDrop: this.handleTabDrop.bind(this),
    });

    this.tabsList = new ListComponent({
      containerId: 'tabs-list',
      emptyMessage: 'No open tabs in this space.',
    });

    // Get other elements
    this.spacesList = document.getElementById('spaces-list')!;
    this.newSpaceBtn = document.querySelector('.new-space-btn')!;
    this.debugBtn = document.getElementById('debug-btn')!;

    // Initialize log viewer
    this.logViewer = new LogViewer({
      modalId: 'log-viewer-modal',
      bodyId: 'log-viewer-body',
      metricsTableId: 'metrics-table',
      filterId: 'log-filter',
    });

    // Setup event listeners
    this.setupEventListeners();

    // Setup sleep/resume detection
    this.setupSleepResumeDetection();

    logger.info('UIManager', 'Initialized');
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // New space button
    this.newSpaceBtn.addEventListener('click', () => this.handleNewSpace());

    // Debug button
    this.debugBtn.addEventListener('click', () => this.logViewer.open());

    // Listen to space manager events
    spaceManager.on(EventType.SPACE_CHANGED, this.handleSpaceChanged.bind(this));
    spaceManager.on(EventType.TABS_UPDATED, this.handleTabsUpdated.bind(this));
    spaceManager.on(EventType.BOOKMARKS_UPDATED, this.handleBookmarksUpdated.bind(this));
    spaceManager.on(EventType.SPACE_CREATED, this.handleSpaceCreated.bind(this));
    spaceManager.on(EventType.SPACE_DELETED, this.handleSpaceDeleted.bind(this));

    // Listen to bookmark changes
    bookmarkManager.onBookmarkChanged(() => this.handleBookmarkChanged());

    // Setup global error handling for event listeners
    this.setupGlobalErrorHandling();
  }

  /**
   * Setup global error handling to prevent crashes
   */
  private setupGlobalErrorHandling(): void {
    // Handle uncaught errors in event callbacks
    window.addEventListener('error', (event) => {
      logger.error('UIManager', 'Uncaught error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.message || String(event.error),
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      logger.error('UIManager', 'Unhandled promise rejection', {
        reason: event.reason,
      });

      // Prevent the rejection from causing an unhandled exception
      event.preventDefault();
    });
  }

  /**
   * Setup sleep/resume detection using Page Visibility API
   * This helps detect when the computer wakes from sleep
   */
  private setupSleepResumeDetection(): void {
    let lastVisibilityTime = Date.now();

    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden) {
        const timeSinceLastVisible = Date.now() - lastVisibilityTime;

        // If page was hidden for more than 30 seconds, potential sleep/resume
        if (timeSinceLastVisible > 30000) {
          logger.info('UIManager', 'Detected potential wake from sleep', {
            timeSinceLastVisible,
          });

          // Trigger recovery
          await this.handleWakeFromSleep();
        }

        lastVisibilityTime = Date.now();
      } else {
        // Page is being hidden, record the time
        lastVisibilityTime = Date.now();
      }
    });

    // Also listen for window focus changes as additional indicator
    window.addEventListener('focus', async () => {
      if (!this.isRecovering) {
        // Refresh UI state on focus to catch any external changes
        this.updateState();
      }
    });
  }

  /**
   * Handle wake from sleep scenario
   */
  private async handleWakeFromSleep(): Promise<void> {
    if (this.isRecovering) {
      logger.debug('UIManager', 'Recovery already in progress, skipping');
      return;
    }

    this.isRecovering = true;
    this.setLoading(true);

    try {
      logger.info('UIManager', 'Starting recovery from wake from sleep');

      // Wait a bit for Chrome APIs to be ready
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Reload bookmarks
      await spaceManager.reloadBookmarks();

      // Update UI
      this.updateState();

      logger.info('UIManager', 'Recovery from wake from sleep completed');
    } catch (error) {
      logger.error('UIManager', 'Error during recovery from wake from sleep', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isRecovering = false;
      this.setLoading(false);
    }
  }

  /**
   * Render pinned bookmarks
   */
  renderPinnedBookmarks(bookmarks: BookmarkData[]): void {
    this.pinnedList.renderItems(bookmarks, (data) => {
      return new ListItemComponent({
        data,
        onClick: this.handleBookmarkClick.bind(this),
        showDeleteButton: false,
      });
    });
  }

  /**
   * Render bookmarks for a space
   */
  renderBookmarks(bookmarks: BookmarkData[]): void {
    this.bookmarksList.renderItems(bookmarks, (data) => {
      return new ListItemComponent({
        data,
        onClick: this.handleBookmarkClick.bind(this),
        onDelete: this.handleBookmarkDelete.bind(this),
        showDeleteButton: true,
      });
    });
  }

  /**
   * Render tabs for a space
   */
  renderTabs(tabs: TabData[]): void {
    this.tabsList.renderItems(tabs, (data) => {
      return new ListItemComponent({
        data,
        onClick: this.handleTabClick.bind(this),
        onDelete: this.handleTabClose.bind(this),
        onContextMenu: this.handleTabContextMenu.bind(this),
        draggable: true,
        showDeleteButton: true,
      });
    });
  }

  /**
   * Render spaces in the footer
   */
  renderSpaces(spaces: Space[], currentSpaceId: string | null): void {
    this.spacesList.innerHTML = '';

    spaces.forEach((space) => {
      // Skip pin folder
      if (space.name.toLowerCase() === 'pin') {
        return;
      }

      const li = document.createElement('li');
      li.dataset.spaceId = space.id;
      li.title = space.name;

      // Set content
      if (isEmoji(space.icon)) {
        li.textContent = space.icon;
      } else if (space.name && space.name.length > 0) {
        li.textContent = space.name.substring(0, 2).toUpperCase();
      } else {
        li.textContent = 'SP';
      }

      // Set active state
      if (space.id === currentSpaceId) {
        li.classList.add('active-space');
      }

      // Add click handler
      li.addEventListener('click', () => {
        spaceManager.triggerSwitch(space.id);
      });

      this.spacesList.appendChild(li);
    });
  }

  /**
   * Handle space changed event
   */
  private handleSpaceChanged(event: AppEvent): void {
    if (event.type !== EventType.SPACE_CHANGED) return;

    const currentSpace = spaceManager.getCurrentSpace();
    if (!currentSpace) return;

    // Render current space data
    this.renderBookmarks(currentSpace.bookmarks);
    this.renderTabs(currentSpace.openTabs);
    this.renderSpaces(spaceManager.getSpaces(), spaceManager.getCurrentSpaceId());
  }

  /**
   * Handle tabs updated event
   */
  private handleTabsUpdated(event: AppEvent): void {
    if (event.type !== EventType.TABS_UPDATED) return;

    const currentSpace = spaceManager.getCurrentSpace();
    if (!currentSpace) return;

    this.renderTabs(currentSpace.openTabs);
  }

  /**
   * Handle bookmarks updated event
   */
  private handleBookmarksUpdated(event: AppEvent): void {
    if (event.type !== EventType.BOOKMARKS_UPDATED) return;

    const currentSpace = spaceManager.getCurrentSpace();
    if (currentSpace) {
      this.renderBookmarks(currentSpace.bookmarks);
    }

    this.renderPinnedBookmarks(spaceManager.getPinnedBookmarks());
  }

  /**
   * Handle space created event
   */
  private handleSpaceCreated(event: AppEvent): void {
    if (event.type !== EventType.SPACE_CREATED) return;

    this.renderSpaces(spaceManager.getSpaces(), spaceManager.getCurrentSpaceId());
  }

  /**
   * Handle space deleted event
   */
  private handleSpaceDeleted(event: AppEvent): void {
    if (event.type !== EventType.SPACE_DELETED) return;

    this.renderSpaces(spaceManager.getSpaces(), spaceManager.getCurrentSpaceId());
  }

  /**
   * Handle bookmark changed (external change)
   */
  private async handleBookmarkChanged(): Promise<void> {
    // Skip reload if currently switching spaces to avoid conflicts
    if (spaceManager.isSwitching()) {
      logger.debug('UIManager', 'Skipping bookmark reload during space switch');
      return;
    }

    await spaceManager.reloadBookmarks();

    const currentSpace = spaceManager.getCurrentSpace();
    if (currentSpace) {
      this.renderBookmarks(currentSpace.bookmarks);
    }

    this.renderPinnedBookmarks(spaceManager.getPinnedBookmarks());
    this.renderSpaces(spaceManager.getSpaces(), spaceManager.getCurrentSpaceId());
  }

  /**
   * Handle bookmark click
   */
  private handleBookmarkClick(data: ListItemData): void {
    chrome.tabs.create({ url: data.url });
  }

  /**
   * Handle bookmark delete
   */
  private async handleBookmarkDelete(data: ListItemData): Promise<void> {
    await bookmarkManager.deleteBookmark(data.id.toString());

    const currentSpace = spaceManager.getCurrentSpace();
    if (currentSpace) {
      currentSpace.bookmarks = currentSpace.bookmarks.filter((b) => b.id !== data.id.toString());
      this.renderBookmarks(currentSpace.bookmarks);
    }
  }

  /**
   * Handle tab click
   */
  private handleTabClick(data: ListItemData): void {
    chrome.tabs.update(Number(data.id), { active: true });
  }

  /**
   * Handle tab close
   */
  private async handleTabClose(data: ListItemData): Promise<void> {
    try {
      await chrome.tabs.remove(Number(data.id));
    } catch {
      const currentSpaceId = spaceManager.getCurrentSpaceId();
      if (currentSpaceId) {
        await spaceManager.removeTabFromSpace(currentSpaceId, Number(data.id));
      }
    }
  }

  /**
   * Handle tab context menu
   */
  private handleTabContextMenu(data: ListItemData, event: MouseEvent): void {
    // Close existing menu
    this.closeContextMenu();

    const currentSpaceId = spaceManager.getCurrentSpaceId();
    if (!currentSpaceId) return;

    const spaces = spaceManager.getSpaces();
    const moveToItem = ContextMenu.createMoveToSubmenu(
      spaces,
      currentSpaceId,
      async (targetSpaceId) => {
        await spaceManager.moveTabToSpace(Number(data.id), currentSpaceId, targetSpaceId);
        await spaceManager.switchSpace(targetSpaceId);
      },
    );

    // Create context menu
    this.currentContextMenu = new ContextMenu({
      items: [moveToItem],
      position: { x: event.pageX, y: event.pageY },
      onClose: () => {
        this.currentContextMenu = null;
      },
    });
  }

  /**
   * Handle tab drop (drag and drop to bookmarks)
   */
  private async handleTabDrop(data: ListItemData): Promise<void> {
    const currentSpaceId = spaceManager.getCurrentSpaceId();
    if (!currentSpaceId) return;

    const currentSpace = spaceManager.getCurrentSpace();
    if (!currentSpace) return;

    // Create bookmark
    await bookmarkManager.createBookmark(currentSpaceId, data.title, data.url);

    // Refresh bookmarks
    currentSpace.bookmarks = await bookmarkManager.getFolderBookmarks(currentSpaceId);
    this.renderBookmarks(currentSpace.bookmarks);

    // Close the tab
    await chrome.tabs.remove(Number(data.id));
    await spaceManager.removeTabFromSpace(currentSpaceId, Number(data.id));
  }

  /**
   * Handle new space button click
   */
  private async handleNewSpace(): Promise<void> {
    const name = prompt('Enter name for the new space:');
    if (!name || name.trim() === '') return;

    // Use atomic create and switch to prevent conflicts
    const space = await spaceManager.createAndSwitchSpace(name.trim());
    if (!space) {
      alert('Error creating new space. A space with this name may already exist. Check console for details.');
    }
  }

  /**
   * Close the current context menu
   */
  private closeContextMenu(): void {
    if (this.currentContextMenu) {
      this.currentContextMenu.close();
      this.currentContextMenu = null;
    }
  }

  /**
   * Update UI state
   */
  updateState(): void {
    const currentSpace = spaceManager.getCurrentSpace();

    if (currentSpace) {
      this.renderBookmarks(currentSpace.bookmarks);
      this.renderTabs(currentSpace.openTabs);
    }

    this.renderPinnedBookmarks(spaceManager.getPinnedBookmarks());
    this.renderSpaces(spaceManager.getSpaces(), spaceManager.getCurrentSpaceId());
  }

  /**
   * Set loading state
   */
  setLoading(isLoading: boolean): void {
    if (isLoading) {
      document.body.classList.add('loading');
    } else {
      document.body.classList.remove('loading');
    }
  }

  /**
   * Destroy the UI manager
   */
  destroy(): void {
    this.closeContextMenu();
    this.pinnedList.destroy();
    this.bookmarksList.destroy();
    this.tabsList.destroy();
    this.spacesList.innerHTML = '';

    logger.info('UIManager', 'Destroyed');
  }

  /**
   * Get the log viewer instance
   */
  getLogViewer(): LogViewer {
    return this.logViewer;
  }
}
