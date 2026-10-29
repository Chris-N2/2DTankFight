import { isRoomCode } from '@tank/protocol';
import { describe, expect, test } from 'vitest';
import { LOS, Table, WAVES } from './harness';

describe('game server: rooms and codes', () => {
  test('A room is created', () => {
    const table = new Table();
    const room = table.host(WAVES);
    const reply = table.last('p1');
    expect(reply).toMatchObject({ t: 'room', code: room.code, seat: 'p1', guest: false });
    expect(reply).toHaveProperty('token');
    expect(room.code).toHaveLength(4);
    expect(room.code).not.toMatch(/[01OIL]/);
    expect(isRoomCode(room.code)).toBe(true);
    expect(table.reg.size).toBe(1);
  });

  test('codes are unique among the rooms open', () => {
    const table = new Table({ maxRooms: 200 });
    const codes = new Set<string>();
    for (let i = 0; i < 200; i++) codes.add(table.host(LOS).code);
    expect(codes.size).toBe(200);
  });

  test('a room is always for two humans, whatever the client asked', () => {
    const table = new Table();
    const room = table.host({ ...LOS, humans: 1 });
    expect(room.options.humans).toBe(2);
  });

  test('Invalid options refused', () => {
    const table = new Table();
    const made = table.reg.create({ ...LOS, aiCount: 4 }, 0);
    expect(made).toEqual({ refused: 'invalid', detail: 'Number of AI opponents must be between 1 and 3.' });
    expect(table.reg.size).toBe(0);
    expect(table.reg.create({} as never, 0)).toMatchObject({ refused: 'invalid' });
  });

  test('Server busy', () => {
    const table = new Table({ maxRooms: 3 });
    for (let i = 0; i < 3; i++) table.host();
    expect(table.reg.create(LOS, 0)).toEqual({ refused: 'busy' });
    expect(table.reg.size).toBe(3);
  });

  test('a closed room makes way for a new one', () => {
    const table = new Table({ maxRooms: 1 });
    table.host();
    table.send('p1', { t: 'leave' });
    expect('room' in table.reg.create(LOS, 0)).toBe(true);
  });

  test('Codes ignore case', () => {
    const table = new Table();
    const room = table.host();
    const joined = table.reg.join(room.code.toLowerCase());
    expect(joined).toMatchObject({ room, seat: 'p2' });
    expect(table.reg.find(` ${room.code.toLowerCase()} `)).toBe(room);
  });
});

describe('game server: joining', () => {
  test('Joining a lobby', () => {
    const table = new Table();
    const room = table.host(WAVES);
    table.guest();
    expect(table.last('p1')).toEqual({ t: 'lobby', guest: true });
    expect(table.last('p2')).toMatchObject({
      t: 'room',
      code: room.code,
      seat: 'p2',
      options: { ...WAVES, humans: 2 },
      guest: true,
    });
    expect(table.token('p2')).not.toBe(table.token('p1'));
  });

  test('Unknown code', () => {
    const table = new Table();
    const room = table.host();
    const unknown = room.code === 'ZZZZ' ? 'YYYY' : 'ZZZZ';
    expect(table.reg.join(unknown)).toEqual({ refused: 'noSuchGame' });
    expect(table.reg.join('')).toEqual({ refused: 'noSuchGame' });
  });

  test('Room already full', () => {
    const table = new Table();
    const room = table.host();
    table.guest();
    expect(table.reg.join(room.code)).toEqual({ refused: 'full' });
  });

  test('a game that has started takes no more players', () => {
    const table = new Table();
    const room = table.host();
    table.send('p1', { t: 'bot' });
    expect(room.phase).toBe('game');
    expect(table.reg.join(room.code)).toEqual({ refused: 'started' });
  });
});

describe('game server: seats and rejoining', () => {
  test('Refresh mid-lobby', () => {
    const table = new Table();
    const room = table.host();
    table.guest();
    const token = table.token('p2');
    table.drop('p2');
    expect(table.last('p1')).toEqual({ t: 'lobby', guest: false });
    table.clear();

    expect(table.rejoin('p2', token)).toMatchObject({ room, seat: 'p2' });
    expect(table.last('p2')).toMatchObject({ t: 'room', seat: 'p2', token, guest: true });
    expect(table.last('p1')).toEqual({ t: 'lobby', guest: true });
    expect(room.hasGuest).toBe(true);
  });

  test('a token takes its seat over even before the old connection has closed', () => {
    const table = new Table();
    const room = table.host();
    table.guest();
    const token = table.token('p1');
    table.clear();
    expect(table.rejoin('p1', token)).toMatchObject({ room, seat: 'p1' });
    expect(table.last('p1')).toMatchObject({ t: 'room', seat: 'p1', guest: true });
    expect(table.inbox.p2).toEqual([]);
  });

  test('Wrong token', () => {
    const table = new Table();
    const first = table.host();
    table.guest();
    const firstGuest = table.token('p2');
    const second = table.host();

    expect(table.reg.rejoin(second.code, firstGuest, 0)).toEqual({ refused: 'invalid' });
    expect(table.reg.rejoin(second.code, '', 0)).toEqual({ refused: 'invalid' });
    expect(table.reg.rejoin(second.code, 'made-up', 0)).toEqual({ refused: 'invalid' });
    expect(second.hasGuest).toBe(false);
    expect(first.hasGuest).toBe(true);
    expect(table.reg.rejoin('ZZZZ', firstGuest, 0)).toEqual({ refused: 'noSuchGame' });
  });

  test('a guest who dropped out of the lobby can only come back while the seat is free', () => {
    const table = new Table();
    const room = table.host();
    table.guest();
    const token = table.token('p2');
    table.drop('p2');
    table.guest(); // someone else takes the seat
    expect(table.reg.rejoin(room.code, token, 0)).toEqual({ refused: 'full' });
  });
});
