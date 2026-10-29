import { createAiMemory, think } from './ai/think';
import { BUILT_IN_BOARDS } from './boards';
import { DEFAULT_CONFIG, ticks, type SimConfig } from './config';
import { buildNavGrid } from './nav';
import { humansOf, maxTanks, validateOptions } from './options';
import { createRng, nextInt, shuffle, type RngState } from './rng';
import { rulesFor } from './rules';
import { createTank, HUMAN_COLOR_INDEX, SECOND_HUMAN_COLOR_INDEX } from './tank';
import {
  HUMAN_ID,
  SECOND_HUMAN_ID,
  type Board,
  type InputMap,
  type MapRotation,
  type MatchOptions,
  type MatchState,
  type SimEvent,
  type TankInput,
} from './types';
import { stepWorld } from './world';

/**
 * Creates a match for one or two humans in the chosen mode, ready to begin the first round's or wave's countdown.
 * `boards` is the catalogue the map options choose from. Throws if the options are invalid.
 */
export function createMatch(
  options: MatchOptions,
  seed: number,
  config: SimConfig = DEFAULT_CONFIG,
  boards: readonly Board[] = BUILT_IN_BOARDS,
): MatchState {
  const problem = validateOptions(options, boards);
  if (problem) throw new Error(problem);
  const { maps } = options;
  const playable = maps.kind === 'random' ? boards : boards.filter((b) => maps.ids.includes(b.id));
  if (playable.length === 0) throw new Error('There are no boards to play on.');
  const short = playable.find((b) => b.spawns.length < maxTanks(options));
  if (short) throw new Error(`Board ${short.name} has too few spawn points.`);

  const cfg: SimConfig = { ...config };
  const humanIds = humansOf(options) === 2 ? [HUMAN_ID, SECOND_HUMAN_ID] : [HUMAN_ID];
  const mapRng = createRng((seed ^ 0x27d4eb2f) >>> 0);
  const state: MatchState = {
    config: cfg,
    boards: playable.map(cloneBoard),
    // Replaced with the first round's board when the round starts.
    board: cloneBoard(playable[0]!),
    nav: { cellSize: cfg.navCellSize, cols: 0, rows: 0, walkable: [] },
    maps: firstRotation(options, playable, mapRng),
    options: cloneOptions(options),
    tick: 0,
    phase: 'countdown',
    phaseTicks: 0,
    round: 0,
    roundsPlayed: 0,
    scores: { humans: Object.fromEntries(humanIds.map((id) => [id, 0])), ai: 0 },
    lastRoundOutcome: null,
    lastRoundScorers: [],
    result: null,
    winnerId: null,
    forfeit: false,
    waves: options.mode === 'waves' ? { startAiCount: options.startAiCount, cleared: 0 } : null,
    // Humans come first, so spawns are assigned in the same order as ever. The mode's rules add the AI tanks.
    tanks: humanIds.map((id, i) =>
      createTank(cfg, id, 'human', i === 0 ? HUMAN_COLOR_INDEX : SECOND_HUMAN_COLOR_INDEX),
    ),
    shells: [],
    nextShellId: 1,
    mortarShells: [],
    nextMortarId: 1,
    rng: createRng(seed),
    aiRng: createRng((seed ^ 0x5bd1e995) >>> 0),
    mapRng,
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
      const ending = rules.evaluate(state, events);
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
 * A human leaves a two-player match. Call it between ticks, not during one. Their tank goes, and so do its shells and
 * any mortar it has in flight, so nothing it fired can still score or slow anyone. Their score is kept for the
 * result. Then the mode decides: Last One Standing ends in a forfeit win for the human who stays, and Waves carries on
 * unless nobody is left alive. Does nothing once the game is over, for an id that isn't a human in the match, or in
 * single-player (there's nobody to carry on). Returns the events.
 */
export function leave(state: MatchState, humanId: string): SimEvent[] {
  const events: SimEvent[] = [];
  if (state.phase === 'gameOver' || humansOf(state.options) < 2) return events;
  if (!state.tanks.some((t) => t.id === humanId && t.kind === 'human')) return events;

  state.tanks = state.tanks.filter((t) => t.id !== humanId);
  state.shells = state.shells.filter((s) => s.ownerId !== humanId);
  state.mortarShells = state.mortarShells.filter((m) => m.ownerId !== humanId);
  events.push({ type: 'left', tankId: humanId });
  rulesFor(state).left(state, humanId, events);
  if (state.result !== null) state.phase = 'gameOver';
  return events;
}

/**
 * Starts the next round or wave: the mode's rules set up the tanks, then every tank is reset and spawned,
 * shells, mortars in flight and AI memory are cleared, and the countdown starts.
 */
function startRound(state: MatchState, events: SimEvent[]): void {
  const cfg = state.config;
  state.round++;
  state.shells = [];
  state.mortarShells = [];
  state.ai = {};
  rulesFor(state).setUp(state, events);
  nextBoard(state);

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
    tank.mortarCharge = -1;
    tank.mortarHeld = false;
    tank.slowTicks = 0;
    if (tank.kind === 'ai') state.ai[tank.id] = createAiMemory();
  });

  state.phase = 'countdown';
  state.phaseTicks = ticks(cfg, cfg.countdownDuration);
}

function firstRotation(options: MatchOptions, boards: readonly Board[], rng: RngState): MapRotation {
  const order =
    options.maps.kind === 'sequence'
      ? [...options.maps.ids]
      : shuffle(
          rng,
          boards.map((b) => b.id),
        );
  return { order, next: 0 };
}

/**
 * Moves on to the next board in the rotation and makes it the current board, with a fresh navigation grid.
 * A sequence starts again from the top when it runs out. Random reshuffles every board once each has been played,
 * making sure the new order doesn't start with the board just played.
 */
function nextBoard(state: MatchState): void {
  const maps = state.maps;
  if (maps.next >= maps.order.length) {
    if (state.options.maps.kind === 'sequence') {
      maps.next = 0;
    } else {
      const last = maps.order[maps.order.length - 1];
      shuffle(state.mapRng, maps.order);
      if (maps.order.length > 1 && maps.order[0] === last) {
        const swap = 1 + nextInt(state.mapRng, maps.order.length - 1);
        maps.order[0] = maps.order[swap]!;
        maps.order[swap] = last!;
      }
      maps.next = 0;
    }
  }
  const id = maps.order[maps.next++]!;
  const board = state.boards.find((b) => b.id === id)!;
  state.board = cloneBoard(board);
  state.nav = buildNavGrid(state.board, state.config);
}

function cloneOptions(options: MatchOptions): MatchOptions {
  return JSON.parse(JSON.stringify(options)) as MatchOptions;
}

function cloneBoard(board: Board): Board {
  return JSON.parse(JSON.stringify(board)) as Board;
}

/** Deep copy of a match state. State is plain data, so a JSON round trip is exact. */
export function cloneState(state: MatchState): MatchState {
  return JSON.parse(JSON.stringify(state)) as MatchState;
}
