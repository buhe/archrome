/**
 * Tests for src/utils/debounce.ts
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { debounce, debounceAsync, throttle, KeyedDebounce } from '@utils/debounce';

describe('debounce utilities', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // SpaceManager debounces rapid space switches so only the last one runs
  describe('debounce', () => {
    it('should collapse rapid calls into a single invocation with the last args', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('space-1');
      debounced('space-2');
      debounced('space-3');
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('space-3');
    });
  });

  describe('debounceAsync', () => {
    it('resolves with the result of the last call after the wait', async () => {
      vi.useFakeTimers();
      const fn = vi.fn(async (n: number) => n * 2);
      const debounced = debounceAsync(fn, 100);

      const p = debounced(5);
      vi.advanceTimersByTime(100);
      await expect(p).resolves.toBe(10);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(5);
    });

    it('rejects when the underlying function throws', async () => {
      vi.useFakeTimers();
      const fn = vi.fn(async () => {
        throw new Error('boom');
      });
      const debounced = debounceAsync(fn, 50);

      const p = debounced();
      vi.advanceTimersByTime(50);
      await expect(p).rejects.toThrow('boom');
    });

    it('only the most recent call runs when several are queued', async () => {
      vi.useFakeTimers();
      const fn = vi.fn(async (n: number) => n);
      const debounced = debounceAsync(fn, 100);

      debounced(1);
      debounced(2);
      const last = debounced(3);
      vi.advanceTimersByTime(100);
      // Only the final call's returned promise settles; earlier ones are superseded.
      await expect(last).resolves.toBe(3);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(3);
    });
  });

  describe('throttle', () => {
    it('runs immediately on the first call then waits', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('a');
      throttled('b');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('a');

      // After the wait elapses, the trailing call fires with the last args
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('b');
    });

    it('executes again once the wait period has fully passed', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled(1);
      vi.advanceTimersByTime(100);
      throttled(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('KeyedDebounce', () => {
    it('debounces each key independently', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const kd = new KeyedDebounce(fn, 100);

      kd.debounce('a', 1);
      kd.debounce('a', 2);
      kd.debounce('b', 3);

      vi.advanceTimersByTime(100);
      // key 'a' collapsed to one call with last args, key 'b' once
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenCalledWith('a', 2);
      expect(fn).toHaveBeenCalledWith('b', 3);
    });

    it('clear() cancels all pending calls', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const kd = new KeyedDebounce(fn, 100);

      kd.debounce('a', 1);
      kd.clear();
      vi.advanceTimersByTime(100);
      expect(fn).not.toHaveBeenCalled();
    });

    it('clearKey() cancels a single key only', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const kd = new KeyedDebounce(fn, 100);

      kd.debounce('a', 1);
      kd.debounce('b', 2);
      kd.clearKey('a');
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('b', 2);
    });

    it('clearKey on an unknown key is a no-op', () => {
      const fn = vi.fn();
      const kd = new KeyedDebounce(fn, 100);
      expect(() => kd.clearKey('missing')).not.toThrow();
    });
  });
});
