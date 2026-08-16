/**
 * Tests for src/ui/UIManager.ts
 *
 * The four manager singletons are mocked so the UI controller can be exercised
 * in isolation against a jsdom DOM.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { spaceManager, bookmarkManager, storageManager } = vi.hoisted(() => ({
  spaceManager: {
    on: vi.fn(),
    getCurrentSpace: vi.fn(() => null),
    getCurrentSpaceId: vi.fn(() => null),
    getSpaces: vi.fn(() => []),
    getPinnedBookmarks: vi.fn(() => []),
    isSwitching: vi.fn(() => false),
    isCreatingSpace: vi.fn(() => false),
    isTabClosedDuringSwitch: vi.fn(() => false),
    triggerSwitch: vi.fn(),
    switchSpace: vi.fn(async () => undefined),
    createAndSwitchSpace: vi.fn(async () => ({ id: '9', icon: '●', name: 'NewSpace', bookmarks: [], openTabs: [] })),
    deleteSpace: vi.fn(async () => true),
    reloadBookmarks: vi.fn(async () => undefined),
    moveTabToSpace: vi.fn(async () => true),
    removeTabFromSpace: vi.fn(async () => undefined),
    loadPinnedBookmarks: vi.fn(async () => undefined),
  },
  bookmarkManager: {
    onBookmarkChanged: vi.fn(),
    deleteBookmark: vi.fn(async () => true),
    getFolderBookmarks: vi.fn(async () => []),
    createBookmark: vi.fn(async () => null),
    getPinFolder: vi.fn(async () => null),
    getBookmarksBar: vi.fn(async () => null),
    createFolder: vi.fn(async () => null),
  },
  storageManager: {
    getTheme: vi.fn(async () => null),
    setTheme: vi.fn(async () => undefined),
  },
}));

vi.mock('@managers/index', () => ({
  spaceManager,
  bookmarkManager,
  tabManager: {},
  storageManager,
}));

import { UIManager } from '@ui/UIManager';
import { EventType } from '@types/index';
import type { Space, BookmarkData, TabData } from '@types/index';

function setupDom() {
  document.body.innerHTML = `
    <ul id="pinned-list"></ul>
    <ul id="bookmarks-list"></ul>
    <ul id="tabs-list"></ul>
    <ul id="spaces-list"></ul>
    <button class="new-space-btn">+</button>
    <button id="theme-toggle-btn">🌙</button>
    <button id="debug-btn">debug</button>
    <div id="log-viewer-modal"><button class="close-btn">x</button></div>
    <div id="log-viewer-body"></div>
    <div id="metrics-table"></div>
    <select id="log-filter"><option value="all">All</option></select>
    <button id="export-logs">Export</button>
    <button id="clear-logs">Clear</button>
  `;
}

const SPACE: Space = {
  id: '1',
  icon: '😀',
  name: 'Work',
  bookmarks: [{ id: 'bm1', title: 'G', url: 'https://g.com' }],
  openTabs: [{ id: 50, url: 'https://t.com', title: 'T', favIconUrl: null }],
};

describe('UIManager', () => {
  let ui: UIManager;

  beforeEach(async () => {
    setupDom();
    vi.clearAllMocks();
    // Reset the shared space fixture (some handlers mutate its arrays in place)
    SPACE.bookmarks = [{ id: 'bm1', title: 'G', url: 'https://g.com' }];
    SPACE.openTabs = [{ id: 50, url: 'https://t.com', title: 'T', favIconUrl: null }];
    ui = new UIManager();
    // let the async initTheme() settle
    await new Promise((r) => setTimeout(r, 0));
  });

  afterEach(() => {
    ui?.destroy();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function handlerFor(type: EventType) {
    const call = spaceManager.on.mock.calls.find((c) => c[0] === type);
    return call?.[1] as ((e: unknown) => void) | undefined;
  }

  describe('renderSpaces', () => {
    it('renders emoji icon, initials, skips pin, and marks active', () => {
      const spaces: Space[] = [
        { id: '1', icon: '😀', name: 'Work', bookmarks: [], openTabs: [] },
        { id: '2', icon: '●', name: 'Home', bookmarks: [], openTabs: [] },
        { id: '3', icon: '●', name: 'pin', bookmarks: [], openTabs: [] },
      ];
      ui.renderSpaces(spaces, '1');

      const items = document.querySelectorAll('#spaces-list li');
      expect(items).toHaveLength(2); // pin skipped
      expect(items[0].textContent).toBe('😀');
      expect(items[0].classList.contains('active-space')).toBe(true);
      expect(items[1].textContent).toBe('HO'); // "Home" -> first 2 chars uppercased
    });

    it('shows SP for empty-named spaces', () => {
      ui.renderSpaces([{ id: '1', icon: '●', name: '', bookmarks: [], openTabs: [] }], null);
      expect(document.querySelector('#spaces-list li')?.textContent).toBe('SP');
    });

    it('triggers a space switch on click', () => {
      ui.renderSpaces([{ id: '1', icon: '😀', name: 'Work', bookmarks: [], openTabs: [] }], null);
      (document.querySelector('#spaces-list li') as HTMLElement).click();
      expect(spaceManager.triggerSwitch).toHaveBeenCalledWith('1');
    });

    it('opens a delete context menu on right-click and deletes when confirmed', async () => {
      ui.renderSpaces([{ id: '1', icon: '😀', name: 'Work', bookmarks: [], openTabs: [] }], null);
      const li = document.querySelector('#spaces-list li') as HTMLElement;
      li.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

      const item = document.querySelector('.custom-context-menu .context-menu-item') as HTMLElement;
      expect(item).toBeTruthy();
      item.click();

      // Confirmation now uses the in-panel dialog instead of window.confirm
      await vi.waitFor(() => {
        expect(document.querySelector('.dialog-overlay')).toBeTruthy();
      });
      (document.querySelector('.dialog-overlay .dialog-btn-primary') as HTMLElement).click();

      await vi.waitFor(() => {
        expect(spaceManager.deleteSpace).toHaveBeenCalledWith('1');
      });
    });

    it('does not delete when confirmation is dismissed', async () => {
      ui.renderSpaces([{ id: '1', icon: '😀', name: 'Work', bookmarks: [], openTabs: [] }], null);
      const li = document.querySelector('#spaces-list li') as HTMLElement;
      li.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
      (document.querySelector('.custom-context-menu .context-menu-item') as HTMLElement).click();

      await vi.waitFor(() => {
        expect(document.querySelector('.dialog-overlay')).toBeTruthy();
      });
      (document.querySelector('.dialog-overlay .dialog-btn:not(.dialog-btn-primary)') as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 0));
      expect(spaceManager.deleteSpace).not.toHaveBeenCalled();
    });
  });

  describe('render methods', () => {
    it('renders bookmark items', () => {
      ui.renderBookmarks([{ id: 'bm1', title: 'G', url: 'https://g.com' } as BookmarkData]);
      expect(document.querySelectorAll('#bookmarks-list .item-list-item').length).toBe(1);
    });

    it('renders tab items', () => {
      ui.renderTabs([{ id: 1, url: 'https://t.com', title: 'T' } as TabData]);
      expect(document.querySelectorAll('#tabs-list .item-list-item').length).toBe(1);
    });

    it('renders pinned bookmark items', () => {
      ui.renderPinnedBookmarks([{ id: 'p1', title: 'P', url: 'https://p.com' } as BookmarkData]);
      expect(document.querySelectorAll('#pinned-list .item-list-item').length).toBe(1);
    });
  });

  describe('click handlers wired through rendered items', () => {
    it('opens a tab when a bookmark is clicked', () => {
      ui.renderBookmarks([{ id: 'bm1', title: 'G', url: 'https://g.com' } as BookmarkData]);
      (document.querySelector('#bookmarks-list .item-list-item') as HTMLElement).click();
      expect(chrome.tabs.create).toHaveBeenCalledWith({ url: 'https://g.com' });
    });

    it('activates a tab when a tab row is clicked', () => {
      ui.renderTabs([{ id: 42, url: 'https://t.com', title: 'T' } as TabData]);
      (document.querySelector('#tabs-list .item-list-item') as HTMLElement).click();
      expect(chrome.tabs.update).toHaveBeenCalledWith(42, { active: true });
    });

    it('deletes a bookmark via the delete button', async () => {
      spaceManager.getCurrentSpace.mockReturnValue(SPACE);
      ui.renderBookmarks([{ id: 'bm1', title: 'G', url: 'https://g.com' } as BookmarkData]);
      (document.querySelector('#bookmarks-list .delete-btn') as HTMLElement).click();
      await vi.waitFor(() => {
        expect(bookmarkManager.deleteBookmark).toHaveBeenCalledWith('bm1');
      });
    });

    it('deletes a pinned bookmark and reloads the pin list', async () => {
      ui.renderPinnedBookmarks([{ id: 'p1', title: 'P', url: 'https://p.com' } as BookmarkData]);
      (document.querySelector('#pinned-list .delete-btn') as HTMLElement).click();
      await vi.waitFor(() => {
        expect(bookmarkManager.deleteBookmark).toHaveBeenCalledWith('p1');
      });
      expect(spaceManager.loadPinnedBookmarks).toHaveBeenCalled();
    });

    it('removes the tab from the space when closing fails', async () => {
      vi.spyOn(chrome.tabs, 'remove').mockRejectedValueOnce(new Error('nope'));
      spaceManager.getCurrentSpaceId.mockReturnValue('1');
      ui.renderTabs([{ id: 42, url: 'https://t.com', title: 'T' } as TabData]);
      (document.querySelector('#tabs-list .delete-btn') as HTMLElement).click();
      await vi.waitFor(() => {
        expect(spaceManager.removeTabFromSpace).toHaveBeenCalledWith('1', 42);
      });
    });
  });

  describe('space manager event handlers', () => {
    it('handleSpaceChanged re-renders the current space', () => {
      const h = handlerFor(EventType.SPACE_CHANGED)!;
      spaceManager.getCurrentSpace.mockReturnValue(SPACE);
      spaceManager.getSpaces.mockReturnValue([SPACE]);
      spaceManager.getCurrentSpaceId.mockReturnValue('1');
      h({ type: EventType.SPACE_CHANGED, timestamp: 0, spaceId: '1' });
      expect(document.querySelectorAll('#bookmarks-list .item-list-item').length).toBe(1);
      expect(document.querySelectorAll('#tabs-list .item-list-item').length).toBe(1);
    });

    it('handleSpaceChanged is a no-op without a current space', () => {
      const h = handlerFor(EventType.SPACE_CHANGED)!;
      spaceManager.getCurrentSpace.mockReturnValue(null);
      h({ type: EventType.SPACE_CHANGED, timestamp: 0, spaceId: '1' });
      expect(document.querySelectorAll('#bookmarks-list .item-list-item').length).toBe(0);
    });

    it('handleTabsUpdated renders tabs for the current space', () => {
      const h = handlerFor(EventType.TABS_UPDATED)!;
      spaceManager.getCurrentSpace.mockReturnValue(SPACE);
      h({ type: EventType.TABS_UPDATED, timestamp: 0, spaceId: '1', tabs: [] });
      expect(document.querySelectorAll('#tabs-list .item-list-item').length).toBe(1);
    });

    it('handleBookmarksUpdated renders bookmarks and pinned', () => {
      const h = handlerFor(EventType.BOOKMARKS_UPDATED)!;
      spaceManager.getCurrentSpace.mockReturnValue(SPACE);
      spaceManager.getPinnedBookmarks.mockReturnValue([]);
      h({ type: EventType.BOOKMARKS_UPDATED, timestamp: 0, spaceId: 'all', bookmarks: [] });
      expect(document.querySelectorAll('#bookmarks-list .item-list-item').length).toBe(1);
    });

    it('handleSpaceCreated re-renders spaces', () => {
      const h = handlerFor(EventType.SPACE_CREATED)!;
      spaceManager.getSpaces.mockReturnValue([SPACE]);
      spaceManager.getCurrentSpaceId.mockReturnValue('1');
      h({ type: EventType.SPACE_CREATED, timestamp: 0, space: SPACE });
      expect(document.querySelectorAll('#spaces-list li').length).toBe(1);
    });

    it('handleSpaceDeleted re-renders spaces', () => {
      const h = handlerFor(EventType.SPACE_DELETED)!;
      spaceManager.getSpaces.mockReturnValue([]);
      spaceManager.getCurrentSpaceId.mockReturnValue(null);
      h({ type: EventType.SPACE_DELETED, timestamp: 0, spaceId: '1' });
      expect(document.querySelectorAll('#spaces-list li').length).toBe(0);
    });

    it('handleBookmarkChanged skips reload while switching', async () => {
      const cb = bookmarkManager.onBookmarkChanged.mock.calls[0][0] as () => Promise<void>;
      spaceManager.isSwitching.mockReturnValue(true);
      await cb();
      expect(spaceManager.reloadBookmarks).not.toHaveBeenCalled();
    });

    it('handleBookmarkChanged skips reload while creating a space', async () => {
      const cb = bookmarkManager.onBookmarkChanged.mock.calls[0][0] as () => Promise<void>;
      // Bookmark events from space creation arrive while no switch runs yet
      spaceManager.isSwitching.mockReturnValue(false);
      spaceManager.isCreatingSpace.mockReturnValue(true);
      await cb();
      expect(spaceManager.reloadBookmarks).not.toHaveBeenCalled();
    });

    it('handleBookmarkChanged reloads bookmarks when idle', async () => {
      const cb = bookmarkManager.onBookmarkChanged.mock.calls[0][0] as () => Promise<void>;
      spaceManager.isSwitching.mockReturnValue(false);
      spaceManager.isCreatingSpace.mockReturnValue(false);
      spaceManager.getCurrentSpace.mockReturnValue(SPACE);
      spaceManager.getSpaces.mockReturnValue([SPACE]);
      spaceManager.getCurrentSpaceId.mockReturnValue('1');
      spaceManager.getPinnedBookmarks.mockReturnValue([]);
      await cb();
      expect(spaceManager.reloadBookmarks).toHaveBeenCalled();
    });
  });

  describe('new space / theme / state', () => {
    it('creates a new space from the in-panel prompt dialog', async () => {
      (document.querySelector('.new-space-btn') as HTMLElement).click();

      // The in-panel dialog replaces window.prompt
      await vi.waitFor(() => {
        expect(document.querySelector('.dialog-overlay .dialog-input')).toBeTruthy();
      });
      const input = document.querySelector('.dialog-overlay .dialog-input') as HTMLInputElement;
      input.value = 'NewSpace';
      (document.querySelector('.dialog-overlay .dialog-btn-primary') as HTMLElement).click();

      await vi.waitFor(() => {
        expect(spaceManager.createAndSwitchSpace).toHaveBeenCalledWith('NewSpace');
      });
    });

    it('aborts creating a space when the prompt is empty', async () => {
      (document.querySelector('.new-space-btn') as HTMLElement).click();

      await vi.waitFor(() => {
        expect(document.querySelector('.dialog-overlay .dialog-input')).toBeTruthy();
      });
      const input = document.querySelector('.dialog-overlay .dialog-input') as HTMLInputElement;
      input.value = '';
      (document.querySelector('.dialog-overlay .dialog-btn-primary') as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 0));
      expect(spaceManager.createAndSwitchSpace).not.toHaveBeenCalled();
    });

    it('toggles the theme to dark and persists it', async () => {
      (document.getElementById('theme-toggle-btn') as HTMLElement).click();
      await vi.waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      });
      expect(storageManager.setTheme).toHaveBeenCalledWith('dark');
    });

    it('updateState renders the current space and spaces', () => {
      spaceManager.getCurrentSpace.mockReturnValue(SPACE);
      spaceManager.getSpaces.mockReturnValue([SPACE]);
      spaceManager.getCurrentSpaceId.mockReturnValue('1');
      spaceManager.getPinnedBookmarks.mockReturnValue([]);
      ui.updateState();
      expect(document.querySelectorAll('#bookmarks-list .item-list-item').length).toBe(1);
      expect(document.querySelectorAll('#spaces-list li').length).toBe(1);
    });

    it('setLoading toggles the body loading class', () => {
      ui.setLoading(true);
      expect(document.body.classList.contains('loading')).toBe(true);
      ui.setLoading(false);
      expect(document.body.classList.contains('loading')).toBe(false);
    });

    it('getLogViewer returns the log viewer instance', () => {
      expect(ui.getLogViewer()).toBeTruthy();
    });
  });

  describe('drop to pin', () => {
    function dispatchDrop(payload: unknown) {
      const ul = document.getElementById('pinned-list')!;
      const dataTransfer = {
        getData: vi.fn(() => JSON.stringify(payload)),
        dropEffect: 'none',
      };
      const evt = new Event('drop', { bubbles: true }) as DragEvent;
      Object.defineProperty(evt, 'dataTransfer', { value: dataTransfer });
      Object.defineProperty(evt, 'preventDefault', { value: vi.fn() });
      ul.dispatchEvent(evt);
      return evt;
    }

    it('creates the bookmark in the existing pin folder and closes the tab', async () => {
      spaceManager.getCurrentSpaceId.mockReturnValue('1');
      bookmarkManager.getPinFolder.mockResolvedValueOnce({ id: 'pin1', title: 'pin' });

      dispatchDrop({ id: '50', title: 'T', url: 'https://t.com' });
      await vi.waitFor(() => {
        expect(chrome.tabs.remove).toHaveBeenCalledWith(50);
      });

      expect(bookmarkManager.createBookmark).toHaveBeenCalledWith('pin1', 'T', 'https://t.com');
      expect(spaceManager.loadPinnedBookmarks).toHaveBeenCalled();
      expect(spaceManager.removeTabFromSpace).toHaveBeenCalledWith('1', 50);
      expect(bookmarkManager.createFolder).not.toHaveBeenCalled();
    });

    it('creates the pin folder when it does not exist yet', async () => {
      spaceManager.getCurrentSpaceId.mockReturnValue('1');
      bookmarkManager.getPinFolder.mockResolvedValueOnce(null);
      bookmarkManager.getBookmarksBar.mockResolvedValueOnce({ id: 'bar1', title: '' });
      bookmarkManager.createFolder.mockResolvedValueOnce({ id: 'newpin', title: 'pin' });

      dispatchDrop({ id: '51', title: 'N', url: 'https://n.com' });
      await vi.waitFor(() => {
        expect(bookmarkManager.createFolder).toHaveBeenCalledWith('bar1', 'pin');
      });
      expect(bookmarkManager.createBookmark).toHaveBeenCalledWith('newpin', 'N', 'https://n.com');
    });

    it('does nothing when the bookmarks bar is unavailable and no pin folder exists', async () => {
      bookmarkManager.getPinFolder.mockResolvedValueOnce(null);
      bookmarkManager.getBookmarksBar.mockResolvedValueOnce(null);

      dispatchDrop({ id: '52', title: 'X', url: 'https://x.com' });
      await new Promise((r) => setTimeout(r, 0));

      expect(bookmarkManager.createBookmark).not.toHaveBeenCalled();
      expect(bookmarkManager.createFolder).not.toHaveBeenCalled();
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });
  });
});
