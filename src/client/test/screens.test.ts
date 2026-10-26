import { createMatch, PROVING_GROUND, step, type MatchState } from '@tank/sim';
import { describe, expect, test } from 'vitest';
import { bannerFor, gameOverText, hpPips, roundLine, scoreLine } from '../src/screens';

function match(): MatchState {
  return createMatch({ aiCount: 2, rounds: 5 }, PROVING_GROUND, 1);
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
