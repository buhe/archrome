/**
 * StorageManager tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageManager } from '@managers/StorageManager';
import type { TabData } from '@types/index';

// Mock chrome.storage.local
const mockStorage = new Map<string, unknown>();

vi.mock('chrome.storage.local', () => ({
  get: vi.fn((keys: string[]) => {
    const result: Record<string, unknown> = {};
    keys.forEach((key) => {
      if (mockStorage.has(key)) {
        result[key] = mockStorage.get(key);
      }
    });
    return Promise.resolve(result);
  }),
  set: vi.fn((items: Record<string, unknown>) => {
    Object.entries(items).forEach(([key, value]) => {
      mockStorage.set(key, value);
    });
    return Promise.resolve();
  }),
  remove: vi.fn((keys: string[]) => {
    keys.forEach((key) => mockStorage.delete(key));
    return Promise.resolve();
  }),
  clear: vi.fn(() => {
    mockStorage.clear();
    return Promise.resolve();
  }),
  getBytesInUse: vi.fn(() => Promise.resolve(1024)),
  QUOTA_BYTES: 10485760, // 10MB
}));

describe('StorageManager', () => {
  let storageManager: StorageManager;

  beforeEach(() => {
    mockStorage.clear();
    storageManager = new StorageManager();
  });

  describe('storeTabs', () => {
    it('should store tabs for a space', async () => {
      const tabs: TabData[] = [
        { id: 1, url: 'https://example.com', title: 'Example', favIconUrl: null },
      ];

      await storageManager.storeTabs('space1', tabs);

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 500));

      const stored = mockStorage.get('space_space1_tabs');
      expect(stored).toEqual(tabs);
    });
  });

  describe('getStoredTabs', () => {
    it('should get stored tabs for a space', async () => {
      const tabs: TabData[] = [
        { id: 1, url: 'https://example.com', title: 'Example', favIconUrl: null },
      ];

      mockStorage.set('space_space1_tabs', tabs);

      const retrieved = await storageManager.getStoredTabs('space1');
      expect(retrieved).toEqual(tabs);
    });

    it('should return empty array if no tabs stored', async () => {
      const retrieved = await storageManager.getStoredTabs('nonexistent');
      expect(retrieved).toEqual([]);
    });
  });

  describe('setLastActiveSpace', () => {
    it('should set last active space ID', async () => {
      await storageManager.setLastActiveSpace('space1');
      expect(mockStorage.get('last_active_space_id')).toBe('space1');
    });
  });

  describe('getLastActiveSpace', () => {
    it('should get last active space ID', async () => {
      mockStorage.set('last_active_space_id', 'space1');

      const spaceId = await storageManager.getLastActiveSpace();
      expect(spaceId).toBe('space1');
    });

    it('should return null if no last active space', async () => {
      const spaceId = await storageManager.getLastActiveSpace();
      expect(spaceId).toBeNull();
    });
  });
});
