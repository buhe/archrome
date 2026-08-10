/**
 * Tests for src/ui/components/ListComponent.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ListComponent } from '@ui/components/ListComponent';
import { ListItemComponent } from '@ui/components/ListItemComponent';
import type { TabData } from '@types/index';

// Space bookmark/tab lists in the sidebar show an empty message when there are no items
describe('ListComponent', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('ul');
    container.id = 'bookmarks-list';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
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

  it('throws when the container does not exist', () => {
    expect(() => new ListComponent({ containerId: 'missing' })).toThrow(
      'Container with id "missing" not found',
    );
  });

  it('showEmptyMessage with no message clears the container', () => {
    const list = new ListComponent({ containerId: 'bookmarks-list', emptyMessage: '' });
    list.showEmptyMessage();
    expect(container.children.length).toBe(0);
  });

  it('addItem / getItem / removeItem / updateItem manage items', () => {
    const list = new ListComponent({ containerId: 'bookmarks-list' });
    const data: TabData = { id: 7, url: 'https://a.com', title: 'A', favIconUrl: null };
    const item = new ListItemComponent({ data, onClick: vi.fn() });
    list.addItem(item);

    // addItem keys items by the (stringified) dataset id
    expect(list.getItem('7')).toBe(item);
    expect(list.getAllItems()).toHaveLength(1);
    list.updateItem('7', { id: 7, url: 'https://b.com', title: 'B', favIconUrl: null });
    expect(item.getElement().querySelector('.item-text')?.textContent).toBe('B');
    list.removeItem('7');
    expect(list.getItem('7')).toBeUndefined();
  });

  it('removeItem is a no-op for unknown ids', () => {
    const list = new ListComponent({ containerId: 'bookmarks-list' });
    expect(() => list.removeItem('999')).not.toThrow();
  });

  it('setDisabled toggles pointer events and the disabled class', () => {
    const list = new ListComponent({ containerId: 'bookmarks-list' });
    list.renderItems(
      [{ id: 1, url: 'https://a.com', title: 'A', favIconUrl: null }],
      (data) => new ListItemComponent({ data, onClick: vi.fn() }),
    );
    list.setDisabled(true);
    expect(container.classList.contains('disabled')).toBe(true);
    expect(container.style.pointerEvents).toBe('none');
    list.setDisabled(false);
    expect(container.classList.contains('disabled')).toBe(false);
  });

  it('setLoading toggles the loading class', () => {
    const list = new ListComponent({ containerId: 'bookmarks-list' });
    list.setLoading(true);
    expect(container.classList.contains('loading')).toBe(true);
    list.setLoading(false);
    expect(container.classList.contains('loading')).toBe(false);
  });

  it('highlightItem adds then removes the highlight class', () => {
    vi.useFakeTimers();
    const list = new ListComponent({ containerId: 'bookmarks-list' });
    list.renderItems(
      [{ id: 1, url: 'https://a.com', title: 'A', favIconUrl: null }],
      (data) => new ListItemComponent({ data, onClick: vi.fn() }),
    );
    list.highlightItem('1', 1000);
    expect(list.getItem('1')!.getElement().classList.contains('highlight')).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(list.getItem('1')!.getElement().classList.contains('highlight')).toBe(false);
  });

  it('drag-and-drop hands dropped item data to onDrop', async () => {
    const onDrop = vi.fn();
    const list = new ListComponent({ containerId: 'bookmarks-list', allowDrop: true, onDrop });
    const event = new Event('drop', { bubbles: true });
    (event as unknown as { dataTransfer: { getData: (t: string) => string } }).dataTransfer = {
      getData: () => JSON.stringify({ id: 5, url: 'https://x.com', title: 'X' }),
    };
    container.dispatchEvent(event);
    await vi.waitFor(() => expect(onDrop).toHaveBeenCalled());
    expect(onDrop.mock.calls[0][0]).toMatchObject({ id: 5, url: 'https://x.com' });
  });

  it('destroy clears the container', () => {
    const list = new ListComponent({ containerId: 'bookmarks-list' });
    list.renderItems(
      [{ id: 1, url: 'https://a.com', title: 'A', favIconUrl: null }],
      (data) => new ListItemComponent({ data, onClick: vi.fn() }),
    );
    list.destroy();
    expect(container.children.length).toBe(0);
  });
});
