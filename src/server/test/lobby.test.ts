import { describe, expect, test } from 'vitest';
import { LOS, SETTINGS, Table } from './harness';

describe('game server: lobby', () => {
  test('Host changes options', () => {
    const table = new Table();
    table.host(LOS);
    table.guest();
    table.send('p1', { t: 'options', options: { ...LOS, mortars: false } });
    expect(table.last('p2')).toEqual({ t: 'options', options: { ...LOS, mortars: false, humans: 2 } });
    expect(table.room.options.mortars).toBe(false);
  });

  test('options sent with no guest are kept for when one joins', () => {
    const table = new Table();
    table.host(LOS);
    table.send('p1', { t: 'options', options: { ...LOS, rounds: 3 } });
    table.guest();
    expect(table.last('p2')).toMatchObject({ t: 'room', options: { rounds: 3 } });
  });

  test('invalid options are refused with the reason, and the old ones kept', () => {
    const table = new Table();
    table.host(LOS);
    table.guest();
    table.clear();
    table.send('p1', { t: 'options', options: { ...LOS, aiCount: 4 } });
    expect(table.last('p1')).toEqual({
      t: 'refused',
      reason: 'invalid',
      detail: 'Number of AI opponents must be between 1 and 3.',
    });
    expect(table.inbox.p2).toEqual([]);
    expect(table.room.options.mode === 'lastOneStanding' && table.room.options.aiCount).toBe(2);
  });

  test('only the host can change the options or start', () => {
    const table = new Table();
    table.host(LOS);
    table.guest();
    table.clear();
    table.send('p2', { t: 'options', options: { ...LOS, rounds: 1 } });
    table.send('p2', { t: 'start' });
    table.send('p2', { t: 'bot' });
    expect(table.room.options.mode === 'lastOneStanding' && table.room.options.rounds).toBe(5);
    expect(table.room.phase).toBe('lobby');
    expect(table.inbox).toEqual({ p1: [], p2: [] });
  });

  test('No start without a guest', () => {
    const table = new Table();
    table.host();
    table.send('p1', { t: 'start' });
    table.advance(1000);
    expect(table.room.phase).toBe('lobby');
    expect(table.room.match).toBeNull();
    expect(table.sent('p1', 'snap')).toEqual([]);
  });

  test('Guest leaves the lobby', () => {
    const table = new Table();
    const room = table.host();
    table.guest();
    table.drop('p2'); // closes the tab
    expect(table.last('p1')).toEqual({ t: 'lobby', guest: false });
    expect(room.hasGuest).toBe(false);
    expect(table.reg.join(room.code.toLowerCase())).toMatchObject({ room, seat: 'p2' });
  });

  test('a guest who leaves on purpose frees the seat for good', () => {
    const table = new Table();
    const room = table.host();
    table.guest();
    const token = table.token('p2');
    table.send('p2', { t: 'leave' });
    expect(table.last('p1')).toEqual({ t: 'lobby', guest: false });
    expect(table.reg.rejoin(room.code, token, table.now)).toEqual({ gone: true });
  });

  test('Idle lobby expires', () => {
    const table = new Table({ lobbyIdleMs: 60_000 });
    const room = table.host();
    table.guest();
    table.advance(59_000);
    expect(room.closed).toBe(false);
    table.advance(1_000);
    expect(room.closed).toBe(true);
    expect(table.last('p1')).toEqual({ t: 'closed', reason: 'expired' });
    expect(table.last('p2')).toEqual({ t: 'closed', reason: 'expired' });
    expect(table.reg.find(room.code)).toBeUndefined();
    expect(table.reg.join(room.code)).toEqual({ refused: 'noSuchGame' });
    expect(table.reg.size).toBe(0);
  });

  test("the host's lobby grace: back in time keeps the room", () => {
    const table = new Table();
    const room = table.host();
    table.guest();
    table.drop('p1');
    table.advance(SETTINGS.graceMs - 1000);
    expect(table.rejoin('p1')).toMatchObject({ room, seat: 'p1' });
    table.advance(10_000);
    expect(room.closed).toBe(false);
    table.send('p1', { t: 'start' });
    expect(room.phase).toBe('game');
  });

  test("the host's lobby grace: out of time closes the room, and the guest is told the host has left", () => {
    const table = new Table();
    const room = table.host();
    table.guest();
    table.drop('p1');
    table.advance(SETTINGS.graceMs);
    expect(room.closed).toBe(true);
    expect(table.last('p2')).toEqual({ t: 'closed', reason: 'hostLeft' });
    expect(table.reg.find(room.code)).toBeUndefined();
  });

  test('a host who leaves the lobby on purpose closes the room at once', () => {
    const table = new Table();
    const room = table.host();
    table.guest();
    table.send('p1', { t: 'leave' });
    expect(room.closed).toBe(true);
    expect(table.last('p2')).toEqual({ t: 'closed', reason: 'hostLeft' });
  });
});
