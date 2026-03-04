/**
 * Helper utility functions
 */

import type { TabData, BookmarkData } from '@types/index';

/**
 * Check if a character is an emoji
 */
export function isEmoji(char: string): boolean {
  if (!char || char.length === 0) return false;

  const emojiRegex =
    /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]/u;
  return emojiRegex.test(char[0]);
}

/**
 * Extract icon and name from a folder title
 * If the title starts with an emoji, that becomes the icon
 */
export function extractIconAndName(title: string): { icon: string; name: string } {
  const defaultIcon = '●';

  if (!title || title.length === 0) {
    return { icon: defaultIcon, name: '' };
  }

  if (isEmoji(title)) {
    return { icon: title[0], name: title.substring(1).trim() };
  }

  return { icon: defaultIcon, name: title };
}

/**
 * Generate a unique ID
 */
export function generateUniqueId(): string {
  return `_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Format duration in milliseconds to a human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format a timestamp to a localized time string
 */
export function formatTime(timestamp: string | number): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  return date.toLocaleTimeString();
}

/**
 * Clean and limit tabs data for storage
 */
export function cleanTabsData(tabs: TabData[], maxTabs: number): TabData[] {
  return tabs.slice(0, maxTabs).map((tab) => ({
    id: tab.id,
    url: tab.url,
    title: tab.title || 'Untitled',
    favIconUrl: tab.favIconUrl || null,
  }));
}

/**
 * Get favicon URL for a tab
 */
export function getFaviconUrl(tab: TabData | chrome.tabs.Tab): string {
  // For chrome:// URLs, use default icon
  if (tab.url && tab.url.startsWith('chrome://')) {
    return 'icons/default_favicon.png';
  }

  // Use favicon from tab if available
  if ('favIconUrl' in tab && tab.favIconUrl) {
    return tab.favIconUrl;
  }

  // For tabs with URL, use Google's favicon service
  if (tab.url && !tab.url.startsWith('about:')) {
    try {
      const hostname = new URL(tab.url).hostname;
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=16`;
    } catch {
      // Invalid URL, use default
    }
  }

  return 'icons/default_favicon.png';
}

/**
 * Check if a URL is valid for tab creation/restoration
 */
export function isValidUrl(url?: string): boolean {
  if (!url) return false;
  if (url.startsWith('chrome://')) return false;
  if (url.startsWith('about:')) return false;
  if (url.startsWith('chrome-extension://')) return false;
  return true;
}

/**
 * Get display text for an item (bookmark or tab)
 */
export function getDisplayText(title: string, url: string): string {
  return title || url || 'Untitled';
}

/**
 * Check if a tab is currently open (exists in browser)
 */
export async function isTabOpen(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.get(tabId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a promise that resolves after a delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 100,
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await delay(baseDelay * Math.pow(2, i));
      }
    }
  }

  throw lastError;
}

/**
 * Create a blob download URL
 */
export function createDownloadUrl(data: string, mimeType = 'application/json'): string {
  const blob = new Blob([data], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Download a file using Chrome downloads API
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  await chrome.downloads.download({
    url,
    filename,
    saveAs: true,
  });
}

/**
 * Export data as JSON file
 */
export async function exportAsJson(data: unknown, filename: string): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const url = createDownloadUrl(json);
  await downloadFile(url, filename);
  URL.revokeObjectURL(url);
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}
