/**
 * Tests for src/utils/logger.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '@utils/logger';
import { LogLevel, STORAGE_KEYS } from '@types/index';

describe('Logger', () => {
  let logger: Logger;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new Logger(5);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes a log entry to console only (persistence disabled to avoid storage races)', async () => {
    await logger.info('Test', 'hello');

    // 持久化已禁用：storage 不应被写入
    const stored = await chrome.storage.local.get([STORAGE_KEYS.LOGS]);
    expect(stored[STORAGE_KEYS.LOGS]).toBeUndefined();

    expect(consoleSpy).toHaveBeenCalled();
  });

  it('includes data in the console output when provided', async () => {
    await logger.warn('Test', 'with data', { key: 'value' });
    const call = consoleSpy.mock.calls.find((c) => c.some((a) => typeof a === 'string' && a.includes('with data')));
    expect(call).toBeTruthy();
  });

  it('does not persist logs to storage (persistence disabled)', async () => {
    for (let i = 0; i < 8; i++) {
      await logger.debug('Test', `msg-${i}`);
    }
    const stored = await chrome.storage.local.get([STORAGE_KEYS.LOGS]);
    expect(stored[STORAGE_KEYS.LOGS]).toBeUndefined();
  });

  it('getLogs returns [] when persistence is disabled', async () => {
    await logger.debug('Test', 'd');
    await logger.error('Test', 'e');
    const logs = await logger.getLogs();
    expect(logs).toEqual([]);
  });

  it('getLogs returns [] for level filter as well when persistence is disabled', async () => {
    await logger.debug('Test', 'd');
    await logger.error('Test', 'e');
    const logs = await logger.getLogs(LogLevel.ERROR);
    expect(logs).toEqual([]);
  });

  it('clearLogs empties logs and metrics', async () => {
    await logger.info('Test', 'x');
    await logger.clearLogs();
    const stored = await chrome.storage.local.get([STORAGE_KEYS.LOGS, STORAGE_KEYS.SWITCH_METRICS]);
    expect(stored[STORAGE_KEYS.LOGS]).toEqual([]);
    expect(stored[STORAGE_KEYS.SWITCH_METRICS]).toEqual([]);
  });

  it('getLogs returns [] when storage throws', async () => {
    vi.spyOn(chrome.storage.local, 'get').mockRejectedValueOnce(new Error('boom'));
    const logs = await logger.getLogs();
    expect(logs).toEqual([]);
  });

  it('write does not throw when storage fails', async () => {
    vi.spyOn(chrome.storage.local, 'get').mockRejectedValueOnce(new Error('boom'));
    await expect(logger.info('Test', 'safe')).resolves.toBeUndefined();
  });

  it('maps every level to a name', async () => {
    await logger.debug('T', 'd');
    await logger.info('T', 'i');
    await logger.warn('T', 'w');
    await logger.error('T', 'e');
    await logger.critical('T', 'c');

    const calls = consoleSpy.mock.calls.map((c) => c[0] as string);
    expect(calls.some((s) => s.includes('[DEBUG]'))).toBe(true);
    expect(calls.some((s) => s.includes('[INFO]'))).toBe(true);
    expect(calls.some((s) => s.includes('[WARN]'))).toBe(true);
    expect(calls.some((s) => s.includes('[ERROR]'))).toBe(true);
    expect(calls.some((s) => s.includes('[CRITICAL]'))).toBe(true);
  });
});
