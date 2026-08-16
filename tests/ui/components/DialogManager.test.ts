/**
 * Tests for src/ui/components/DialogManager.ts
 *
 * The DialogManager provides in-panel replacements for native
 * prompt()/confirm()/alert(), which are not reliably supported inside
 * Chrome's side panel.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DialogManager } from '@ui/components/DialogManager';

describe('DialogManager', () => {
  let dialogs: DialogManager;

  beforeEach(() => {
    document.body.innerHTML = '';
    dialogs = new DialogManager();
  });

  afterEach(() => {
    dialogs.destroy();
  });

  describe('prompt', () => {
    it('resolves with the entered value on OK and removes the dialog', async () => {
      const promise = dialogs.prompt('Space name');
      const input = document.querySelector('.dialog-input') as HTMLInputElement;
      expect(input).toBeTruthy();

      input.value = 'Work';
      (document.querySelector('.dialog-btn-primary') as HTMLElement).click();

      await expect(promise).resolves.toBe('Work');
      expect(document.querySelector('.dialog-overlay')).toBeNull();
    });

    it('resolves with an empty string on Enter in empty input (like native prompt)', async () => {
      const promise = dialogs.prompt('Space name');
      const input = document.querySelector('.dialog-input') as HTMLInputElement;
      input.value = '';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await expect(promise).resolves.toBe('');
    });

    it('resolves with the value on Enter key', async () => {
      const promise = dialogs.prompt('Space name');
      const input = document.querySelector('.dialog-input') as HTMLInputElement;
      input.value = 'Play';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await expect(promise).resolves.toBe('Play');
    });

    it('resolves with null on Escape', async () => {
      const promise = dialogs.prompt('Space name');
      const input = document.querySelector('.dialog-input') as HTMLInputElement;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await expect(promise).resolves.toBeNull();
    });

    it('resolves with null when the backdrop is clicked', async () => {
      const promise = dialogs.prompt('Space name');
      const overlay = document.querySelector('.dialog-overlay') as HTMLElement;
      overlay.click();
      await expect(promise).resolves.toBeNull();
    });

    it('settles only once even with multiple dismiss actions', async () => {
      const promise = dialogs.prompt('Space name');
      const overlay = document.querySelector('.dialog-overlay') as HTMLElement;
      overlay.click();
      overlay.click();
      await expect(promise).resolves.toBeNull();
    });
  });

  describe('confirm', () => {
    it('resolves true on the primary button', async () => {
      const promise = dialogs.confirm('Delete?');
      const message = document.querySelector('.dialog-message') as HTMLElement;
      expect(message.textContent).toBe('Delete?');

      (document.querySelector('.dialog-btn-primary') as HTMLElement).click();
      await expect(promise).resolves.toBe(true);
      expect(document.querySelector('.dialog-overlay')).toBeNull();
    });

    it('resolves false on the secondary button', async () => {
      const promise = dialogs.confirm('Delete?');
      (document.querySelector('.dialog-btn:not(.dialog-btn-primary)') as HTMLElement).click();
      await expect(promise).resolves.toBe(false);
    });

    it('resolves false on Escape and detaches the document key handler', async () => {
      const promise = dialogs.confirm('Delete?');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await expect(promise).resolves.toBe(false);

      // The document-level handler must be removed with the dialog
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(document.querySelector('.dialog-overlay')).toBeNull();
    });

    it('applies the danger style to the primary button when requested', async () => {
      const promise = dialogs.confirm('Delete?', { okLabel: 'Delete', danger: true });
      const primary = document.querySelector('.dialog-btn-primary') as HTMLElement;
      expect(primary.textContent).toBe('Delete');
      expect(primary.classList.contains('dialog-btn-danger')).toBe(true);
      primary.click();
      await expect(promise).resolves.toBe(true);
    });
  });

  describe('toast', () => {
    it('shows a toast that disappears after the duration', async () => {
      vi.useFakeTimers();
      dialogs.toast('Saved', 1000);

      const toast = document.querySelector('.dialog-toast') as HTMLElement;
      expect(toast.textContent).toBe('Saved');

      vi.advanceTimersByTime(1000);
      expect(document.querySelector('.dialog-toast')).toBeNull();
      vi.useRealTimers();
    });

    it('replaces an earlier toast with the newest message', () => {
      vi.useFakeTimers();
      dialogs.toast('first');
      dialogs.toast('second');

      const toast = document.querySelector('.dialog-toast') as HTMLElement;
      expect(document.querySelectorAll('.dialog-toast')).toHaveLength(1);
      expect(toast.textContent).toBe('second');
      vi.useRealTimers();
    });
  });

  describe('destroy', () => {
    it('removes any open dialogs and toasts', async () => {
      dialogs.prompt('pending');
      dialogs.confirm('pending');
      dialogs.toast('pending');

      dialogs.destroy();

      expect(document.querySelector('.dialog-overlay')).toBeNull();
      expect(document.querySelector('.dialog-toast')).toBeNull();
    });
  });
});
