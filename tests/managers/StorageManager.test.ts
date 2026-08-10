/**
 * Tests for src/managers/StorageManager.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageManager } from '@managers/StorageManager';
import { STORAGE_KEYS } from '@types/index';
import type { TabData } from '@types/index';
import { logger } from '@utils/logger';

const TABS: TabData[] = [
  { id: 1, url: 'https://a.com', title: 'A', favIconUrl: null },
  { id: 2, url: 'https://b.com', title: 'B', favIconUrl: 'https://b.com/f.ico' },
];

describe('StorageManager', () => {
  let manager: StorageManager;

  beforeEach(() => {
    manager = new StorageManager({ maxStoredTabs: 100, maxLogs: 2, maxMetrics: 2 });
  });

  afterEach(() => {
    manager.clearPendingOperations();
    vi.restoreAllMocks();
  });

  describe('tabs storage', () => {
    it('storeTabsImmediate writes cleaned tabs under the space key', async () => {
      await manager.storeTabsImmediate('space-1', TABS);
      const stored = await chrome.storage.local.get(['space_space-1_tabs']);
      expect(stored['space_space-1_tabs']).toHaveLength(2);
      expect(stored['space_space-1_tabs'][0]).toMatchObject({ id: 1, url: 'https://a.com' });
    });

    it('getStoredTabs returns the stored tabs', async () => {
      await manager.storeTabsImmediate('space-1', TABS);
      const tabs = await manager.getStoredTabs('space-1');
      expect(tabs).toHaveLength(2);
      expect(tabs[1].title).toBe('B');
    });

    it('getStoredTabs returns [] and logs on error', async () => {
      vi.spyOn(chrome.storage.local, 'get').mockRejectedValueOnce(new Error('read fail'));
      await expect(manager.getStoredTabs('space-x')).resolves.toEqual([]);
    });

    it('storeTabsImmediate rethrows when storage.set fails', async () => {
      vi.spyOn(chrome.storage.local, 'set').mockRejectedValueOnce(new Error('write fail'));
      await expect(manager.storeTabsImmediate('space-1', TABS)).rejects.toThrow('write fail');
    });

    it('stores minimal data when size exceeds quota', async () => {
      (chrome.storage.local as unknown as { QUOTA_BYTES: number }).QUOTA_BYTES = 1;
      await manager.storeTabsImmediate('space-1', TABS);
      const stored = await chrome.storage.local.get(['space_space-1_tabs']);
      // Minimal form only keeps id + url
      expect(stored['space_space-1_tabs'][0]).toEqual({ id: 1, url: 'https://a.com' });
    });

    it('limits stored tabs to maxStoredTabs', async () => {
      const many: TabData[] = Array.from({ length: 5 }, (_, i) => ({
        id: i,
        url: `https://${i}.com`,
        title: `T${i}`,
        favIconUrl: null,
      }));
      const limited = new StorageManager({ maxStoredTabs: 2 });
      await limited.storeTabsImmediate('s', many);
      const tabs = await limited.getStoredTabs('s');
      expect(tabs).toHaveLength(2);
    });

    it('storeTabs is debounced', async () => {
      vi.useFakeTimers();
      const setSpy = chrome.storage.local.set;
      await manager.storeTabs('space-1', TABS);
      await manager.storeTabs('space-1', TABS);
      expect(setSpy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(300);
      expect(setSpy).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it('clearPendingOperations cancels debounced stores', async () => {
      vi.useFakeTimers();
      const setSpy = chrome.storage.local.set;
      await manager.storeTabs('space-1', TABS);
      manager.clearPendingOperations();
      vi.advanceTimersByTime(300);
      expect(setSpy).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('last active space', () => {
    it('round-trips the last active space id', async () => {
      await manager.setLastActiveSpace('space-7');
      expect(await manager.getLastActiveSpace()).toBe('space-7');
    });

    it('getLastActiveSpace returns null when storage throws', async () => {
      vi.spyOn(chrome.storage.local, 'get').mockRejectedValueOnce(new Error('x'));
      expect(await manager.getLastActiveSpace()).toBeNull();
    });

    it('setLastActiveSpace swallows storage errors', async () => {
      vi.spyOn(chrome.storage.local, 'set').mockRejectedValueOnce(new Error('x'));
      await expect(manager.setLastActiveSpace('s')).resolves.toBeUndefined();
    });
  });

  describe('switch metrics', () => {
    it('stores and retrieves metrics', async () => {
      await manager.storeSwitchMetrics([{ toSpace: 'a', status: 'success', startTime: 1 }]);
      const metrics = await manager.getSwitchMetrics();
      expect(metrics).toHaveLength(1);
    });

    it('trims to maxMetrics', async () => {
      const big = Array.from({ length: 5 }, (_, i) => ({
        toSpace: `s${i}`,
        status: 'success' as const,
        startTime: i,
      }));
      await manager.storeSwitchMetrics(big);
      const metrics = await manager.getSwitchMetrics();
      expect(metrics).toHaveLength(2); // maxMetrics = 2
    });

    it('getSwitchMetrics returns [] on error', async () => {
      vi.spyOn(chrome.storage.local, 'get').mockRejectedValueOnce(new Error('x'));
      expect(await manager.getSwitchMetrics()).toEqual([]);
    });
  });

  describe('heartbeat', () => {
    it('round-trips a heartbeat timestamp', async () => {
      await manager.updateHeartbeat();
      expect(await manager.getHeartbeat()).toBeTypeOf('number');
    });

    it('getHeartbeat returns null on error', async () => {
      vi.spyOn(chrome.storage.local, 'get').mockRejectedValueOnce(new Error('x'));
      expect(await manager.getHeartbeat()).toBeNull();
    });
  });

  describe('theme', () => {
    it('round-trips a valid theme', async () => {
      await manager.setTheme('dark');
      expect(await manager.getTheme()).toBe('dark');
    });

    it('returns null for an unknown theme value', async () => {
      await chrome.storage.local.set({ [STORAGE_KEYS.THEME]: 'neon' });
      expect(await manager.getTheme()).toBeNull();
    });

    it('returns null when no theme is stored', async () => {
      expect(await manager.getTheme()).toBeNull();
    });

    it('getTheme returns null on error', async () => {
      vi.spyOn(chrome.storage.local, 'get').mockRejectedValueOnce(new Error('x'));
      expect(await manager.getTheme()).toBeNull();
    });

    it('setTheme swallows storage errors', async () => {
      vi.spyOn(chrome.storage.local, 'set').mockRejectedValueOnce(new Error('x'));
      await expect(manager.setTheme('light')).resolves.toBeUndefined();
    });
  });

  describe('clear operations', () => {
    it('clearAll wipes storage', async () => {
      await manager.setLastActiveSpace('s');
      await manager.clearAll();
      expect(await manager.getLastActiveSpace()).toBeNull();
    });

    it('clearSpaceData removes only the space key', async () => {
      await manager.storeTabsImmediate('s1', TABS);
      await manager.clearSpaceData('s1');
      expect(await manager.getStoredTabs('s1')).toEqual([]);
    });
  });

  describe('cleanupOldData', () => {
    it('trims oversized logs and metrics', async () => {
      // Silence the logger so its own writes don't pollute the LOGS key being cleaned.
      const writeSpy = vi.spyOn(logger, 'write').mockResolvedValue(undefined);

      const logs = Array.from({ length: 10 }, (_, i) => ({ i }));
      const metrics = Array.from({ length: 10 }, (_, i) => ({ i }));
      await chrome.storage.local.set({
        [STORAGE_KEYS.LOGS]: logs,
        [STORAGE_KEYS.SWITCH_METRICS]: metrics,
      });

      const cleaner = new StorageManager({ cleanupInterval: 0, maxLogs: 2, maxMetrics: 2 });
      await cleaner.cleanupOldData();

      const result = await chrome.storage.local.get([STORAGE_KEYS.LOGS, STORAGE_KEYS.SWITCH_METRICS]);
      expect(result[STORAGE_KEYS.LOGS]).toHaveLength(2);
      expect(result[STORAGE_KEYS.SWITCH_METRICS]).toHaveLength(2);
      writeSpy.mockRestore();
    });

    it('is a no-op within the cleanup interval', async () => {
      const setSpy = vi.spyOn(chrome.storage.local, 'set');
      const cleaner = new StorageManager({ cleanupInterval: 999999 });
      await cleaner.cleanupOldData();
      expect(setSpy).not.toHaveBeenCalled();
    });
  });

  describe('getStorageUsage', () => {
    it('returns bytes in use and quota', async () => {
      const usage = await manager.getStorageUsage();
      expect(usage).toEqual({ bytesInUse: 0, quotaBytes: expect.any(Number) });
    });

    it('returns zero usage on error', async () => {
      vi.spyOn(chrome.storage.local, 'getBytesInUse').mockRejectedValueOnce(new Error('x'));
      const usage = await manager.getStorageUsage();
      expect(usage.bytesInUse).toBe(0);
    });
  });
});
