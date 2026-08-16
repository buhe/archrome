/**
 * Dialog Manager - In-panel HTML replacements for native prompt()/confirm()/alert()
 *
 * Native JavaScript dialogs are not reliably supported inside Chrome's side
 * panel and can freeze or crash it; these in-panel dialogs are the supported
 * replacement. The DOM is built on demand and appended to document.body, so
 * no HTML scaffolding is required.
 */

/**
 * Dialog Manager class
 */
export class DialogManager {
  private activeToast: HTMLElement | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Show a text input dialog (prompt replacement).
   * Resolves with the entered text, or null when cancelled.
   */
  prompt(title: string, defaultValue = ''): Promise<string | null> {
    return new Promise((resolve) => {
      const { overlay, card } = this.createShell();

      const heading = document.createElement('h3');
      heading.className = 'dialog-title';
      heading.textContent = title;
      card.appendChild(heading);

      const input = document.createElement('input');
      input.className = 'dialog-input';
      input.type = 'text';
      input.value = defaultValue;
      card.appendChild(input);

      const settled = this.createSettler(overlay, (result: string | null) => {
        resolve(result);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          settled(input.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          settled(null);
        }
      });

      const actions = document.createElement('div');
      actions.className = 'dialog-actions';
      actions.appendChild(
        this.createButton('Cancel', () => settled(null), /* danger */ false, /* primary */ false),
      );
      actions.appendChild(
        this.createButton('OK', () => settled(input.value), /* danger */ false, /* primary */ true),
      );
      card.appendChild(actions);

      // Cancel when clicking the backdrop
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          settled(null);
        }
      });

      document.body.appendChild(overlay);
      input.focus();
      input.select();
    });
  }

  /**
   * Show a confirmation dialog (confirm replacement).
   * Resolves with true when confirmed, false when cancelled.
   */
  confirm(message: string, options?: { okLabel?: string; danger?: boolean }): Promise<boolean> {
    return new Promise((resolve) => {
      const { overlay, card } = this.createShell();

      const text = document.createElement('p');
      text.className = 'dialog-message';
      text.textContent = message;
      card.appendChild(text);

      const settled = this.createSettler(overlay, (result: boolean) => {
        resolve(result);
      });

      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          settled(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          settled(false);
        }
      };
      document.addEventListener('keydown', onKey);

      const actions = document.createElement('div');
      actions.className = 'dialog-actions';
      actions.appendChild(
        this.createButton('Cancel', () => settled(false), /* danger */ false, /* primary */ false),
      );
      actions.appendChild(
        this.createButton(
          options?.okLabel ?? 'OK',
          () => settled(true),
          options?.danger ?? false,
          /* primary */ true,
        ),
      );
      card.appendChild(actions);

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          settled(false);
        }
      });

      document.body.appendChild(overlay);

      // Remove the document-level key handler together with the dialog
      const originalCleanup = settled.cleanup;
      settled.cleanup = () => {
        document.removeEventListener('keydown', onKey);
        originalCleanup();
      };

      // Focus the primary button so Enter/Escape semantics are discoverable
      const okBtn = actions.querySelector<HTMLButtonElement>('.dialog-btn-primary');
      okBtn?.focus();
    });
  }

  /**
   * Show a transient toast message (alert replacement).
   * Only the latest toast is shown; earlier ones are replaced.
   */
  toast(message: string, durationMs = 3000): void {
    if (this.activeToast) {
      this.activeToast.remove();
      this.activeToast = null;
    }
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }

    const toast = document.createElement('div');
    toast.className = 'dialog-toast';
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    document.body.appendChild(toast);
    this.activeToast = toast;

    this.toastTimer = setTimeout(() => {
      toast.remove();
      if (this.activeToast === toast) {
        this.activeToast = null;
      }
      this.toastTimer = null;
    }, durationMs);
  }

  /**
   * Create the overlay/card shell shared by prompt and confirm
   */
  private createShell(): { overlay: HTMLElement; card: HTMLElement } {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const card = document.createElement('div');
    card.className = 'dialog-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    overlay.appendChild(card);

    return { overlay, card };
  }

  /**
   * Create a settle-once handler that also removes the dialog from the DOM.
   * Returns a settle function with a swappable cleanup hook.
   */
  private createSettler<T>(overlay: HTMLElement, resolve: (value: T) => void) {
    let done = false;
    const settle = ((value: T) => {
      if (done) return;
      done = true;
      settle.cleanup();
      resolve(value);
    }) as ((value: T) => void) & { cleanup: () => void };

    settle.cleanup = () => {
      overlay.remove();
    };

    return settle;
  }

  /**
   * Create a dialog action button
   */
  private createButton(
    label: string,
    onClick: () => void,
    danger: boolean,
    primary: boolean,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'dialog-btn';
    button.textContent = label;
    if (primary) {
      button.classList.add('dialog-btn-primary');
    }
    if (danger) {
      button.classList.add('dialog-btn-danger');
    }
    button.addEventListener('click', onClick);
    return button;
  }

  /**
   * Destroy the dialog manager and remove any visible elements
   */
  destroy(): void {
    document.querySelectorAll('.dialog-overlay').forEach((el) => el.remove());
    if (this.activeToast) {
      this.activeToast.remove();
      this.activeToast = null;
    }
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }
}
