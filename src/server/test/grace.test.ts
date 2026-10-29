import type { MatchOptions } from '@tank/sim';
import { describe, expect, test } from 'vitest';
import { RESUME_MS } from '../src/room';
import { LOS, SETTINGS, Table, WAVES } from './harness';

const GRACE = SETTINGS.graceMs;

/** A table in play, with a shell and a mortar in the air and a tank bogged down, so freezing has things to stop. */
function busy(options: MatchOptions = LOS): Table {
  const table = new Table();
  table.playing(options);
  table.send('p1', { t: 'input', throttle: 1, turn: 0.5, fire: true, mortar: false });
  table.send('p2', { t: 'input', throttle: -1, turn: -0.5, fire: true, mortar: false });
  table.advance(200);
  const match = table.room.match!;
  match.tanks.find((t) => t.id === 'p1')!.slowTicks = 90;
  match.mortarShells.push({
    id: 50,
    ownerId: 'ai1',
    fromX: 0,
    fromY: 0,
    toX: 600,
    toY: 400,
    flightTicks: 60,
    ticksLeft: 60,
  });
  expect(match.shells.length).toBeGreaterThan(0);
  return table;
}

describe('game server: grace period for drops', () => {
  test('Freeze and resume', () => {
    const table = busy();
    table.clear();
    table.drop('p2');
    const frozenAt = JSON.stringify(table.room.match);
    expect(table.last('p1')).toEqual({ t: 'frozen', seat: 'p2', until: GRACE });

    table.advance(5000);
    expect(JSON.stringify(table.room.match)).toBe(frozenAt);
    expect(table.rejoin('p2')).toMatchObject({ seat: 'p2' });
    // The guest is sent where they are, then both see the same 3-second countdown.
    expect(table.inbox.p2.map((m) => m.t)).toEqual(['room', 'board', 'snap', 'resume']);
    expect(table.last('p2')).toEqual({ t: 'resume', at: RESUME_MS });
    expect(table.last('p1')).toEqual({ t: 'resume', at: RESUME_MS });
    expect(table.sent('p2', 'snap')[0]).toMatchObject({ tick: table.room.match!.tick, events: [] });

    table.advance(RESUME_MS - 4);
    expect(JSON.stringify(table.room.match)).toBe(frozenAt);
    table.advance(100);
    expect(table.room.match!.tick).toBeGreaterThan(JSON.parse(frozenAt).tick);
  });

  test('Frozen means frozen', () => {
    const table = busy();
    // A snapshot of everything that moves or counts down, taken as the drop happens.
    table.drop('p1');
    const match = table.room.match!;
    const before = {
      tick: match.tick,
      phaseTicks: match.phaseTicks,
      tanks: JSON.stringify(match.tanks),
      shells: JSON.stringify(match.shells),
      mortars: JSON.stringify(match.mortarShells),
    };
    table.advance(GRACE - 100);
    expect({
      tick: match.tick,
      phaseTicks: match.phaseTicks,
      tanks: JSON.stringify(match.tanks),
      shells: JSON.stringify(match.shells),
      mortars: JSON.stringify(match.mortarShells),
    }).toEqual(before);
    expect(table.sent('p2', 'snap').at(-1)!.tick).toBe(before.tick);
  });

  test('a drop during the countdown freezes the countdown', () => {
    const table = new Table();
    table.started();
    table.advance(1000);
    table.drop('p2');
    const left = table.room.match!.phaseTicks;
    table.advance(10_000);
    expect(table.room.match!.phaseTicks).toBe(left);
    expect(table.room.match!.phase).toBe('countdown');
  });

  test('controls pressed while frozen do nothing when play resumes', () => {
    const table = new Table();
    table.playing();
    table.drop('p2');
    table.send('p1', { t: 'input', throttle: 0, turn: 0, fire: true, mortar: false });
    table.send('p1', { t: 'input', throttle: 0, turn: 0, fire: false, mortar: false });
    table.rejoin('p2');
    table.clear();
    table.advance(RESUME_MS + 100);
    expect(table.events('p1').some((e) => e.type === 'shotFired' && e.tankId === 'p1')).toBe(false);
  });

  test('Out of time in Last One Standing', () => {
    const table = busy();
    const token = table.token('p2');
    table.drop('p2');
    table.advance(GRACE - 100);
    expect(table.room.phase).toBe('game');
    table.advance(100);
    expect(table.room.phase).toBe('result');
    expect(table.sent('p1', 'snap').at(-1)).toMatchObject({
      phase: 'gameOver',
      result: 'win',
      winnerId: 'p1',
      forfeit: true,
    });
    expect(
      table
        .events('p1')
        .slice(-2)
        .map((e) => e.type),
    ).toEqual(['left', 'gameEnded']);
    // When the guest's client next gets through, it's told the game went on without them.
    expect(table.reg.rejoin(table.room.code, token, table.now)).toEqual({ gone: true });
  });

  test('Out of time in Waves', () => {
    const table = busy(WAVES);
    table.drop('p1');
    table.advance(GRACE);
    expect(table.room.phase).toBe('game');
    expect(table.room.match!.tanks.some((t) => t.id === 'p1')).toBe(false);
    expect(table.events('p2').at(-1)).toEqual({ type: 'left', tankId: 'p1' });
    // A 3-2-1, and the guest carries on alone.
    expect(table.last('p2')).toEqual({ t: 'resume', at: RESUME_MS });
    const tick = table.room.match!.tick;
    table.advance(RESUME_MS + 500);
    expect(table.room.match!.tick).toBeGreaterThan(tick);
  });

  test('when a Waves game the host left ends, the guest sees the result and then that the host has gone', () => {
    const table = busy(WAVES);
    table.send('p1', { t: 'leave' });
    for (const t of table.room.match!.tanks) if (t.id === 'p2') t.hp = 0;
    table.advanceUntil(() => table.room.closed, 10_000);
    const last = table.inbox.p2.slice(-2);
    expect(last[0]).toMatchObject({ t: 'snap', phase: 'gameOver', result: 'over' });
    expect(last[1]).toEqual({ t: 'closed', reason: 'hostLeft' });
  });

  test("both players drop: frozen until one returns, who sees the other's time counting down", () => {
    const table = busy();
    table.drop('p1');
    table.advance(2000);
    table.drop('p2');
    table.advance(1000);
    table.clear();
    table.rejoin('p2');
    expect(table.last('p2')).toEqual({ t: 'frozen', seat: 'p1', until: GRACE - 3000 });
    table.advance(5000);
    expect(table.room.phase).toBe('game');
    table.rejoin('p1');
    expect(table.last('p1')).toEqual({ t: 'resume', at: RESUME_MS });
    expect(table.last('p2')).toEqual({ t: 'resume', at: RESUME_MS });
  });

  test('both players drop and neither returns: the room closes', () => {
    const table = busy();
    table.drop('p1');
    table.advance(2000);
    table.drop('p2');
    table.advance(GRACE - 2000);
    expect(table.room.closed).toBe(false); // the guest still has time
    table.advance(2000);
    expect(table.room.closed).toBe(true);
    expect(table.reg.find(table.room.code)).toBeUndefined();
  });

  test('both drop, the host runs out of time while the guest is away, then the guest returns and plays on', () => {
    const table = busy(WAVES);
    table.drop('p2');
    table.advance(2000);
    table.drop('p1');
    table.advance(GRACE - 1000); // the guest's time is up, the host's isn't
    table.rejoin('p1');
    // The guest's seat has gone, and the host plays on alone after a 3-2-1.
    expect(table.room.match!.tanks.some((t) => t.id === 'p2')).toBe(false);
    expect(table.last('p1')).toEqual({ t: 'resume', at: RESUME_MS });
    const tick = table.room.match!.tick;
    table.advance(RESUME_MS + 200);
    expect(table.room.match!.tick).toBeGreaterThan(tick);
  });

  test('a drop during the 3-2-1 freezes the game again', () => {
    const table = busy();
    table.drop('p2');
    table.rejoin('p2');
    table.advance(1000);
    table.clear();
    table.drop('p1');
    expect(table.last('p2')).toEqual({ t: 'frozen', seat: 'p1', until: GRACE });
    const tick = table.room.match!.tick;
    table.advance(5000);
    expect(table.room.match!.tick).toBe(tick);
  });

  test('a refresh that beats the drop being noticed rejoins without freezing anything', () => {
    const table = busy();
    table.clear();
    table.rejoin('p1');
    expect(table.inbox.p1.map((m) => m.t)).toEqual(['room', 'board', 'snap']);
    const tick = table.room.match!.tick;
    table.advance(100);
    expect(table.room.match!.tick).toBeGreaterThan(tick);
  });
});
