import type { MatchState, SimEvent } from '../types';
import { lastOneStanding } from './lastOneStanding';
import { waves } from './waves';

/**
 * What differs between game modes. The shared phase machine in `match.ts` calls these; the rules are
 * looked up by `state.options.mode` rather than stored in the state, which stays plain data.
 */
export interface ModeRules {
  /** Builds this round's or wave's tanks and their combat values, before spawning. */
  setUp(state: MatchState, events: SimEvent[]): void;
  /** Called after each playing tick: whether play continues, moves on to the next round or wave, or ends. */
  evaluate(state: MatchState): 'continue' | 'next' | 'gameOver';
  /** Records the outcome (scores, waves cleared) and emits the mode's events. */
  finish(state: MatchState, ending: 'next' | 'gameOver', events: SimEvent[]): void;
}

export function rulesFor(state: MatchState): ModeRules {
  return state.options.mode === 'waves' ? waves : lastOneStanding;
}
