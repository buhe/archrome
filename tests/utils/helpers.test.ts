/**
 * Tests for src/utils/helpers.ts
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatDuration,
  getFaviconUrl,
  safeJsonParse,
  extractIconAndName,
  isValidUrl,
  cleanTabsData,
  isEmoji,
  getDisplayText,
  formatTime,
  generateUniqueId,
  isTabOpen,
  delay,
  retryWithBackoff,
  createDownloadUrl,
  downloadFile,
  exportAsJson,
  deepClone,
} from '@utils/helpers';

describe('utils/helpers', () => {
  describe('formatDuration', () => {
    it('should format durations', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(59000)).toBe('59.0s');
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(90500)).toBe('1m 30s');
    });
  });

  describe('getFaviconUrl', () => {
    it('should return the right favicon URL', () => {
      expect(getFaviconUrl({ id: 1, url: 'chrome://settings', title: 'Settings', favIconUrl: null })).toBe(
        'icons/default_favicon.png',
      );
      expect(
        getFaviconUrl({ id: 2, url: 'https://example.com', title: 'Example', favIconUrl: 'https://a.com/f.ico' }),
      ).toBe('https://a.com/f.ico');
      expect(getFaviconUrl({ id: 3, url: 'https://example.com/path', title: 'Example', favIconUrl: null })).toBe(
        'https://www.google.com/s2/favicons?domain=example.com&sz=16',
      );
      expect(getFaviconUrl({ id: 4, url: 'about:blank', title: '', favIconUrl: null })).toBe(
        'icons/default_favicon.png',
      );
    });
  });

  describe('safeJsonParse', () => {
    it('should parse JSON with fallback', () => {
      expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
      expect(safeJsonParse('[1,2]', [])).toEqual([1, 2]);
      expect(safeJsonParse('not json', { fallback: true })).toEqual({ fallback: true });
      expect(safeJsonParse('', null)).toBe(null);
    });
  });

  // Space folder titles may start with an emoji used as the space icon
  describe('extractIconAndName', () => {
    it('should parse space icon and name from bookmark folder titles', () => {
      expect(extractIconAndName('😀Work')).toEqual({ icon: '😀', name: 'Work' });
      expect(extractIconAndName('🎉Personal')).toEqual({ icon: '🎉', name: 'Personal' });
      expect(extractIconAndName('Work')).toEqual({ icon: '●', name: 'Work' });
      expect(extractIconAndName('')).toEqual({ icon: '●', name: '' });
    });
  });

  // UIManager uses isEmoji to decide whether a space icon renders as an emoji
  describe('isEmoji', () => {
    it('should detect emoji icons and reject plain text or empty input', () => {
      expect(isEmoji('😀')).toBe(true);
      expect(isEmoji('🎉')).toBe(true);
      expect(isEmoji('●')).toBe(false);
      expect(isEmoji('W')).toBe(false);
      expect(isEmoji('')).toBe(false);
    });
  });

  // Only restorable http(s) tabs should be kept when switching spaces
  describe('isValidUrl', () => {
    it('should accept restorable page URLs and reject browser-internal URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://example.com/path')).toBe(true);
      expect(isValidUrl('chrome://settings')).toBe(false);
      expect(isValidUrl('about:blank')).toBe(false);
      expect(isValidUrl('chrome-extension://abc/page.html')).toBe(false);
      expect(isValidUrl(undefined)).toBe(false);
    });
  });

  // Space tab snapshots are trimmed before writing to chrome.storage
  describe('cleanTabsData', () => {
    it('should normalize titles and limit stored tabs for a space', () => {
      const tabs = [
        { id: 1, url: 'https://example.com', title: 'Example', favIconUrl: 'https://example.com/f.ico' },
        { id: 2, url: 'https://example.org', title: '', favIconUrl: null },
        { id: 3, url: 'https://third.com', title: 'Third', favIconUrl: null },
      ];

      const cleaned = cleanTabsData(tabs, 2);

      expect(cleaned).toHaveLength(2);
      expect(cleaned[0]).toEqual({
        id: 1,
        url: 'https://example.com',
        title: 'Example',
        favIconUrl: 'https://example.com/f.ico',
      });
      expect(cleaned[1]).toEqual({
        id: 2,
        url: 'https://example.org',
        title: 'Untitled',
        favIconUrl: null,
      });
    });
  });

  // ListItemComponent falls back to URL then 'Untitled' when titles are missing
  describe('getDisplayText', () => {
    it('should prefer the title and fall back to URL or Untitled', () => {
      expect(getDisplayText('Example', 'https://example.com')).toBe('Example');
      expect(getDisplayText('', 'https://example.com')).toBe('https://example.com');
      expect(getDisplayText('', '')).toBe('Untitled');
    });
  });

  describe('formatTime', () => {
    it('formats a timestamp into a time string', () => {
      const out = formatTime(0);
      expect(typeof out).toBe('string');
      expect(out.length).toBeGreaterThan(0);
      // string and number inputs both work
      expect(formatTime('2020-01-01T00:00:00.000Z')).toEqual(expect.any(String));
    });
  });

  describe('generateUniqueId', () => {
    it('produces unique ids with the expected prefix', () => {
      const a = generateUniqueId();
      const b = generateUniqueId();
      expect(a).toMatch(/^_/);
      expect(a).not.toBe(b);
    });
  });

  describe('isTabOpen', () => {
    afterEach(() => vi.restoreAllMocks());

    it('returns true when chrome.tabs.get resolves', async () => {
      vi.spyOn(chrome.tabs, 'get').mockResolvedValue({ id: 1 } as never);
      expect(await isTabOpen(1)).toBe(true);
    });

    it('returns false when chrome.tabs.get rejects', async () => {
      vi.spyOn(chrome.tabs, 'get').mockRejectedValue(new Error('no tab'));
      expect(await isTabOpen(99)).toBe(false);
    });
  });

  describe('delay', () => {
    it('resolves after the given milliseconds', async () => {
      const start = Date.now();
      await delay(10);
      expect(Date.now() - start).toBeGreaterThanOrEqual(5);
    });
  });

  describe('retryWithBackoff', () => {
    afterEach(() => vi.restoreAllMocks());

    it('returns the value once the function succeeds', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      await expect(retryWithBackoff(fn, 3, 1)).resolves.toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and eventually throws the last error', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(retryWithBackoff(fn, 2, 1)).rejects.toThrow('fail');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('succeeds after a transient failure', async () => {
      let calls = 0;
      const fn = vi.fn().mockImplementation(async () => {
        calls++;
        if (calls === 1) throw new Error('transient');
        return 'recovered';
      });
      await expect(retryWithBackoff(fn, 3, 1)).resolves.toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('createDownloadUrl / downloadFile / exportAsJson', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('createDownloadUrl builds an object URL', () => {
      const url = createDownloadUrl('{}');
      expect(url).toMatch(/^blob:/);
    });

    it('downloadFile delegates to chrome.downloads.download', async () => {
      await downloadFile('https://example.com/file.json', 'file.json');
      expect(chrome.downloads.download).toHaveBeenCalledWith({
        url: 'https://example.com/file.json',
        filename: 'file.json',
        saveAs: true,
      });
    });

    it('exportAsJson serializes data and triggers a download', async () => {
      const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
      await exportAsJson({ a: 1 }, 'out.json');
      expect(chrome.downloads.download).toHaveBeenCalled();
      expect(revoke).toHaveBeenCalled();
    });
  });

  describe('deepClone', () => {
    it('produces an equal but independent copy', () => {
      const original = { a: 1, nested: { b: 2 } };
      const clone = deepClone(original);
      expect(clone).toEqual(original);
      expect(clone).not.toBe(original);
      expect(clone.nested).not.toBe(original.nested);
    });
  });
});
