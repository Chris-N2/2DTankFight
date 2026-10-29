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
  /** Stable kebab-case id, used in match options. Never shown to players. */
  id: string;
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
  /**
   * -1 = full left (anticlockwise on screen), 1 = full right, 0 = none; values in between turn part-way
   * (an analogue stick). Out-of-range values are clamped and non-finite values ignored by the simulation.
   */
  turn: number;
  /** Fire button held this tick. A shell is fired on the transition from released to held. */
  fire: boolean;
  /**
   * Mortar button held this tick (absent = not held). Pressing starts charging; releasing launches at the
   * charged range.
   */
  mortar?: boolean;
}

export const IDLE_INPUT: Readonly<TankInput> = Object.freeze({
  throttle: 0,
  turn: 0,
  fire: false,
  mortar: false,
});

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
  /** Hit points at the start of each round or wave. */
  maxHp: number;
  /** Damage each of this tank's shells does. */
  shellDamage: number;
  /** Speed of this tank's shells, units per second. */
  shellSpeed: number;
  alive: boolean;
  /** Ticks remaining before this tank may fire again. */
  cooldown: number;
  /** Whether fire was held on the previous tick (for edge-triggered firing). */
  fireHeld: boolean;
  /** Mortars loaded: 1 or 0. Set by the mode's rules at the start of each round or wave. */
  mortars: number;
  /** Ticks the mortar button has been held while charging, or -1 when not charging. */
  mortarCharge: number;
  /** Whether the mortar button was held on the previous tick (for edge-triggered charging). */
  mortarHeld: boolean;
  /** Ticks of mortar slow remaining; 0 when not slowed. */
  slowTicks: number;
  /**
   * Set by the mode's rules: while this tank is slowed, the mud jams its turret and it can't fire (Waves AI tanks).
   */
  mudJamsTurret: boolean;
}

/**
 * A mortar in flight. It travels in a straight line over the ground from launch to landing point and touches
 * nothing on the way; its height is purely for drawing.
 */
export interface MortarState {
  id: number;
  ownerId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Total flight time in ticks. */
  flightTicks: number;
  /** Ticks until it lands. */
  ticksLeft: number;
}

export interface ShellState {
  id: number;
  ownerId: string;
  x: number;
  y: number;
  /** Velocity in units per second. */
  vx: number;
  vy: number;
  /**
   * Units per second, as fired. Kept alongside the velocity (rather than recomputed from it) so a shell
   * travels exactly the same distance every tick.
   */
  speed: number;
  /** Hit points this shell takes off the tank it hits. */
  damage: number;
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
  /** Consecutive ticks the current target has been hidden from this AI's turret. */
  hiddenTicks: number;
  /** Whether the AI was engaging its target (lined up from where it is) last tick. Leaving takes a clear change. */
  engaging: boolean;
  /** Ticks since this AI last moved meaningfully or fired, measured from `progressRefX`/`progressRefY`. */
  progressTicks: number;
  progressRefX: number;
  progressRefY: number;
  /** Where this AI last got stuck, and for how many more ticks it keeps away from there. */
  avoidX: number;
  avoidY: number;
  avoidTicks: number;
  /** The way this AI last turned while navigating (-1, 0 or 1). */
  navTurn: number;
  /**
   * The mortar lob this AI has committed to, or null when not lobbing. It keeps its own target, apart from
   * `targetId`, so a retarget mid-lob can't swing it round onto a tank the AI could simply shoot. `x`/`y` is that
   * target's last known position, so a lob can still be finished if the target is destroyed mid-charge.
   */
  lob: { targetId: string; x: number; y: number; range: number; aimOffset: number } | null;
}

export type GameMode = 'lastOneStanding' | 'waves';

/**
 * Which board each round or wave is played on. `random` plays every board once, in a shuffled order, before any
 * repeats; `sequence` plays the listed board ids in order, starting again from the top when they run out.
 */
export type MapOptions = { kind: 'random' } | { kind: 'sequence'; ids: string[] };

/** `mortars: false` is classic play: nobody has a mortar. */
export type MatchOptions =
  | { mode: 'lastOneStanding'; aiCount: number; rounds: number; mortars: boolean; maps: MapOptions }
  | { mode: 'waves'; startAiCount: number; mortars: boolean; maps: MapOptions };

/** Where the match is in its map rotation. */
export interface MapRotation {
  /** Board ids in the order they'll be played: the sequence, or the current shuffle of every board. */
  order: string[];
  /** Index in `order` of the board the next round or wave will be played on. */
  next: number;
}

/**
 * `roundOver` is the pause after a round (Last One Standing) or a cleared wave (Waves). In Waves,
 * `MatchState.round` is the wave number.
 */
export type Phase = 'countdown' | 'playing' | 'roundOver' | 'gameOver';
export type RoundOutcome = 'human' | 'ai' | 'draw';
export type LastOneStandingResult = 'win' | 'loss' | 'draw';
/** `over` ends every Waves game: the score is the number of waves cleared. */
export type GameResult = LastOneStandingResult | 'over';

/**
 * What a wave changed for the AI tanks, compared with the wave before. `thinnerArmour`: more tanks, each with less
 * armour. The rest are escalation steps; `lethal` is the damage step after which one hit destroys a human.
 */
export type WaveChange = 'thinnerArmour' | 'armour' | 'damage' | 'lethal' | 'speed';

export interface WavesState {
  startAiCount: number;
  cleared: number;
}

export interface Scores {
  human: number;
  ai: number;
}

export interface MatchState {
  config: SimConfig;
  /** Every board this match can be played on. */
  boards: Board[];
  /** The board the current round or wave is played on. */
  board: Board;
  nav: NavGrid;
  maps: MapRotation;
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
  /** The Waves mode's own data; null in Last One Standing. */
  waves: WavesState | null;
  tanks: TankState[];
  shells: ShellState[];
  nextShellId: number;
  mortarShells: MortarState[];
  nextMortarId: number;
  /** Randomness for match decisions (spawn assignment). */
  rng: RngState;
  /** Separate randomness stream for AI, so AI changes don't reshuffle spawns. */
  aiRng: RngState;
  /** Separate randomness stream for map choice, so maps don't reshuffle spawns or change what the AI does. */
  mapRng: RngState;
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
  | {
      type: 'mortarLaunched';
      mortarId: number;
      tankId: string;
      x: number;
      y: number;
      toX: number;
      toY: number;
    }
  | { type: 'mortarLanded'; mortarId: number; ownerId: string; x: number; y: number; slowedIds: string[] }
  | { type: 'eliminated'; tankId: string; byId: string; x: number; y: number }
  | { type: 'roundEnded'; round: number; outcome: RoundOutcome; scores: Scores }
  | { type: 'gameEnded'; result: LastOneStandingResult; scores: Scores }
  | { type: 'waveStarted'; wave: number; aiCount: number; changes: WaveChange[] }
  | { type: 'waveCleared'; wave: number; cleared: number }
  | { type: 'gameEnded'; result: 'over'; wavesCleared: number };

/** Inputs for one tick, keyed by tank id. Tanks without an entry are treated as idle. */
export type InputMap = Readonly<Record<string, TankInput | undefined>>;

export const HUMAN_ID = 'p1';
