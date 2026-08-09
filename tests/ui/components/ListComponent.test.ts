/**
 * Tests for src/ui/components/ListComponent.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ListComponent } from '@ui/components/ListComponent';
import { ListItemComponent } from '@ui/components/ListItemComponent';
import type { TabData } from '@types/index';

// Space bookmark/tab lists in the sidebar show an empty message when there are no items
describe('ListComponent', () => {
  beforeEach(() => {
    const container = document.createElement('ul');
    container.id = 'bookmarks-list';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should show the empty message for no items, then render items via the factory', () => {
    const list = new ListComponent({
      containerId: 'bookmarks-list',
      emptyMessage: 'No bookmarks in this space.',
    });

    list.renderItems([], () => {
      throw new Error('factory should not run for empty data');
    });

    expect(document.querySelector('#bookmarks-list .empty-message')?.textContent).toBe(
      'No bookmarks in this space.',
    );
    expect(list.isEmpty()).toBe(true);
    expect(list.getCount()).toBe(0);

    const tabs: TabData[] = [
      { id: 1, url: 'https://a.com', title: 'A', favIconUrl: null },
      { id: 2, url: 'https://b.com', title: 'B', favIconUrl: null },
    ];
    list.renderItems(tabs, (data) => new ListItemComponent({ data, onClick: vi.fn() }));

    expect(list.getCount()).toBe(2);
    expect(list.isEmpty()).toBe(false);
    expect(document.querySelectorAll('#bookmarks-list .item-list-item')).toHaveLength(2);
    expect(document.querySelector('#bookmarks-list .empty-message')).toBeNull();
    expect(document.querySelector('#bookmarks-list .item-text')?.textContent).toBe('A');
  });
});
