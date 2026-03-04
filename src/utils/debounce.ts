/**
 * Debounce utility functions
 */

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debounced(...args: Parameters<T>): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Creates a debounced async function that returns a promise
 */
export function debounceAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingResolve: ((value: ReturnType<T>) => void) | null = null;
  let pendingReject: ((reason?: unknown) => void) | null = null;
  let pendingArgs: Parameters<T> | null = null;

  return async function debouncedAsync(
    ...args: Parameters<T>
  ): Promise<ReturnType<T>> {
    // Store args for when the timeout fires
    pendingArgs = args;

    // Clear previous timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    // Return a promise that resolves with the result
    return new Promise<ReturnType<T>>((resolve, reject) => {
      pendingResolve = resolve;
      pendingReject = reject;

      timeoutId = setTimeout(async () => {
        try {
          if (pendingArgs) {
            const result = await func(...pendingArgs);
            if (pendingResolve) pendingResolve(result);
          }
        } catch (error) {
          if (pendingReject) pendingReject(error);
        } finally {
          timeoutId = null;
          pendingResolve = null;
          pendingReject = null;
          pendingArgs = null;
        }
      }, wait);
    });
  };
}

/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastExecTime = 0;
  let pendingArgs: Parameters<T> | null = null;

  return function throttled(...args: Parameters<T>): void {
    const now = Date.now();
    const timeSinceLastExec = now - lastExecTime;

    pendingArgs = args;

    if (timeSinceLastExec >= wait) {
      // Execute immediately if enough time has passed
      lastExecTime = now;
      func(...pendingArgs);
      pendingArgs = null;
    } else if (timeoutId === null) {
      // Schedule execution for when wait time has elapsed
      const remainingWait = wait - timeSinceLastExec;
      timeoutId = setTimeout(() => {
        lastExecTime = Date.now();
        if (pendingArgs) {
          func(...pendingArgs);
        }
        timeoutId = null;
        pendingArgs = null;
      }, remainingWait);
    }
  };
}

/**
 * Creates a keyed debounce manager that handles multiple keys independently
 */
export class KeyedDebounce<T> {
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private func: (key: string, ...args: T[]) => void;
  private wait: number;

  constructor(func: (key: string, ...args: T[]) => void, wait: number) {
    this.func = func;
    this.wait = wait;
  }

  /**
   * Debounce a function call for a specific key
   */
  debounce(key: string, ...args: T[]): void {
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.func(key, ...args);
      this.timers.delete(key);
    }, this.wait);

    this.timers.set(key, timer);
  }

  /**
   * Clear all pending debounced calls
   */
  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  /**
   * Clear a specific key
   */
  clearKey(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
}
