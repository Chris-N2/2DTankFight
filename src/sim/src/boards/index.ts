import type { Board } from '../types';
import { CHECKERBOARD } from './checkerboard';
import { FRUSTRATION } from './frustration';
import { NOWHERE_TO_HIDE } from './nowhereToHide';
import { PAC_TANK } from './pacTank';
import { PROVING_GROUND } from './provingGround';
import { RICOCHET_ALLEY } from './ricochetAlley';
import { RUN_FOR_COVER } from './runForCover';

export {
  CHECKERBOARD,
  FRUSTRATION,
  NOWHERE_TO_HIDE,
  PAC_TANK,
  PROVING_GROUND,
  RICOCHET_ALLEY,
  RUN_FOR_COVER,
};

/**
 * Every hand-made board shipped with the game, in the order the map picker shows them. Each must pass
 * validateBoard, be 1200 × 800 and have a unique id (all enforced by tests).
 */
export const BUILT_IN_BOARDS: readonly Board[] = [
  PROVING_GROUND,
  RUN_FOR_COVER,
  NOWHERE_TO_HIDE,
  PAC_TANK,
  FRUSTRATION,
  RICOCHET_ALLEY,
  CHECKERBOARD,
];
