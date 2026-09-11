const LAST_KEY = 'falling-block:last-level';
const UNLOCK_KEY = 'falling-block:max-unlocked';

function clampIndex(n: number, levelCount: number): number {
  return Math.max(0, Math.min(levelCount - 1, n));
}

export function loadLastLevelIndex(levelCount: number): number {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (raw == null) return 0;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return 0;
    return clampIndex(n, levelCount);
  } catch {
    return 0;
  }
}

export function saveLastLevelIndex(index: number): void {
  try {
    localStorage.setItem(LAST_KEY, String(index));
  } catch {
    // ignore
  }
}

/** Highest level index the player may select (0 = only level 1). */
export function loadMaxUnlocked(levelCount: number): number {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    let unlocked = 0;
    if (raw != null) {
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n)) unlocked = n;
    }
    // Migrate: anything already visited counts as unlocked.
    const last = loadLastLevelIndex(levelCount);
    unlocked = Math.max(unlocked, last);
    return clampIndex(unlocked, levelCount);
  } catch {
    return 0;
  }
}

export function saveMaxUnlocked(index: number): void {
  try {
    const prev = Number.parseInt(localStorage.getItem(UNLOCK_KEY) ?? '0', 10);
    const next = Math.max(Number.isFinite(prev) ? prev : 0, index);
    localStorage.setItem(UNLOCK_KEY, String(next));
  } catch {
    // ignore
  }
}

/** Call when the player clears a level — unlocks the next one. */
export function unlockAfterClear(clearedIndex: number, levelCount: number): number {
  const next = clampIndex(clearedIndex + 1, levelCount);
  saveMaxUnlocked(Math.max(clearedIndex, next));
  return loadMaxUnlocked(levelCount);
}
