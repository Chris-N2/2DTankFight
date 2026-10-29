import { humansOf } from '../options';
import { aiColorIndex, createTank, setDefaultCombat } from '../tank';
import type { LastOneStandingResult, MatchState, RoundOutcome, Scores, SimEvent } from '../types';
import type { ModeRules } from '.';

/** How a round ended: the outcome, and the humans who scored (both of them for a shared point). */
interface RoundResult {
  outcome: RoundOutcome;
  scorers: string[];
}

interface GameOutcome {
  result: LastOneStandingResult;
  winnerId: string | null;
}

/**
 * Every tank for itself, over a number of rounds. In single-player the AI tanks count together as one opponent; with
 * two humans each human scores for themselves and rounds the AI wins score for nobody.
 */
export const lastOneStanding: ModeRules = {
  setUp(state, events) {
    const { aiCount, mortars } = optionsOf(state);
    const humans = humansOf(state.options);
    // The same tanks play every round; they're added once, after the humans.
    if (!state.tanks.some((t) => t.kind === 'ai')) {
      for (let i = 1; i <= aiCount; i++) {
        state.tanks.push(createTank(state.config, `ai${i}`, 'ai', aiColorIndex(humans, i)));
      }
    }
    for (const tank of state.tanks) {
      setDefaultCombat(state.config, tank);
      // Every tank for itself, so everyone gets a mortar, loaded afresh each round.
      tank.mortars = mortars ? 1 : 0;
    }
    events.push({ type: 'roundStarted', round: state.round });
  },

  evaluate(state, events) {
    const round = roundResult(state, events);
    if (!round) return 'continue';
    return gameOutcome(state, state.roundsPlayed + 1, scored(state.scores, round)) ? 'gameOver' : 'next';
  },

  finish(state, ending, events) {
    const round = roundResult(state, events) ?? { outcome: 'draw', scorers: [] };
    state.scores = scored(state.scores, round);
    state.roundsPlayed++;
    state.lastRoundOutcome = round.outcome;
    state.lastRoundScorers = [...round.scorers];
    events.push({
      type: 'roundEnded',
      round: state.round,
      outcome: round.outcome,
      scorers: [...round.scorers],
      scores: copyScores(state.scores),
    });
    if (ending === 'gameOver') {
      const game = gameOutcome(state, state.roundsPlayed, state.scores) ?? { result: 'draw', winnerId: null };
      endGame(state, game, false, events);
    }
  },

  left(state, _humanId, events) {
    // The one who stays wins by forfeit, whatever the score; the round in progress isn't scored.
    const stayer = state.tanks.find((t) => t.kind === 'human');
    endGame(state, { result: 'win', winnerId: stayer?.id ?? null }, true, events);
  },
};

/**
 * Applies the Last One Standing round-end rules. Returns null while the round is still on. `events` are the current
 * tick's: with two humans, they tell a shared point (both humans fell in the final tick) from a draw.
 */
export function evaluateRound(state: MatchState, events: readonly SimEvent[] = []): RoundOutcome | null {
  return roundResult(state, events)?.outcome ?? null;
}

/** The game result once the outcome can no longer change, otherwise null. */
export function evaluateGame(state: MatchState): LastOneStandingResult | null {
  return gameOutcome(state, state.roundsPlayed, state.scores)?.result ?? null;
}

function roundResult(state: MatchState, events: readonly SimEvent[]): RoundResult | null {
  const humans = state.tanks.filter((t) => t.kind === 'human');
  const humansAlive = humans.filter((t) => t.alive);
  const aiAlive = state.tanks.some((t) => t.kind === 'ai' && t.alive);

  if (humansAlive.length === 0) {
    // The round ends as soon as every human is out, without waiting for the AI tanks to finish each other off.
    if (aiAlive) return { outcome: 'ai', scorers: [] };
    // Nobody is left. If both humans went down in this final tick, they were the last humans: they share the point.
    const fell = new Set(events.flatMap((e) => (e.type === 'eliminated' ? [e.tankId] : [])));
    const last = humans.filter((t) => fell.has(t.id));
    if (last.length === 2) return { outcome: 'human', scorers: last.map((t) => t.id) };
    return { outcome: 'draw', scorers: [] };
  }
  if (humansAlive.length === 1 && !aiAlive) return { outcome: 'human', scorers: [humansAlive[0]!.id] };
  return null;
}

function gameOutcome(state: MatchState, roundsPlayed: number, scores: Scores): GameOutcome | null {
  const remaining = optionsOf(state).rounds - roundsPlayed;
  const ids = Object.keys(scores.humans);
  // Single-player: the human against the AI side. Two humans: against each other, and the AI's rounds don't count.
  const [a, b] =
    ids.length === 1
      ? [scores.humans[ids[0]!]!, scores.ai]
      : [scores.humans[ids[0]!]!, scores.humans[ids[1]!]!];
  if (Math.abs(a - b) <= remaining && remaining > 0) return null;
  if (a === b) return { result: 'draw', winnerId: null };
  if (ids.length === 1)
    return a > b ? { result: 'win', winnerId: ids[0]! } : { result: 'loss', winnerId: null };
  return { result: 'win', winnerId: a > b ? ids[0]! : ids[1]! };
}

function endGame(state: MatchState, game: GameOutcome, forfeit: boolean, events: SimEvent[]): void {
  state.result = game.result;
  state.winnerId = game.winnerId;
  state.forfeit = forfeit;
  events.push({
    type: 'gameEnded',
    result: game.result,
    scores: copyScores(state.scores),
    winnerId: game.winnerId,
    forfeit,
  });
}

function scored(scores: Scores, round: RoundResult): Scores {
  const next = copyScores(scores);
  for (const id of round.scorers) next.humans[id] = (next.humans[id] ?? 0) + 1;
  if (round.outcome === 'ai') next.ai++;
  return next;
}

function copyScores(scores: Scores): Scores {
  return { humans: { ...scores.humans }, ai: scores.ai };
}

function optionsOf(state: MatchState): { aiCount: number; rounds: number; mortars: boolean } {
  if (state.options.mode !== 'lastOneStanding') throw new Error('Not a Last One Standing match.');
  return state.options;
}
