/**
 * Global test setup
 *
 * Installs an in-memory mock of the Chrome extension APIs (storage, tabs,
 * bookmarks, downloads) onto the global `chrome` object so the manager and UI
 * modules can be exercised under jsdom. A fresh mock is installed before every
 * test so storage state and mock call history never leak between tests.
 */

import { vi, beforeEach } from 'vitest';

// Silence the noisy logger console output during the test run. Real test
// failures still surface through vitest's own reporter.
const noop = () => undefined;
// eslint-disable-next-line no-console
console.log = noop;
// eslint-disable-next-line no-console
console.info = noop;
// eslint-disable-next-line no-console
console.debug = noop;
// eslint-disable-next-line no-console
console.warn = noop;
// eslint-disable-next-line no-console
console.error = noop;

// jsdom does not implement the blob URL helpers or matchMedia; polyfill them.
const URLPolyfill = URL as unknown as {
  createObjectURL?: unknown;
  revokeObjectURL?: unknown;
};
if (typeof URLPolyfill.createObjectURL !== 'function') {
  URLPolyfill.createObjectURL = vi.fn(() => 'blob:mock');
}
if (typeof URLPolyfill.revokeObjectURL !== 'function') {
  URLPolyfill.revokeObjectURL = vi.fn(() => undefined);
}

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  })) as unknown as typeof window.matchMedia;
}

/**
 * Build a fresh Chrome API mock backed by an in-memory storage map.
 */
function createChromeMock() {
  const storage = new Map<string, unknown>();
  let tabCounter = 100;
  let bookmarkCounter = 200;

  return {
    storage: {
      local: {
        QUOTA_BYTES: 10_485_760,
        get: vi.fn(async (keys: unknown) => {
          if (keys === null || keys === undefined) {
            return Object.fromEntries(storage);
          }
          if (typeof keys === 'object' && !Array.isArray(keys)) {
            const result: Record<string, unknown> = {};
            for (const k of Object.keys(keys)) {
              result[k] = storage.has(k) ? storage.get(k) : (keys as Record<string, unknown>)[k];
            }
            return result;
          }
          const arr = Array.isArray(keys) ? (keys as string[]) : [keys as string];
          const result: Record<string, unknown> = {};
          for (const k of arr) {
            if (storage.has(k)) result[k] = storage.get(k);
          }
          return result;
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) storage.set(k, v);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          const arr = Array.isArray(keys) ? keys : [keys];
          for (const k of arr) storage.delete(k);
        }),
        clear: vi.fn(async () => {
          storage.clear();
        }),
        getBytesInUse: vi.fn(async () => 0),
      },
    },
    tabs: {
      query: vi.fn(async () => [] as unknown[]),
      get: vi.fn(async (id: number) => {
        throw new Error(`No tab with id ${id}`);
      }),
      create: vi.fn(async (props: Record<string, unknown>) => ({
        id: tabCounter++,
        url: (props?.url as string) ?? undefined,
        pendingUrl: props?.pendingUrl,
        title: (props?.title as string) ?? '',
        favIconUrl: (props?.favIconUrl as string) ?? null,
        active: props?.active ?? true,
        ...props,
      })),
      update: vi.fn(async (id: number, props: Record<string, unknown>) => ({ id, ...props })),
      remove: vi.fn(async () => undefined),
      move: vi.fn(async (id: number, props: Record<string, unknown>) => ({ id, ...props })),
      duplicate: vi.fn(async (id: number) => ({ id })),
      onCreated: { addListener: vi.fn() },
      onUpdated: { addListener: vi.fn() },
      onRemoved: { addListener: vi.fn() },
      onActivated: { addListener: vi.fn() },
      onDetached: { addListener: vi.fn() },
      onAttached: { addListener: vi.fn() },
    },
    bookmarks: {
      getTree: vi.fn(async () => [
        {
          id: '0',
          title: '',
          children: [{ id: '1', title: 'Bookmarks bar', children: [] }],
        },
      ]),
      getSubTree: vi.fn(async () => []),
      create: vi.fn(async (props: Record<string, unknown>) => ({
        id: String(bookmarkCounter++),
        title: (props?.title as string) ?? '',
        url: props?.url,
        parentId: props?.parentId,
        index: props?.index,
        dateAdded: Date.now(),
        ...props,
      })),
      remove: vi.fn(async () => undefined),
      removeTree: vi.fn(async () => undefined),
      move: vi.fn(async (id: string, props: Record<string, unknown>) => ({ id, ...props })),
      update: vi.fn(async (id: string, props: Record<string, unknown>) => ({ id, ...props })),
      search: vi.fn(async () => []),
      onCreated: { addListener: vi.fn() },
      onRemoved: { addListener: vi.fn() },
      onChanged: { addListener: vi.fn() },
      onMoved: { addListener: vi.fn() },
    },
    downloads: {
      download: vi.fn(async () => 1),
    },
    runtime: {
      id: 'test-extension',
      getManifest: vi.fn(() => ({ version: '0.0.0' })),
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
      onSuspend: { addListener: vi.fn() },
      onMessage: { addListener: vi.fn() },
    },
    action: {
      onClicked: { addListener: vi.fn() },
    },
    sidePanel: {
      setPanelBehavior: vi.fn(async () => undefined),
    },
  };
}

// Install before any test module imports its dependencies.
(globalThis as unknown as { chrome: unknown }).chrome = createChromeMock();

beforeEach(() => {
  (globalThis as unknown as { chrome: unknown }).chrome = createChromeMock();
});
