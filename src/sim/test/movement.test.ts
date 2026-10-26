import { describe, expect, test } from 'vitest';
import { circleRectOverlap, distance } from '../src/geometry';
import { cloneState } from '../src/match';
import { cfg, DT, makeBoard, place, playing, R, retire, world } from './helpers';

describe('simulation: tank movement', () => {
  test('Driving forward', () => {
    const state = playing();
    retire(state, 'ai1');
    const t = place(state, 'p1', 300, 300, 0);
    world(state, { p1: { throttle: 1 } });
    expect(t.x).toBeCloseTo(300 + cfg.tankSpeed * DT);
    expect(t.y).toBeCloseTo(300);
    expect(t.heading).toBe(0);
  });

  test('Reversing is slower', () => {
    const state = playing();
    retire(state, 'ai1');
    const t = place(state, 'p1', 300, 300, 0);
    world(state, { p1: { throttle: -1 } });
    const moved = 300 - t.x;
    expect(moved).toBeGreaterThan(0); // backwards, opposite to the heading
    expect(moved).toBeLessThan(cfg.tankSpeed * DT);
    expect(moved).toBeCloseTo(cfg.tankReverseSpeed * DT);
  });

  test('Turning on the spot', () => {
    const state = playing();
    retire(state, 'ai1');
    const t = place(state, 'p1', 300, 300, 0);
    world(state, { p1: { turn: -1 } });
    // Turning left is anticlockwise on screen; with y pointing down, that's a decreasing angle.
    expect(t.heading).toBeCloseTo(-cfg.tankTurnRate * DT);
    expect([t.x, t.y]).toEqual([300, 300]);
  });

  test('Partial turn', () => {
    const state = playing();
    retire(state, 'ai1');
    const t = place(state, 'p1', 300, 300, 0);
    world(state, { p1: { turn: 0.5 } });
    expect(t.heading).toBeCloseTo(0.5 * cfg.tankTurnRate * DT); // clockwise on screen: increasing angle
    expect([t.x, t.y]).toEqual([300, 300]);
  });

  test('Out-of-range turn is clamped', () => {
    const state = playing();
    const over = place(state, 'p1', 300, 300, 0);
    const full = place(state, 'ai1', 500, 300, 0);
    world(state, { p1: { turn: 2.5 }, ai1: { turn: 1 } });
    expect(over.heading).toBe(full.heading);
    world(state, { p1: { turn: -7 }, ai1: { turn: -1 } });
    expect(over.heading).toBe(full.heading);
  });

  test('Invalid turn is ignored', () => {
    const state = playing();
    retire(state, 'ai1');
    const t = place(state, 'p1', 300, 300, 0);
    for (const turn of [NaN, Infinity, -Infinity]) {
      world(state, { p1: { turn, throttle: 1 } });
      expect(t.heading).toBe(0);
      expect(Number.isFinite(t.x) && Number.isFinite(t.y)).toBe(true);
    }
    // ...and the match stays deterministic: the same inputs from a clone give the same state.
    const copy = cloneState(state);
    world(state, { p1: { turn: NaN } });
    world(copy, { p1: { turn: NaN } });
    expect(copy).toEqual(state);
  });

  test('turning and moving in the same tick', () => {
    const state = playing();
    retire(state, 'ai1');
    const t = place(state, 'p1', 300, 300, 0);
    world(state, { p1: { throttle: 1, turn: 1 } });
    expect(t.heading).toBeCloseTo(cfg.tankTurnRate * DT);
    expect(t.x).toBeGreaterThan(300);
    expect(t.y).toBeGreaterThan(300);
  });
});

describe('simulation: tank collisions', () => {
  test('Blocked by an obstacle', () => {
    const wall = { x: 500, y: 200, w: 40, h: 200 };
    const state = playing(makeBoard([wall]));
    retire(state, 'ai1');
    const t = place(state, 'p1', 400, 300, 0);
    for (let i = 0; i < 120; i++) {
      world(state, { p1: { throttle: 1 } });
      expect(circleRectOverlap(t.x, t.y, R, wall)).toBe(false);
    }
    expect(t.x).toBeLessThanOrEqual(wall.x - R);
    expect(t.x).toBeGreaterThan(wall.x - R - cfg.tankSpeed * DT - 1e-9);
  });

  test('Sliding along a wall', () => {
    const wall = { x: 0, y: 400, w: 800, h: 20 };
    const state = playing(makeBoard([wall]));
    retire(state, 'ai1');
    const t = place(state, 'p1', 150, 300, Math.PI / 4); // heading down-right, into the wall
    for (let i = 0; i < 120; i++) {
      world(state, { p1: { throttle: 1 } });
      expect(circleRectOverlap(t.x, t.y, R, wall)).toBe(false);
    }
    // The x component is never blocked, so it keeps sliding along the wall.
    expect(t.x).toBeCloseTo(150 + 120 * cfg.tankSpeed * DT * Math.cos(Math.PI / 4), 5);
    expect(t.y).toBeLessThanOrEqual(wall.y - R);
    expect(t.y).toBeGreaterThan(wall.y - R - 3);
  });

  test('Tanks block each other', () => {
    const state = playing();
    const a = place(state, 'p1', 300, 300, 0);
    const b = place(state, 'ai1', 400, 300, Math.PI);
    for (let i = 0; i < 90; i++) {
      world(state, { p1: { throttle: 1 }, ai1: { throttle: 1 } });
      expect(distance(a.x, a.y, b.x, b.y)).toBeGreaterThanOrEqual(2 * R - 1e-9);
    }
  });

  test('the arena boundary blocks tanks', () => {
    const state = playing();
    retire(state, 'ai1');
    const t = place(state, 'p1', 100, 300, Math.PI);
    for (let i = 0; i < 120; i++) world(state, { p1: { throttle: 1 } });
    expect(t.x).toBeGreaterThanOrEqual(R);
    expect(t.x).toBeLessThan(R + cfg.tankSpeed * DT + 1e-9);
  });
});
