/**
 * Tests for src/managers/TabManager.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TabManager } from '@managers/TabManager';
import type { TabData } from '@types/index';

describe('TabManager', () => {
  let tm: TabManager;

  beforeEach(() => {
    tm = new TabManager({ batchSize: 5, batchDelay: 10, maxRestoreTabs: 10 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('queries', () => {
    it('getAllTabs returns queried tabs', async () => {
      vi.spyOn(chrome.tabs, 'query').mockResolvedValueOnce([{ id: 1 }, { id: 2 }] as never);
      const tabs = await tm.getAllTabs();
      expect(tabs).toHaveLength(2);
    });

    it('getAllTabs returns [] on error', async () => {
      vi.spyOn(chrome.tabs, 'query').mockRejectedValueOnce(new Error('x'));
      expect(await tm.getAllTabs()).toEqual([]);
    });

    it('getCurrentWindowTabs queries the current window', async () => {
      vi.spyOn(chrome.tabs, 'query').mockResolvedValueOnce([{ id: 1 }] as never);
      const tabs = await tm.getCurrentWindowTabs();
      expect(tabs).toHaveLength(1);
      expect(chrome.tabs.query).toHaveBeenCalledWith({ currentWindow: true });
    });

    it('getCurrentWindowTabs returns [] on error', async () => {
      vi.spyOn(chrome.tabs, 'query').mockRejectedValueOnce(new Error('x'));
      expect(await tm.getCurrentWindowTabs()).toEqual([]);
    });

    it('getTab returns the tab when it exists', async () => {
      vi.spyOn(chrome.tabs, 'get').mockResolvedValueOnce({ id: 5 } as never);
      expect((await tm.getTab(5))?.id).toBe(5);
    });

    it('getTab returns null when not found', async () => {
      expect(await tm.getTab(99)).toBeNull();
    });
  });

  describe('createTab', () => {
    it('creates a tab for a valid url', async () => {
      const tab = await tm.createTab('https://example.com');
      expect(tab).not.toBeNull();
      expect(chrome.tabs.create).toHaveBeenCalledWith({ url: 'https://example.com', active: true });
    });

    it('returns null for an invalid url', async () => {
      expect(await tm.createTab('chrome://settings')).toBeNull();
    });

    it('returns null on error', async () => {
      vi.spyOn(chrome.tabs, 'create').mockRejectedValueOnce(new Error('x'));
      expect(await tm.createTab('https://example.com')).toBeNull();
    });

    it('returns null when chrome API is not ready', async () => {
      // Temporarily make the API unavailable so the manager considers it unready
      vi.useFakeTimers();
      const orig = chrome.tabs.query;
      (chrome.tabs as unknown as { query: unknown }).query = undefined;
      const unready = new TabManager();
      const promise = unready.createTab('https://example.com');
      await vi.runAllTimersAsync();
      expect(await promise).toBeNull();
      (chrome.tabs as unknown as { query: unknown }).query = orig;
      vi.useRealTimers();
    });
  });

  describe('createTabWithRetry', () => {
    it('returns the tab on success', async () => {
      const tab = await tm.createTabWithRetry('https://example.com');
      expect(tab).not.toBeNull();
    });

    it('returns null after exhausting retries', async () => {
      vi.spyOn(chrome.tabs, 'create').mockRejectedValue(new Error('fail'));
      vi.useFakeTimers();
      const p = tm.createTabWithRetry('https://example.com', true, { retries: 2, delay: 1 });
      await vi.runAllTimersAsync();
      expect(await p).toBeNull();
      vi.useRealTimers();
    });
  });

  describe('update / move / duplicate', () => {
    it('updateTab returns true on success', async () => {
      expect(await tm.updateTab(5, { active: true })).toBe(true);
      expect(chrome.tabs.update).toHaveBeenCalledWith(5, { active: true });
    });

    it('updateTab returns false on error', async () => {
      vi.spyOn(chrome.tabs, 'update').mockRejectedValueOnce(new Error('x'));
      expect(await tm.updateTab(5, { active: true })).toBe(false);
    });

    it('moveTab returns true on success', async () => {
      expect(await tm.moveTab(5, { index: 0 })).toBe(true);
    });

    it('moveTab returns false on error', async () => {
      vi.spyOn(chrome.tabs, 'move').mockRejectedValueOnce(new Error('x'));
      expect(await tm.moveTab(5, { index: 0 })).toBe(false);
    });

    it('duplicateTab returns the tab on success', async () => {
      vi.spyOn(chrome.tabs, 'duplicate').mockResolvedValueOnce({ id: 9 } as never);
      expect((await tm.duplicateTab(5))?.id).toBe(9);
    });

    it('duplicateTab returns null on error', async () => {
      vi.spyOn(chrome.tabs, 'duplicate').mockRejectedValueOnce(new Error('x'));
      expect(await tm.duplicateTab(5)).toBeNull();
    });
  });

  describe('closeTabs', () => {
    it('returns 0 for an empty list', async () => {
      expect(await tm.closeTabs([])).toBe(0);
    });

    it('closes tabs and returns the count', async () => {
      expect(await tm.closeTabs([1, 2])).toBe(2);
      expect(chrome.tabs.remove).toHaveBeenCalledWith([1, 2]);
    });

    it('returns 0 on error', async () => {
      vi.spyOn(chrome.tabs, 'remove').mockRejectedValueOnce(new Error('x'));
      expect(await tm.closeTabs([1])).toBe(0);
    });
  });

  describe('closeTabsBatch', () => {
    it('closes only currently-open tab ids in batches', async () => {
      vi.useFakeTimers();
      vi.spyOn(chrome.tabs, 'query').mockResolvedValue([
        { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }, { id: 7 },
      ] as never);
      const removeSpy = vi.spyOn(chrome.tabs, 'remove').mockResolvedValue(undefined);

      const promise = tm.closeTabsBatch([1, 2, 3, 4, 5, 6, 7, 99]);
      await vi.runAllTimersAsync();
      const closed = await promise;
      expect(closed).toBe(7); // 99 is not open, filtered out
      // batchSize 5 → two batches [1..5] and [6,7]
      expect(removeSpy.mock.calls.map((c) => c[0])).toEqual([[1, 2, 3, 4, 5], [6, 7]]);
      vi.useRealTimers();
    });

    it('returns 0 when no matching open tabs', async () => {
      vi.spyOn(chrome.tabs, 'query').mockResolvedValue([{ id: 1 }] as never);
      expect(await tm.closeTabsBatch([99])).toBe(0);
    });

    it('falls back to individual close when a batch throws', async () => {
      vi.useFakeTimers();
      vi.spyOn(chrome.tabs, 'query').mockResolvedValue([{ id: 1 }, { id: 2 }] as never);
      const removeSpy = vi
        .spyOn(chrome.tabs, 'remove')
        // first batch ([1,2]) rejects, then individual [1] ok, [2] ok
        .mockRejectedValueOnce(new Error('batch fail'))
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      const closed = await tm.closeTabsBatch([1, 2]);
      await vi.runAllTimersAsync();
      expect(closed).toBe(2);
      expect(removeSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('restoreTabs', () => {
    afterEach(() => vi.useRealTimers());

    it('returns [] for empty input', async () => {
      expect(await tm.restoreTabs([])).toEqual([]);
    });

    it('creates tabs for valid urls and skips invalid ones', async () => {
      vi.useFakeTimers();
      const tabs: TabData[] = [
        { id: 1, url: 'https://a.com', title: 'A', favIconUrl: null },
        { id: 2, url: 'chrome://settings', title: 'Bad', favIconUrl: null },
        { id: 3, url: 'https://b.com', title: 'B', favIconUrl: null },
      ];
      const promise = tm.restoreTabs(tabs);
      await vi.runAllTimersAsync();
      const restored = await promise;
      expect(restored).toHaveLength(2); // invalid url skipped
    });

    it('restoreTabSafely reuses an existing tab', async () => {
      vi.spyOn(chrome.tabs, 'get').mockResolvedValueOnce({ id: 7 } as never);
      const tab = await tm.restoreTabSafely({ id: 7, url: 'https://x.com', title: 'X', favIconUrl: null });
      expect(tab?.id).toBe(7);
    });

    it('restoreTabSafely skips invalid urls', async () => {
      const tab = await tm.restoreTabSafely({ id: 9, url: 'about:blank', title: '', favIconUrl: null });
      expect(tab).toBeNull();
    });
  });

  describe('converters / filters', () => {
    it('chromeTabToTabData normalizes a chrome tab', () => {
      const data = tm.chromeTabToTabData({ id: 1, url: 'https://a.com', pendingUrl: 'https://b.com', title: 'A' } as chrome.tabs.Tab);
      expect(data).toEqual({ id: 1, url: 'https://a.com', title: 'A', favIconUrl: null });
    });

    it('chromeTabToTabData falls back to pendingUrl', () => {
      const data = tm.chromeTabToTabData({ id: 1, pendingUrl: 'https://b.com' } as chrome.tabs.Tab);
      expect(data.url).toBe('https://b.com');
    });

    it('filterValidTabs keeps only restorable urls', () => {
      const tabs = [
        { id: 1, url: 'https://a.com' },
        { id: 2, url: 'chrome://settings' },
        { id: 3, pendingUrl: 'https://c.com' },
      ] as unknown as chrome.tabs.Tab[];
      expect(tm.filterValidTabs(tabs).map((t) => t.id)).toEqual([1, 3]);
    });

    it('getTabIds maps to ids', () => {
      expect(tm.getTabIds([{ id: 5 } as TabData, { id: 6 } as TabData])).toEqual([5, 6]);
    });
  });

  describe('event listeners', () => {
    it('registers tab listeners', () => {
      tm.onTabCreated(() => undefined);
      tm.onTabUpdated(() => undefined);
      tm.onTabRemoved(() => undefined);
      tm.onTabActivated(() => undefined);
      tm.onTabDetached(() => undefined);
      tm.onTabAttached(() => undefined);
      expect(chrome.tabs.onCreated.addListener).toHaveBeenCalled();
      expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(chrome.tabs.onRemoved.addListener).toHaveBeenCalled();
      expect(chrome.tabs.onActivated.addListener).toHaveBeenCalled();
      expect(chrome.tabs.onDetached.addListener).toHaveBeenCalled();
      expect(chrome.tabs.onAttached.addListener).toHaveBeenCalled();
    });
  });

  describe('ensureChromeApiReady', () => {
    it('returns true when the API is ready', async () => {
      expect(await tm.ensureChromeApiReady()).toBe(true);
    });

    it('returns false after waiting when the API never becomes ready', async () => {
      const orig = chrome.tabs.query;
      (chrome.tabs as unknown as { query: unknown }).query = undefined;
      const unready = new TabManager();
      const ready = await unready.ensureChromeApiReady(0);
      expect(ready).toBe(false);
      (chrome.tabs as unknown as { query: unknown }).query = orig;
    });
  });
});
