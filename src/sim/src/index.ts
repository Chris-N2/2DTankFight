export * from './types';
export { DEFAULT_CONFIG, ticks, tickDuration, type SimConfig } from './config';
export type { Rect } from './geometry';
export { createRng, type RngState } from './rng';
export {
  AI_COUNT_MAX,
  AI_COUNT_MIN,
  aiCountMax,
  humansOf,
  MAX_TANKS,
  ROUND_CHOICES,
  SEQUENCE_MAX,
  sequenceLimit,
  validateOptions,
} from './options';
export { botInput } from './ai/bot';
export { cloneState, createMatch, leave, step } from './match';
export { mortarLanding, mortarRange } from './mortar';
export { evaluateGame, evaluateRound } from './rules/lastOneStanding';
export { waveSetup, type WaveSetup } from './rules/waves';
export { validateBoard, type BoardValidation } from './validate';
export {
  BUILT_IN_BOARDS,
  CHECKERBOARD,
  FRUSTRATION,
  NOWHERE_TO_HIDE,
  PAC_TANK,
  PROVING_GROUND,
  RICOCHET_ALLEY,
  RUN_FOR_COVER,
} from './boards';
