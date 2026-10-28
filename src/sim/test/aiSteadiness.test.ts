import { describe, expect, test } from 'vitest';
import { FRUSTRATION, RICOCHET_ALLEY, step, type Board, type TankInput } from '../src';
import { angleDiff, distance } from '../src/geometry';
import { cfg, matchOn } from './helpers';

/**
 * "Corner dance": an AI tank sitting by an obstacle turning back and forth on the spot, neither moving nor firing.
 * These tests play whole Waves games with a scripted human who can't be destroyed (so nothing ends early) and measure
 * how often it happens, and the longest an AI goes without moving or firing.
 */

const SPAN = cfg.tickRate; // one second
/** A span counts as a dance if the tank moved less than this... */
const DANCE_MOVE = 12;
/** ...and reversed its turn at least this many times, without firing. */
const DANCE_REVERSALS = 2;
/** Moving this far from where it last stood still counts as meaningful progress. */
const PROGRESS_DISTANCE = 2 * cfg.aiStuckDistance;
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
/**
 * The longest an AI may go without meaningful progress or a shot, seconds. Stalls at corners are gone; what's left is
 * queuing behind an ally parked in the way (backing off every couple of seconds, then trying again). Sorting that out
 * means AI tanks spreading out, which is a later change, because it makes the AI stronger.
 */
const MAX_STALL = 6;
const SECONDS = 90;

interface Sample {
  tick: number;
  x: number;
  y: number;
  turned: number;
  fired: boolean;
}

interface Steadiness {
  /** Fraction of one-second spans that were a dance. */
  danceRate: number;
  /** The longest an AI went without meaningful progress or a shot, seconds. */
  longestStall: number;
  worst: string;
}

/** A human who drives round in arcs, changing direction every second or two. */
function wanderer(seed: number, tick: number, mem: { turn: number; left: number }): TankInput {
  if (--mem.left <= 0) {
    mem.turn = [-1, 0, 0, 1][(seed * 7 + tick) % 4]!;
    mem.left = 40 + ((tick * 13) % 80);
  }
  return { throttle: 1, turn: mem.turn, fire: false };
}

function measure(board: Board, mode: 'waves' | 'lastOneStanding'): Steadiness {
  let spans = 0;
  let dances = 0;
  let longestStall = 0;
  let worst = '';
  for (const seed of SEEDS) {
    const state =
      mode === 'waves'
        ? matchOn({ mode, startAiCount: 4, mortars: false }, board, seed)
        : matchOn({ mode, aiCount: 4, rounds: 7, mortars: false }, board, seed);
    const human = state.tanks.find((t) => t.kind === 'human')!;
    const drive = { turn: 0, left: 0 };
    const history: Record<string, Sample[]> = {};
    for (let tick = 0; tick < SECONDS * cfg.tickRate; tick++) {
      // Nobody is ever destroyed: in Waves the human must survive, and in Last One Standing this is a study of
      // movement, not of who wins.
      for (const t of state.tanks) if (mode === 'lastOneStanding' || t === human) t.hp = 1000;
      const headings = new Map(state.tanks.map((t) => [t.id, t.heading]));
      const events = step(state, { [human.id]: wanderer(seed, tick, drive) });
      if (state.phase !== 'playing') continue;
      for (const t of state.tanks) {
        if (t.kind !== 'ai' || !t.alive) continue;
        (history[t.id] ??= []).push({
          tick,
          x: t.x,
          y: t.y,
          turned: angleDiff(headings.get(t.id)!, t.heading),
          fired: events.some((e) => e.type === 'shotFired' && e.tankId === t.id),
        });
      }
    }
    for (const [id, samples] of Object.entries(history)) {
      for (let start = 0; start + SPAN <= samples.length; start += SPAN) {
        spans++;
        const span = samples.slice(start, start + SPAN);
        if (isDance(span)) dances++;
      }
      let anchor = 0;
      for (let i = 0; i < samples.length; i++) {
        const a = samples[anchor]!;
        const s = samples[i]!;
        if (s.fired || distance(a.x, a.y, s.x, s.y) > PROGRESS_DISTANCE) anchor = i;
        const stall = (i - anchor) / cfg.tickRate;
        if (stall > longestStall) {
          longestStall = stall;
          worst = `seed ${seed}, ${id} from ${(a.tick / cfg.tickRate).toFixed(1)}s at (${a.x.toFixed(0)}, ${a.y.toFixed(0)})`;
        }
      }
    }
  }
  return { danceRate: dances / spans, longestStall, worst };
}

function isDance(span: Sample[]): boolean {
  const first = span[0]!;
  const last = span[span.length - 1]!;
  if (distance(first.x, first.y, last.x, last.y) >= DANCE_MOVE) return false;
  if (span.some((s) => s.fired)) return false;
  let reversals = 0;
  let direction = 0;
  for (const s of span) {
    const d = Math.abs(s.turned) < 1e-9 ? 0 : Math.sign(s.turned);
    if (d !== 0 && direction !== 0 && d !== direction) reversals++;
    if (d !== 0) direction = d;
  }
  return reversals >= DANCE_REVERSALS;
}

describe('ai: decisive movement', () => {
  for (const board of [RICOCHET_ALLEY, FRUSTRATION]) {
    test(`Corner dance stays rare: ${board.name}, Waves`, () => {
      const result = measure(board, 'waves');
      expect.soft(result.danceRate, 'share of one-second spans spent dancing').toBeLessThan(0.01);
      expect.soft(result.longestStall, `longest stall: ${result.worst}`).toBeLessThanOrEqual(MAX_STALL);
    }, 120_000);
  }

  test('Corner dance stays rare: Ricochet Alley, Last One Standing', () => {
    const result = measure(RICOCHET_ALLEY, 'lastOneStanding');
    expect.soft(result.danceRate, 'share of one-second spans spent dancing').toBeLessThan(0.01);
    expect.soft(result.longestStall, `longest stall: ${result.worst}`).toBeLessThanOrEqual(MAX_STALL);
  }, 120_000);
});
