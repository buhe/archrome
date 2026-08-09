/**
 * Tests for src/ui/components/ListItemComponent.ts
 */

import { describe, it, expect, vi } from 'vitest';
import { ListItemComponent } from '@ui/components/ListItemComponent';
import type { TabData } from '@types/index';

// Sidebar bookmark/tab rows (favicon + title + optional delete button)
describe('ListItemComponent', () => {
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
});
