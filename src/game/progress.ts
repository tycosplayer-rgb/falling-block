const STORAGE_KEY = 'falling-block:last-level';

export function loadLastLevelIndex(levelCount: number): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return 0;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(levelCount - 1, n));
  } catch {
    return 0;
  }
}

export function saveLastLevelIndex(index: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(index));
  } catch {
    // ignore quota / private mode
  }
}
