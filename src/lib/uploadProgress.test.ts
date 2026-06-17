import { afterEach, describe, expect, it, vi } from 'vitest';
import { createThrottledProgressUpdater } from './uploadProgress';

describe('createThrottledProgressUpdater', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces frequent progress updates into the latest value', () => {
    vi.useFakeTimers();
    let now = 1_000;
    const updates: number[] = [];
    const updater = createThrottledProgressUpdater((progress) => updates.push(progress), 100, () => now);

    updater.update(10);
    expect(updates).toEqual([10]);

    now = 1_020;
    updater.update(20);
    updater.update(30);
    expect(updates).toEqual([10]);

    now = 1_100;
    vi.advanceTimersByTime(80);
    expect(updates).toEqual([10, 30]);
  });

  it('flushes completion immediately', () => {
    vi.useFakeTimers();
    let now = 1_000;
    const updates: number[] = [];
    const updater = createThrottledProgressUpdater((progress) => updates.push(progress), 100, () => now);

    updater.update(5);
    now = 1_010;
    updater.update(50);
    updater.update(100);

    expect(updates).toEqual([5, 100]);
  });
});
