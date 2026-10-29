import type { Snapshot as NetSnapshot } from '@tank/protocol';
import {
  DEFAULT_CONFIG,
  type Board,
  type MatchOptions,
  type MatchState,
  type RngState,
  type SimEvent,
} from '@tank/sim';
import { snapshot, type Snapshot } from './renderer';

// An online game, seen from the client: snapshots from the server turned back into something the renderer, the HUD
// and the screens can use as if it were a local match. Pure; time is passed in.

/** How far behind the newest snapshot the game is drawn, so there's always a next snapshot to move towards. */
export const INTERPOLATION_DELAY_MS = 100;
/** Further behind than this (a hidden tab coming back, say) and playback jumps forward rather than catching up. */
export const MAX_BEHIND_MS = 500;
/** The most time one frame can move playback on. */
const MAX_FRAME_MS = 100;
/** Playback runs this much faster or slower while it drifts from the delay, to settle back to it unnoticed. */
const CATCH_UP = 0.1;

const STEP_MS = 1000 / DEFAULT_CONFIG.tickRate;
const DELAY_TICKS = INTERPOLATION_DELAY_MS / STEP_MS;
const MAX_BEHIND_TICKS = MAX_BEHIND_MS / STEP_MS;
const NO_RNG: RngState = { s: [0, 0, 0, 0] };

/** What to draw this frame, and the events that have just come due, in order. */
export interface MirrorFrame {
  /** The match as it is at the next snapshot; null before the first one. */
  state: MatchState | null;
  /** Positions at the snapshot before, for the renderer to interpolate from; null to draw `state` as it is. */
  prev: Snapshot | null;
  /** How far from `prev` to `state`, 0 to 1. */
  alpha: number;
  events: SimEvent[];
}

interface Entry {
  snap: NetSnapshot;
  board: Board;
  state?: MatchState;
}

/**
 * The client's copy of an online match. Snapshots are played back in tick order at real-time speed, about
 * {@link INTERPOLATION_DELAY_MS} behind the newest. When the buffer runs dry, it holds on the newest rather than
 * guessing ahead; when it falls far behind, it jumps.
 */
export class OnlineMirror {
  private entries: Entry[] = [];
  /** The board for the snapshots that come after it: the server sends a new board just before the round it's for. */
  private board: Board | null = null;
  /** Where playback is, in (fractional) ticks; null until the first frame with a snapshot. */
  private playTick: number | null = null;
  private lastFrame: number | null = null;
  /** The newest tick whose events have been played. */
  private playedTick = -Infinity;

  constructor(private options: MatchOptions) {}

  /** The options the game was started with, which the screens need (the mode, the rounds, mortars). */
  setOptions(options: MatchOptions): void {
    this.options = options;
  }

  setBoard(board: Board): void {
    this.board = board;
  }

  push(snap: NetSnapshot): void {
    if (!this.board) return;
    const newest = this.entries.at(-1);
    // Ticks only go backwards when a new game has started.
    if (newest && snap.tick < newest.snap.tick) this.reset();
    this.entries.push({ snap, board: this.board });
  }

  /** Forgets every snapshot: a new game, or back in after a drop. The board is kept. */
  reset(): void {
    this.entries = [];
    this.playTick = null;
    this.lastFrame = null;
    this.playedTick = -Infinity;
  }

  /** The newest snapshot's match, for decisions that shouldn't wait for playback. */
  get latest(): MatchState | null {
    const newest = this.entries.at(-1);
    return newest ? this.mirror(newest) : null;
  }

  frame(now: number): MirrorFrame {
    const first = this.entries[0];
    const last = this.entries.at(-1);
    if (!first || !last) return { state: null, prev: null, alpha: 0, events: [] };
    const newest = last.snap.tick;

    let play = this.playTick ?? Math.max(first.snap.tick, newest - DELAY_TICKS);
    if (this.playTick !== null && this.lastFrame !== null) {
      const lag = newest - play;
      const rate = lag > DELAY_TICKS + 1 ? 1 + CATCH_UP : lag < DELAY_TICKS - 1 ? 1 - CATCH_UP : 1;
      play += (Math.max(0, Math.min(MAX_FRAME_MS, now - this.lastFrame)) / STEP_MS) * rate;
      if (newest - play > MAX_BEHIND_TICKS) play = newest - DELAY_TICKS;
    }
    play = Math.min(play, newest);
    this.playTick = play;
    this.lastFrame = now;

    // The snapshot playback has reached, and the one after it.
    let at = 0;
    while (at + 1 < this.entries.length && this.entries[at + 1]!.snap.tick <= play) at++;
    const events: SimEvent[] = [];
    for (const entry of this.entries.slice(0, at + 1)) {
      if (entry.snap.tick > this.playedTick) events.push(...entry.snap.events);
    }
    const current = this.entries[at]!;
    this.playedTick = Math.max(this.playedTick, current.snap.tick);
    this.entries = this.entries.slice(at);

    const next = this.entries[1];
    if (!next) return { state: this.mirror(current), prev: null, alpha: 0, events };
    const alpha = (play - current.snap.tick) / (next.snap.tick - current.snap.tick);
    return { state: this.mirror(next), prev: snapshot(this.mirror(current)), alpha, events };
  }

  /** A snapshot as a match. What the server keeps to itself is filled with harmless blanks. */
  private mirror(entry: Entry): MatchState {
    if (entry.state) return entry.state;
    const { events: _events, ...dynamic } = entry.snap;
    entry.state = {
      ...dynamic,
      config: DEFAULT_CONFIG,
      boards: [entry.board],
      board: entry.board,
      nav: { cellSize: DEFAULT_CONFIG.navCellSize, cols: 0, rows: 0, walkable: [] },
      maps: { order: [entry.board.id], next: 0 },
      options: this.options,
      nextShellId: 0,
      nextMortarId: 0,
      rng: NO_RNG,
      aiRng: NO_RNG,
      mapRng: NO_RNG,
      ai: {},
    };
    return entry.state;
  }
}
