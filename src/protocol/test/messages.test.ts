import { describe, expect, test } from 'vitest';
import {
  CODE_ALPHABET,
  encode,
  isRoomCode,
  normalizeCode,
  parseClientMessage,
  parseServerMessage,
  randomCode,
  type ServerMessage,
} from '../src';

const OPTIONS = { mode: 'waves', startAiCount: 2, mortars: true, maps: { kind: 'random' }, humans: 2 };

describe('client messages', () => {
  test('every known message parses', () => {
    for (const t of ['hello', 'start', 'bot', 'playAgain', 'toLobby', 'leave']) {
      expect(parseClientMessage(JSON.stringify({ t }))).toEqual({ t });
    }
    expect(parseClientMessage(JSON.stringify({ t: 'create', options: OPTIONS }))).toEqual({
      t: 'create',
      options: OPTIONS,
    });
    expect(parseClientMessage(JSON.stringify({ t: 'options', options: OPTIONS }))).toEqual({
      t: 'options',
      options: OPTIONS,
    });
    expect(parseClientMessage('{"t":"join","code":"ktxw"}')).toEqual({ t: 'join', code: 'ktxw' });
    expect(parseClientMessage('{"t":"rejoin","code":"KTXW","token":"abc"}')).toEqual({
      t: 'rejoin',
      code: 'KTXW',
      token: 'abc',
    });
    expect(parseClientMessage('{"t":"input","throttle":-1,"turn":0.5,"fire":true,"mortar":false}')).toEqual({
      t: 'input',
      throttle: -1,
      turn: 0.5,
      fire: true,
      mortar: false,
    });
  });

  test('unknown and malformed messages are dropped', () => {
    expect(parseClientMessage('not json')).toBeNull();
    expect(parseClientMessage('[1,2,3]')).toBeNull();
    expect(parseClientMessage('null')).toBeNull();
    expect(parseClientMessage('{"type":"input"}')).toBeNull();
    expect(parseClientMessage('{"t":42}')).toBeNull();
    // Claims about the game are not messages the server knows (Controls only).
    expect(parseClientMessage('{"t":"position","x":100,"y":100}')).toBeNull();
    expect(parseClientMessage('{"t":"hit","targetId":"p2"}')).toBeNull();
  });

  test('controls of the wrong type become idle; turn is left for the simulation to clamp', () => {
    expect(
      parseClientMessage('{"t":"input","throttle":"forward","turn":"left","fire":1,"mortar":"yes"}'),
    ).toEqual({ t: 'input', throttle: 0, turn: 0, fire: false, mortar: false });
    expect(parseClientMessage('{"t":"input"}')).toEqual({
      t: 'input',
      throttle: 0,
      turn: 0,
      fire: false,
      mortar: false,
    });
    expect(parseClientMessage('{"t":"input","throttle":2,"turn":7}')).toMatchObject({ throttle: 0, turn: 7 });
    expect(parseClientMessage('{"t":"input","turn":1e999}')).toMatchObject({ turn: 0 });
  });

  test('codes, tokens and options of the wrong type become values the server refuses', () => {
    expect(parseClientMessage('{"t":"join","code":1234}')).toEqual({ t: 'join', code: '' });
    expect(parseClientMessage('{"t":"rejoin","code":null,"token":{}}')).toEqual({
      t: 'rejoin',
      code: '',
      token: '',
    });
    expect(parseClientMessage('{"t":"create","options":"lots"}')).toEqual({ t: 'create', options: {} });
  });

  test('only option fields are kept', () => {
    const parsed = parseClientMessage(
      JSON.stringify({ t: 'create', options: { ...OPTIONS, tanks: [], hp: 99 } }),
    );
    expect(parsed).toEqual({ t: 'create', options: OPTIONS });
  });
});

describe('server messages', () => {
  const snap = {
    t: 'snap',
    tick: 10,
    phase: 'countdown',
    phaseTicks: 50,
    round: 1,
    roundsPlayed: 0,
    scores: { humans: { p1: 0, p2: 0 }, ai: 0 },
    lastRoundOutcome: null,
    lastRoundScorers: [],
    result: null,
    winnerId: null,
    forfeit: false,
    waves: null,
    tanks: [],
    shells: [],
    mortarShells: [],
    events: [],
  };
  const board = { id: 'b', name: 'B', width: 1200, height: 800, obstacles: [], spawns: [] };
  const good: ServerMessage[] = [
    { t: 'welcome', bot: true, version: 1 },
    { t: 'room', code: 'KTXW', seat: 'p2', token: 'tok', options: OPTIONS as never, guest: true },
    { t: 'refused', reason: 'full' },
    { t: 'refused', reason: 'invalid', detail: 'Number of AI opponents must be between 1 and 3.' },
    { t: 'options', options: OPTIONS as never },
    { t: 'board', board },
    snap as ServerMessage,
    { t: 'frozen', seat: 'p1', until: 15000 },
    { t: 'resume', at: 3000 },
    { t: 'lobby', guest: false },
    { t: 'closed', reason: 'hostLeft' },
  ];

  test('every message the server sends comes back the same', () => {
    for (const msg of good) expect(parseServerMessage(encode(msg))).toEqual(msg);
  });

  test('malformed messages are ignored', () => {
    const bad = [
      'garbage',
      '{"t":"welcome","bot":"yes","version":1}',
      '{"t":"room","code":"KTXW","seat":"p3","token":"x","options":{},"guest":true}',
      '{"t":"refused","reason":"bored"}',
      '{"t":"board","board":{"id":"b"}}',
      JSON.stringify({ ...snap, tanks: 'none' }),
      '{"t":"frozen","seat":"p2"}',
      '{"t":"resume","at":"soon"}',
      '{"t":"closed","reason":"why not"}',
      '{"t":"party"}',
    ];
    for (const raw of bad) expect(parseServerMessage(raw), raw).toBeNull();
  });
});

describe('room codes', () => {
  test('the alphabet has no characters that are easily confused', () => {
    for (const c of '0O1IL') expect(CODE_ALPHABET).not.toContain(c);
  });

  test('random codes are 4 characters from the alphabet', () => {
    let seed = 1;
    const random = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 500; i++) {
      const code = randomCode(random);
      expect(isRoomCode(code), code).toBe(true);
    }
    expect(randomCode(() => 0.999999)).toBe('9999');
  });

  test('codes ignore case and surrounding spaces', () => {
    expect(normalizeCode(' ktxw ')).toBe('KTXW');
    expect(isRoomCode(normalizeCode('ktxw'))).toBe(true);
    expect(isRoomCode('KTX')).toBe(false);
    expect(isRoomCode('KTX0')).toBe(false);
  });
});
