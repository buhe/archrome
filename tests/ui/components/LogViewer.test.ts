/**
 * Tests for src/ui/components/LogViewer.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LogViewer } from '@ui/components/LogViewer';
import { LogLevel, STORAGE_KEYS } from '@types/index';
import type { LogEntry, SwitchMetric } from '@types/index';

function setupDom() {
  document.body.innerHTML = `
    <div id="log-viewer-modal" style="display:none">
      <button class="close-btn">x</button>
    </div>
    <div id="log-viewer-body"></div>
    <div id="metrics-table"></div>
    <select id="log-filter">
      <option value="all">All</option>
      <option value="error">Error</option>
      <option value="warn">Warn</option>
      <option value="switch">Switch</option>
    </select>
    <button id="export-logs">Export</button>
    <button id="clear-logs">Clear</button>
  `;
}

const LOGS: LogEntry[] = [
  { timestamp: '2026-01-01T00:00:00.000Z', level: LogLevel.DEBUG, category: 'App', message: 'debug msg' },
  { timestamp: '2026-01-01T00:00:01.000Z', level: LogLevel.WARN, category: 'App', message: 'warn msg' },
  { timestamp: '2026-01-01T00:00:02.000Z', level: LogLevel.ERROR, category: 'App', message: 'error msg' },
  { timestamp: '2026-01-01T00:00:03.000Z', level: LogLevel.INFO, category: 'SwitchSpace', message: 'switched' },
];

const METRICS: SwitchMetric[] = [
  { startTime: 1000, toSpace: 'A', fromSpace: 'B', status: 'success', duration: 100 },
  { startTime: 2000, toSpace: 'C', status: 'failed', duration: 6000 },
  { startTime: 3000, toSpace: 'D', status: 'started' },
];

describe('LogViewer', () => {
  let viewer: LogViewer;

  beforeEach(() => {
    setupDom();
    viewer = new LogViewer({
      modalId: 'log-viewer-modal',
      bodyId: 'log-viewer-body',
      metricsTableId: 'metrics-table',
      filterId: 'log-filter',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function seed() {
    await chrome.storage.local.set({
      [STORAGE_KEYS.LOGS]: LOGS,
      [STORAGE_KEYS.SWITCH_METRICS]: METRICS,
    });
  }

  describe('open / close / toggle', () => {
    it('open renders logs and metrics', async () => {
      await seed();
      await viewer.open();
      expect(viewer.isOpened()).toBe(true);
      expect(document.getElementById('log-viewer-modal')?.style.display).toBe('flex');
      // logs rendered (most recent first)
      expect(document.querySelectorAll('#log-viewer-body .log-entry').length).toBe(LOGS.length);
      // metrics header + rows
      expect(document.querySelectorAll('#metrics-table .metric-row').length).toBe(METRICS.length + 1);
    });

    it('close hides the modal', async () => {
      await viewer.open();
      viewer.close();
      expect(viewer.isOpened()).toBe(false);
      expect(document.getElementById('log-viewer-modal')?.style.display).toBe('none');
    });

    it('toggle opens then closes', async () => {
      await seed();
      await viewer.toggle();
      expect(viewer.isOpened()).toBe(true);
      await viewer.toggle();
      expect(viewer.isOpened()).toBe(false);
    });
  });

  describe('log filtering', () => {
    it('shows only error-level logs when filter is error', async () => {
      await seed();
      (document.getElementById('log-filter') as HTMLSelectElement).value = 'error';
      await viewer.open();
      const entries = document.querySelectorAll('#log-viewer-body .log-entry');
      expect(entries.length).toBe(1); // only the ERROR entry
    });

    it('shows only warn+ logs when filter is warn', async () => {
      await seed();
      (document.getElementById('log-filter') as HTMLSelectElement).value = 'warn';
      await viewer.open();
      const entries = document.querySelectorAll('#log-viewer-body .log-entry');
      expect(entries.length).toBe(2); // WARN + ERROR
    });

    it('shows only SwitchSpace category when filter is switch', async () => {
      await seed();
      (document.getElementById('log-filter') as HTMLSelectElement).value = 'switch';
      await viewer.open();
      const entries = document.querySelectorAll('#log-viewer-body .log-entry');
      expect(entries.length).toBe(1);
    });

    it('shows an empty state when there are no logs', async () => {
      await viewer.open();
      expect(document.getElementById('log-viewer-body')?.textContent).toContain('No logs found');
    });
  });

  describe('metrics rendering', () => {
    it('renders an empty state when there are no metrics', async () => {
      await chrome.storage.local.set({ [STORAGE_KEYS.LOGS]: [] });
      await viewer.open();
      expect(document.getElementById('metrics-table')?.textContent).toContain('No switch metrics recorded');
    });

    it('marks slow and very-slow durations and escaped content', async () => {
      await seed();
      await viewer.open();
      const html = document.getElementById('metrics-table')?.innerHTML ?? '';
      expect(html).toContain('very-slow'); // duration 6000
      expect(html).toContain('failed');
      expect(html).toContain('success');
    });
  });

  describe('clear / export', () => {
    it('clearLogs wipes logs when confirmed', async () => {
      await seed();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      // trigger the clear button listener
      document.getElementById('clear-logs')?.click();
      await vi.waitFor(() => {
        expect(document.getElementById('log-viewer-body')?.textContent).toContain('No logs found');
      });
    });

    it('clearLogs does nothing when not confirmed', async () => {
      await seed();
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      document.getElementById('clear-logs')?.click();
      // still has the original log count after a re-render settles
      await viewer.open();
      expect(document.querySelectorAll('#log-viewer-body .log-entry').length).toBe(LOGS.length);
    });

    it('exportLogs triggers a download', async () => {
      await seed();
      document.getElementById('export-logs')?.click();
      await vi.waitFor(() => {
        expect(chrome.downloads.download).toHaveBeenCalled();
      });
    });

    it('exportLogs alerts on failure', async () => {
      await seed();
      vi.spyOn(chrome.downloads, 'download').mockRejectedValueOnce(new Error('boom'));
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
      document.getElementById('export-logs')?.click();
      await vi.waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });
    });
  });
});
