import { describe, expect, test } from 'vitest';
import { LOS, SETTINGS, Table, WAVES } from './harness';

describe('game server: leaving on purpose', () => {
  test('Leaving Last One Standing', () => {
    const table = new Table();
    table.playing(LOS);
    const token = table.token('p2');
    table.clear();
    table.send('p2', { t: 'leave' });
    // At once: no grace period, no freeze.
    expect(table.room.phase).toBe('result');
    expect(table.sent('p1', 'frozen')).toEqual([]);
    expect(table.last('p1')).toMatchObject({
      t: 'snap',
      phase: 'gameOver',
      result: 'win',
      winnerId: 'p1',
      forfeit: true,
    });
    expect(table.reg.rejoin(table.room.code, token, table.now)).toEqual({ gone: true });
  });

  test('the host leaving Last One Standing gives the guest the forfeit win, then closes the room', () => {
    const table = new Table();
    table.playing(LOS);
    table.clear();
    table.send('p1', { t: 'leave' });
    expect(table.inbox.p2.map((m) => m.t)).toEqual(['snap', 'closed']);
    expect(table.inbox.p2[0]).toMatchObject({ result: 'win', winnerId: 'p2', forfeit: true });
    expect(table.last('p2')).toEqual({ t: 'closed', reason: 'hostLeft' });
    expect(table.room.closed).toBe(true);
  });

  test('leaving Waves: the other human carries on alone straight away', () => {
    const table = new Table();
    table.playing(WAVES);
    table.send('p2', { t: 'leave' });
    expect(table.room.phase).toBe('game');
    expect(table.events('p1').at(-1)).toEqual({ type: 'left', tankId: 'p2' });
    const tick = table.room.match!.tick;
    table.advance(200);
    expect(table.room.match!.tick).toBeGreaterThan(tick);
  });

  test('the player who stayed can leave a frozen game too', () => {
    const table = new Table();
    table.playing(LOS);
    table.drop('p2');
    table.send('p1', { t: 'leave' });
    // The guest, still within their grace period, has won by forfeit and sees it when they get back.
    expect(table.room.phase).toBe('result');
    table.rejoin('p2');
    expect(table.inbox.p2.slice(-2)).toMatchObject([
      { t: 'snap', result: 'win', winnerId: 'p2', forfeit: true },
      { t: 'closed', reason: 'hostLeft' },
    ]);
  });

  test('a result nobody comes back for: the room closes when the grace period runs out', () => {
    const table = new Table();
    table.playing(LOS);
    table.drop('p2');
    table.send('p1', { t: 'leave' });
    table.advance(SETTINGS.graceMs);
    expect(table.room.closed).toBe(true);
  });

  test('the guest leaving while the host is away: the host comes back to the forfeit win', () => {
    const table = new Table();
    table.playing(LOS);
    table.drop('p1');
    table.send('p2', { t: 'leave' });
    table.advance(5000);
    table.rejoin('p1');
    expect(table.last('p1')).toMatchObject({ t: 'snap', result: 'win', winnerId: 'p1', forfeit: true });
    expect(table.room.closed).toBe(false);
  });

  test('a host who drops after coming back to the result closes the room', () => {
    const table = new Table();
    table.playing(LOS);
    table.drop('p1');
    table.send('p2', { t: 'leave' });
    table.rejoin('p1');
    table.drop('p1');
    expect(table.room.closed).toBe(true); // no grace needed after the game
  });
});

describe('game server: test bot', () => {
  test('Playing the bot', () => {
    const table = new Table({ testBot: true });
    table.host(WAVES);
    table.send('p1', { t: 'bot' });
    expect(table.room.phase).toBe('game');
    expect(table.room.match!.tanks.filter((t) => t.kind === 'human').map((t) => t.id)).toEqual(['p1', 'p2']);
    expect(table.inbox.p2).toEqual([]); // nobody to send anything to

    table.advanceUntil(() => table.room.match!.phase === 'playing', 10_000);
    table.advanceUntil(
      () => table.events('p1').some((e) => e.type === 'shotFired' && e.tankId === 'p2'),
      20_000,
    );
    const hitsOnP1 = table
      .events('p1')
      .filter((e) => e.type === 'hit' && e.shooterId === 'p2' && e.targetId === 'p1');
    expect(hitsOnP1).toEqual([]);
  });

  test('the bot never drops, plays again, and going back to the lobby frees its seat', () => {
    const table = new Table({ testBot: true });
    table.host({ ...LOS, rounds: 1 });
    table.send('p1', { t: 'bot' });
    table.advance(60_000);
    expect(table.sent('p1', 'frozen')).toEqual([]);
    for (const t of table.room.match!.tanks) if (t.id !== 'p1') t.alive = false;
    table.advanceUntil(() => table.room.phase === 'result', 10_000);

    table.send('p1', { t: 'playAgain' });
    expect(table.room.phase).toBe('game');
    for (const t of table.room.match!.tanks) if (t.id !== 'p1') t.alive = false;
    table.advanceUntil(() => table.room.phase === 'result', 10_000);

    table.clear();
    table.send('p1', { t: 'toLobby' });
    expect(table.last('p1')).toEqual({ t: 'lobby', guest: false });
    expect(table.room.hasGuest).toBe(false);
    expect(table.reg.join(table.room.code)).toMatchObject({ seat: 'p2' });
  });

  test('the host leaving a game with the bot closes the room', () => {
    const table = new Table({ testBot: true });
    table.host();
    table.send('p1', { t: 'bot' });
    table.send('p1', { t: 'leave' });
    expect(table.room.closed).toBe(true);
  });

  test('Bot switched off', () => {
    const table = new Table({ testBot: false });
    table.host();
    table.send('p1', { t: 'bot' });
    expect(table.room.phase).toBe('lobby');
    expect(table.room.hasGuest).toBe(false);
    expect(table.last('p1')).toMatchObject({ t: 'refused', reason: 'invalid' });
  });

  test('no bot when a guest has the seat', () => {
    const table = new Table({ testBot: true });
    table.host();
    table.guest();
    table.send('p1', { t: 'bot' });
    expect(table.room.phase).toBe('lobby');
    expect(table.last('p1')).toEqual({ t: 'refused', reason: 'full' });
  });
});
