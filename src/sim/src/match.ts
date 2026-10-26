import { createAiMemory, think } from './ai/think';
import { DEFAULT_CONFIG, ticks, type SimConfig } from './config';
import { buildNavGrid } from './nav';
import { createRng, shuffle } from './rng';
import {
  HUMAN_ID,
  type Board,
  type GameResult,
  type InputMap,
  type MatchOptions,
  type MatchState,
  type RoundOutcome,
  type SimEvent,
  type TankInput,
  type TankState,
} from './types';
import { stepWorld } from './world';

export const AI_COUNT_MIN = 1;
export const AI_COUNT_MAX = 4;
export const ROUND_CHOICES: readonly number[] = [1, 3, 5, 7];

/** Returns a reason the options are invalid, or null if they're fine. */
export function validateOptions(options: MatchOptions): string | null {
  if (
    !Number.isInteger(options.aiCount) ||
    options.aiCount < AI_COUNT_MIN ||
    options.aiCount > AI_COUNT_MAX
  ) {
    return `Number of AI opponents must be between ${AI_COUNT_MIN} and ${AI_COUNT_MAX}.`;
  }
  if (!ROUND_CHOICES.includes(options.rounds)) {
    return `Number of rounds must be one of ${ROUND_CHOICES.join(', ')}.`;
  }
  return null;
}

/**
 * Creates a single-player Last One Standing match, ready to begin round 1's countdown.
 * Throws if the options are invalid.
 */
export function createMatch(
  options: MatchOptions,
  board: Board,
  seed: number,
  config: SimConfig = DEFAULT_CONFIG,
): MatchState {
  const problem = validateOptions(options);
  if (problem) throw new Error(problem);
  if (board.spawns.length < options.aiCount + 1) throw new Error('Board has too few spawn points.');

  const cfg: SimConfig = { ...config };
  const tanks: TankState[] = [];
  const makeTank = (id: string, kind: TankState['kind'], colorIndex: number): TankState => ({
    id,
    kind,
    colorIndex,
    x: 0,
    y: 0,
    heading: 0,
    hp: cfg.tankMaxHp,
    alive: true,
    cooldown: 0,
    fireHeld: false,
  });
  tanks.push(makeTank(HUMAN_ID, 'human', 0));
  for (let i = 1; i <= options.aiCount; i++) tanks.push(makeTank(`ai${i}`, 'ai', i));

  const state: MatchState = {
    config: cfg,
    board: cloneBoard(board),
    nav: buildNavGrid(board, cfg),
    options: { ...options },
    tick: 0,
    phase: 'countdown',
    phaseTicks: 0,
    round: 0,
    roundsPlayed: 0,
    scores: { human: 0, ai: 0 },
    lastRoundOutcome: null,
    result: null,
    tanks,
    shells: [],
    nextShellId: 1,
    rng: createRng(seed),
    aiRng: createRng((seed ^ 0x5bd1e995) >>> 0),
    ai: {},
  };
  startRound(state, []);
  return state;
}

/**
 * Advances the match by exactly one fixed tick. `inputs` carries the human players' inputs;
 * AI tanks decide theirs here, through the same input type. Returns the events of this tick.
 */
export function step(state: MatchState, inputs: InputMap): SimEvent[] {
  const events: SimEvent[] = [];
  state.tick++;

  switch (state.phase) {
    case 'countdown':
      // The world is frozen and inputs are ignored until the countdown ends.
      if (--state.phaseTicks <= 0) {
        state.phase = 'playing';
        events.push({ type: 'playStarted', round: state.round });
      }
      break;

    case 'playing': {
      const all: Record<string, TankInput | undefined> = {};
      for (const tank of state.tanks) {
        if (!tank.alive) continue;
        all[tank.id] = tank.kind === 'ai' ? think(state, tank) : inputs[tank.id];
      }
      stepWorld(state, all, events);
      const outcome = evaluateRound(state);
      if (outcome) endRound(state, outcome, events);
      break;
    }

    case 'roundOver':
      if (--state.phaseTicks <= 0) startRound(state, events);
      break;

    case 'gameOver':
      break;
  }
  return events;
}

/** Applies the Last One Standing round-end rules. Returns null while the round is still on. */
export function evaluateRound(state: MatchState): RoundOutcome | null {
  const human = state.tanks.find((t) => t.kind === 'human');
  const aiAlive = state.tanks.filter((t) => t.kind === 'ai' && t.alive).length;
  if (!human || !human.alive) return aiAlive > 0 ? 'ai' : 'draw';
  return aiAlive === 0 ? 'human' : null;
}

/** The game result once the outcome can no longer change, otherwise null. */
export function evaluateGame(state: MatchState): GameResult | null {
  const { human, ai } = state.scores;
  const remaining = state.options.rounds - state.roundsPlayed;
  if (Math.abs(human - ai) <= remaining && remaining > 0) return null;
  return human > ai ? 'win' : human < ai ? 'loss' : 'draw';
}

function endRound(state: MatchState, outcome: RoundOutcome, events: SimEvent[]): void {
  if (outcome === 'human') state.scores.human++;
  else if (outcome === 'ai') state.scores.ai++;
  state.roundsPlayed++;
  state.lastRoundOutcome = outcome;
  events.push({ type: 'roundEnded', round: state.round, outcome, scores: { ...state.scores } });

  const result = evaluateGame(state);
  if (result) {
    state.phase = 'gameOver';
    state.result = result;
    events.push({ type: 'gameEnded', result, scores: { ...state.scores } });
  } else {
    state.phase = 'roundOver';
    state.phaseTicks = ticks(state.config, state.config.roundResultDuration);
  }
}

/** Resets every tank, clears shells and AI memory, assigns spawns and starts the countdown. */
function startRound(state: MatchState, events: SimEvent[]): void {
  const cfg = state.config;
  state.round++;
  state.shells = [];
  state.ai = {};

  const spawnOrder = shuffle(
    state.rng,
    state.board.spawns.map((_, i) => i),
  );
  state.tanks.forEach((tank, i) => {
    const spawn = state.board.spawns[spawnOrder[i]!]!;
    tank.x = spawn.x;
    tank.y = spawn.y;
    tank.heading = spawn.heading;
    tank.hp = cfg.tankMaxHp;
    tank.alive = true;
    tank.cooldown = 0;
    tank.fireHeld = false;
    if (tank.kind === 'ai') state.ai[tank.id] = createAiMemory();
  });

  state.phase = 'countdown';
  state.phaseTicks = ticks(cfg, cfg.countdownDuration);
  events.push({ type: 'roundStarted', round: state.round });
}

function cloneBoard(board: Board): Board {
  return JSON.parse(JSON.stringify(board)) as Board;
}

/** Deep copy of a match state. State is plain data, so a JSON round trip is exact. */
export function cloneState(state: MatchState): MatchState {
  return JSON.parse(JSON.stringify(state)) as MatchState;
}
