import type { MatchOptions } from './types';

export const AI_COUNT_MIN = 1;
export const AI_COUNT_MAX = 4;
export const ROUND_CHOICES: readonly number[] = [1, 3, 5, 7];

/** Returns a reason the options are invalid, or null if they're fine. */
export function validateOptions(options: MatchOptions): string | null {
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

function isAiCount(n: number): boolean {
  return Number.isInteger(n) && n >= AI_COUNT_MIN && n <= AI_COUNT_MAX;
}

/** The most tanks a match with these options will ever have on the board at once. */
export function maxTanks(options: MatchOptions): number {
  return (options.mode === 'lastOneStanding' ? options.aiCount : AI_COUNT_MAX) + 1;
}
