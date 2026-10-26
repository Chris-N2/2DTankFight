import type { SimConfig } from './config';
import type { Rect } from './geometry';
import type { RngState } from './rng';

// Everything in MatchState is plain data (objects, arrays, numbers, strings, booleans) so it can be
// cloned, compared and — in the multiplayer change — sent over the network as-is.

export interface SpawnPoint {
  x: number;
  y: number;
  /** Initial heading in radians; 0 = east, positive = clockwise on screen (y grows down). */
  heading: number;
}

export interface Board {
  name: string;
  width: number;
  height: number;
  obstacles: Rect[];
  spawns: SpawnPoint[];
}

/** One tank's controls for one tick. */
export interface TankInput {
  /** 1 = forward, -1 = reverse, 0 = none. */
  throttle: -1 | 0 | 1;
  /** -1 = turn left (anticlockwise on screen), 1 = turn right, 0 = none. */
  turn: -1 | 0 | 1;
  /** Fire button held this tick. A shell is fired on the transition from released to held. */
  fire: boolean;
}

export const IDLE_INPUT: Readonly<TankInput> = Object.freeze({ throttle: 0, turn: 0, fire: false });

export type TankKind = 'human' | 'ai';

export interface TankState {
  id: string;
  kind: TankKind;
  /** Index into the client's colour palette. */
  colorIndex: number;
  x: number;
  y: number;
  heading: number;
  hp: number;
  alive: boolean;
  /** Ticks remaining before this tank may fire again. */
  cooldown: number;
  /** Whether fire was held on the previous tick (for edge-triggered firing). */
  fireHeld: boolean;
}

export interface ShellState {
  id: number;
  ownerId: string;
  x: number;
  y: number;
  /** Velocity in units per second. */
  vx: number;
  vy: number;
  bounces: number;
  ticksLeft: number;
}

export interface NavGrid {
  cellSize: number;
  cols: number;
  rows: number;
  /** 1 if a tank's centre can sit at the cell centre without touching anything, else 0. Row-major. */
  walkable: number[];
}

/** Per-tank AI working memory. Plain data, reset at the start of every round. */
export interface AiMemory {
  targetId: string | null;
  retargetTicks: number;
  /** Cell indices to drive through, in order. */
  path: number[];
  pathIndex: number;
  replanTicks: number;
  /** Consecutive ticks the current target has been in line of sight. */
  seenTicks: number;
  /** Aim offset (radians) for the current engagement. */
  aimOffset: number;
  /** Ticks until this AI will fire again (reload plus a random pause). */
  fireWaitTicks: number;
  /** Consecutive ticks spent lined up on the target with the barrel blocked by cover. */
  blockedTicks: number;
  stuckTicks: number;
  stuckRefX: number;
  stuckRefY: number;
  recoverTicks: number;
  recoverTurn: -1 | 1;
}

export interface MatchOptions {
  aiCount: number;
  rounds: number;
}

export type Phase = 'countdown' | 'playing' | 'roundOver' | 'gameOver';
export type RoundOutcome = 'human' | 'ai' | 'draw';
export type GameResult = 'win' | 'loss' | 'draw';

export interface Scores {
  human: number;
  ai: number;
}

export interface MatchState {
  config: SimConfig;
  board: Board;
  nav: NavGrid;
  options: MatchOptions;
  tick: number;
  phase: Phase;
  /** Ticks remaining in the current countdown or round-result phase. */
  phaseTicks: number;
  /** Current round number, starting at 1. */
  round: number;
  roundsPlayed: number;
  scores: Scores;
  lastRoundOutcome: RoundOutcome | null;
  result: GameResult | null;
  tanks: TankState[];
  shells: ShellState[];
  nextShellId: number;
  /** Randomness for match decisions (spawn assignment). */
  rng: RngState;
  /** Separate randomness stream for AI, so AI changes don't reshuffle spawns. */
  aiRng: RngState;
  ai: Record<string, AiMemory>;
}

export type SimEvent =
  | { type: 'roundStarted'; round: number }
  | { type: 'playStarted'; round: number }
  | { type: 'shotFired'; tankId: string; shellId: number; x: number; y: number; heading: number }
  | { type: 'bounce'; shellId: number; x: number; y: number }
  | { type: 'shellDestroyed'; shellId: number; x: number; y: number }
  | {
      type: 'hit';
      shooterId: string;
      targetId: string;
      shellId: number;
      damage: number;
      x: number;
      y: number;
    }
  | { type: 'eliminated'; tankId: string; byId: string; x: number; y: number }
  | { type: 'roundEnded'; round: number; outcome: RoundOutcome; scores: Scores }
  | { type: 'gameEnded'; result: GameResult; scores: Scores };

/** Inputs for one tick, keyed by tank id. Tanks without an entry are treated as idle. */
export type InputMap = Readonly<Record<string, TankInput | undefined>>;

export const HUMAN_ID = 'p1';
