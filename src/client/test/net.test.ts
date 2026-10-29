import { describe, expect, test } from 'vitest';
import { readServerTag, serverAddress } from '../src/address';
import { onLoad } from '../src/lobby';
import {
  backoffMs,
  Connection,
  CONNECT_TIMEOUT_MS,
  HEARTBEAT_MS,
  InputSender,
  RECONNECT_FOR_MS,
  SEAT_KEY,
  SEAT_TAKEN_OVER,
  sessionSeatStore,
  type ConnectionFailure,
  type StoredSeat,
} from '../src/net';
import { FakeClock, socketFactory } from './fakes';

const SERVER = 'wss://tank-server.example.net';
const SEAT: StoredSeat = { server: SERVER, code: 'KTXW', seat: 'p2', token: 'secret' };

describe('hosting: naming a multiplayer server', () => {
  test('Turning online play on', () => {
    expect(serverAddress({ serverTag: SERVER, hostname: 'example.com', dev: false })).toBe(SERVER);
    expect(serverAddress({ serverTag: `  ${SERVER} `, hostname: 'example.com', dev: true })).toBe(SERVER);
    const page = { querySelector: () => ({ content: SERVER }) } as unknown as Document;
    expect(readServerTag(page)).toBe(SERVER);
  });

  test('Static as ever: no tag, no server, and nothing to connect to', () => {
    const page = { querySelector: () => null } as unknown as Document;
    expect(readServerTag(page)).toBeNull();
    expect(serverAddress({ serverTag: null, hostname: 'example.com', dev: false })).toBeNull();
    expect(serverAddress({ serverTag: '', hostname: 'example.com', dev: false })).toBeNull();
    // Even a join link or a stored seat makes no connection without a server.
    expect(onLoad(null, SEAT, 'https://example.com/?join=KTXW')).toEqual({ t: 'none' });
  });

  test('the development server finds a local multiplayer server, on the same host for LAN play', () => {
    expect(serverAddress({ serverTag: null, hostname: 'localhost', dev: true })).toBe('ws://localhost:8080');
    expect(serverAddress({ serverTag: null, hostname: '192.168.1.20', dev: true })).toBe(
      'ws://192.168.1.20:8080',
    );
  });
});

describe('online play: at page load', () => {
  test('a stored seat on this server is rejoined before any join link', () => {
    expect(onLoad(SERVER, SEAT, 'https://example.com/?join=ABCD')).toEqual({ t: 'rejoin', seat: SEAT });
  });

  test('a join link joins, in any letter case', () => {
    expect(onLoad(SERVER, null, 'https://example.com/games/?ref=menu&join=ktxw')).toEqual({
      t: 'join',
      code: 'KTXW',
    });
  });

  test('a seat on another server is ignored, and nothing at all means nothing happens', () => {
    expect(onLoad(SERVER, { ...SEAT, server: 'wss://elsewhere' }, 'https://example.com/')).toEqual({
      t: 'none',
    });
    expect(onLoad(SERVER, null, 'https://example.com/?join=nonsense!')).toEqual({ t: 'none' });
  });
});

/** A connection with fake sockets and time, recording what it reports. */
function connection(): {
  conn: Connection;
  clock: FakeClock;
  sockets: ReturnType<typeof socketFactory>['sockets'];
  log: string[];
} {
  const clock = new FakeClock();
  const { make, sockets } = socketFactory();
  const log: string[] = [];
  const conn = new Connection(SERVER, make, clock, {
    open: (re) => log.push(re ? 'reopen' : 'open'),
    message: (m) => log.push(`message:${m.t}`),
    dropped: () => log.push('dropped'),
    failed: (why: ConnectionFailure) => log.push(`failed:${why}`),
  });
  conn.connect();
  return { conn, clock, sockets, log };
}

describe('net: the connection', () => {
  test('opens, sends and receives', () => {
    const { conn, sockets, log } = connection();
    expect(sockets).toHaveLength(1);
    expect(sockets[0]!.url).toBe(SERVER);
    sockets[0]!.open();
    conn.send({ t: 'hello' });
    expect(sockets[0]!.messages).toEqual([{ t: 'hello' }]);
    sockets[0]!.receive({ t: 'welcome', bot: false, version: 1 });
    sockets[0]!.onmessage?.({ data: 'garbage' });
    expect(log).toEqual(['open', 'message:welcome']);
  });

  test('a server that never answers is unreachable', () => {
    const { clock, log, sockets } = connection();
    clock.advance(CONNECT_TIMEOUT_MS);
    expect(log).toEqual(['failed:unreachable']);
    expect(sockets).toHaveLength(1);
  });

  test('a server that refuses straight away is unreachable, and nothing is retried', () => {
    const { clock, log, sockets } = connection();
    sockets[0]!.drop();
    clock.advance(60_000);
    expect(log).toEqual(['failed:unreachable']);
    expect(sockets).toHaveLength(1);
  });

  test('reconnect timing: 0.5 s, 1 s, 2 s, then every 4 s', () => {
    expect([0, 1, 2, 3, 4, 5].map(backoffMs)).toEqual([500, 1000, 2000, 4000, 4000, 4000]);
    const { clock, log, sockets } = connection();
    sockets[0]!.open();
    sockets[0]!.drop();
    expect(log).toEqual(['open', 'dropped']);

    const tries: number[] = [];
    for (let t = 0; t < 8000; t += 100) {
      const before = sockets.length;
      clock.advance(100);
      if (sockets.length > before) {
        tries.push(clock.now());
        sockets.at(-1)!.drop(); // still no network
      }
    }
    expect(tries).toEqual([500, 1500, 3500, 7500]);
  });

  test('back in: reports a reopen, and the next drop starts the backoff afresh', () => {
    const { clock, log, sockets } = connection();
    sockets[0]!.open();
    sockets[0]!.drop();
    clock.advance(500);
    sockets[1]!.drop();
    clock.advance(1000);
    sockets[2]!.open();
    expect(log).toEqual(['open', 'dropped', 'reopen']);
    sockets[2]!.drop();
    clock.advance(499);
    expect(sockets).toHaveLength(3);
    clock.advance(1);
    expect(sockets).toHaveLength(4);
  });

  test('gives up once it has been away too long', () => {
    const { clock, log, sockets } = connection();
    sockets[0]!.open();
    sockets[0]!.drop();
    for (let t = 0; t < RECONNECT_FOR_MS + 10_000; t += 100) {
      const before = sockets.length;
      clock.advance(100);
      if (sockets.length > before) sockets.at(-1)!.drop();
    }
    expect(log.at(-1)).toBe('failed:lost');
    const count = sockets.length;
    clock.advance(60_000);
    expect(sockets).toHaveLength(count);
  });

  test('a seat taken over elsewhere is not fought for', () => {
    const { clock, log, sockets } = connection();
    sockets[0]!.open();
    sockets[0]!.drop(SEAT_TAKEN_OVER);
    clock.advance(30_000);
    expect(log).toEqual(['open', 'failed:replaced']);
    expect(sockets).toHaveLength(1);
  });

  test('closing on purpose stops everything', () => {
    const { conn, clock, log, sockets } = connection();
    sockets[0]!.open();
    conn.close();
    expect(sockets[0]!.closedByClient).toBe(true);
    sockets[0]!.drop();
    clock.advance(30_000);
    expect(log).toEqual(['open']);
    expect(sockets).toHaveLength(1);
  });

  test('nothing is sent while away', () => {
    const { conn, sockets } = connection();
    sockets[0]!.open();
    sockets[0]!.drop();
    conn.send({ t: 'start' });
    expect(sockets[0]!.sent).toEqual([]);
  });
});

describe('net: sending controls', () => {
  const idle = { throttle: 0 as const, turn: 0, fire: false, mortar: false };

  test('sent when they change, and not otherwise until the heartbeat', () => {
    const sent: unknown[] = [];
    const sender = new InputSender((m) => sent.push(m));
    sender.update(idle, 0);
    sender.update(idle, 16);
    sender.update(idle, 100);
    expect(sent).toHaveLength(1);
    sender.update({ ...idle, throttle: 1 }, 116);
    sender.update({ ...idle, throttle: 1, fire: true }, 132);
    expect(sent).toEqual([
      { t: 'input', ...idle },
      { t: 'input', ...idle, throttle: 1 },
      { t: 'input', ...idle, throttle: 1, fire: true },
    ]);
  });

  test('a heartbeat at least every 250 ms', () => {
    const sent: number[] = [];
    let now = 0;
    const sender = new InputSender(() => sent.push(now));
    for (now = 0; now <= 1000; now += 16) sender.update(idle, now);
    expect(sent[0]).toBe(0);
    for (let i = 1; i < sent.length; i++)
      expect(sent[i]! - sent[i - 1]!).toBeLessThanOrEqual(HEARTBEAT_MS + 16);
    expect(sent.length).toBeGreaterThanOrEqual(4);
  });

  test('a missing mortar is sent as not held', () => {
    const sent: unknown[] = [];
    new InputSender((m) => sent.push(m)).update({ throttle: -1, turn: 0.5, fire: false }, 0);
    expect(sent).toEqual([{ t: 'input', throttle: -1, turn: 0.5, fire: false, mortar: false }]);
  });
});

describe('net: the seat store', () => {
  function storage(): Storage & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    } as unknown as Storage & { data: Map<string, string> };
  }

  test('keeps a seat, and forgets it', () => {
    const s = storage();
    const store = sessionSeatStore(() => s);
    expect(store.load()).toBeNull();
    store.save(SEAT);
    expect(JSON.parse(s.data.get(SEAT_KEY)!)).toEqual(SEAT);
    expect(store.load()).toEqual(SEAT);
    store.clear();
    expect(store.load()).toBeNull();
  });

  test('ignores anything that is not a seat, and copes with blocked storage', () => {
    const s = storage();
    s.data.set(SEAT_KEY, '{"server":"x","code":"KTXW","seat":"p9","token":"t"}');
    expect(sessionSeatStore(() => s).load()).toBeNull();
    s.data.set(SEAT_KEY, 'not json');
    expect(sessionSeatStore(() => s).load()).toBeNull();
    const blocked = sessionSeatStore(() => {
      throw new Error('SecurityError');
    });
    expect(blocked.load()).toBeNull();
    expect(() => blocked.save(SEAT)).not.toThrow();
    expect(() => blocked.clear()).not.toThrow();
  });
});
