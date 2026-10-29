import { IDLE_INPUT, type MatchState, type TankInput } from '../types';
import { think } from './think';

/**
 * Drives a human's tank with the AI's own brain: the multiplayer server's test bot. In Waves it's the other human's
 * team-mate: they're hidden from it, so it treats only AI tanks as enemies (and never as allies to hold fire for). In
 * Last One Standing it's every tank for itself, so it sees, and fights, everyone. Its working memory lives with the AI
 * tanks', so it's reset with theirs every round. Idle if the tank isn't in the match or isn't alive. Call it once per
 * tick, before `step`, like any other source of input.
 */
export function botInput(state: MatchState, id: string): TankInput {
  const tank = state.tanks.find((t) => t.id === id && t.kind === 'human' && t.alive);
  if (!tank) return { ...IDLE_INPUT };
  if (state.options.mode === 'lastOneStanding') return think(state, tank);
  // A shallow copy that sees fewer tanks: everything else (the AI memory, the random number streams) is shared, so
  // what `think` remembers and draws is kept in the real match.
  const view: MatchState = { ...state, tanks: state.tanks.filter((t) => t.kind === 'ai' || t === tank) };
  return think(view, tank);
}
