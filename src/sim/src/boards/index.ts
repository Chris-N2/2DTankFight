import type { Board } from '../types';
import { PROVING_GROUND } from './provingGround';

export { PROVING_GROUND };

/** Every hand-made board shipped with the game. Each must pass validateBoard (enforced by tests). */
export const BUILT_IN_BOARDS: readonly Board[] = [PROVING_GROUND];
