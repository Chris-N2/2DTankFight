// The best number of waves cleared on this device, kept per starting AI count (starting with 4 is a
// different game from starting with 1) and per mortars setting (so is having a mortar). The best score is a
// nicety: if storage is blocked or broken, everything here quietly reports "unavailable" and the game plays on.

/** The part of the Web Storage API used here, so tests can pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BestResult {
  /** The best number of waves cleared, including the game just played. */
  best: number;
  /** True if the game just played beat every earlier one. */
  isNew: boolean;
}

/**
 * Bests set before mortars existed live under the plain key, so with mortars off they carry on as the
 * classic bests.
 */
export function bestKey(startAiCount: number, mortars: boolean): string {
  return `tank-command.waves-best.${startAiCount}${mortars ? '.mortars' : ''}`;
}

/** The browser's local storage, or null if it's blocked (some privacy settings throw on access). */
export function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Records a finished Waves game and returns the best so far, or null if storage is unavailable.
 * A first game only counts as a new best if it cleared at least one wave.
 */
export function recordBest(
  storage: StorageLike | null,
  startAiCount: number,
  mortars: boolean,
  cleared: number,
): BestResult | null {
  if (!storage) return null;
  try {
    const key = bestKey(startAiCount, mortars);
    const stored = storage.getItem(key);
    const previous = stored === null ? null : Number.parseInt(stored, 10);
    const known = previous !== null && Number.isFinite(previous) && previous >= 0 ? previous : null;
    const isNew = cleared > (known ?? 0);
    if (isNew || known === null) storage.setItem(key, String(Math.max(cleared, known ?? 0)));
    return { best: Math.max(cleared, known ?? 0), isNew };
  } catch {
    return null;
  }
}
