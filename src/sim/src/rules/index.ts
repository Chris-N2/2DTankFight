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
  /**
   * Called after each playing tick, with that tick's events so far: whether play continues, moves on to the next
   * round or wave, or ends.
   */
  evaluate(state: MatchState, events: readonly SimEvent[]): 'continue' | 'next' | 'gameOver';
  /** Records the outcome (scores, waves cleared) and emits the mode's events. */
  finish(state: MatchState, ending: 'next' | 'gameOver', events: SimEvent[]): void;
  /**
   * A human has left a two-player match and their tank has been removed. Decides what that does to the game: if it
   * ends it, sets `result` and emits `gameEnded`, and the caller moves the match to `gameOver`.
   */
  left(state: MatchState, humanId: string, events: SimEvent[]): void;
}

export function rulesFor(state: MatchState): ModeRules {
  return state.options.mode === 'waves' ? waves : lastOneStanding;
}
