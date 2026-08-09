/**
 * Tests for src/ui/components/ContextMenu.ts
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { ContextMenu } from '@ui/components/ContextMenu';

// Right-click menu for tabs/bookmarks (e.g. Move to, Delete)
describe('ContextMenu', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should render menu items, run the action on click, and close', async () => {
    const onClose = vi.fn();
    const action = vi.fn();

    const menu = new ContextMenu({
      items: [
        { label: 'Open', action },
        { label: 'Delete', action: vi.fn(), icon: '🗑' },
      ],
      position: { x: 40, y: 80 },
      onClose,
    });

    const root = document.querySelector('.custom-context-menu') as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.getAttribute('role')).toBe('menu');
    expect(root.style.left).toBe('40px');
    expect(root.style.top).toBe('80px');

    const labels = Array.from(root.querySelectorAll('.context-menu-label')).map(
      (node) => node.textContent,
    );
    expect(labels).toEqual(['Open', 'Delete']);

    const openItem = root.querySelectorAll('.context-menu-item')[0] as HTMLElement;
    openItem.click();

    // The click handler is async (await action(); close()); wait a tick for it to settle
    await vi.waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
    });

    expect(document.querySelector('.custom-context-menu')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);

    menu.destroy();
  });
});
