/**
 * Utility functions tests
 */

import { describe, it, expect } from 'vitest';
import { isEmoji, extractIconAndName, generateUniqueId, isValidUrl, cleanTabsData } from '@utils/index';

describe('Utility Functions', () => {
  describe('isEmoji', () => {
    it('should detect emojis', () => {
      expect(isEmoji('😀')).toBe(true);
      expect(isEmoji('🎉')).toBe(true);
      expect(isEmoji('🔥')).toBe(true);
      expect(isEmoji('A')).toBe(false);
      expect(isEmoji('1')).toBe(false);
      expect(isEmoji('')).toBe(false);
    });
  });

  describe('extractIconAndName', () => {
    it('should extract emoji and name', () => {
      expect(extractIconAndName('😀Work')).toEqual({ icon: '😀', name: 'Work' });
      expect(extractIconAndName('🎉Personal')).toEqual({ icon: '🎉', name: 'Personal' });
    });

    it('should handle non-emoji titles', () => {
      expect(extractIconAndName('Work')).toEqual({ icon: '●', name: 'Work' });
      expect(extractIconAndName('Personal Stuff')).toEqual({ icon: '●', name: 'Personal Stuff' });
    });

    it('should handle empty strings', () => {
      expect(extractIconAndName('')).toEqual({ icon: '●', name: '' });
    });
  });

  describe('generateUniqueId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateUniqueId();
      const id2 = generateUniqueId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^_[a-z0-9]+$/);
      expect(id2).toMatch(/^_[a-z0-9]+$/);
    });
  });

  describe('isValidUrl', () => {
    it('should validate URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('https://example.com/path')).toBe(true);
      expect(isValidUrl('chrome://settings')).toBe(false);
      expect(isValidUrl('about:blank')).toBe(false);
      expect(isValidUrl('chrome-extension://abc')).toBe(false);
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl(undefined)).toBe(false);
    });
  });

  describe('cleanTabsData', () => {
    it('should clean and limit tabs data', () => {
      const tabs = [
        { id: 1, url: 'https://example.com', title: 'Example', favIconUrl: 'https://example.com/favicon.ico' },
        { id: 2, url: 'https://example.org', title: 'Example Org', favIconUrl: null },
      ];

      const cleaned = cleanTabsData(tabs, 10);
      expect(cleaned).toHaveLength(2);
      expect(cleaned[0]).toEqual({
        id: 1,
        url: 'https://example.com',
        title: 'Example',
        favIconUrl: 'https://example.com/favicon.ico',
      });
    });

    it('should limit tabs to maxTabs', () => {
      const tabs = Array.from({ length: 150 }, (_, i) => ({
        id: i,
        url: `https://example.com/${i}`,
        title: `Tab ${i}`,
        favIconUrl: null,
      }));

      const cleaned = cleanTabsData(tabs, 100);
      expect(cleaned).toHaveLength(100);
    });
  });
});
