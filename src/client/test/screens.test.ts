import { createMatch, PROVING_GROUND, step, type MatchState } from '@tank/sim';
import { describe, expect, test } from 'vitest';
import {
  bannerFor,
  DEFAULT_CHOICES,
  gameOverText,
  hpPips,
  matchOptionsFor,
  mortarHud,
  roundLine,
  scoreLine,
} from '../src/screens';
import { mortarPose } from '../src/renderer';

function match(): MatchState {
  return createMatch({ mode: 'lastOneStanding', aiCount: 2, rounds: 5, mortars: false }, PROVING_GROUND, 1);
}

describe('round and game flow text', () => {
  test('countdown shows 3, 2, 1 and the round number', () => {
    const state = match();
    expect(bannerFor(state, false, false)).toEqual({ title: '3', sub: 'Round 1 of 5' });
    for (let i = 0; i < 60; i++) step(state, {});
    expect(bannerFor(state, false, false)?.title).toBe('2');
    for (let i = 0; i < 60; i++) step(state, {});
    expect(bannerFor(state, false, false)?.title).toBe('1');
  });

  test('GO! briefly, then a clear view during play', () => {
    const state = match();
    while (state.phase === 'countdown') step(state, {});
    expect(bannerFor(state, true, false)?.title).toBe('GO!');
    expect(bannerFor(state, false, false)).toBeNull();
  });

  test('round results show the outcome and the updated score', () => {
    const state = match();
    state.phase = 'roundOver';
    state.scores = { human: 2, ai: 1 };
    state.lastRoundOutcome = 'human';
    expect(bannerFor(state, false, false)).toEqual({ title: 'Round won!', sub: 'You 2 – 1 AI' });
    state.lastRoundOutcome = 'ai';
    expect(bannerFor(state, false, false)?.title).toBe('Round lost');
    expect(bannerFor(state, false, true)?.sub).toContain('own shell');
    state.lastRoundOutcome = 'draw';
    expect(bannerFor(state, false, false)?.title).toBe('Mutual destruction!');
  });

  test('game result text covers win, loss and draw', () => {
    expect(gameOverText('win', { human: 3, ai: 1 })).toMatchObject({
      title: 'Victory!',
      score: 'You 3 – 1 AI',
    });
    expect(gameOverText('loss', { human: 0, ai: 3 }).title).toBe('Defeat');
    expect(gameOverText('draw', { human: 1, ai: 1 }).title).toBe('A draw');
  });
});

describe('heads-up display', () => {
  test('Damage shown', () => {
    const state = match();
    expect(hpPips(state)).toBe('■■■');
    state.tanks[0]!.hp = 2;
    expect(hpPips(state)).toBe('■■□');
    state.tanks[0]!.alive = false;
    state.tanks[0]!.hp = 0;
    expect(hpPips(state)).toBe('□□□');
  });

  test('round and score lines', () => {
    const state = match();
    expect(roundLine(state)).toBe('Round 1 / 5');
    expect(scoreLine({ human: 1, ai: 0 })).toBe('You 1 – 0 AI');
  });
});

describe('mortars on screen', () => {
  test('Defaults allow an immediate start, with mortars on', () => {
    const options = matchOptionsFor(DEFAULT_CHOICES);
    expect(options).toEqual({ mode: 'lastOneStanding', aiCount: 3, rounds: 5, mortars: true });
    expect(() => createMatch(options, PROVING_GROUND, 1)).not.toThrow();
  });

  test('Classic play', () => {
    const choices = { ...DEFAULT_CHOICES, mortars: false };
    const state = createMatch(matchOptionsFor(choices), PROVING_GROUND, 1);
    expect(state.options.mortars).toBe(false);
    expect(mortarHud(state)).toBeNull();
  });

  test('the mortars setting goes with either mode', () => {
    const waves = { ...DEFAULT_CHOICES, mode: 'waves' as const, startAiCount: 2, mortars: false };
    expect(matchOptionsFor(waves)).toEqual({ mode: 'waves', startAiCount: 2, mortars: false });
  });

  test('Play again keeps the mortars setting', () => {
    // "Play again" builds the next game from the same remembered choices; playing a game mustn't change them.
    const choices = { ...DEFAULT_CHOICES, mode: 'waves' as const, startAiCount: 2, mortars: false };
    const first = createMatch(matchOptionsFor(choices), PROVING_GROUND, 1);
    for (let i = 0; i < 600 && first.phase !== 'gameOver'; i++) step(first, {});
    const again = createMatch(matchOptionsFor(choices), PROVING_GROUND, 2);
    expect(again.options).toEqual(first.options);
    expect(again.options.mortars).toBe(false);
    expect(choices).toEqual({ ...DEFAULT_CHOICES, mode: 'waves', startAiCount: 2, mortars: false });
  });

  test('Mortar readiness shown', () => {
    const state = createMatch(matchOptionsFor(DEFAULT_CHOICES), PROVING_GROUND, 1);
    while (state.phase !== 'playing') step(state, {});
    expect(mortarHud(state)).toBe('Ready');
    step(state, { p1: { throttle: 0, turn: 0, fire: false, mortar: true } });
    expect(mortarHud(state)).toBe('Aiming…');
    step(state, { p1: { throttle: 0, turn: 0, fire: false, mortar: false } });
    expect(mortarHud(state)).toBe('Used');
    // A new round reloads it.
    for (const t of state.tanks) if (t.kind === 'ai') t.hp = 0;
    while ((state.phase as string) !== 'countdown') step(state, {});
    expect(mortarHud(state)).toBe('Ready');
  });
});

describe('mortar drawing', () => {
  const mortar = {
    id: 1,
    ownerId: 'p1',
    fromX: 100,
    fromY: 100,
    toX: 500,
    toY: 100,
    flightTicks: 48,
    ticksLeft: 48,
  };

  test('Mortar in flight: it arcs from launch to landing point', () => {
    const start = mortarPose({ ...mortar, ticksLeft: 47 }, 0);
    expect(start).toMatchObject({ x: 100, y: 100, height: 0 });
    const mid = mortarPose({ ...mortar, ticksLeft: 24 }, 1);
    expect(mid.x).toBeCloseTo(300);
    expect(mid.height).toBeGreaterThan(50); // well up above the walls
    const end = mortarPose({ ...mortar, ticksLeft: 0 }, 1);
    expect(end).toMatchObject({ x: 500, y: 100, height: 0 });
  });

  test('frames between ticks move it smoothly', () => {
    const a = mortarPose({ ...mortar, ticksLeft: 30 }, 0);
    const b = mortarPose({ ...mortar, ticksLeft: 30 }, 0.5);
    const c = mortarPose({ ...mortar, ticksLeft: 29 }, 0);
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.x).toBeLessThan(c.x);
  });
});
