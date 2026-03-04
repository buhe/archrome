/**
 * List Item Component - Base class for list items (bookmarks, tabs)
 */

import type { BookmarkData, TabData } from '@types/index';
import { getFaviconUrl, getDisplayText } from '@utils/index';

export type ListItemData = BookmarkData | TabData;

export interface ListItemOptions {
  data: ListItemData;
  onClick: (data: ListItemData) => void;
  onDelete?: (data: ListItemData) => void;
  onContextMenu?: (data: ListItemData, event: MouseEvent) => void;
  draggable?: boolean;
  showDeleteButton?: boolean;
}

/**
 * Base class for list items
 */
export class ListItemComponent {
  protected element: HTMLLIElement;
  protected options: ListItemOptions;

  constructor(options: ListItemOptions) {
    this.options = options;
    this.element = this.createElement();
  }

  /**
   * Create the list item element
   */
  protected createElement(): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'item-list-item';
    li.dataset.id = this.options.data.id.toString();

    // Add draggable attribute if needed
    if (this.options.draggable) {
      li.draggable = true;
      this.setupDragEvents(li);
    }

    // Create favicon
    const favicon = document.createElement('img');
    favicon.className = 'favicon';
    favicon.src = getFaviconUrl(this.options.data);
    favicon.onerror = () => {
      favicon.src = 'icons/default_favicon.png';
    };
    li.appendChild(favicon);

    // Create text
    const text = document.createElement('span');
    text.className = 'item-text';
    text.textContent = getDisplayText(
      this.options.data.title,
      this.options.data.url,
    );
    li.appendChild(text);

    // Add delete button if needed
    if (this.options.showDeleteButton && this.options.onDelete) {
      const deleteBtn = document.createElement('span');
      deleteBtn.innerHTML = '&#x2715;';
      deleteBtn.className = 'delete-btn';
      deleteBtn.title = 'Delete';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.options.onDelete?.(this.options.data);
      });
      li.appendChild(deleteBtn);
    }

    // Add click handler
    li.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).classList.contains('delete-btn')) {
        this.options.onClick(this.options.data);
      }
    });

    // Add context menu handler
    if (this.options.onContextMenu) {
      li.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.options.onContextMenu?.(this.options.data, e);
      });
    }

    return li;
  }

  /**
   * Setup drag events
   */
  protected setupDragEvents(element: HTMLLIElement): void {
    element.addEventListener('dragstart', (e) => {
      const dragData = {
        id: this.options.data.id,
        url: this.options.data.url,
        title: this.options.data.title,
      };
      e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'move';
      element.classList.add('dragging');
    });

    element.addEventListener('dragend', () => {
      element.classList.remove('dragging');
    });
  }

  /**
   * Get the DOM element
   */
  getElement(): HTMLLIElement {
    return this.element;
  }

  /**
   * Update the item data
   */
  update(data: ListItemData): void {
    this.options.data = data;

    const text = this.element.querySelector('.item-text') as HTMLElement;
    if (text) {
      text.textContent = getDisplayText(data.title, data.url);
    }

    const favicon = this.element.querySelector('.favicon') as HTMLImageElement;
    if (favicon) {
      favicon.src = getFaviconUrl(data);
    }
  }

  /**
   * Remove the item from DOM
   */
  remove(): void {
    this.element.remove();
  }

  /**
   * Add a CSS class
   */
  addClass(className: string): void {
    this.element.classList.add(className);
  }

  /**
   * Remove a CSS class
   */
  removeClass(className: string): void {
    this.element.classList.remove(className);
  }

  /**
   * Animate the item
   */
  animate(animationClass: string): void {
    this.element.classList.add(animationClass);
    setTimeout(() => {
      this.element.classList.remove(animationClass);
    }, 600);
  }

  /**
   * Show loading state
   */
  setLoading(loading: boolean): void {
    if (loading) {
      this.element.classList.add('loading');
    } else {
      this.element.classList.remove('loading');
    }
  }

  /**
   * Disable the item
   */
  setDisabled(disabled: boolean): void {
    if (disabled) {
      this.element.classList.add('disabled');
      this.element.style.pointerEvents = 'none';
    } else {
      this.element.classList.remove('disabled');
      this.element.style.pointerEvents = '';
    }
  }
}
