import { snapshotOf, type Snapshot } from '@tank/protocol';
import {
  createMatch,
  PROVING_GROUND,
  RUN_FOR_COVER,
  step,
  type MatchOptions,
  type MatchState,
  type SimEvent,
} from '@tank/sim';
import { describe, expect, test } from 'vitest';
import { INTERPOLATION_DELAY_MS, OnlineMirror } from '../src/online';

const OPTIONS: MatchOptions = {
  mode: 'lastOneStanding',
  aiCount: 2,
  rounds: 3,
  mortars: true,
  maps: { kind: 'random' },
  humans: 2,
};
const STEP = 1000 / 60;

/** A real match, stepped with everyone driving, and cut into snapshots every two ticks as the server does. */
function recording(ticks: number): { snaps: Snapshot[]; match: MatchState } {
  const match = createMatch(OPTIONS, 3);
  const snaps: Snapshot[] = [snapshotOf(match, [])];
  let pending: SimEvent[] = [];
  for (let i = 1; i <= ticks; i++) {
    pending.push(
      ...step(match, {
        p1: { throttle: 1, turn: 0.3, fire: true },
        p2: { throttle: 1, turn: -0.3, fire: i % 30 === 0 },
      }),
    );
    if (i % 2 === 0) {
      snaps.push(snapshotOf(match, pending));
      pending = [];
    }
  }
  return { snaps, match };
}

function mirror(): OnlineMirror {
  const m = new OnlineMirror(OPTIONS);
  m.setBoard(PROVING_GROUND);
  return m;
}

/** Fake tick-only snapshots, enough for timing tests. */
function snap(tick: number, events: SimEvent[] = []): Snapshot {
  const { snaps } = recording(0);
  return { ...snaps[0]!, tick, events };
}

describe('online: the mirror', () => {
  test('nothing to draw before the first snapshot', () => {
    expect(mirror().frame(0)).toEqual({ state: null, prev: null, alpha: 0, events: [] });
  });

  test('a snapshot becomes a match the screens can use', () => {
    const { snaps, match } = recording(10);
    const m = mirror();
    m.push(snaps.at(-1)!);
    const { state } = m.frame(0);
    expect(state!.tanks).toEqual(match.tanks);
    expect(state!.phase).toBe(match.phase);
    expect(state!.options).toEqual(OPTIONS);
    expect(state!.board).toBe(PROVING_GROUND);
    expect(state!.config.tickRate).toBe(60);
  });

  test('a new board applies from the snapshot after it, not before', () => {
    const m = mirror();
    m.push(snap(10));
    m.setBoard(RUN_FOR_COVER);
    m.push(snap(12));
    expect(m.frame(0).state!.board).toBe(RUN_FOR_COVER); // drawn towards tick 12, the new board's
    const held = mirror();
    held.push(snap(10));
    held.setBoard(RUN_FOR_COVER);
    expect(held.frame(0).state!.board).toBe(PROVING_GROUND);
  });
});

describe('online: interpolation', () => {
  test('draws about 100 ms behind the newest snapshot, moving smoothly between snapshots', () => {
    const { snaps } = recording(120);
    const m = mirror();
    let now = 0;
    let fed = 0;
    // Snapshots arrive every 2 ticks; frames run at 60 per second.
    const frames: { at: number; tick: number; alpha: number }[] = [];
    for (let frame = 0; frame < 100; frame++) {
      while (fed < snaps.length && snaps[fed]!.tick * STEP <= now) m.push(snaps[fed++]!);
      const f = m.frame(now);
      frames.push({ at: now, tick: f.state!.tick, alpha: f.alpha });
      now += STEP;
    }
    // Once settled, the drawn tick trails the newest by about the delay, give or take a snapshot.
    const settled = frames.slice(60);
    for (const f of settled) {
      const newest = Math.floor(f.at / STEP / 2) * 2;
      const drawnAt = f.tick - 2 + 2 * f.alpha;
      expect(newest - drawnAt).toBeGreaterThan(INTERPOLATION_DELAY_MS / STEP - 3);
      expect(newest - drawnAt).toBeLessThan(INTERPOLATION_DELAY_MS / STEP + 3);
    }
    // And every frame moves on a little: no jumps, no stalls.
    for (let i = 61; i < frames.length; i++) {
      const a = frames[i - 1]!;
      const b = frames[i]!;
      const step = b.tick - 2 + 2 * b.alpha - (a.tick - 2 + 2 * a.alpha);
      expect(step).toBeGreaterThan(0.5);
      expect(step).toBeLessThan(1.5);
    }
  });

  test('positions are interpolated between the snapshots either side', () => {
    const { snaps } = recording(40);
    const m = mirror();
    for (const s of snaps.slice(0, 10)) m.push(s); // up to tick 18
    m.frame(0); // starts 6 ticks behind the newest: tick 12
    const f = m.frame(STEP); // one tick later: halfway from 12 to 14
    expect(f.state!.tick).toBe(14);
    expect(f.prev!.tanks['p1']).toEqual(expect.objectContaining({ x: snaps[6]!.tanks[0]!.x }));
    expect(f.alpha).toBeCloseTo(0.5);
  });

  test('holds on the newest snapshot when the buffer runs dry, rather than guessing ahead', () => {
    const m = mirror();
    for (let t = 0; t <= 20; t += 2) m.push(snap(t));
    m.frame(0);
    for (let now = 0; now < 2000; now += STEP) m.frame(now);
    const held = m.frame(2000);
    expect(held.state!.tick).toBe(20);
    expect(held.prev).toBeNull();
    // More arrives: playback carries on from there.
    m.push(snap(22));
    m.push(snap(24));
    const on = m.frame(2000 + STEP);
    expect(on.state!.tick).toBe(22);
    expect(on.alpha).toBeGreaterThan(0);
  });

  test('jumps forward when far behind', () => {
    const m = mirror();
    m.push(snap(0));
    m.frame(0);
    // A tab that was hidden: a second of snapshots piles up before the next frame.
    for (let t = 2; t <= 120; t += 2) m.push(snap(t));
    const f = m.frame(16);
    expect(f.state!.tick).toBeGreaterThanOrEqual(110);
  });

  test('every event is played once, in order, as its snapshot comes due', () => {
    const { snaps } = recording(300);
    const all = snaps.flatMap((s) => s.events);
    expect(all.length).toBeGreaterThan(5);
    const m = mirror();
    const played: SimEvent[] = [];
    let now = 0;
    let fed = 0;
    while (played.length < all.length && now < 20_000) {
      // Irregular arrival: bursts of three snapshots at a time.
      if (Math.floor(now / STEP) % 6 === 0)
        for (let i = 0; i < 3 && fed < snaps.length; i++) m.push(snaps[fed++]!);
      played.push(...m.frame(now).events);
      now += STEP;
    }
    expect(played).toEqual(all);
  });

  test('a skipped stretch still plays its events', () => {
    const m = mirror();
    const ended: SimEvent = { type: 'gameEnded', result: 'over', wavesCleared: 2 };
    m.push(snap(0));
    m.frame(0);
    for (let t = 2; t <= 120; t += 2) m.push(snap(t, t === 40 ? [ended] : []));
    expect(m.frame(16).events).toEqual([ended]);
  });

  test('a new game (the tick going back) starts afresh', () => {
    const m = mirror();
    for (let t = 0; t <= 600; t += 2) m.push(snap(t));
    for (let now = 0; now < 1000; now += STEP) m.frame(now);
    m.push(snap(0, [{ type: 'roundStarted', round: 1 }]));
    const f = m.frame(1000);
    expect(f.state!.tick).toBe(0);
    expect(f.events).toEqual([{ type: 'roundStarted', round: 1 }]);
  });
});
