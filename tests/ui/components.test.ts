/**
 * UI component tests for sidebar list items, lists, and context menus
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ListItemComponent } from '@ui/components/ListItemComponent';
import { ListComponent } from '@ui/components/ListComponent';
import { ContextMenu } from '@ui/components/ContextMenu';

describe('UI Components', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // Bookmark/tab rows in the sidebar (favicon + title + optional delete)
  describe('ListItemComponent', () => {
    it('should render a list item with favicon, title, and fire click/delete handlers', () => {
      const onClick = vi.fn();
      const onDelete = vi.fn();
      const bookmark = {
        id: 'bm-1',
        title: 'Example',
        url: 'https://example.com',
        favIconUrl: 'https://example.com/favicon.ico',
      };

      const item = new ListItemComponent({
        data: bookmark,
        onClick,
        onDelete,
        showDeleteButton: true,
      });

      const el = item.getElement();
      expect(el.tagName).toBe('LI');
      expect(el.classList.contains('item-list-item')).toBe(true);
      expect(el.dataset.id).toBe('bm-1');

      const favicon = el.querySelector('.favicon') as HTMLImageElement;
      expect(favicon).toBeTruthy();
      expect(favicon.src).toBe('https://example.com/favicon.ico');

      const text = el.querySelector('.item-text') as HTMLElement;
      expect(text.textContent).toBe('Example');

      const deleteBtn = el.querySelector('.delete-btn') as HTMLElement;
      expect(deleteBtn).toBeTruthy();

      el.click();
      expect(onClick).toHaveBeenCalledWith(bookmark);

      deleteBtn.click();
      expect(onDelete).toHaveBeenCalledWith(bookmark);
      // Delete click should not also trigger the row click again
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  // Bookmarks / tabs / pinned lists in the sidebar
  describe('ListComponent', () => {
    beforeEach(() => {
      const container = document.createElement('ul');
      container.id = 'bookmarks-list';
      document.body.appendChild(container);
    });

    it('should show empty message, then render items and report count', () => {
      const list = new ListComponent({
        containerId: 'bookmarks-list',
        emptyMessage: 'No bookmarks in this space.',
      });

      list.renderItems([], () => {
        throw new Error('factory should not run for empty data');
      });

      const empty = document.querySelector('#bookmarks-list .empty-message');
      expect(empty?.textContent).toBe('No bookmarks in this space.');
      expect(list.isEmpty()).toBe(true);
      expect(list.getCount()).toBe(0);

      const tabs = [
        { id: 1, url: 'https://a.com', title: 'A', favIconUrl: null },
        { id: 2, url: 'https://b.com', title: 'B', favIconUrl: null },
      ];

      list.renderItems(tabs, (data) =>
        new ListItemComponent({
          data,
          onClick: vi.fn(),
        }),
      );

      expect(list.getCount()).toBe(2);
      expect(list.isEmpty()).toBe(false);
      expect(document.querySelectorAll('#bookmarks-list .item-list-item')).toHaveLength(2);
      expect(document.querySelector('#bookmarks-list .empty-message')).toBeNull();
    });
  });

  // Right-click menu for tabs/bookmarks (e.g. Move to, Delete)
  describe('ContextMenu', () => {
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

      // action is async in the component; wait a tick for it to settle
      await vi.waitFor(() => {
        expect(action).toHaveBeenCalledTimes(1);
      });

      expect(document.querySelector('.custom-context-menu')).toBeNull();
      expect(onClose).toHaveBeenCalledTimes(1);

      // close() already removed the menu; destroy is safe to call for cleanup
      menu.destroy();
    });
  });
});
