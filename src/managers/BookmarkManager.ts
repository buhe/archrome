/**
 * Bookmark Manager - Handles all Chrome bookmarks API operations
 */

import type { BookmarkData, BookmarkTreeNode } from '@types/index';
import { extractIconAndName } from '@utils/index';
import { logger } from '@utils/index';

/**
 * Bookmark Manager class
 */
export class BookmarkManager {
  private bookmarkBarId = '1'; // Chrome's default Bookmarks Bar ID
  private pinFolderName = 'pin';

  /**
   * Check if Chrome bookmarks API is available
   */
  private isApiAvailable(): boolean {
    try {
      return !!(chrome.bookmarks && typeof chrome.bookmarks.getTree === 'function');
    } catch {
      return false;
    }
  }

  /**
   * Wait for Chrome API to be ready
   */
  private async ensureApiReady(maxWait = 3000): Promise<boolean> {
    if (this.isApiAvailable()) {
      return true;
    }

    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
      if (this.isApiAvailable()) {
        logger.info('BookmarkManager', 'Chrome bookmarks API became available');
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    logger.error('BookmarkManager', 'Chrome bookmarks API not available after wait', { maxWait });
    return false;
  }

  /**
   * Get the entire bookmark tree
   */
  async getTree(): Promise<BookmarkTreeNode[]> {
    try {
      await this.ensureApiReady();
      const tree = await chrome.bookmarks.getTree();
      return tree as BookmarkTreeNode[];
    } catch (error) {
      logger.error('BookmarkManager', 'Error getting bookmark tree', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get the Bookmarks Bar node
   */
  async getBookmarksBar(): Promise<BookmarkTreeNode | null> {
    try {
      const tree = await this.getTree();
      const bookmarkBar = tree[0]?.children?.find((node) => node.id === this.bookmarkBarId);

      if (!bookmarkBar) {
        logger.warn('BookmarkManager', 'Bookmarks Bar not found');
        return null;
      }

      return bookmarkBar;
    } catch (error) {
      logger.error('BookmarkManager', 'Error getting Bookmarks Bar', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get all folder children of the Bookmarks Bar (spaces)
   */
  async getSpaceFolders(): Promise<BookmarkTreeNode[]> {
    try {
      const bookmarkBar = await this.getBookmarksBar();
      if (!bookmarkBar || !bookmarkBar.children) {
        return [];
      }

      // Return only folders (nodes with children)
      return bookmarkBar.children.filter((node) => node.children !== undefined);
    } catch (error) {
      logger.error('BookmarkManager', 'Error getting space folders', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get the "pin" folder for pinned bookmarks
   */
  async getPinFolder(): Promise<BookmarkTreeNode | null> {
    try {
      const bookmarkBar = await this.getBookmarksBar();
      if (!bookmarkBar || !bookmarkBar.children) {
        return null;
      }

      const pinFolder = bookmarkBar.children.find(
        (node) => node.title.toLowerCase() === this.pinFolderName && node.children,
      );

      return pinFolder || null;
    } catch (error) {
      logger.error('BookmarkManager', 'Error getting pin folder', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get bookmarks for a specific folder
   */
  async getFolderBookmarks(folderId: string): Promise<BookmarkData[]> {
    try {
      const subtree = await chrome.bookmarks.getSubTree(folderId);
      if (!subtree[0]?.children) {
        return [];
      }

      // Return only actual bookmarks (nodes with URLs)
      return subtree[0].children
        .filter((node) => node.url !== undefined)
        .map((node) => ({
          id: node.id,
          title: node.title,
          url: node.url || '',
          dateAdded: node.dateAdded,
          index: node.index,
          parentId: node.parentId,
        }));
    } catch (error) {
      logger.error('BookmarkManager', 'Error getting folder bookmarks', {
        folderId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get pinned bookmarks from the "pin" folder
   */
  async getPinnedBookmarks(): Promise<BookmarkData[]> {
    try {
      const pinFolder = await this.getPinFolder();
      if (!pinFolder) {
        logger.debug('BookmarkManager', 'No pin folder found');
        return [];
      }

      return pinFolder.children
        ?.filter((node) => node.url !== undefined)
        .map((node) => ({
          id: node.id,
          title: node.title,
          url: node.url || '',
          dateAdded: node.dateAdded,
          index: node.index,
          parentId: node.parentId,
        })) || [];
    } catch (error) {
      logger.error('BookmarkManager', 'Error getting pinned bookmarks', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Create a new bookmark
   */
  async createBookmark(parentId: string, title: string, url: string): Promise<BookmarkData | null> {
    try {
      const result = await chrome.bookmarks.create({ parentId, title, url });
      logger.info('BookmarkManager', 'Bookmark created', { id: result.id, title });

      return {
        id: result.id,
        title: result.title,
        url: result.url || '',
        dateAdded: result.dateAdded,
        index: result.index,
        parentId: result.parentId,
      };
    } catch (error) {
      logger.error('BookmarkManager', 'Error creating bookmark', {
        parentId,
        title,
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Create a new folder (space)
   * Returns null if a folder with the same name already exists
   */
  async createFolder(parentId: string, title: string): Promise<BookmarkTreeNode | null> {
    try {
      // Check if a folder with the same name already exists
      const bookmarkBar = await this.getBookmarksBar();
      if (bookmarkBar && bookmarkBar.children) {
        const existingFolder = bookmarkBar.children.find(
          (node) => node.title === title && node.children !== undefined
        );

        if (existingFolder) {
          logger.warn('BookmarkManager', 'Folder with same name already exists', {
            title,
            existingId: existingFolder.id,
          });
          return null;
        }
      }

      const result = await chrome.bookmarks.create({ parentId, title });
      logger.info('BookmarkManager', 'Folder created', { id: result.id, title });

      return {
        id: result.id,
        title: result.title,
        parentId: result.parentId,
        index: result.index,
        dateAdded: result.dateAdded,
        children: [],
      };
    } catch (error) {
      logger.error('BookmarkManager', 'Error creating folder', {
        parentId,
        title,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Delete a bookmark
   */
  async deleteBookmark(id: string): Promise<boolean> {
    try {
      await chrome.bookmarks.remove(id);
      logger.info('BookmarkManager', 'Bookmark deleted', { id });
      return true;
    } catch (error) {
      logger.error('BookmarkManager', 'Error deleting bookmark', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Delete a folder (space)
   */
  async deleteFolder(id: string): Promise<boolean> {
    try {
      await chrome.bookmarks.removeTree(id);
      logger.info('BookmarkManager', 'Folder deleted', { id });
      return true;
    } catch (error) {
      logger.error('BookmarkManager', 'Error deleting folder', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Move a bookmark to a different folder
   */
  async moveBookmark(id: string, newParentId: string, index?: number): Promise<boolean> {
    try {
      await chrome.bookmarks.move(id, { parentId: newParentId, index });
      logger.info('BookmarkManager', 'Bookmark moved', { id, newParentId, index });
      return true;
    } catch (error) {
      logger.error('BookmarkManager', 'Error moving bookmark', {
        id,
        newParentId,
        index,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Update a bookmark's title or URL
   */
  async updateBookmark(id: string, title?: string, url?: string): Promise<boolean> {
    try {
      const updates: { title?: string; url?: string } = {};
      if (title !== undefined) updates.title = title;
      if (url !== undefined) updates.url = url;

      await chrome.bookmarks.update(id, updates);
      logger.info('BookmarkManager', 'Bookmark updated', { id, updates });
      return true;
    } catch (error) {
      logger.error('BookmarkManager', 'Error updating bookmark', {
        id,
        title,
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Search bookmarks by query
   */
  async searchBookmarks(query: string): Promise<BookmarkData[]> {
    try {
      const results = await chrome.bookmarks.search(query);

      return results
        .filter((node) => node.url !== undefined)
        .map((node) => ({
          id: node.id,
          title: node.title,
          url: node.url || '',
          dateAdded: node.dateAdded,
          index: node.index,
          parentId: node.parentId,
        }));
    } catch (error) {
      logger.error('BookmarkManager', 'Error searching bookmarks', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Convert a bookmark tree node to a Space object
   */
  folderToSpace(folder: BookmarkTreeNode): { id: string; icon: string; name: string } {
    const { icon, name } = extractIconAndName(folder.title);

    return {
      id: folder.id,
      icon,
      name: name || `Space ${folder.id}`,
    };
  }

  /**
   * Check if a folder is the pin folder
   */
  isPinFolder(folder: BookmarkTreeNode): boolean {
    return folder.title.toLowerCase() === this.pinFolderName;
  }

  /**
   * Set up event listeners for bookmark changes
   */
  onBookmarkChanged(callback: () => void | Promise<void>): void {
    chrome.bookmarks.onCreated.addListener(callback);
    chrome.bookmarks.onRemoved.addListener(callback);
    chrome.bookmarks.onChanged.addListener(callback);
    chrome.bookmarks.onMoved.addListener(callback);
  }
}

// Singleton instance
export const bookmarkManager = new BookmarkManager();
