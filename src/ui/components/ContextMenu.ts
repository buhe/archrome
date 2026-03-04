/**
 * Context Menu Component - Custom context menu for tabs and bookmarks
 */

import type { ContextMenuItem } from '@types/index';

export interface ContextMenuOptions {
  items: ContextMenuItem[];
  position?: { x: number; y: number };
  onClose?: () => void;
}

/**
 * Context Menu class
 */
export class ContextMenu {
  private element: HTMLDivElement;
  private options: ContextMenuOptions;
  private submenus: Map<HTMLElement, ContextMenu> = new Map();

  constructor(options: ContextMenuOptions) {
    this.options = options;
    this.element = this.createMenu();

    if (options.position) {
      this.setPosition(options.position.x, options.position.y);
    }

    this.setupCloseHandlers();
  }

  /**
   * Create the context menu element
   */
  private createMenu(): HTMLDivElement {
    const menu = document.createElement('div');
    menu.className = 'custom-context-menu';
    menu.role = 'menu';
    menu.setAttribute('aria-label', 'Context menu');

    this.options.items.forEach((item) => {
      const menuItem = this.createMenuItem(item);
      menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);

    return menu;
  }

  /**
   * Create a menu item
   */
  private createMenuItem(item: ContextMenuItem): HTMLElement {
    const menuItem = document.createElement('div');
    menuItem.className = 'context-menu-item';

    if (item.icon) {
      const icon = document.createElement('span');
      icon.className = 'context-menu-icon';
      icon.textContent = item.icon;
      menuItem.appendChild(icon);
    }

    const label = document.createElement('span');
    label.className = 'context-menu-label';
    label.textContent = item.label;
    menuItem.appendChild(label);

    // Handle submenu
    if (item.items && item.items.length > 0) {
      menuItem.classList.add('has-submenu');
      menuItem.setAttribute('aria-haspopup', 'true');

      // Create submenu as a child of menuItem (like reference project)
      const subMenu = document.createElement('div');
      subMenu.className = 'context-submenu';

      item.items.forEach((subItem) => {
        const subMenuItem = document.createElement('div');
        subMenuItem.className = 'context-menu-item';
        subMenuItem.textContent = subItem.label;

        subMenuItem.addEventListener('click', async () => {
          await subItem.action();
          this.close();
        });

        subMenu.appendChild(subMenuItem);
      });

      // Initially hidden
      subMenu.style.display = 'none';
      menuItem.appendChild(subMenu);

      // Simple hover logic - EXACTLY like reference project
      menuItem.addEventListener('mouseenter', () => {
        subMenu.style.display = 'block';
      });

      menuItem.addEventListener('mouseleave', () => {
        subMenu.style.display = 'none';
      });

      this.submenus.set(menuItem, null as any);
    } else {
      // Handle click action
      menuItem.addEventListener('click', async () => {
        await item.action();
        this.close();
      });
    }

    return menuItem;
  }

  /**
   * Set menu position
   */
  setPosition(x: number, y: number): void {
    // Ensure menu stays within viewport
    const menuWidth = 200; // Approximate width
    const menuHeight = this.element.offsetHeight || 200;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let finalX = x;
    let finalY = y;

    // Adjust horizontal position
    if (x + menuWidth > viewportWidth) {
      finalX = viewportWidth - menuWidth - 10;
    }

    // Adjust vertical position
    if (y + menuHeight > viewportHeight) {
      finalY = viewportHeight - menuHeight - 10;
    }

    this.element.style.left = `${finalX}px`;
    this.element.style.top = `${finalY}px`;
  }

  /**
   * Setup close handlers
   */
  private setupCloseHandlers(): void {
    // Close when clicking outside
    const closeHandler = (e: MouseEvent) => {
      if (!this.element.contains(e.target as Node)) {
        this.close();
      }
    };

    // Use timeout to avoid immediate closing
    setTimeout(() => {
      document.addEventListener('click', closeHandler);
    }, 0);

    // Store reference for cleanup
    (this.element as any)._closeHandler = closeHandler;
  }

  /**
   * Show the menu
   */
  show(x?: number, y?: number): void {
    if (x !== undefined && y !== undefined) {
      this.setPosition(x, y);
    }
    this.element.style.display = 'block';
  }

  /**
   * Hide the menu
   */
  hide(): void {
    this.element.style.display = 'none';
  }

  /**
   * Close and remove the menu
   */
  close(): void {
    // Remove close handler
    const closeHandler = (this.element as any)._closeHandler;
    if (closeHandler) {
      document.removeEventListener('click', closeHandler);
    }

    // Clear submenus map
    this.submenus.clear();

    // Remove from DOM
    this.element.remove();

    // Call close callback
    this.options.onClose?.();
  }

  /**
   * Destroy the menu
   */
  destroy(): void {
    this.close();
  }

  /**
   * Create a move-to submenu for tabs
   */
  static createMoveToSubmenu(
    spaces: Array<{ id: string; name: string }>,
    currentSpaceId: string,
    onMove: (spaceId: string) => void | Promise<void>,
  ): ContextMenuItem {
    const otherSpaces = spaces.filter((s) => s.id !== currentSpaceId && s.name.toLowerCase() !== 'pin');

    return {
      label: 'Move to',
      items: otherSpaces.map((space) => ({
        label: space.name,
        action: () => onMove(space.id),
      })),
    };
  }
}
