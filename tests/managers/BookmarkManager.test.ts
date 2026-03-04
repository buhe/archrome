/**
 * BookmarkManager tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookmarkManager } from '@managers/BookmarkManager';
import type { BookmarkTreeNode } from '@types/index';

// Mock chrome.bookmarks API
const mockBookmarks: Map<string, BookmarkTreeNode> = new Map();

vi.mock('chrome.bookmarks', () => ({
  getTree: vi.fn(() => {
    const root: BookmarkTreeNode = {
      id: '0',
      title: '',
      children: [
        {
          id: '1',
          title: 'Bookmarks Bar',
          children: [],
        },
      ],
    };
    return Promise.resolve([root]);
  }),
  getSubTree: vi.fn((id: string) => {
    return Promise.resolve([mockBookmarks.get(id)]);
  }),
  create: vi.fn(async (bookmark: { parentId?: string; title?: string; url?: string }) => {
    const id = `bookmark_${Date.now()}`;
    const newBookmark: BookmarkTreeNode = {
      id,
      title: bookmark.title || '',
      url: bookmark.url,
      dateAdded: Date.now(),
      index: 0,
    };
    mockBookmarks.set(id, newBookmark);
    return Promise.resolve(newBookmark);
  }),
  remove: vi.fn((id: string) => {
    mockBookmarks.delete(id);
    return Promise.resolve();
  }),
  removeTree: vi.fn((id: string) => {
    mockBookmarks.delete(id);
    return Promise.resolve();
  }),
  move: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  search: vi.fn(() => Promise.resolve([])),
  onCreated: { addListener: vi.fn() },
  onRemoved: { addListener: vi.fn() },
  onChanged: { addListener: vi.fn() },
  onMoved: { addListener: vi.fn() },
}));

describe('BookmarkManager', () => {
  let bookmarkManager: BookmarkManager;

  beforeEach(() => {
    mockBookmarks.clear();
    bookmarkManager = new BookmarkManager();
  });

  describe('getTree', () => {
    it('should get bookmark tree', async () => {
      const tree = await bookmarkManager.getTree();
      expect(tree).toBeDefined();
      expect(tree.length).toBeGreaterThan(0);
    });
  });

  describe('getBookmarksBar', () => {
    it('should get bookmarks bar', async () => {
      const bar = await bookmarkManager.getBookmarksBar();
      expect(bar).toBeDefined();
      expect(bar?.id).toBe('1');
    });
  });

  describe('createFolder', () => {
    it('should create a new folder', async () => {
      const folder = await bookmarkManager.createFolder('1', 'Test Space');
      expect(folder).toBeDefined();
      expect(folder?.title).toBe('Test Space');
    });
  });

  describe('createBookmark', () => {
    it('should create a new bookmark', async () => {
      const bookmark = await bookmarkManager.createBookmark('1', 'Test Bookmark', 'https://example.com');
      expect(bookmark).toBeDefined();
      expect(bookmark?.title).toBe('Test Bookmark');
      expect(bookmark?.url).toBe('https://example.com');
    });
  });

  describe('folderToSpace', () => {
    it('should convert folder to space', () => {
      const folder: BookmarkTreeNode = {
        id: '123',
        title: '😀Work',
        children: [],
      };

      const space = bookmarkManager.folderToSpace(folder);
      expect(space.id).toBe('123');
      expect(space.icon).toBe('😀');
      expect(space.name).toBe('Work');
    });

    it('should handle non-emoji folder names', () => {
      const folder: BookmarkTreeNode = {
        id: '123',
        title: 'Personal',
        children: [],
      };

      const space = bookmarkManager.folderToSpace(folder);
      expect(space.id).toBe('123');
      expect(space.icon).toBe('●');
      expect(space.name).toBe('Personal');
    });
  });
});
