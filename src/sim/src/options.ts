import { BUILT_IN_BOARDS } from './boards';
import type { Board, MatchOptions } from './types';

export const AI_COUNT_MIN = 1;
export const AI_COUNT_MAX = 4;
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
  const modeProblem = validateModeOptions(options);
  if (modeProblem) return modeProblem;
  return validateMaps(options, boards);
}

/** The longest map sequence these options allow. */
export function sequenceLimit(options: MatchOptions): number {
  return options.mode === 'lastOneStanding' ? Math.min(SEQUENCE_MAX, options.rounds) : SEQUENCE_MAX;
}

function validateModeOptions(options: MatchOptions): string | null {
  switch (options.mode) {
    case 'lastOneStanding':
      if (!isAiCount(options.aiCount)) {
        return `Number of AI opponents must be between ${AI_COUNT_MIN} and ${AI_COUNT_MAX}.`;
      }
      if (!ROUND_CHOICES.includes(options.rounds)) {
        return `Number of rounds must be one of ${ROUND_CHOICES.join(', ')}.`;
      }
      return null;
    case 'waves':
      if (!isAiCount(options.startAiCount)) {
        return `Starting number of AI tanks must be between ${AI_COUNT_MIN} and ${AI_COUNT_MAX}.`;
      }
      return null;
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

function isAiCount(n: number): boolean {
  return Number.isInteger(n) && n >= AI_COUNT_MIN && n <= AI_COUNT_MAX;
}

/** The most tanks a match with these options will ever have on the board at once. */
export function maxTanks(options: MatchOptions): number {
  return (options.mode === 'lastOneStanding' ? options.aiCount : AI_COUNT_MAX) + 1;
}
