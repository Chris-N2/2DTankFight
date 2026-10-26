export * from './types';
export { DEFAULT_CONFIG, ticks, tickDuration, type SimConfig } from './config';
export type { Rect } from './geometry';
export { createRng, type RngState } from './rng';
export {
  AI_COUNT_MAX,
  AI_COUNT_MIN,
  ROUND_CHOICES,
  cloneState,
  createMatch,
  evaluateGame,
  evaluateRound,
  step,
  validateOptions,
} from './match';
export { validateBoard, type BoardValidation } from './validate';
export { BUILT_IN_BOARDS, PROVING_GROUND } from './boards';
