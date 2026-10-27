import { createTank, setDefaultCombat } from '../tank';
import type { LastOneStandingResult, MatchState, RoundOutcome, Scores } from '../types';
import type { ModeRules } from '.';

/** Every tank for itself; the human against the AI tanks as one side, over a number of rounds. */
export const lastOneStanding: ModeRules = {
  setUp(state, events) {
    const { aiCount, mortars } = optionsOf(state);
    // The same tanks play every round; they're added once, after the human.
    if (state.tanks.length === 1) {
      for (let i = 1; i <= aiCount; i++) state.tanks.push(createTank(state.config, `ai${i}`, 'ai', i));
    }
    for (const tank of state.tanks) {
      setDefaultCombat(state.config, tank);
      // Every tank for itself, so everyone gets a mortar, loaded afresh each round.
      tank.mortars = mortars ? 1 : 0;
    }
    events.push({ type: 'roundStarted', round: state.round });
  },

  evaluate(state) {
    const outcome = evaluateRound(state);
    if (!outcome) return 'continue';
    const result = gameResult(optionsOf(state).rounds, state.roundsPlayed + 1, scored(state.scores, outcome));
    return result ? 'gameOver' : 'next';
  },

  finish(state, ending, events) {
    const outcome = evaluateRound(state) ?? 'draw';
    state.scores = scored(state.scores, outcome);
    state.roundsPlayed++;
    state.lastRoundOutcome = outcome;
    events.push({ type: 'roundEnded', round: state.round, outcome, scores: { ...state.scores } });
    if (ending === 'gameOver') {
      const result = evaluateGame(state) ?? 'draw';
      state.result = result;
      events.push({ type: 'gameEnded', result, scores: { ...state.scores } });
    }
  },
};

/** Applies the Last One Standing round-end rules. Returns null while the round is still on. */
export function evaluateRound(state: MatchState): RoundOutcome | null {
  const human = state.tanks.find((t) => t.kind === 'human');
  const aiAlive = state.tanks.filter((t) => t.kind === 'ai' && t.alive).length;
  if (!human || !human.alive) return aiAlive > 0 ? 'ai' : 'draw';
  return aiAlive === 0 ? 'human' : null;
}

/** The game result once the outcome can no longer change, otherwise null. */
export function evaluateGame(state: MatchState): LastOneStandingResult | null {
  return gameResult(optionsOf(state).rounds, state.roundsPlayed, state.scores);
}

function gameResult(rounds: number, roundsPlayed: number, scores: Scores): LastOneStandingResult | null {
  const { human, ai } = scores;
  const remaining = rounds - roundsPlayed;
  if (Math.abs(human - ai) <= remaining && remaining > 0) return null;
  return human > ai ? 'win' : human < ai ? 'loss' : 'draw';
}

function scored(scores: Scores, outcome: RoundOutcome): Scores {
  return {
    human: scores.human + (outcome === 'human' ? 1 : 0),
    ai: scores.ai + (outcome === 'ai' ? 1 : 0),
  };
}

function optionsOf(state: MatchState): { aiCount: number; rounds: number; mortars: boolean } {
  if (state.options.mode !== 'lastOneStanding') throw new Error('Not a Last One Standing match.');
  return state.options;
}
