/**
 * Log Viewer Component - Modal for viewing logs and metrics
 */

import type { LogEntry, SwitchMetric, LogFilter } from '@types/index';
import { LogLevel } from '@types/index';
import { logger } from '@utils/index';
import { formatTime, formatDuration, exportAsJson } from '@utils/index';

export interface LogViewerOptions {
  modalId: string;
  bodyId: string;
  metricsTableId: string;
  filterId: string;
}

/**
 * Log Viewer class
 */
export class LogViewer {
  private modal: HTMLElement;
  private body: HTMLElement;
  private metricsTable: HTMLElement;
  private filter: HTMLSelectElement;
  private isOpen: boolean = false;

  constructor(options: LogViewerOptions) {
    this.modal = document.getElementById(options.modalId)!;
    this.body = document.getElementById(options.bodyId)!;
    this.metricsTable = document.getElementById(options.metricsTableId)!;
    this.filter = document.getElementById(options.filterId) as HTMLSelectElement;

    if (!this.modal || !this.body || !this.metricsTable || !this.filter) {
      throw new Error('Log viewer elements not found');
    }

    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Close button
    const closeBtn = this.modal.querySelector('.close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    // Export button
    const exportBtn = document.getElementById('export-logs');
    exportBtn?.addEventListener('click', () => this.exportLogs());

    // Clear button
    const clearBtn = document.getElementById('clear-logs');
    clearBtn?.addEventListener('click', () => this.clearLogs());

    // Filter change
    this.filter.addEventListener('change', () => this.renderLogs());

    // Close on background click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    // Keyboard shortcut (Ctrl+Shift+L)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  /**
   * Open the log viewer
   */
  async open(): Promise<void> {
    this.modal.style.display = 'flex';
    this.isOpen = true;

    await this.renderLogs();
    await this.renderMetrics();
  }

  /**
   * Close the log viewer
   */
  close(): void {
    this.modal.style.display = 'none';
    this.isOpen = false;
  }

  /**
   * Toggle the log viewer
   */
  async toggle(): Promise<void> {
    if (this.isOpen) {
      this.close();
    } else {
      await this.open();
    }
  }

  /**
   * Render logs in the viewer
   */
  private async renderLogs(): Promise<void> {
    const filterValue = this.filter.value as LogFilter;
    let logs = await logger.getLogs();

    // Apply filter
    if (filterValue === 'error') {
      logs = logs.filter((log) => log.level >= LogLevel.ERROR);
    } else if (filterValue === 'warn') {
      logs = logs.filter((log) => log.level >= LogLevel.WARN);
    } else if (filterValue === 'switch') {
      logs = logs.filter((log) => log.category === 'SwitchSpace');
    }

    // Show most recent logs first
    logs.reverse();

    if (logs.length === 0) {
      this.body.innerHTML = '<div class="log-entry">No logs found</div>';
      return;
    }

    this.body.innerHTML = logs
      .map((logEntry) => this.renderLogEntry(logEntry))
      .join('');
  }

  /**
   * Render a single log entry
   */
  private renderLogEntry(logEntry: LogEntry): string {
    const levelName = this.getLevelName(logEntry.level);
    const levelClass = `log-${levelName.toLowerCase()}`;
    const time = formatTime(logEntry.timestamp);
    const dataStr = logEntry.data ? ` | ${JSON.stringify(logEntry.data)}` : '';

    return `<div class="log-entry ${levelClass}">
      <span class="log-time">[${time}]</span>
      <span class="log-category">[${logEntry.category}]</span>
      ${this.escapeHtml(logEntry.message)}${this.escapeHtml(dataStr)}
    </div>`;
  }

  /**
   * Render switch metrics
   */
  private async renderMetrics(): Promise<void> {
    const metrics = await logger.getLogs();
    const switchMetrics = await this.getSwitchMetrics();

    // Show most recent metrics first
    const recentMetrics = switchMetrics.slice(-20).reverse();

    if (recentMetrics.length === 0) {
      this.metricsTable.innerHTML =
        '<div style="padding: 0.5rem; color: var(--text-tertiary);">No switch metrics recorded</div>';
      return;
    }

    const headerHtml = '<div class="metric-row header"><div>Status</div><div>Time</div><div>From</div><div>To</div><div>Duration</div></div>';

    const rowsHtml = recentMetrics
      .map((metric) => this.renderMetricRow(metric))
      .join('');

    this.metricsTable.innerHTML = headerHtml + rowsHtml;
  }

  /**
   * Render a single metric row
   */
  private renderMetricRow(metric: SwitchMetric): string {
    const status = metric.status || 'unknown';
    const statusClass = status === 'success' ? 'success' : status === 'failed' ? 'failed' : 'started';
    const duration = metric.duration || (metric.startTime ? Date.now() - metric.startTime : '-');
    const durationMs = typeof duration === 'number' ? `${duration}ms` : duration;
    const durationClass = duration > 5000 ? 'very-slow' : duration > 2000 ? 'slow' : '';
    const time = formatTime(metric.startTime);

    return `<div class="metric-row">
      <div><span class="metric-status ${statusClass}">${status}</span></div>
      <div>${this.escapeHtml(time)}</div>
      <div>${this.escapeHtml(metric.fromSpace || '-')}</div>
      <div>${this.escapeHtml(metric.toSpace || '-')}</div>
      <div class="metric-duration ${durationClass}">${this.escapeHtml(durationMs)}</div>
    </div>`;
  }

  /**
   * Export logs to JSON file
   */
  private async exportLogs(): Promise<void> {
    try {
      const logs = await logger.getLogs();
      const metrics = await this.getSwitchMetrics();

      const exportData = {
        exportTime: new Date().toISOString(),
        logs,
        switchMetrics: metrics,
      };

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `archrome-logs-${timestamp}.json`;

      await exportAsJson(exportData, filename);

      logger.info('LogViewer', 'Logs exported successfully');
    } catch (error) {
      logger.error('LogViewer', 'Failed to export logs', {
        error: error instanceof Error ? error.message : String(error),
      });
      alert('Failed to export logs: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * Clear all logs
   */
  private async clearLogs(): Promise<void> {
    if (!confirm('Are you sure you want to clear all logs? This cannot be undone.')) {
      return;
    }

    try {
      await logger.clearLogs();
      await this.renderLogs();
      await this.renderMetrics();
      logger.info('LogViewer', 'Logs cleared successfully');
    } catch (error) {
      logger.error('LogViewer', 'Failed to clear logs', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get switch metrics from storage
   */
  private async getSwitchMetrics(): Promise<SwitchMetric[]> {
    try {
      const result = await chrome.storage.local.get(['archrome_switch_metrics']);
      return (result.archrome_switch_metrics as SwitchMetric[]) || [];
    } catch {
      return [];
    }
  }

  /**
   * Get level name from LogLevel enum
   */
  private getLevelName(level: LogLevel): string {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
    return levels[level] || 'UNKNOWN';
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Check if the log viewer is open
   */
  isOpened(): boolean {
    return this.isOpen;
  }
}
