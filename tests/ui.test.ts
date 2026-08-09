/**
 * UI components tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListItemComponent } from '@ui/components/ListItemComponent';
import { ListComponent } from '@ui/components/ListComponent';
import { ContextMenu } from '@ui/components/ContextMenu';
import type { TabData } from '@types/index';

describe('UI Components', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // Sidebar bookmark/tab rows are rendered by ListItemComponent
  describe('ListItemComponent', () => {
    it('should render title and favicon, and route delete clicks without triggering item click', () => {
      const data: TabData = {
        id: 1,
        url: 'https://example.com',
        title: 'Example',
        favIconUrl: 'https://example.com/f.ico',
      };
      const onClick = vi.fn();
      const onDelete = vi.fn();

      const item = new ListItemComponent({ data, onClick, onDelete, showDeleteButton: true });
      const el = item.getElement();

      expect(el.querySelector('.item-text')?.textContent).toBe('Example');
      expect((el.querySelector('.favicon') as HTMLImageElement).src).toBe('https://example.com/f.ico');

      el.querySelector<HTMLElement>('.delete-btn')!.click();
      expect(onDelete).toHaveBeenCalledWith(data);
      expect(onClick).not.toHaveBeenCalled();

      el.click();
      expect(onClick).toHaveBeenCalledWith(data);
    });
  });

  // Space bookmark lists show an empty message when a space has no items
  describe('ListComponent', () => {
    it('should show the empty message for no items and render items via the factory', () => {
      document.body.innerHTML = '<ul id="bookmark-list"></ul>';
      const list = new ListComponent({ containerId: 'bookmark-list', emptyMessage: 'No bookmarks' });
      const factory = (data: TabData) => new ListItemComponent({ data, onClick: () => {} });

      list.renderItems([], factory);
      expect(document.querySelector('.empty-message')?.textContent).toBe('No bookmarks');
      expect(list.getCount()).toBe(0);

      list.renderItems([{ id: 1, url: 'https://a.com', title: 'A', favIconUrl: null }], factory);
      expect(document.querySelector('.empty-message')).toBeNull();
      expect(list.getCount()).toBe(1);
      expect(document.querySelector('.item-text')?.textContent).toBe('A');
    });
  });

  // Right-clicking a tab opens a ContextMenu; choosing an item runs its action and closes the menu
  describe('ContextMenu', () => {
    it('should run the item action on click and remove the menu from the DOM', async () => {
      const action = vi.fn();
      new ContextMenu({ items: [{ label: 'Close tab', action }] });

      const menuEl = document.querySelector('.custom-context-menu');
      expect(menuEl).not.toBeNull();
      expect(menuEl?.querySelector('.context-menu-label')?.textContent).toBe('Close tab');

      menuEl!.querySelector<HTMLElement>('.context-menu-item')!.click();
      // The click handler is async (await action(); close()), let it finish
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(action).toHaveBeenCalledTimes(1);
      expect(document.querySelector('.custom-context-menu')).toBeNull();
    });
  });
});
