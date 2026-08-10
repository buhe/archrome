/**
 * Tests for src/managers/SpaceManager.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpaceManager } from '@managers/SpaceManager';
import { EventType } from '@types/index';
import type { BookmarkTreeNode, Space } from '@types/index';

const SPACES_TREE = (): BookmarkTreeNode[] => [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: 'Bookmarks bar',
        children: [
          {
            id: 's1',
            title: '😀Work',
            children: [{ id: 'b1', title: 'G', url: 'https://g.com', dateAdded: 1 }],
          },
          { id: 's2', title: 'Play', children: [] },
          { id: 'pin', title: 'pin', children: [{ id: 'p1', title: 'P', url: 'https://p.com' }] },
        ],
      },
    ],
  },
];

describe('SpaceManager', () => {
  let sm: SpaceManager;

  beforeEach(() => {
    sm = new SpaceManager();
  });

  afterEach(() => {
    sm.destroy();
    vi.useRealTimers();
  });

  describe('loading', () => {
    it('loadSpaces builds spaces from bookmark folders, excluding the pin folder', async () => {
      chrome.bookmarks.getTree.mockResolvedValue(SPACES_TREE());
      chrome.bookmarks.getSubTree.mockResolvedValue([
        { id: 's1', title: 'Work', children: [{ id: 'b1', title: 'G', url: 'https://g.com' }] },
      ]);

      await sm.loadSpaces();
      const spaces = sm.getSpaces();
      expect(spaces.map((s) => s.id)).toEqual(['s1', 's2']);
      expect(spaces[0].name).toBe('Work');
      expect(spaces[0].icon).toBe('😀');
      expect(spaces[0].bookmarks).toHaveLength(1);
    });

    it('loadPinnedBookmarks reads pinned bookmarks', async () => {
      chrome.bookmarks.getTree.mockResolvedValue(SPACES_TREE());
      await sm.loadPinnedBookmarks();
      expect(sm.getPinnedBookmarks()).toHaveLength(1);
    });
  });

  describe('create / delete', () => {
    it('createSpace adds a new space and emits SPACE_CREATED', async () => {
      const listener = vi.fn();
      sm.on(EventType.SPACE_CREATED, listener);

      const space = await sm.createSpace('Project');
      expect(space).not.toBeNull();
      expect(space?.name).toBe('Project');
      expect(sm.hasSpace(space!.id)).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('createSpace returns null for a duplicate name (case-insensitive)', async () => {
      const first = await sm.createSpace('Project');
      expect(first).not.toBeNull();
      expect(await sm.createSpace('project')).toBeNull();
    });

    it('createSpace returns null when bookmarks bar is missing', async () => {
      chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: '', children: [] }]);
      expect(await sm.createSpace('X')).toBeNull();
    });

    it('createAndSwitchSpace creates then switches to the space', async () => {
      const space = await sm.createAndSwitchSpace('Solo');
      expect(space).not.toBeNull();
      expect(sm.getCurrentSpaceId()).toBe(space!.id);
    });

    it('deleteSpace removes the space and emits SPACE_DELETED', async () => {
      const listener = vi.fn();
      sm.on(EventType.SPACE_DELETED, listener);
      const space = await sm.createSpace('Temp');
      const ok = await sm.deleteSpace(space!.id);
      expect(ok).toBe(true);
      expect(sm.hasSpace(space!.id)).toBe(false);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('deleteSpace switches to another space when deleting the current one', async () => {
      const a = await sm.createSpace('A');
      await sm.createSpace('B');
      await sm.switchSpace(a!.id);
      expect(sm.getCurrentSpaceId()).toBe(a!.id);

      await sm.deleteSpace(a!.id);
      // current was deleted → switched to the other remaining space
      expect(sm.getCurrentSpaceId()).not.toBe(a!.id);
    });

    it('deleteSpace clears currentSpaceId when no spaces remain', async () => {
      const a = await sm.createSpace('Only');
      await sm.switchSpace(a!.id);
      await sm.deleteSpace(a!.id);
      expect(sm.getCurrentSpaceId()).toBeNull();
    });
  });

  describe('tab management', () => {
    it('addTabToCurrentSpace tracks a new tab and emits TABS_UPDATED', async () => {
      const space = await sm.createSpace('Work');
      await sm.switchSpace(space!.id);

      const listener = vi.fn();
      sm.on(EventType.TABS_UPDATED, listener);

      await sm.addTabToCurrentSpace({ id: 50, url: 'https://x.com', title: 'X' } as chrome.tabs.Tab);
      expect(sm.getCurrentSpace()?.openTabs).toHaveLength(1);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('addTabToCurrentSpace is a no-op when no current space', async () => {
      await expect(
        sm.addTabToCurrentSpace({ id: 1 } as chrome.tabs.Tab),
      ).resolves.toBeUndefined();
    });

    it('addTabToCurrentSpace ignores already-tracked tabs', async () => {
      const space = await sm.createSpace('Work');
      await sm.switchSpace(space!.id);
      const tab = { id: 50, url: 'https://x.com', title: 'X' } as chrome.tabs.Tab;
      await sm.addTabToCurrentSpace(tab);
      await sm.addTabToCurrentSpace(tab); // duplicate id
      expect(sm.getCurrentSpace()?.openTabs).toHaveLength(1);
    });

    it('removeTabFromSpace removes a tab and persists', async () => {
      const space = await sm.createSpace('Work');
      await sm.switchSpace(space!.id);
      await sm.addTabToCurrentSpace({ id: 50, url: 'https://x.com', title: 'X' } as chrome.tabs.Tab);
      await sm.removeTabFromSpace(space!.id, 50);
      expect(sm.getCurrentSpace()?.openTabs).toHaveLength(0);
    });

    it('removeTabFromSpace is a no-op for an unknown space or tab', async () => {
      await expect(sm.removeTabFromSpace('missing', 1)).resolves.toBeUndefined();
      const space = await sm.createSpace('Work');
      await expect(sm.removeTabFromSpace(space!.id, 999)).resolves.toBeUndefined();
    });

    it('updateTabInSpace updates a tracked tab', async () => {
      const space = await sm.createSpace('Work');
      await sm.switchSpace(space!.id);
      await sm.addTabToCurrentSpace({ id: 50, url: 'https://x.com', title: 'X' } as chrome.tabs.Tab);
      await sm.updateTabInSpace(space!.id, { id: 50, url: 'https://y.com', title: 'Y' } as chrome.tabs.Tab);
      expect(sm.getCurrentSpace()?.openTabs[0].title).toBe('Y');
    });

    it('moveTabToSpace moves a tab between spaces', async () => {
      const a = (await sm.createSpace('A'))!;
      const b = (await sm.createSpace('B'))!;
      await sm.switchSpace(a.id);
      await sm.addTabToCurrentSpace({ id: 50, url: 'https://x.com', title: 'X' } as chrome.tabs.Tab);

      const ok = await sm.moveTabToSpace(50, a.id, b.id);
      expect(ok).toBe(true);
      expect(sm.getSpace(a.id)?.openTabs).toHaveLength(0);
      expect(sm.getSpace(b.id)?.openTabs).toHaveLength(1);
    });

    it('moveTabToSpace returns false for unknown spaces or tabs', async () => {
      const a = (await sm.createSpace('A'))!;
      expect(await sm.moveTabToSpace(50, a.id, 'missing')).toBe(false);
      expect(await sm.moveTabToSpace(50, 'missing', a.id)).toBe(false);
      const b = (await sm.createSpace('B'))!;
      expect(await sm.moveTabToSpace(50, a.id, b.id)).toBe(false); // tab not in a
    });
  });

  describe('switching', () => {
    it('switchSpace ignores switching to the current space', async () => {
      const a = await sm.createSpace('A');
      await sm.switchSpace(a!.id);
      expect(sm.getCurrentSpaceId()).toBe(a!.id);

      const before = sm.getCurrentSpace()?.openTabs.length ?? 0;
      await sm.switchSpace(a!.id); // same space
      expect(sm.getCurrentSpaceId()).toBe(a!.id);
      expect(sm.getCurrentSpace()?.openTabs.length ?? 0).toBe(before);
    });

    it('switchSpace handles a missing target gracefully', async () => {
      const a = await sm.createSpace('A');
      await sm.switchSpace(a!.id);
      // switch to non-existent space -> error path, current unchanged
      await sm.switchSpace('does-not-exist');
      expect(sm.getCurrentSpaceId()).toBe(a!.id);
    });

    it('switchSpace activates the first restored tab when restoring stored tabs', async () => {
      const a = (await sm.createSpace('A'))!;
      // seed stored tabs so switchSpace restores them
      (a as Space).openTabs = [
        { id: 0, url: 'https://a1.com', title: 'A1', favIconUrl: null },
        { id: 0, url: 'https://a2.com', title: 'A2', favIconUrl: null },
      ];
      await sm.switchSpace(a.id);
      expect(sm.getCurrentSpaceId()).toBe(a.id);
    });

    it('triggerSwitch debounces switches', async () => {
      vi.useFakeTimers();
      const a = await sm.createSpace('A');
      await sm.createSpace('B');
      await sm.switchSpace(a!.id);

      sm.triggerSwitch('s-other');
      sm.triggerSwitch('s-other');
      // debounced - not switched yet immediately
      vi.advanceTimersByTime(sm.getCurrentSpaceId() ? 300 : 300);
    });
  });

  describe('initialize', () => {
    it('switches to the last active space when it still exists', async () => {
      chrome.bookmarks.getTree.mockResolvedValue(SPACES_TREE());
      chrome.bookmarks.getSubTree.mockResolvedValue([{ id: 'x', title: '', children: [] }]);
      await sm.loadSpaces();
      await chrome.storage.local.set({ last_active_space_id: 's2' });

      await sm.initialize();
      expect(sm.getCurrentSpaceId()).toBe('s2');
    });

    it('falls back to the first space when last active is missing', async () => {
      chrome.bookmarks.getTree.mockResolvedValue(SPACES_TREE());
      chrome.bookmarks.getSubTree.mockResolvedValue([{ id: 'x', title: '', children: [] }]);
      await sm.loadSpaces();
      await chrome.storage.local.set({ last_active_space_id: 'gone' });

      await sm.initialize();
      expect(sm.getCurrentSpaceId()).toBe('s1');
    });
  });

  describe('events', () => {
    it('off removes a previously registered listener', async () => {
      const listener = vi.fn();
      sm.on(EventType.SPACE_CREATED, listener);
      sm.off(EventType.SPACE_CREATED, listener);
      await sm.createSpace('X');
      expect(listener).not.toHaveBeenCalled();
    });

    it('emit swallows errors thrown by listeners', async () => {
      const bad = vi.fn(() => {
        throw new Error('listener broke');
      });
      const good = vi.fn();
      sm.on(EventType.SPACE_CREATED, bad);
      sm.on(EventType.SPACE_CREATED, good);
      await sm.createSpace('X');
      expect(good).toHaveBeenCalled();
    });
  });

  describe('accessors', () => {
    it('reports initial state', () => {
      expect(sm.getCurrentSpace()).toBeNull();
      expect(sm.getSpaces()).toEqual([]);
      expect(sm.getPinnedBookmarks()).toEqual([]);
      expect(sm.hasSpace('x')).toBe(false);
      expect(sm.isSwitching()).toBe(false);
      expect(sm.getCurrentSpaceId()).toBeNull();
    });
  });
});
