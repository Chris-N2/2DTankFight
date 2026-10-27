import { describe, expect, test } from 'vitest';
import { cloneState, createMatch, PROVING_GROUND, step } from '../src';
import {
  angleDiff,
  circleRectOverlap,
  lineOfSight,
  sweepBounds,
  sweepCircle,
  sweepRect,
  wrapAngle,
} from '../src/geometry';
import { createRng, nextFloat, nextInt, nextUint32, shuffle } from '../src/rng';
import { DT, place, playing, retire, world } from './helpers';

describe('state', () => {
  test('match state is plain, serialisable data', () => {
    const state = createMatch(
      { mode: 'lastOneStanding', aiCount: 4, rounds: 5, mortars: false },
      PROVING_GROUND,
      42,
    );
    for (let i = 0; i < 400; i++) step(state, { p1: { throttle: 1, turn: 1, fire: i % 20 === 0 } });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(cloneState(state)).toEqual(state);
  });
});

describe('rng', () => {
  test('same seed gives the same sequence', () => {
    const a = createRng(123);
    const b = createRng(123);
    for (let i = 0; i < 100; i++) expect(nextUint32(a)).toBe(nextUint32(b));
  });

  test('different seeds give different sequences', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 10 }, () => nextUint32(a));
    const seqB = Array.from({ length: 10 }, () => nextUint32(b));
    expect(seqA).not.toEqual(seqB);
  });

  test('floats are in [0, 1) and ints in range', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const f = nextFloat(rng);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = nextInt(rng, 5);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(5);
    }
  });

  test('shuffle is a reproducible permutation', () => {
    const a = shuffle(createRng(9), [0, 1, 2, 3, 4]);
    const b = shuffle(createRng(9), [0, 1, 2, 3, 4]);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('geometry', () => {
  const box = { x: 100, y: 100, w: 50, h: 50 };

  test('wrapAngle and angleDiff stay within (-π, π]', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
  });

  test('circle vs rectangle overlap', () => {
    expect(circleRectOverlap(90, 125, 11, box)).toBe(true);
    expect(circleRectOverlap(90, 125, 10, box)).toBe(false); // touching is not overlapping
    expect(circleRectOverlap(125, 125, 1, box)).toBe(true); // centre inside
  });

  test('swept segment vs rectangle reports first contact and normal', () => {
    const c = sweepRect(50, 125, 150, 125, box);
    expect(c?.t).toBeCloseTo(0.5);
    expect([c?.nx, c?.ny]).toEqual([-1, 0]);
    const fromBelow = sweepRect(125, 200, 125, 120, box);
    expect([fromBelow?.nx, fromBelow?.ny]).toEqual([0, 1]);
    expect(sweepRect(50, 50, 60, 60, box)).toBeNull();
  });

  test('a thin obstacle cannot be tunnelled through', () => {
    const thin = { x: 400, y: 0, w: 1, h: 600 };
    const c = sweepRect(395, 300, 410, 300, thin);
    expect(c).not.toBeNull();
    expect(395 + 15 * c!.t).toBeCloseTo(400);
  });

  test('swept segment leaving the arena boundary', () => {
    const c = sweepBounds(790, 300, 810, 300, 800, 600);
    expect(c?.t).toBeCloseTo(0.5);
    expect([c?.nx, c?.ny]).toEqual([-1, 0]);
    expect(sweepBounds(100, 100, 110, 110, 800, 600)).toBeNull();
  });

  test('swept segment vs circle', () => {
    expect(sweepCircle(0, 0, 100, 0, 60, 0, 10)).toBeCloseTo(0.5);
    expect(sweepCircle(0, 0, 100, 0, 60, 30, 10)).toBeNull();
    expect(sweepCircle(60, 0, 100, 0, 60, 0, 10)).toBe(0);
  });

  test('line of sight is blocked by obstacles', () => {
    expect(lineOfSight(50, 125, 200, 125, [box])).toBe(false);
    expect(lineOfSight(50, 50, 200, 50, [box])).toBe(true);
  });
});

describe('simulation: fixed-timestep, input-driven advancement', () => {
  test('Ticks advance by a fixed step', () => {
    const state = createMatch(
      { mode: 'lastOneStanding', aiCount: 1, rounds: 1, mortars: false },
      PROVING_GROUND,
      1,
    );
    const before = state.tick;
    step(state, {});
    expect(state.tick).toBe(before + 1);
    for (let i = 0; i < 59; i++) step(state, {});
    expect((state.tick - before) * DT).toBeCloseTo(1);
  });

  test('Missing input means idle', () => {
    const state = playing();
    retire(state, 'ai1');
    const t = place(state, 'p1', 300, 300, 0.5);
    const events = world(state, {});
    expect([t.x, t.y, t.heading]).toEqual([300, 300, 0.5]);
    expect(state.shells).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  test('inputs for eliminated tanks are ignored', () => {
    const state = playing();
    const t = place(state, 'p1', 300, 300, 0);
    retire(state, 'p1');
    world(state, { p1: { throttle: 1, turn: 1, fire: true } });
    expect([t.x, t.y, t.heading]).toEqual([300, 300, 0]);
    expect(state.shells).toHaveLength(0);
  });
});
