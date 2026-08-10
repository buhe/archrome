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

  it('renders a hover submenu and runs the sub-item action on click', async () => {
    const subAction = vi.fn();
    const menu = new ContextMenu({
      items: [{ label: 'Move to', items: [{ label: 'Work', action: subAction }] }],
    });

    const item = document.querySelector('.context-menu-item') as HTMLElement;
    expect(item.classList.contains('has-submenu')).toBe(true);

    const submenu = item.querySelector('.context-submenu') as HTMLElement;
    expect(submenu.style.display).toBe('none');

    item.dispatchEvent(new Event('mouseenter', { bubbles: true }));
    expect(submenu.style.display).toBe('block');
    item.dispatchEvent(new Event('mouseleave', { bubbles: true }));
    expect(submenu.style.display).toBe('none');

    // Reopen and click the sub-item
    item.dispatchEvent(new Event('mouseenter', { bubbles: true }));
    (submenu.querySelector('.context-menu-item') as HTMLElement).click();
    await vi.waitFor(() => expect(subAction).toHaveBeenCalledTimes(1));
    expect(document.querySelector('.custom-context-menu')).toBeNull();

    menu.destroy();
  });

  it('setPosition keeps the menu inside the viewport', () => {
    const menu = new ContextMenu({ items: [{ label: 'X', action: vi.fn() }] });
    // Force large offsets so clamping triggers
    Object.defineProperty(window, 'innerWidth', { value: 300, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 300, configurable: true });
    menu.setPosition(5000, 5000);
    const el = document.querySelector('.custom-context-menu') as HTMLElement;
    expect(Number(parseFloat(el.style.left))).toBeLessThan(5000);
    expect(Number(parseFloat(el.style.top))).toBeLessThan(5000);
    menu.destroy();
  });

  it('show and hide toggle the display style', () => {
    const menu = new ContextMenu({ items: [{ label: 'X', action: vi.fn() }] });
    menu.hide();
    expect((document.querySelector('.custom-context-menu') as HTMLElement).style.display).toBe('none');
    menu.show();
    expect((document.querySelector('.custom-context-menu') as HTMLElement).style.display).toBe('block');
    menu.destroy();
  });

  it('createMoveToSubmenu excludes the current space and the pin folder', () => {
    const onMove = vi.fn();
    const item = ContextMenu.createMoveToSubmenu(
      [
        { id: '1', name: 'Current' },
        { id: '2', name: 'Work' },
        { id: '3', name: 'pin' },
      ],
      '1',
      onMove,
    );
    expect(item.label).toBe('Move to');
    expect(item.items?.map((i) => i.label)).toEqual(['Work']);
    item.items?.[0].action();
    expect(onMove).toHaveBeenCalledWith('2');
  });

  it('closes when clicking outside the menu', async () => {
    const onClose = vi.fn();
    const menu = new ContextMenu({ items: [{ label: 'X', action: vi.fn() }], onClose });
    // The outside-click listener is registered on the next tick
    await new Promise((r) => setTimeout(r, 0));
    document.body.click();
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
