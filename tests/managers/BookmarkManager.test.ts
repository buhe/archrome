/**
 * Tests for src/managers/BookmarkManager.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookmarkManager } from '@managers/BookmarkManager';
import type { BookmarkTreeNode } from '@types/index';

const TREE_WITH_SPACES = (extra: BookmarkTreeNode[] = []): BookmarkTreeNode[] => [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: 'Bookmarks bar',
        children: [
          { id: '10', title: '😀Work', children: [{ id: '100', title: 'G', url: 'https://g.com' }] },
          { id: '11', title: 'Play', children: [] },
          { id: '12', title: 'pin', children: [{ id: '120', title: 'P', url: 'https://p.com' }] },
          ...extra,
        ],
      },
    ],
  },
];

describe('BookmarkManager', () => {
  let bm: BookmarkManager;

  beforeEach(() => {
    bm = new BookmarkManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('tree / bar / folders', () => {
    it('getTree returns the bookmark tree', async () => {
      const tree = await bm.getTree();
      expect(tree).toHaveLength(1);
    });

    it('getTree returns [] on error', async () => {
      vi.spyOn(chrome.bookmarks, 'getTree').mockRejectedValueOnce(new Error('x'));
      expect(await bm.getTree()).toEqual([]);
    });

    it('getBookmarksBar finds the bar node', async () => {
      const bar = await bm.getBookmarksBar();
      expect(bar?.id).toBe('1');
    });

    it('getBookmarksBar returns null when bar not found', async () => {
      vi.spyOn(chrome.bookmarks, 'getTree').mockResolvedValueOnce([
        { id: '0', title: '', children: [] },
      ]);
      expect(await bm.getBookmarksBar()).toBeNull();
    });

    it('getSpaceFolders returns only folders (nodes with children)', async () => {
      vi.spyOn(chrome.bookmarks, 'getTree').mockResolvedValueOnce(TREE_WITH_SPACES());
      const folders = await bm.getSpaceFolders();
      expect(folders.map((f) => f.id)).toEqual(['10', '11', '12']);
    });

    it('getPinFolder finds the pin folder case-insensitively', async () => {
      vi.spyOn(chrome.bookmarks, 'getTree').mockResolvedValueOnce(TREE_WITH_SPACES());
      const pin = await bm.getPinFolder();
      expect(pin?.id).toBe('12');
    });

    it('getPinFolder returns null when absent', async () => {
      const pin = await bm.getPinFolder();
      expect(pin).toBeNull();
    });
  });

  describe('folder bookmarks', () => {
    it('getFolderBookmarks returns only url nodes', async () => {
      vi.spyOn(chrome.bookmarks, 'getSubTree').mockResolvedValueOnce([
        {
          id: '10',
          title: 'Work',
          children: [
            { id: 'a', title: 'A', url: 'https://a.com', dateAdded: 1 },
            { id: 'b', title: 'Sub', children: [] },
            { id: 'c', title: 'C', url: 'https://c.com' },
          ],
        },
      ]);
      const bookmarks = await bm.getFolderBookmarks('10');
      expect(bookmarks).toHaveLength(2);
      expect(bookmarks[0]).toMatchObject({ id: 'a', url: 'https://a.com' });
    });

    it('getFolderBookmarks returns [] on error', async () => {
      vi.spyOn(chrome.bookmarks, 'getSubTree').mockRejectedValueOnce(new Error('x'));
      expect(await bm.getFolderBookmarks('10')).toEqual([]);
    });

    it('getPinnedBookmarks reads from the pin folder', async () => {
      vi.spyOn(chrome.bookmarks, 'getTree').mockResolvedValueOnce(TREE_WITH_SPACES());
      const pinned = await bm.getPinnedBookmarks();
      expect(pinned).toHaveLength(1);
      expect(pinned[0].url).toBe('https://p.com');
    });

    it('getPinnedBookmarks returns [] when no pin folder', async () => {
      expect(await bm.getPinnedBookmarks()).toEqual([]);
    });
  });

  describe('create / delete / move / update', () => {
    it('createBookmark returns the created bookmark', async () => {
      const created = await bm.createBookmark('1', 'Title', 'https://x.com');
      expect(created).not.toBeNull();
      expect(created?.title).toBe('Title');
      expect(chrome.bookmarks.create).toHaveBeenCalledWith({ parentId: '1', title: 'Title', url: 'https://x.com' });
    });

    it('createBookmark returns null on error', async () => {
      vi.spyOn(chrome.bookmarks, 'create').mockRejectedValueOnce(new Error('x'));
      expect(await bm.createBookmark('1', 'T', 'https://x.com')).toBeNull();
    });

    it('createFolder creates a new folder', async () => {
      const folder = await bm.createFolder('1', 'New');
      expect(folder).not.toBeNull();
      expect(folder?.title).toBe('New');
    });

    it('createFolder returns null when a folder with the same name exists', async () => {
      vi.spyOn(chrome.bookmarks, 'getTree').mockResolvedValueOnce(TREE_WITH_SPACES());
      expect(await bm.createFolder('1', 'Play')).toBeNull();
    });

    it('deleteBookmark returns true on success', async () => {
      expect(await bm.deleteBookmark('5')).toBe(true);
      expect(chrome.bookmarks.remove).toHaveBeenCalledWith('5');
    });

    it('deleteBookmark returns false on error', async () => {
      vi.spyOn(chrome.bookmarks, 'remove').mockRejectedValueOnce(new Error('x'));
      expect(await bm.deleteBookmark('5')).toBe(false);
    });

    it('deleteFolder returns true on success', async () => {
      expect(await bm.deleteFolder('5')).toBe(true);
      expect(chrome.bookmarks.removeTree).toHaveBeenCalledWith('5');
    });

    it('deleteFolder returns false on error', async () => {
      vi.spyOn(chrome.bookmarks, 'removeTree').mockRejectedValueOnce(new Error('x'));
      expect(await bm.deleteFolder('5')).toBe(false);
    });

    it('moveBookmark returns true and calls move', async () => {
      expect(await bm.moveBookmark('5', '2', 3)).toBe(true);
      expect(chrome.bookmarks.move).toHaveBeenCalledWith('5', { parentId: '2', index: 3 });
    });

    it('updateBookmark sends only provided fields', async () => {
      expect(await bm.updateBookmark('5', 'New')).toBe(true);
      expect(chrome.bookmarks.update).toHaveBeenCalledWith('5', { title: 'New' });
    });

    it('updateBookmark can update both title and url', async () => {
      expect(await bm.updateBookmark('5', 'T', 'https://u.com')).toBe(true);
      expect(chrome.bookmarks.update).toHaveBeenCalledWith('5', { title: 'T', url: 'https://u.com' });
    });

    it('moveBookmark returns false on error', async () => {
      vi.spyOn(chrome.bookmarks, 'move').mockRejectedValueOnce(new Error('x'));
      expect(await bm.moveBookmark('5', '2')).toBe(false);
    });

    it('updateBookmark returns false on error', async () => {
      vi.spyOn(chrome.bookmarks, 'update').mockRejectedValueOnce(new Error('x'));
      expect(await bm.updateBookmark('5', 'T')).toBe(false);
    });
  });

  describe('search', () => {
    it('returns only url nodes', async () => {
      vi.spyOn(chrome.bookmarks, 'search').mockResolvedValueOnce([
        { id: 'a', title: 'A', url: 'https://a.com' },
        { id: 'b', title: 'Folder', children: [] },
      ]);
      const results = await bm.searchBookmarks('a');
      expect(results).toHaveLength(1);
      expect(results[0].url).toBe('https://a.com');
    });

    it('returns [] on error', async () => {
      vi.spyOn(chrome.bookmarks, 'search').mockRejectedValueOnce(new Error('x'));
      expect(await bm.searchBookmarks('a')).toEqual([]);
    });
  });

  describe('helpers', () => {
    it('folderToSpace extracts icon and name from an emoji-prefixed title', () => {
      expect(bm.folderToSpace({ id: '10', title: '😀Work' })).toEqual({ id: '10', icon: '😀', name: 'Work' });
    });

    it('folderToSpace falls back to "Space <id>" when name is empty', () => {
      expect(bm.folderToSpace({ id: '10', title: '' })).toEqual({ id: '10', icon: '●', name: 'Space 10' });
    });

    it('isPinFolder matches case-insensitively', () => {
      expect(bm.isPinFolder({ id: '1', title: 'PIN' })).toBe(true);
      expect(bm.isPinFolder({ id: '1', title: 'Work' })).toBe(false);
    });

    it('onBookmarkChanged registers four listeners', () => {
      bm.onBookmarkChanged(() => undefined);
      expect(chrome.bookmarks.onCreated.addListener).toHaveBeenCalledTimes(1);
      expect(chrome.bookmarks.onRemoved.addListener).toHaveBeenCalledTimes(1);
      expect(chrome.bookmarks.onChanged.addListener).toHaveBeenCalledTimes(1);
      expect(chrome.bookmarks.onMoved.addListener).toHaveBeenCalledTimes(1);
    });
  });
});
