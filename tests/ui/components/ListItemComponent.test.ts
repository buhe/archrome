/**
 * Tests for src/ui/components/ListItemComponent.ts
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { ListItemComponent } from '@ui/components/ListItemComponent';
import type { TabData } from '@types/index';

// Sidebar bookmark/tab rows (favicon + title + optional delete button)
describe('ListItemComponent', () => {
  afterEach(() => vi.useRealTimers());

  it('should render favicon and title, and fire click/delete handlers independently', () => {
    const data: TabData = {
      id: 1,
      url: 'https://example.com',
      title: 'Example',
      favIconUrl: 'https://example.com/favicon.ico',
    };
    const onClick = vi.fn();
    const onDelete = vi.fn();

    const item = new ListItemComponent({ data, onClick, onDelete, showDeleteButton: true });
    const el = item.getElement();

    expect(el.tagName).toBe('LI');
    expect(el.classList.contains('item-list-item')).toBe(true);
    expect(el.dataset.id).toBe('1');

    const favicon = el.querySelector('.favicon') as HTMLImageElement;
    expect(favicon.src).toBe('https://example.com/favicon.ico');
    expect(el.querySelector('.item-text')?.textContent).toBe('Example');

    const deleteBtn = el.querySelector('.delete-btn') as HTMLElement;
    expect(deleteBtn).toBeTruthy();

    // Delete click should not also trigger the row click
    deleteBtn.click();
    expect(onDelete).toHaveBeenCalledWith(data);
    expect(onClick).not.toHaveBeenCalled();

    el.click();
    expect(onClick).toHaveBeenCalledWith(data);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('fires the context menu handler on right-click', () => {
    const data: TabData = { id: 2, url: 'https://a.com', title: 'A', favIconUrl: null };
    const onContextMenu = vi.fn();
    const item = new ListItemComponent({ data, onClick: vi.fn(), onContextMenu });
    item.getElement().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    expect(onContextMenu).toHaveBeenCalled();
  });

  it('update replaces the displayed title and favicon', () => {
    const item = new ListItemComponent({
      data: { id: 1, url: 'https://a.com', title: 'A', favIconUrl: null },
      onClick: vi.fn(),
    });
    item.update({ id: 1, url: 'https://b.com', title: 'B', favIconUrl: 'https://b.com/f.ico' });
    expect(item.getElement().querySelector('.item-text')?.textContent).toBe('B');
  });

  it('is draggable and carries its data on dragstart', () => {
    const item = new ListItemComponent({
      data: { id: 1, url: 'https://a.com', title: 'A', favIconUrl: null },
      onClick: vi.fn(),
      draggable: true,
    });
    const el = item.getElement();
    expect(el.draggable).toBe(true);

    const dt = { setData: vi.fn(), effectAllowed: '' };
    const start = new Event('dragstart', { bubbles: true });
    (start as unknown as { dataTransfer: unknown }).dataTransfer = dt;
    el.dispatchEvent(start);
    expect(dt.setData).toHaveBeenCalledWith('text/plain', expect.stringContaining('"id":1'));
    el.dispatchEvent(new Event('dragend'));
    expect(el.classList.contains('dragging')).toBe(false);
  });

  it('animate adds then removes the class', () => {
    vi.useFakeTimers();
    const item = new ListItemComponent({
      data: { id: 1, url: 'https://a.com', title: 'A', favIconUrl: null },
      onClick: vi.fn(),
    });
    item.animate('flash');
    expect(item.getElement().classList.contains('flash')).toBe(true);
    vi.advanceTimersByTime(600);
    expect(item.getElement().classList.contains('flash')).toBe(false);
  });

  it('setLoading and setDisabled toggle classes and pointer events', () => {
    const item = new ListItemComponent({
      data: { id: 1, url: 'https://a.com', title: 'A', favIconUrl: null },
      onClick: vi.fn(),
    });
    const el = item.getElement();
    item.setLoading(true);
    expect(el.classList.contains('loading')).toBe(true);
    item.setLoading(false);
    expect(el.classList.contains('loading')).toBe(false);

    item.setDisabled(true);
    expect(el.classList.contains('disabled')).toBe(true);
    expect(el.style.pointerEvents).toBe('none');
    item.setDisabled(false);
    expect(el.style.pointerEvents).toBe('');
  });

  it('removeClass removes a previously added class', () => {
    const item = new ListItemComponent({
      data: { id: 1, url: 'https://a.com', title: 'A', favIconUrl: null },
      onClick: vi.fn(),
    });
    item.addClass('x');
    expect(item.getElement().classList.contains('x')).toBe(true);
    item.removeClass('x');
    expect(item.getElement().classList.contains('x')).toBe(false);
    item.remove();
    expect(item.getElement().parentNode).toBeNull();
  });
});
