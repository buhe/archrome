/**
 * Utility functions tests
 */

import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  getFaviconUrl,
  safeJsonParse,
  extractIconAndName,
  isValidUrl,
  cleanTabsData,
} from '@utils/index';

describe('Utility Functions', () => {
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
});
