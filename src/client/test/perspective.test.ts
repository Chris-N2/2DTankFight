import { createMatch, step, type MatchOptions, type MatchState } from '@tank/sim';
import { describe, expect, test } from 'vitest';
import { PALETTE } from '../src/colours';
import { Effects } from '../src/effects';
import { colorOf } from '../src/renderer';
import { bannerFor, hpPips, hudScore, mortarHud, scoreLine } from '../src/screens';

const GREEN = PALETTE[0];
const BLUE = PALETTE[2];

function twoPlayer(options: Partial<MatchOptions> = {}): MatchState {
  return createMatch(
    {
      mode: 'lastOneStanding',
      aiCount: 3,
      rounds: 5,
      mortars: true,
      maps: { kind: 'random' },
      humans: 2,
      ...options,
    } as MatchOptions,
    5,
  );
}

describe('game client: perspective colours', () => {
  test('Green for me, blue for you', () => {
    const state = twoPlayer();
    expect(colorOf(state, 'p1', 'p1')).toBe(GREEN);
    expect(colorOf(state, 'p2', 'p1')).toBe(BLUE);
    expect(colorOf(state, 'p2', 'p2')).toBe(GREEN);
    expect(colorOf(state, 'p1', 'p2')).toBe(BLUE);
  });

  test('Shared AI colours', () => {
    const state = twoPlayer({ aiCount: 3 });
    const ais = state.tanks.filter((t) => t.kind === 'ai').map((t) => t.id);
    expect(ais).toHaveLength(3);
    for (const id of ais) {
      expect(colorOf(state, id, 'p1')).toBe(colorOf(state, id, 'p2'));
      expect(colorOf(state, id, 'p1')).not.toBe(BLUE);
      expect(colorOf(state, id, 'p1')).not.toBe(GREEN);
    }
    expect(new Set(ais.map((id) => colorOf(state, id, 'p2'))).size).toBe(3);
  });

  test('The other human is blue, and only you are green', () => {
    const state = twoPlayer();
    for (const viewer of ['p1', 'p2']) {
      const colours = state.tanks.map((t) => colorOf(state, t.id, viewer));
      expect(colours.filter((c) => c === GREEN)).toHaveLength(1);
      expect(colorOf(state, viewer, viewer)).toBe(GREEN);
      expect(colours.filter((c) => c === BLUE)).toHaveLength(1);
    }
  });

  test('single-player colours are unchanged', () => {
    const state = createMatch(
      { mode: 'lastOneStanding', aiCount: 4, rounds: 5, mortars: true, maps: { kind: 'random' } },
      1,
    );
    expect(state.tanks.map((t) => colorOf(state, t.id))).toEqual(PALETTE);
  });
});

describe('game client: a harmless clang', () => {
  test('a friendly hit sparks, with no hit flash', () => {
    const effects = new Effects();
    effects.add(
      { type: 'friendlyHit', shooterId: 'p1', targetId: 'p2', shellId: 4, x: 100, y: 100 },
      0,
      () => GREEN!,
    );
    expect(effects.kinds()).toEqual(['spark']);
    expect(effects.isFlashing('p2', 10)).toBe(false);
    // A real hit, for comparison, flashes the tank and rings.
    effects.add(
      { type: 'hit', shooterId: 'ai1', targetId: 'p2', shellId: 5, damage: 1, x: 0, y: 0 },
      0,
      () => GREEN!,
    );
    expect(effects.isFlashing('p2', 10)).toBe(true);
    expect(effects.kinds()).toEqual(['spark', 'ring']);
  });

  test('and the HUD hit points stay as they were', () => {
    const state = createMatch(
      { mode: 'waves', startAiCount: 1, mortars: false, maps: { kind: 'random' }, humans: 2 },
      1,
    );
    while (state.phase === 'countdown') step(state, {});
    const p1 = state.tanks.find((t) => t.id === 'p1')!;
    const p2 = state.tanks.find((t) => t.id === 'p2')!;
    // p2 directly in front of p1's barrel.
    p2.x = p1.x + Math.cos(p1.heading) * 80;
    p2.y = p1.y + Math.sin(p1.heading) * 80;
    const before = hpPips(state, 'p2');
    const events = [...step(state, { p1: { throttle: 0, turn: 0, fire: true } })];
    for (let i = 0; i < 30 && !events.some((e) => e.type === 'friendlyHit'); i++)
      events.push(...step(state, {}));
    expect(events.some((e) => e.type === 'friendlyHit')).toBe(true);
    expect(hpPips(state, 'p2')).toBe(before);
  });
});

describe('game client: your own numbers online', () => {
  test('Your own numbers online', () => {
    const state = twoPlayer();
    state.scores = { humans: { p1: 1, p2: 2 }, ai: 0 };
    state.tanks.find((t) => t.id === 'p1')!.hp = 1;
    state.tanks.find((t) => t.id === 'p2')!.hp = 3;
    expect(hudScore(state, 'p2')).toBe('You 2 – 1 Them');
    expect(hudScore(state, 'p1')).toBe('You 1 – 2 Them');
    expect(hpPips(state, 'p2')).toBe('■■■');
    expect(hpPips(state, 'p1')).toBe('■□□');
  });

  test('each player sees their own mortar', () => {
    const state = twoPlayer();
    state.tanks.find((t) => t.id === 'p1')!.mortars = 0;
    expect(mortarHud(state, 'p1')).toBe('Used');
    expect(mortarHud(state, 'p2')).toBe('Ready');
  });

  test('round banners from each side', () => {
    const state = twoPlayer();
    state.phase = 'roundOver';
    state.scores = { humans: { p1: 1, p2: 0 }, ai: 0 };
    state.lastRoundOutcome = 'human';
    state.lastRoundScorers = ['p1'];
    expect(bannerFor(state, false, false, [], 'p1')).toEqual({ title: 'Round won!', sub: 'You 1 – 0 Them' });
    expect(bannerFor(state, false, false, [], 'p2')).toEqual({
      title: 'They took the round',
      sub: 'You 0 – 1 Them',
    });
    state.lastRoundScorers = ['p1', 'p2'];
    expect(bannerFor(state, false, false, [], 'p2')?.title).toBe('Point shared!');
    state.lastRoundOutcome = 'ai';
    state.lastRoundScorers = [];
    expect(bannerFor(state, false, false, [], 'p1')?.title).toBe('The AI took the round');
    expect(bannerFor(state, false, true, [], 'p1')?.sub).toContain('own shell');
    state.lastRoundOutcome = 'draw';
    expect(bannerFor(state, false, false, [], 'p2')?.title).toBe('Nobody scored');
  });

  test('single-player still scores against the AI', () => {
    expect(scoreLine({ humans: { p1: 2 }, ai: 1 })).toBe('You 2 – 1 AI');
  });
});
