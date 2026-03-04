/**
 * List Component - Base class for lists (bookmarks, tabs, pinned)
 */

import type { ListItemData } from './ListItemComponent';
import { ListItemComponent } from './ListItemComponent';

export interface ListOptions {
  containerId: string;
  emptyMessage?: string;
  allowDrop?: boolean;
  onDrop?: (data: ListItemData) => void | Promise<void>;
  onDragOver?: (event: DragEvent) => void;
}

/**
 * Base class for lists
 */
export class ListComponent {
  protected container: HTMLElement;
  protected options: ListOptions;
  protected items: Map<string | number, ListItemComponent> = new Map();
  protected emptyMessage: string;

  constructor(options: ListOptions) {
    this.options = options;
    this.container = document.getElementById(options.containerId)!;
    this.emptyMessage = options.emptyMessage || 'No items';

    if (!this.container) {
      throw new Error(`Container with id "${options.containerId}" not found`);
    }

    this.setupDropZone();
  }

  /**
   * Setup drop zone for drag and drop
   */
  protected setupDropZone(): void {
    if (!this.options.allowDrop || !this.options.onDrop) {
      return;
    }

    this.container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'move';

      if (this.options.onDragOver) {
        this.options.onDragOver(e);
      }

      this.container.classList.add('drag-over');
    });

    this.container.addEventListener('dragleave', () => {
      this.container.classList.remove('drag-over');
    });

    this.container.addEventListener('drop', async (e) => {
      e.preventDefault();
      this.container.classList.remove('drag-over');

      try {
        const data = JSON.parse(e.dataTransfer!.getData('text/plain'));
        await this.options.onDrop?.(data);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error processing drop:', error);
      }
    });
  }

  /**
   * Add an item to the list
   */
  addItem(item: ListItemComponent): void {
    const id = item.getElement().dataset.id || item['options'].data.id;
    this.items.set(id, item);
    this.container.appendChild(item.getElement());
  }

  /**
   * Remove an item from the list
   */
  removeItem(id: string | number): void {
    const item = this.items.get(id);
    if (item) {
      item.remove();
      this.items.delete(id);
    }
  }

  /**
   * Update an item in the list
   */
  updateItem(id: string | number, data: ListItemData): void {
    const item = this.items.get(id);
    if (item) {
      item.update(data);
    }
  }

  /**
   * Clear all items from the list
   */
  clear(): void {
    this.items.forEach((item) => item.remove());
    this.items.clear();
  }

  /**
   * Render items with a factory function
   */
  renderItems(
    itemsData: ListItemData[],
    factory: (data: ListItemData) => ListItemComponent,
  ): void {
    this.clear();

    if (itemsData.length === 0) {
      this.showEmptyMessage();
      return;
    }

    itemsData.forEach((data) => {
      const item = factory(data);
      this.addItem(item);
    });
  }

  /**
   * Show empty message
   */
  showEmptyMessage(): void {
    this.container.innerHTML = `<li class="empty-message">${this.emptyMessage}</li>`;
  }

  /**
   * Get an item by ID
   */
  getItem(id: string | number): ListItemComponent | undefined {
    return this.items.get(id);
  }

  /**
   * Get all items
   */
  getAllItems(): ListItemComponent[] {
    return Array.from(this.items.values());
  }

  /**
   * Get the count of items
   */
  getCount(): number {
    return this.items.size;
  }

  /**
   * Check if the list is empty
   */
  isEmpty(): boolean {
    return this.items.size === 0;
  }

  /**
   * Set loading state
   */
  setLoading(loading: boolean): void {
    if (loading) {
      this.container.classList.add('loading');
    } else {
      this.container.classList.remove('loading');
    }
  }

  /**
   * Disable the list
   */
  setDisabled(disabled: boolean): void {
    if (disabled) {
      this.container.classList.add('disabled');
      this.container.style.pointerEvents = 'none';
    } else {
      this.container.classList.remove('disabled');
      this.container.style.pointerEvents = '';
    }

    this.items.forEach((item) => item.setDisabled(disabled));
  }

  /**
   * Scroll to an item
   */
  scrollToItem(id: string | number): void {
    const item = this.items.get(id);
    if (item) {
      item.getElement().scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /**
   * Highlight an item temporarily
   */
  highlightItem(id: string | number, duration = 2000): void {
    const item = this.items.get(id);
    if (item) {
      item.addClass('highlight');
      setTimeout(() => {
        item.removeClass('highlight');
      }, duration);
    }
  }

  /**
   * Destroy the list component
   */
  destroy(): void {
    this.clear();
    this.container.innerHTML = '';
  }
}
