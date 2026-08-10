/**
 * Tests for src/background.ts
 *
 * background.ts has no exports; it registers Chrome lifecycle/message listeners
 * at import time. We re-import it per test (against the fresh chrome mock) and
 * drive the registered callbacks to exercise the real routing/retry logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('background service worker', () => {
  // freshly imported each test so listener registration hits the current mock
  let onMessage: (req: unknown, sender: unknown, send: (r: unknown) => void) => unknown;
  let onInstalled: (details: { reason: string }) => Promise<void>;
  let onStartup: () => Promise<void>;
  let onSuspend: () => void;

  beforeEach(async () => {
    vi.resetModules();
    await import('@/background');

    onMessage = chrome.runtime.onMessage.addListener.mock.calls[0][0] as typeof onMessage;
    onInstalled = chrome.runtime.onInstalled.addListener.mock.calls[0][0] as typeof onInstalled;
    onStartup = chrome.runtime.onStartup.addListener.mock.calls[0][0] as typeof onStartup;
    onSuspend = chrome.runtime.onSuspend.addListener.mock.calls[0][0] as typeof onSuspend;
  });

  afterEach(() => {
    // stopHeartbeat clears the interval started at import
    onSuspend?.();
    vi.useRealTimers();
  });

  describe('message routing', () => {
    it('responds to ping with pong', () => {
      const send = vi.fn();
      const ret = onMessage({ action: 'ping' }, {}, send);
      expect(ret).toBe(true);
      expect(send).toHaveBeenCalledWith({ status: 'pong' });
    });

    it('responds to getHeartbeat with the stored heartbeat', async () => {
      const send = vi.fn();
      const ret = onMessage({ action: 'getHeartbeat' }, {}, send);
      expect(ret).toBe(true);
      await vi.waitFor(() => {
        expect(send).toHaveBeenCalledWith({ status: 'success', heartbeat: null });
      });
    });

    it('returns false for unknown actions without responding', () => {
      const send = vi.fn();
      const ret = onMessage({ action: 'nope' }, {}, send);
      expect(ret).toBe(false);
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('onInstalled / setPanelBehavior', () => {
    it('sets panel behavior on install', async () => {
      await onInstalled({ reason: 'install' });
      expect(chrome.sidePanel.setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true });
    });

    it('retries setPanelBehavior on failure and eventually succeeds', async () => {
      vi.useFakeTimers();
      chrome.sidePanel.setPanelBehavior
        .mockRejectedValueOnce(new Error('e1'))
        .mockRejectedValueOnce(new Error('e2'))
        .mockResolvedValueOnce(undefined);

      const p = onInstalled({ reason: 'update' });
      await vi.runAllTimersAsync();
      await p;
      expect(chrome.sidePanel.setPanelBehavior).toHaveBeenCalledTimes(3);
    });

    it('survives when every retry fails', async () => {
      vi.useFakeTimers();
      chrome.sidePanel.setPanelBehavior.mockRejectedValue(new Error('always'));

      const p = onInstalled({ reason: 'update' });
      await vi.runAllTimersAsync();
      await expect(p).resolves.toBeUndefined(); // error caught inside the listener
      expect(chrome.sidePanel.setPanelBehavior).toHaveBeenCalledTimes(3);
    });
  });

  describe('onStartup / onSuspend', () => {
    it('onStartup waits for chrome APIs and (re)starts the heartbeat', async () => {
      // Chrome APIs are present in the mock, so waitForChromeApiReady resolves true.
      await expect(onStartup()).resolves.toBeUndefined();
    });

    it('onSuspend stops the heartbeat without throwing', () => {
      expect(() => onSuspend()).not.toThrow();
    });
  });
});
