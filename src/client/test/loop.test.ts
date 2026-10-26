import { describe, expect, test } from 'vitest';
import { FixedStepLoop } from '../src/loop';

const STEP = 1000 / 60;

function makeLoop(maxSteps = 5): { loop: FixedStepLoop; ticks: () => number } {
  let n = 0;
  const loop = new FixedStepLoop(STEP, () => n++, maxSteps);
  return { loop, ticks: () => n };
}

describe('fixed-step loop', () => {
  test('runs ticks in proportion to elapsed time, independent of frame rate', () => {
    const at60 = makeLoop();
    const at144 = makeLoop();
    at60.loop.frame(0);
    at144.loop.frame(0);
    for (let t = 1; t <= 60; t++) at60.loop.frame(t * (1000 / 60));
    for (let t = 1; t <= 144; t++) at144.loop.frame(t * (1000 / 144));
    expect(at60.ticks()).toBe(60);
    expect(Math.abs(at144.ticks() - 60)).toBeLessThanOrEqual(1);
  });

  test('reports the interpolation fraction between ticks', () => {
    const { loop } = makeLoop();
    loop.frame(0);
    const r = loop.frame(STEP * 2.5);
    expect(r.steps).toBe(2);
    expect(r.alpha).toBeCloseTo(0.5);
  });

  test('caps ticks per frame and drops the backlog after a stall', () => {
    const { loop, ticks } = makeLoop(5);
    loop.frame(0);
    expect(loop.frame(5000).steps).toBe(5);
    expect(loop.frame(5000 + STEP).steps).toBe(1); // no catch-up burst
    expect(ticks()).toBe(6);
  });

  test('no simulation time passes while paused (Escape pauses / Switching tabs pauses)', () => {
    const { loop, ticks } = makeLoop();
    loop.frame(0);
    loop.frame(STEP);
    expect(ticks()).toBe(1);
    loop.setPaused(true);
    for (let t = 2; t < 600; t++) expect(loop.frame(t * STEP).steps).toBe(0);
    loop.setPaused(false);
    loop.frame(600 * STEP); // first frame after resuming only re-anchors the clock
    loop.frame(601 * STEP);
    expect(ticks()).toBe(2);
  });

  test('the first frame never runs a tick', () => {
    const { loop } = makeLoop();
    expect(loop.frame(123456).steps).toBe(0);
  });
});
