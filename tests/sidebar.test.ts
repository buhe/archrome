/**
 * Tests for src/sidebar.ts
 *
 * Focus: regression guard for the retry path. When the first initializeApp()
 * attempt fails (common after Service Worker resume / cold start), the retry
 * must still register the chrome.tabs.* event listeners via
 * setupTabEventListeners(). Otherwise the extension silently stops tracking
 * tab changes — the core feature.
 *
 * The manager singletons and UIManager are mocked so initialization can be
 * driven to failure/success deterministically.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mocks ---------------------------------------------------------------
// Hoist mock objects so they exist before the module under test is imported.

const { spaceManager, tabManager, UIManagerMock, delayMock } = vi.hoisted(() => ({
  spaceManager: {
    initialize: vi.fn(),
    on: vi.fn(),
    isSwitching: vi.fn(() => false),
    isTabClosedDuringSwitch: vi.fn(() => false),
    getCurrentSpaceId: vi.fn(() => null),
    getCurrentSpace: vi.fn(() => null),
    getSpace: vi.fn(() => null),
    addTabToCurrentSpace: vi.fn(async () => undefined),
    removeTabFromSpace: vi.fn(async () => undefined),
    updateTabInSpace: vi.fn(async () => undefined),
    destroy: vi.fn(),
  },
  tabManager: {
    // The listeners we care about spying on:
    onTabCreated: vi.fn(),
    onTabRemoved: vi.fn(),
    onTabUpdated: vi.fn(),
  },
  UIManagerMock: vi.fn(),
  delayMock: vi.fn(async () => undefined),
}));

vi.mock('@managers/index', () => ({
  spaceManager,
  tabManager,
}));

vi.mock('@ui/index', () => ({
  // UIManager is exported as a class; replace with a constructor stub.
  UIManager: UIManagerMock,
}));

vi.mock('@utils/index', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    critical: vi.fn(),
  },
  isValidUrl: vi.fn(() => true),
  delay: delayMock,
}));

import { initializeApp } from '@/../src/sidebar';

describe('sidebar.initializeApp retry path', () => {
  beforeEach(() => {
    // Minimal DOM so any stray getElementById won't blow up.
    document.body.innerHTML = '';

    // Reset call history between tests.
    vi.clearAllMocks();

    // By default, delay resolves immediately so the 2s retry fires at once.
    delayMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers tab listeners on the successful first attempt', async () => {
    spaceManager.initialize.mockResolvedValue(undefined);
    UIManagerMock.mockImplementation(() => ({
      updateState: vi.fn(),
      destroy: vi.fn(),
    }));

    await initializeApp();

    expect(spaceManager.initialize).toHaveBeenCalledTimes(1);
    expect(tabManager.onTabCreated).toHaveBeenCalledTimes(1);
    expect(tabManager.onTabRemoved).toHaveBeenCalledTimes(1);
    expect(tabManager.onTabUpdated).toHaveBeenCalledTimes(1);
  });

  it('re-registers tab listeners after a failed first attempt retries successfully', async () => {
    // First initialize() rejects; the retry (2s later) resolves.
    spaceManager.initialize
      .mockRejectedValueOnce(new Error('chrome APIs not ready'))
      .mockResolvedValueOnce(undefined);
    UIManagerMock.mockImplementation(() => ({
      updateState: vi.fn(),
      destroy: vi.fn(),
    }));

    // initializeApp awaits its retry via setTimeout(2000). We let the real
    // timer run but flush it deterministically with fake timers.
    vi.useFakeTimers();

    const promise = initializeApp();

    // First attempt fails synchronously-ish; the catch schedules the retry.
    // Allow microtasks (including the rejection handler) to flush.
    await Promise.resolve();
    await Promise.resolve();

    // Before retry: listeners must NOT have been registered yet, since the
    // successful path calls setupTabEventListeners() only after initialize().
    expect(tabManager.onTabCreated).not.toHaveBeenCalled();

    // Fire the 2000ms retry timer.
    await vi.advanceTimersByTimeAsync(2000);

    // Allow the retry's awaits to settle.
    await Promise.resolve();
    await Promise.resolve();

    await promise;

    // Retry succeeded → listeners MUST now be registered. This is the fix.
    expect(spaceManager.initialize).toHaveBeenCalledTimes(2);
    expect(tabManager.onTabCreated).toHaveBeenCalledTimes(1);
    expect(tabManager.onTabRemoved).toHaveBeenCalledTimes(1);
    expect(tabManager.onTabUpdated).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
