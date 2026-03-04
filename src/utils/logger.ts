/**
 * Logging utility for Archrome
 * Provides persistent logging with configurable levels
 */

import type { LogEntry, LogLevel } from '@types/index';
import { STORAGE_KEYS, DEFAULT_CONFIG } from '@types/index';

// Enable/disable console logging
const CONSOLE_LOG_ENABLED = true;

/**
 * Logger class for managing persistent logs
 */
export class Logger {
  private maxLogs: number;

  constructor(maxLogs: number = DEFAULT_CONFIG.maxLogs) {
    this.maxLogs = maxLogs;
  }

  /**
   * Write a log entry to console and persistent storage
   */
  async write(
    level: LogLevel,
    category: string,
    message: string,
    data?: unknown,
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = { timestamp, level, category, message, data };

    // Console output (if enabled)
    if (CONSOLE_LOG_ENABLED) {
      this.outputToConsole(logEntry);
    }

    // Persistent storage
    await this.writeToStorage(logEntry);
  }

  /**
   * Output log to console with appropriate formatting
   */
  private outputToConsole(entry: LogEntry): void {
    const levelName = this.getLevelName(entry.level);
    const prefix = `[${entry.timestamp}] [${levelName}] [${entry.category}]`;

    if (entry.data) {
      // eslint-disable-next-line no-console
      console.log(prefix, entry.message, entry.data);
    } else {
      // eslint-disable-next-line no-console
      console.log(prefix, entry.message);
    }
  }

  /**
   * Write log to Chrome storage
   */
  private async writeToStorage(entry: LogEntry): Promise<void> {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.LOGS]);
      const logs: LogEntry[] = (result[STORAGE_KEYS.LOGS] as LogEntry[]) || [];
      logs.push(entry);

      // Keep only the most recent logs
      if (logs.length > this.maxLogs) {
        logs.splice(0, logs.length - this.maxLogs);
      }

      await chrome.storage.local.set({ [STORAGE_KEYS.LOGS]: logs });
    } catch (error) {
      // Last resort - try console
      // eslint-disable-next-line no-console
      console.error('Failed to write log:', error, entry);
    }
  }

  /**
   * Get log entries, optionally filtered by level
   */
  async getLogs(minLevel?: LogLevel): Promise<LogEntry[]> {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.LOGS]);
      let logs: LogEntry[] = (result[STORAGE_KEYS.LOGS] as LogEntry[]) || [];

      if (minLevel !== undefined) {
        logs = logs.filter((log) => log.level >= minLevel);
      }

      return logs;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to get logs:', error);
      return [];
    }
  }

  /**
   * Clear all logs
   */
  async clearLogs(): Promise<void> {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.LOGS]: [],
        [STORAGE_KEYS.SWITCH_METRICS]: [],
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to clear logs:', error);
    }
  }

  /**
   * Get level name from LogLevel enum
   */
  private getLevelName(level: LogLevel): string {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
    return levels[level] || 'UNKNOWN';
  }

  // Convenience methods
  debug(category: string, message: string, data?: unknown): Promise<void> {
    return this.write(0, category, message, data);
  }

  info(category: string, message: string, data?: unknown): Promise<void> {
    return this.write(1, category, message, data);
  }

  warn(category: string, message: string, data?: unknown): Promise<void> {
    return this.write(2, category, message, data);
  }

  error(category: string, message: string, data?: unknown): Promise<void> {
    return this.write(3, category, message, data);
  }

  critical(category: string, message: string, data?: unknown): Promise<void> {
    return this.write(4, category, message, data);
  }
}

// Singleton instance
export const logger = new Logger();
