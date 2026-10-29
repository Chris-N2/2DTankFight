import { createMatch, step, type MatchState, type SimEvent } from '@tank/sim';
import { describe, expect, test } from 'vitest';
import { bestKey, recordBest, type StorageLike } from '../src/best';
import { snapshot, tankPose } from '../src/renderer';
import { bannerFor, gameOverText, hpPips, hudScore, roundLine, wavesGameOverText } from '../src/screens';

function wavesMatch(startAiCount = 1): MatchState {
  return createMatch(
    { mode: 'waves', startAiCount, mortars: false, maps: { kind: 'sequence', ids: ['proving-ground'] } },
    3,
  );
}

/** Clears the current wave through the real rules and returns the events up to the next wave's countdown. */
function clearWave(state: MatchState): SimEvent[] {
  while (state.phase === 'countdown') step(state, {});
  for (const t of state.tanks) if (t.kind === 'ai') t.hp = 0;
  const events = step(state, {});
  while (state.phase === 'roundOver') events.push(...step(state, {}));
  return events;
}

class FakeStorage implements StorageLike {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

/** Storage that throws on every access, as some browsers do when site data is blocked. */
const blocked: StorageLike = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('SecurityError');
  },
};

describe('waves: heads-up display', () => {
  test('Wave shown', () => {
    const state = wavesMatch();
    clearWave(state);
    clearWave(state);
    expect(state.round).toBe(3);
    expect(roundLine(state)).toBe('Wave 3');
    expect(hudScore(state)).toBe('Cleared 2');
  });

  test('Last One Standing keeps its round and score', () => {
    const state = createMatch(
      {
        mode: 'lastOneStanding',
        aiCount: 2,
        rounds: 5,
        mortars: false,
        maps: { kind: 'sequence', ids: ['proving-ground'] },
      },
      1,
    );
    expect(roundLine(state)).toBe('Round 1 / 5');
    expect(hudScore(state)).toBe('You 0 – 0 AI');
  });

  test('armour pips follow the human tank', () => {
    const state = wavesMatch(4);
    expect(hpPips(state)).toBe('■■■');
  });
});

describe('waves: flow banners', () => {
  test('Thinner armour is announced', () => {
    const state = wavesMatch(1);
    const subs = [];
    for (let i = 0; i < 3; i++) {
      const started = clearWave(state).find((e) => e.type === 'waveStarted');
      const changes = started?.type === 'waveStarted' ? started.changes : [];
      subs.push(bannerFor(state, false, false, changes)?.sub);
    }
    // Waves 2 and 3 bring more tanks with less armour; wave 4 adds a tank at the same armour.
    expect(subs).toEqual([
      'Wave 2 · Proving Ground · More tanks, thinner armour',
      'Wave 3 · Proving Ground · More tanks, thinner armour',
      'Wave 4 · Proving Ground',
    ]);
  });

  test('wave 1 announces nothing but the wave', () => {
    for (const start of [1, 2, 3, 4]) {
      expect(bannerFor(wavesMatch(start), false, false)?.sub).toBe('Wave 1 · Proving Ground');
    }
  });

  test('countdown names the wave', () => {
    const state = wavesMatch();
    expect(bannerFor(state, false, false)).toEqual({ title: '3', sub: 'Wave 1 · Proving Ground' });
  });

  test('Escalation is announced', () => {
    const state = wavesMatch(4); // wave 2 is the first escalation
    const started = clearWave(state).find((e) => e.type === 'waveStarted');
    expect(started).toMatchObject({ wave: 2, changes: ['armour'] });
    const changes = started?.type === 'waveStarted' ? started.changes : [];
    expect(bannerFor(state, false, false, changes)?.sub).toBe('Wave 2 · Proving Ground · AI armour up');
  });

  test('every escalation step has its announcement', () => {
    const state = wavesMatch(4);
    const subs = [];
    for (let i = 0; i < 9; i++) {
      const started = clearWave(state).find((e) => e.type === 'waveStarted');
      const changes = started?.type === 'waveStarted' ? started.changes : [];
      subs.push(bannerFor(state, false, false, changes)?.sub);
    }
    expect(subs).toEqual([
      'Wave 2 · Proving Ground · AI armour up',
      'Wave 3 · Proving Ground · AI armour up',
      'Wave 4 · Proving Ground · AI hits harder',
      'Wave 5 · Proving Ground · One hit is lethal!',
      'Wave 6 · Proving Ground · AI shells faster',
      'Wave 7 · Proving Ground · AI shells faster',
      'Wave 8 · Proving Ground · AI shells faster',
      'Wave 9 · Proving Ground · AI shells faster',
      'Wave 10 · Proving Ground · AI shells faster',
    ]);
  });

  test('a cleared wave gets its own banner', () => {
    const state = wavesMatch();
    while (state.phase === 'countdown') step(state, {});
    for (const t of state.tanks) if (t.kind === 'ai') t.hp = 0;
    step(state, {});
    expect(state.phase).toBe('roundOver');
    expect(bannerFor(state, false, false)?.title).toBe('Wave 1 cleared!');
  });
});

describe('waves: result screen', () => {
  test('result text shows the wave reached and waves cleared', () => {
    const text = wavesGameOverText(5, 4, { best: 6, isNew: false }, false);
    expect(text).toMatchObject({ title: 'Destroyed on wave 5', score: '4 waves cleared', best: 'Best: 6' });
    expect(text.quip).not.toBe('');
    expect(wavesGameOverText(2, 1, { best: 1, isNew: true }, false)).toMatchObject({
      score: '1 wave cleared',
      best: 'New best!',
    });
    expect(wavesGameOverText(1, 0, null, true).quip).toContain('own shell');
  });

  test('Last One Standing results have no best line', () => {
    expect(gameOverText('win', { humans: { p1: 3 }, ai: 1 }).best).toBe('');
  });

  test('Best on this device', () => {
    const storage = new FakeStorage();
    // A first game that clears nothing isn't much of a record.
    expect(recordBest(storage, 1, false, 0)).toEqual({ best: 0, isNew: false });
    expect(recordBest(storage, 1, false, 3)).toEqual({ best: 3, isNew: true });
    expect(wavesGameOverText(4, 3, recordBest(storage, 1, false, 2), false).best).toBe('Best: 3');
    expect(recordBest(storage, 1, false, 3)).toEqual({ best: 3, isNew: false }); // equalling it isn't beating it
    expect(recordBest(storage, 1, false, 5)).toEqual({ best: 5, isNew: true });
    expect(storage.data.get(bestKey(1, false))).toBe('5');
    // Starting with more AI tanks is a different game, with its own best.
    expect(recordBest(storage, 4, false, 2)).toEqual({ best: 2, isNew: true });
    expect(storage.data.get(bestKey(1, false))).toBe('5');
  });

  test('Bests are kept per mortars setting', () => {
    const storage = new FakeStorage();
    recordBest(storage, 1, false, 6);
    expect(recordBest(storage, 1, true, 3)).toEqual({ best: 3, isNew: true });
    expect(recordBest(storage, 1, false, 0)).toEqual({ best: 6, isNew: false });
    expect(bestKey(1, true)).not.toBe(bestKey(1, false));
  });

  test('Earlier bests are classic bests', () => {
    const storage = new FakeStorage();
    storage.setItem('tank-command.waves-best.2', '7'); // as stored before mortars existed
    expect(recordBest(storage, 2, false, 1)).toEqual({ best: 7, isNew: false });
    expect(recordBest(storage, 2, true, 1)).toEqual({ best: 1, isNew: true });
  });

  test('a corrupt stored best is ignored', () => {
    const storage = new FakeStorage();
    storage.setItem(bestKey(2, false), 'lots');
    expect(recordBest(storage, 2, false, 1)).toEqual({ best: 1, isNew: true });
  });

  test('Best survives storage being unavailable', () => {
    expect(recordBest(null, 1, false, 3)).toBeNull();
    expect(recordBest(blocked, 1, false, 3)).toBeNull();
    const text = wavesGameOverText(4, 3, recordBest(blocked, 1, false, 3), false);
    expect(text.score).toBe('3 waves cleared');
    expect(text.best).toBe('');
  });
});

describe('waves: drawing new tanks', () => {
  test('a tank added at a wave start draws at its spawn', () => {
    const state = wavesMatch();
    while (state.phase === 'countdown') step(state, {});
    for (const t of state.tanks) if (t.kind === 'ai') t.hp = 0;
    step(state, {});
    // The tick that starts wave 2 adds ai2; the frame before it has no record of that tank.
    let prev = snapshot(state);
    while (state.phase === 'roundOver') {
      prev = snapshot(state);
      step(state, {});
    }
    const added = state.tanks.find((t) => t.id === 'ai2')!;
    expect(prev.tanks['ai2']).toBeUndefined();
    for (const alpha of [0, 0.5, 1]) {
      expect(tankPose(added, prev, alpha)).toEqual({ x: added.x, y: added.y, heading: added.heading });
    }
  });

  test('ordinary movement still interpolates', () => {
    const prev = { tanks: { ai1: { x: 100, y: 100, heading: 0 } }, shells: {} };
    expect(tankPose({ id: 'ai1', x: 102, y: 100, heading: 0 }, prev, 0.5).x).toBeCloseTo(101);
  });
});
