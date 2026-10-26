import { createAiMemory, think } from './ai/think';
import { DEFAULT_CONFIG, ticks, type SimConfig } from './config';
import { buildNavGrid } from './nav';
import { maxTanks, validateOptions } from './options';
import { createRng, shuffle } from './rng';
import { rulesFor } from './rules';
import { createTank } from './tank';
import {
  HUMAN_ID,
  type Board,
  type InputMap,
  type MatchOptions,
  type MatchState,
  type SimEvent,
  type TankInput,
} from './types';
import { stepWorld } from './world';

/**
 * Creates a single-player match in the chosen mode, ready to begin the first round's or wave's countdown.
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
  if (board.spawns.length < maxTanks(options)) throw new Error('Board has too few spawn points.');

  const cfg: SimConfig = { ...config };
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
    waves: options.mode === 'waves' ? { startAiCount: options.startAiCount, cleared: 0 } : null,
    // The mode's rules add the AI tanks.
    tanks: [createTank(cfg, HUMAN_ID, 'human', 0)],
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
      const rules = rulesFor(state);
      const ending = rules.evaluate(state);
      if (ending !== 'continue') {
        rules.finish(state, ending, events);
        if (ending === 'gameOver') {
          state.phase = 'gameOver';
        } else {
          state.phase = 'roundOver';
          state.phaseTicks = ticks(state.config, state.config.roundResultDuration);
        }
      }
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

/**
 * Starts the next round or wave: the mode's rules set up the tanks, then every tank is reset and spawned,
 * shells and AI memory are cleared, and the countdown starts.
 */
function startRound(state: MatchState, events: SimEvent[]): void {
  const cfg = state.config;
  state.round++;
  state.shells = [];
  state.ai = {};
  rulesFor(state).setUp(state, events);

  const spawnOrder = shuffle(
    state.rng,
    state.board.spawns.map((_, i) => i),
  );
  state.tanks.forEach((tank, i) => {
    const spawn = state.board.spawns[spawnOrder[i]!]!;
    tank.x = spawn.x;
    tank.y = spawn.y;
    tank.heading = spawn.heading;
    tank.hp = tank.maxHp;
    tank.alive = true;
    tank.cooldown = 0;
    tank.fireHeld = false;
    if (tank.kind === 'ai') state.ai[tank.id] = createAiMemory();
  });

  state.phase = 'countdown';
  state.phaseTicks = ticks(cfg, cfg.countdownDuration);
}

function cloneBoard(board: Board): Board {
  return JSON.parse(JSON.stringify(board)) as Board;
}

/** Deep copy of a match state. State is plain data, so a JSON round trip is exact. */
export function cloneState(state: MatchState): MatchState {
  return JSON.parse(JSON.stringify(state)) as MatchState;
}
