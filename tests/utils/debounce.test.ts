/**
 * Tests for src/utils/debounce.ts
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { debounce } from '@utils/debounce';

// SpaceManager debounces rapid space switches so only the last one runs
describe('debounce', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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
