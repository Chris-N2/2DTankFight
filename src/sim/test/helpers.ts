import {
  createMatch,
  DEFAULT_CONFIG,
  step,
  type Board,
  type MatchOptions,
  type MatchState,
  type SimConfig,
  type RoundOutcome,
  type SimEvent,
  type TankInput,
  type TankState,
} from '../src';
import type { Rect } from '../src/geometry';
import { stepWorld } from '../src/world';

export const cfg = DEFAULT_CONFIG;
export const DT = 1 / cfg.tickRate;
export const R = cfg.tankRadius;

/** Match options without the map choice, for tests that play on one board. */
export type GameOptions = MatchOptions extends infer O
  ? O extends MatchOptions
    ? Omit<O, 'maps'>
    : never
  : never;

/** Adds Random maps to options that don't say, for testing option validation. */
export function withMaps(options: GameOptions): MatchOptions {
  return { ...options, maps: { kind: 'random' } } as MatchOptions;
}

/** A match played on `board` alone: a one-map sequence from a catalogue holding just that board. */
export function matchOn(
  options: GameOptions,
  board: Board,
  seed: number,
  config: SimConfig = cfg,
): MatchState {
  return createMatch(
    { ...options, maps: { kind: 'sequence', ids: [board.id] } } as MatchOptions,
    seed,
    config,
    [board],
  );
}

/** A simple test board with five well-spaced spawn points and the given obstacles. */
export function makeBoard(obstacles: Rect[] = [], width = 800, height = 600): Board {
  return {
    id: 'test',
    name: 'Test',
    width,
    height,
    obstacles: [...obstacles],
    spawns: [
      { x: 60, y: 60, heading: 0 },
      { x: width - 60, y: 60, heading: Math.PI },
      { x: 60, y: height - 60, heading: 0 },
      { x: width - 60, y: height - 60, heading: Math.PI },
      { x: width / 2, y: height - 60, heading: -Math.PI / 2 },
    ],
  };
}

/** A match that has skipped the countdown and is in play. */
export function playing(board: Board = makeBoard(), aiCount = 1, seed = 1, rounds = 5): MatchState {
  const state = matchOn({ mode: 'lastOneStanding', aiCount, rounds, mortars: false }, board, seed);
  state.phase = 'playing';
  state.phaseTicks = 0;
  return state;
}

/** A Waves match that has skipped wave 1's countdown and is in play. */
export function playingWaves(board: Board = makeBoard(), startAiCount = 1, seed = 1): MatchState {
  const state = matchOn({ mode: 'waves', startAiCount, mortars: false }, board, seed);
  state.phase = 'playing';
  state.phaseTicks = 0;
  return state;
}

export function tank(state: MatchState, id: string): TankState {
  const t = state.tanks.find((x) => x.id === id);
  if (!t) throw new Error(`No tank ${id}`);
  return t;
}

export function place(state: MatchState, id: string, x: number, y: number, heading = 0): TankState {
  const t = tank(state, id);
  t.x = x;
  t.y = y;
  t.heading = heading;
  return t;
}

/** Removes tanks from play without going through elimination (for isolated physics tests). */
export function retire(state: MatchState, ...ids: string[]): void {
  for (const id of ids) tank(state, id).alive = false;
}

/** Runs one physics tick with explicit inputs for any tanks (AI is not consulted). */
export function world(state: MatchState, inputs: Record<string, Partial<TankInput>> = {}): SimEvent[] {
  const full: Record<string, TankInput> = {};
  for (const [id, input] of Object.entries(inputs))
    full[id] = { throttle: 0, turn: 0, fire: false, ...input };
  const events: SimEvent[] = [];
  stepWorld(state, full, events);
  return events;
}

/** Adds a shell directly, for testing shell physics in isolation. */
export function addShell(
  state: MatchState,
  x: number,
  y: number,
  heading: number,
  opts: { ownerId?: string; bounces?: number } = {},
): number {
  const id = state.nextShellId++;
  state.shells.push({
    id,
    ownerId: opts.ownerId ?? 'nobody',
    x,
    y,
    vx: Math.cos(heading) * cfg.shellSpeed,
    vy: Math.sin(heading) * cfg.shellSpeed,
    speed: cfg.shellSpeed,
    damage: cfg.shellDamage,
    bounces: opts.bounces ?? 0,
    ticksLeft: Math.round(cfg.shellLifetime * cfg.tickRate),
  });
  return id;
}

/** Steps the match (no human input) until the phase is 'playing' or the game is over. */
export function skipToPlay(state: MatchState): SimEvent[] {
  const events: SimEvent[] = [];
  for (let guard = 0; guard < 100_000 && state.phase !== 'playing' && state.phase !== 'gameOver'; guard++) {
    events.push(...step(state, {}));
  }
  return events;
}

/**
 * Forces a round outcome through the real rules: sets hit points to zero so the next tick's
 * elimination pass ends the round, then steps until the next round is in play (or the game ends).
 */
export function finishRound(state: MatchState, outcome: RoundOutcome): SimEvent[] {
  const events = skipToPlay(state);
  if (state.phase === 'gameOver') throw new Error('Game already over');
  for (const t of state.tanks) {
    if (outcome === 'human' && t.kind === 'ai') t.hp = 0;
    if (outcome === 'ai' && t.kind === 'human') t.hp = 0;
    if (outcome === 'draw') t.hp = 0;
  }
  events.push(...step(state, {}));
  return events;
}

export function count<T extends SimEvent['type']>(events: SimEvent[], type: T): number {
  return events.filter((e) => e.type === type).length;
}

export function ofType<T extends SimEvent['type']>(
  events: SimEvent[],
  type: T,
): Extract<SimEvent, { type: T }>[] {
  return events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
}
