import { BUILT_IN_BOARDS } from './boards';
import type { Board, MatchOptions } from './types';

export const AI_COUNT_MIN = 1;
/** The most AI tanks in single-player. With two humans it's one fewer: see {@link aiCountMax}. */
export const AI_COUNT_MAX = 4;
/** The most tanks in any match, humans and AI together. */
export const MAX_TANKS = 5;

/** The number of human players these options are for. */
export function humansOf(options: MatchOptions): 1 | 2 {
  return options.humans ?? 1;
}

/** The most AI tanks a match with this many humans can have. */
export function aiCountMax(humans: number): number {
  return MAX_TANKS - humans;
}
export const ROUND_CHOICES: readonly number[] = [1, 3, 5, 7];
/** The most maps a sequence can hold. In Last One Standing the number of rounds may limit it further. */
export const SEQUENCE_MAX = 7;

/**
 * Returns a reason the options are invalid, or null if they're fine. `boards` is the catalogue a map sequence may
 * choose from.
 */
export function validateOptions(
  options: MatchOptions,
  boards: readonly Board[] = BUILT_IN_BOARDS,
): string | null {
  // Options may one day arrive from an untrusted network client, so the type alone isn't trusted.
  if (typeof (options.mortars as unknown) !== 'boolean') return 'Mortars must be either on or off.';
  const humans = options.humans as unknown;
  if (humans !== undefined && humans !== 1 && humans !== 2) return 'There must be 1 or 2 human players.';
  const modeProblem = validateModeOptions(options);
  if (modeProblem) return modeProblem;
  return validateMaps(options, boards);
}

/** The longest map sequence these options allow. */
export function sequenceLimit(options: MatchOptions): number {
  return options.mode === 'lastOneStanding' ? Math.min(SEQUENCE_MAX, options.rounds) : SEQUENCE_MAX;
}

function validateModeOptions(options: MatchOptions): string | null {
  const max = aiCountMax(humansOf(options));
  switch (options.mode) {
    case 'lastOneStanding':
      if (!isAiCount(options.aiCount, max)) {
        return `Number of AI opponents must be between ${AI_COUNT_MIN} and ${max}.`;
      }
      if (!ROUND_CHOICES.includes(options.rounds)) {
        return `Number of rounds must be one of ${ROUND_CHOICES.join(', ')}.`;
      }
      return null;
    case 'waves': {
      if (!isAiCount(options.startAiCount, max)) {
        return `Starting number of AI tanks must be between ${AI_COUNT_MIN} and ${max}.`;
      }
      const friendlyFire = options.friendlyFire as unknown;
      if (friendlyFire !== undefined && typeof friendlyFire !== 'boolean') {
        return 'Friendly fire must be either on or off.';
      }
      return null;
    }
    default:
      // Options may one day arrive from an untrusted network client.
      return 'Unknown game mode.';
  }
}

function validateMaps(options: MatchOptions, boards: readonly Board[]): string | null {
  const maps = options.maps as unknown;
  if (typeof maps !== 'object' || maps === null) return 'Maps must be either random or a sequence.';
  const { kind, ids } = maps as { kind?: unknown; ids?: unknown };
  if (kind === 'random') return null;
  if (kind !== 'sequence') return 'Maps must be either random or a sequence.';
  if (!Array.isArray(ids) || ids.length === 0) return 'A map sequence needs at least one map.';
  const limit = sequenceLimit(options);
  if (ids.length > limit) {
    return options.mode === 'lastOneStanding' && limit < SEQUENCE_MAX
      ? `A map sequence can't be longer than the number of rounds (${limit}).`
      : `A map sequence can hold at most ${limit} maps.`;
  }
  for (const id of ids) {
    if (!boards.some((b) => b.id === id)) return `Unknown map: ${String(id)}.`;
  }
  return null;
}

function isAiCount(n: number, max: number): boolean {
  return Number.isInteger(n) && n >= AI_COUNT_MIN && n <= max;
}

/** The most tanks a match with these options will ever have on the board at once. */
export function maxTanks(options: MatchOptions): number {
  const humans = humansOf(options);
  return (options.mode === 'lastOneStanding' ? options.aiCount : aiCountMax(humans)) + humans;
}

/** Whether one human's shells can damage the other: only Waves can turn friendly fire off. */
export function friendlyFireOn(options: MatchOptions): boolean {
  return options.mode !== 'waves' || options.friendlyFire === true;
}
