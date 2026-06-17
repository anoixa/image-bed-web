export interface ThrottledProgressUpdater {
  update: (progress: number) => void;
  flush: () => void;
  cancel: () => void;
}

export function createThrottledProgressUpdater(
  onProgress: (progress: number) => void,
  intervalMs: number = 120,
  now: () => number = () => Date.now()
): ThrottledProgressUpdater {
  let latestProgress = 0;
  let hasPendingProgress = false;
  let lastFlushedAt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const flush = () => {
    if (!hasPendingProgress) return;
    clearTimer();
    hasPendingProgress = false;
    lastFlushedAt = now();
    onProgress(latestProgress);
  };

  return {
    update(progress: number) {
      latestProgress = progress;
      hasPendingProgress = true;

      const elapsed = now() - lastFlushedAt;
      if (progress >= 100 || lastFlushedAt === 0 || elapsed >= intervalMs) {
        flush();
        return;
      }

      if (timer === null) {
        timer = setTimeout(flush, intervalMs - elapsed);
      }
    },
    flush,
    cancel() {
      clearTimer();
      hasPendingProgress = false;
    },
  };
}
