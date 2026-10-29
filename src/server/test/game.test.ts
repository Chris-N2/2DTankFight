import { botInput, createMatch, DEFAULT_CONFIG, step, type SimEvent, type TankInput } from '@tank/sim';
import { describe, expect, test } from 'vitest';
import { LOS, Table, WAVES } from './harness';

/** Two tables with the same seeds and the same clock, so whatever differs between them is down to the test. */
function twins(): [Table, Table] {
  const a = new Table();
  const b = new Table();
  a.playing();
  b.playing();
  return [a, b];
}

function state(table: Table): string {
  return JSON.stringify(table.room.match);
}

describe('game server: starting', () => {
  test('both players get the same board and the same first countdown', () => {
    const table = new Table();
    table.started();
    for (const seat of ['p1', 'p2'] as const) {
      expect(table.inbox[seat].slice(-2).map((m) => m.t)).toEqual(['board', 'snap']);
    }
    expect(table.sent('p1', 'board')).toEqual(table.sent('p2', 'board'));
    expect(table.sent('p1', 'snap')).toEqual(table.sent('p2', 'snap'));
    expect(table.sent('p1', 'snap')[0]).toMatchObject({ phase: 'countdown', round: 1, tick: 0 });
  });

  test('snapshots arrive 30 times a second, with the countdown running down', () => {
    const table = new Table();
    table.started();
    table.clear();
    table.advance(1000);
    const snaps = table.sent('p1', 'snap');
    expect(snaps.length).toBeGreaterThanOrEqual(29);
    expect(snaps.length).toBeLessThanOrEqual(31);
    expect(snaps.at(-1)!.tick).toBeGreaterThanOrEqual(58); // the first tick only starts the clock
    expect(snaps.at(-1)!.phaseTicks).toBeLessThan(snaps[0]!.phaseTicks);
  });
});

describe('game server: controls', () => {
  test('Controls only', () => {
    const [a, b] = twins();
    a.sendRaw('p1', '{"t":"position","id":"p1","x":600,"y":400}');
    a.sendRaw('p1', '{"t":"hit","shooterId":"p1","targetId":"p2","damage":100}');
    a.sendRaw('p1', '{"t":"score","p1":5}');
    a.sendRaw('p1', '{"t":"input","throttle":1,"turn":0,"fire":false,"x":600,"hp":99,"alive":false}');
    b.sendRaw('p1', '{"t":"input","throttle":1,"turn":0,"fire":false}');
    a.advance(500);
    b.advance(500);
    expect(state(a)).toBe(state(b));
  });

  test('Garbage in', () => {
    const [a, b] = twins();
    a.sendRaw('p2', '{"t":"input","throttle":"full","turn":"left","fire":"yes","mortar":7}');
    a.sendRaw('p2', '}{ not json');
    a.sendRaw('p2', '{"t":"input","turn":null}');
    a.sendRaw('p2', '{"t":"options","options":"lots"}');
    a.advance(500);
    b.advance(500);
    expect(a.room.match!.phase).toBe('playing');
    expect(a.room.match!.tick).toBeGreaterThan(b.room.match!.tick - 1);
    expect(state(a)).toBe(state(b)); // p2 behaved as if it had no input
  });

  test('A quick tap still fires', () => {
    const table = new Table();
    table.playing();
    table.clear();
    table.send('p1', { t: 'input', throttle: 0, turn: 0, fire: true, mortar: false });
    table.send('p1', { t: 'input', throttle: 0, turn: 0, fire: false, mortar: false });
    table.advance(40);
    const shots = table.events('p1').filter((e) => e.type === 'shotFired' && e.tankId === 'p1');
    expect(shots).toHaveLength(1);
  });

  test('a quick mortar tap still launches', () => {
    const table = new Table();
    table.playing();
    table.clear();
    table.send('p1', { t: 'input', throttle: 0, turn: 0, fire: false, mortar: true });
    table.send('p1', { t: 'input', throttle: 0, turn: 0, fire: false, mortar: false });
    table.advance(40);
    expect(table.events('p1').some((e) => e.type === 'mortarLaunched' && e.tankId === 'p1')).toBe(true);
  });

  test('Holding keeps holding', () => {
    const [a, b] = twins();
    const forward: TankInput = { throttle: 1, turn: 0, fire: false, mortar: false };
    const start = { ...a.room.match!.tanks.find((t) => t.id === 'p1')! };
    a.send('p1', { t: 'input', ...forward, mortar: false });
    // The twin is sent the same controls every few milliseconds instead.
    for (let i = 0; i < 250; i++) {
      b.send('p1', { t: 'input', ...forward, mortar: false });
      b.advance(4);
    }
    a.advance(1000);
    expect(state(a)).toBe(state(b));
    const end = a.room.match!.tanks.find((t) => t.id === 'p1')!;
    expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeGreaterThan(0);
  });

  test('controls before the game starts are ignored', () => {
    const table = new Table();
    table.host();
    table.guest();
    table.send('p1', { t: 'input', throttle: 1, turn: 0, fire: true, mortar: false });
    table.send('p1', { t: 'start' });
    table.advanceUntil(() => table.room.match?.phase === 'playing', 10_000);
    table.advance(100);
    expect(table.events('p1').some((e) => e.type === 'shotFired' && e.tankId === 'p1')).toBe(false);
  });
});

describe('game server: snapshots and events', () => {
  test('Nothing missed between snapshots', () => {
    const table = new Table();
    table.playing({ ...LOS, maps: { kind: 'sequence', ids: ['proving-ground'] } });
    const match = table.room.match!;
    // Freeze the AI out of the way and line up a shell that bounces off the left edge into p2.
    const p2 = match.tanks.find((t) => t.id === 'p2')!;
    p2.x = DEFAULT_CONFIG.tankRadius + 27;
    p2.y = 300;
    const speed = 2400;
    match.shells.push({
      id: 999,
      ownerId: 'p1',
      x: 8,
      y: 300,
      vx: -speed,
      vy: 0,
      speed,
      damage: 1,
      bounces: 0,
      ticksLeft: 60,
    });
    table.clear();
    table.advanceUntil(() => table.events('p2').some((e) => e.type === 'hit' && e.shellId === 999), 1000);
    for (const seat of ['p1', 'p2'] as const) {
      const snap = table
        .sent(seat, 'snap')
        .find((s) => s.events.some((e) => e.type === 'hit' && e.shellId === 999))!;
      const types = snap.events.filter((e) => 'shellId' in e && e.shellId === 999).map((e) => e.type);
      expect(types).toEqual(['bounce', 'hit']);
    }
  });

  test('every event reaches each player exactly once, in order', () => {
    // A whole game against the bot, replayed on a match of our own with the same seed and the same controls.
    const table = new Table();
    table.host({ ...WAVES, startAiCount: 3 });
    table.send('p1', { t: 'bot' });
    const controls: TankInput = { throttle: 1, turn: 0.3, fire: false, mortar: false };
    table.send('p1', { t: 'input', ...controls, mortar: false });
    table.advanceUntil(() => table.room.phase === 'result', 600_000);

    const replay = createMatch({ ...WAVES, startAiCount: 3, humans: 2 }, 1001);
    const events: SimEvent[] = [];
    while (replay.tick < table.room.match!.tick) {
      events.push(...step(replay, { p1: controls, p2: botInput(replay, 'p2') }));
    }
    expect(JSON.stringify(replay)).toBe(JSON.stringify(table.room.match));
    expect(table.events('p1')).toEqual(events);
    expect(events.at(-1)).toMatchObject({ type: 'gameEnded', result: 'over' });
  }, 60_000);

  test('New board, sent once', () => {
    const table = new Table();
    table.playing(LOS); // random maps never play the same board twice in a row
    const match = table.room.match!;
    const first = match.board.id;
    table.clear();
    for (const t of match.tanks) if (t.id !== 'p1') t.alive = false;
    table.advanceUntil(
      () => table.room.match!.round === 2 && table.room.match!.phase === 'countdown',
      10_000,
    );
    table.advance(500);

    for (const seat of ['p1', 'p2'] as const) {
      const msgs = table.inbox[seat];
      const boards = msgs.filter((m) => m.t === 'board');
      expect(boards).toHaveLength(1);
      expect(boards[0]).toMatchObject({ board: { id: match.board.id } });
      expect(match.board.id).not.toBe(first);
      const at = msgs.indexOf(boards[0]!);
      const roundTwo = msgs.findIndex((m) => m.t === 'snap' && m.round === 2);
      expect(at).toBeGreaterThan(-1);
      expect(roundTwo).toBe(at + 1);
    }
  });

  test('a board that stays the same is not sent again', () => {
    const table = new Table();
    table.playing({ ...LOS, maps: { kind: 'sequence', ids: ['pac-tank'] } });
    const match = table.room.match!;
    table.clear();
    for (const t of match.tanks) if (t.id !== 'p1') t.alive = false;
    table.advanceUntil(() => table.room.match!.round === 2, 10_000);
    expect(table.sent('p1', 'board')).toEqual([]);
  });
});

describe('game server: playing again', () => {
  function finished(): Table {
    const table = new Table();
    table.playing({ ...LOS, rounds: 1 });
    for (const t of table.room.match!.tanks) if (t.id !== 'p1') t.alive = false;
    table.advanceUntil(() => table.room.phase === 'result', 10_000);
    return table;
  }

  test('a game that ends leaves both players in the room with the result', () => {
    const table = finished();
    expect(table.sent('p2', 'snap').at(-1)).toMatchObject({
      phase: 'gameOver',
      result: 'win',
      winnerId: 'p1',
    });
    expect(table.room.hasGuest).toBe(true);
    table.advance(5000);
    expect(table.room.closed).toBe(false);
  });

  test('Play again keeps the room', () => {
    const table = finished();
    const seed = table.room.match!.rng;
    table.clear();
    table.send('p2', { t: 'playAgain' }); // only the host decides
    expect(table.room.phase).toBe('result');
    table.send('p1', { t: 'playAgain' });
    expect(table.room.phase).toBe('game');
    for (const seat of ['p1', 'p2'] as const) {
      expect(table.inbox[seat].map((m) => m.t)).toEqual(['board', 'snap']);
      expect(table.sent(seat, 'snap')[0]).toMatchObject({ phase: 'countdown', round: 1, tick: 0 });
    }
    expect(table.room.match!.rng).not.toEqual(seed);
  });

  test('each game gets a fresh seed', () => {
    const seeds: number[] = [];
    const table = new Table(
      {},
      {
        token: () => 'token',
        seed: () => {
          seeds.push(seeds.length + 77);
          return seeds.at(-1)!;
        },
        random: Math.random,
      },
    );
    table.started({ ...LOS, rounds: 1 });
    for (let game = 0; game < 2; game++) {
      for (const t of table.room.match!.tanks) if (t.id !== 'p1') t.alive = false;
      table.advanceUntil(() => table.room.phase === 'result', 10_000);
      table.send('p1', { t: 'playAgain' });
    }
    expect(seeds).toEqual([77, 78, 79]);
  });

  test('Back to the lobby', () => {
    const table = finished();
    table.clear();
    table.send('p1', { t: 'toLobby' });
    expect(table.room.phase).toBe('lobby');
    expect(table.last('p1')).toEqual({ t: 'lobby', guest: true });
    expect(table.last('p2')).toEqual({ t: 'lobby', guest: true });
    table.send('p1', { t: 'options', options: { ...WAVES, friendlyFire: true } });
    expect(table.last('p2')).toEqual({ t: 'options', options: { ...WAVES, friendlyFire: true, humans: 2 } });
    table.send('p1', { t: 'start' });
    expect(table.room.match!.options.mode).toBe('waves');
  });

  test('the guest heads off after a game: the host is back in the lobby with the same code', () => {
    const table = finished();
    const code = table.room.code;
    table.send('p2', { t: 'leave' });
    expect(table.room.phase).toBe('lobby');
    expect(table.last('p1')).toEqual({ t: 'lobby', guest: false });
    expect(table.reg.join(code)).toMatchObject({ seat: 'p2' });
  });

  test('a drop after the game: the guest going puts the host back in the lobby', () => {
    const table = finished();
    table.drop('p2');
    expect(table.room.phase).toBe('lobby');
    expect(table.last('p1')).toEqual({ t: 'lobby', guest: false });
  });

  test('a drop after the game: the host going closes the room once the guest is told', () => {
    const table = finished();
    table.drop('p1');
    expect(table.room.closed).toBe(true);
    expect(table.last('p2')).toEqual({ t: 'closed', reason: 'hostLeft' });
  });
});
