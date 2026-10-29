import { encode, parseServerMessage, type ClientMessage, type ServerMessage } from '@tank/protocol';
import type { MatchOptions } from '@tank/sim';
import { afterEach, describe, expect, test } from 'vitest';
import { WebSocket, type ClientOptions } from 'ws';
import { DEFAULTS, OPEN_ORIGINS_WARNING, type ServerConfig } from '../src/config';
import { launch, type Log } from '../src/launch';
import { startServer, type RunningServer, type ServerOptions } from '../src/server';
import { LOS, WAVES } from './harness';

const running: RunningServer[] = [];
const clients: Client[] = [];

afterEach(async () => {
  for (const c of clients.splice(0)) c.ws.terminate();
  await Promise.all(running.splice(0).map((s) => s.close()));
});

async function serve(
  config: Partial<ServerConfig> = {},
  options: ServerOptions = {},
): Promise<RunningServer> {
  const server = await startServer({ ...DEFAULTS, port: 0, ...config }, options);
  running.push(server);
  return server;
}

/** A real WebSocket client that keeps everything the server sends it. */
class Client {
  readonly messages: ServerMessage[] = [];
  closed = false;
  closeCode = 0;

  private constructor(readonly ws: WebSocket) {
    ws.on('message', (data) => {
      const msg = parseServerMessage(String(data));
      if (msg) this.messages.push(msg);
    });
    ws.on('close', (code) => {
      this.closed = true;
      this.closeCode = code;
    });
  }

  static open(server: RunningServer, options: ClientOptions = {}): Promise<Client> {
    const ws = new WebSocket(`ws://localhost:${server.port}`, options);
    const client = new Client(ws);
    clients.push(client);
    return new Promise((resolve, reject) => {
      ws.once('open', () => resolve(client));
      ws.once('error', reject);
    });
  }

  send(msg: ClientMessage): void {
    this.ws.send(encode(msg));
  }

  /** Waits for a message that matches, and returns it. */
  async next<T extends ServerMessage['t']>(
    t: T,
    match: (m: Extract<ServerMessage, { t: T }>) => boolean = () => true,
    timeoutMs = 8000,
  ): Promise<Extract<ServerMessage, { t: T }>> {
    await until(() => this.find(t, match) !== undefined, timeoutMs, `no ${t} message`);
    return this.find(t, match)!;
  }

  private find<T extends ServerMessage['t']>(
    t: T,
    match: (m: Extract<ServerMessage, { t: T }>) => boolean,
  ): Extract<ServerMessage, { t: T }> | undefined {
    return this.messages.find((m): m is Extract<ServerMessage, { t: T }> => m.t === t && match(m as never));
  }
}

async function until(done: () => boolean, timeoutMs: number, what: string): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (!done()) {
    if (Date.now() > end) throw new Error(`Timed out: ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** A host and a guest in a room. */
async function pair(
  server: RunningServer,
  options: MatchOptions = LOS,
): Promise<{ host: Client; guest: Client; code: string }> {
  const host = await Client.open(server);
  host.send({ t: 'create', options });
  const room = await host.next('room');
  const guest = await Client.open(server);
  guest.send({ t: 'join', code: room.code.toLowerCase() });
  await guest.next('room');
  await host.next('lobby', (m) => m.guest);
  return { host, guest, code: room.code };
}

describe('game server: over real WebSockets', () => {
  test('Healthy', async () => {
    const server = await serve();
    const res = await fetch(`http://localhost:${server.port}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', rooms: 0 });

    await pair(server);
    expect(await (await fetch(`http://localhost:${server.port}/health`)).json()).toEqual({
      status: 'ok',
      rooms: 1,
    });
    expect((await fetch(`http://localhost:${server.port}/elsewhere`)).status).toBe(404);
  });

  test('welcome says whether the test bot is available', async () => {
    for (const testBot of [false, true]) {
      const server = await serve({ testBot });
      const client = await Client.open(server);
      client.send({ t: 'hello' });
      expect(await client.next('welcome')).toEqual({ t: 'welcome', bot: testBot, version: 1 });
    }
  });

  test('Unknown site refused', async () => {
    const server = await serve({ allowedOrigins: ['https://example.com'] });
    await expect(Client.open(server, { origin: 'https://other.example' })).rejects.toThrow(/403/);
    await expect(Client.open(server)).rejects.toThrow(/403/); // no origin at all
    const allowed = await Client.open(server, { origin: 'https://example.com' });
    allowed.send({ t: 'hello' });
    await allowed.next('welcome');
  });

  test('with no allow-list every site may connect', async () => {
    const server = await serve({ allowedOrigins: null });
    await Client.open(server, { origin: 'https://anywhere.example' });
  });

  test('a message over 4 KB closes the socket', async () => {
    const server = await serve();
    const client = await Client.open(server);
    client.ws.send(JSON.stringify({ t: 'hello', padding: 'x'.repeat(5000) }));
    await until(() => client.closed, 5000, 'socket closed');
    expect(client.closeCode).toBe(1009);
  });

  test('refusals reach the client', async () => {
    const server = await serve({ maxRooms: 1 });
    const client = await Client.open(server);
    client.send({ t: 'join', code: 'ZZZZ' });
    expect(await client.next('refused')).toEqual({ t: 'refused', reason: 'noSuchGame' });
    client.send({ t: 'create', options: { ...LOS, aiCount: 4 } });
    expect(await client.next('refused', (m) => m.reason === 'invalid')).toMatchObject({
      detail: expect.any(String),
    });
    await pair(server);
    client.send({ t: 'create', options: LOS });
    expect(await client.next('refused', (m) => m.reason === 'busy')).toEqual({
      t: 'refused',
      reason: 'busy',
    });
  });

  test('a whole game: host, join, start, play, finish, play again', async () => {
    const server = await serve();
    const { host, guest, code } = await pair(server, { ...LOS, aiCount: 1, rounds: 1 });
    host.send({ t: 'start' });
    for (const c of [host, guest]) {
      await c.next('board');
      await c.next('snap', (s) => s.phase === 'countdown');
    }
    await host.next('snap', (s) => s.phase === 'playing');
    host.send({ t: 'input', throttle: 1, turn: 0.2, fire: true, mortar: false });
    guest.send({ t: 'input', throttle: -1, turn: 0, fire: false, mortar: false });
    await guest.next('snap', (s) => s.events.some((e) => e.type === 'shotFired' && e.tankId === 'p1'));

    // Finish it: everyone but the host is out.
    const match = server.registry.find(code)!.match!;
    for (const t of match.tanks) if (t.id !== 'p1') t.alive = false;
    const result = { phase: 'gameOver', result: 'win', winnerId: 'p1' };
    expect(await host.next('snap', (s) => s.phase === 'gameOver')).toMatchObject(result);
    expect(await guest.next('snap', (s) => s.phase === 'gameOver')).toMatchObject(result);

    host.messages.length = 0;
    guest.messages.length = 0;
    host.send({ t: 'playAgain' });
    await guest.next('snap', (s) => s.phase === 'countdown' && s.tick === 0);
    await host.next('snap', (s) => s.phase === 'countdown' && s.tick === 0);
  }, 20_000);

  test('a drop and a rejoin: freeze, then a 3-2-1, then play', async () => {
    const server = await serve();
    const { host, guest, code } = await pair(server, WAVES);
    const token = guest.messages.find((m) => m.t === 'room')!;
    host.send({ t: 'start' });
    await guest.next('snap');

    guest.ws.terminate(); // the Wi-Fi goes
    expect(await host.next('frozen')).toMatchObject({ seat: 'p2', until: 15_000 });

    const back = await Client.open(server);
    back.send({ t: 'rejoin', code, token: token.t === 'room' ? token.token : '' });
    expect((await back.next('room')).seat).toBe('p2');
    await back.next('board');
    await back.next('snap');
    expect(await back.next('resume')).toEqual({ t: 'resume', at: 3000 });
    expect(await host.next('resume')).toEqual({ t: 'resume', at: 3000 });
    const tick = server.registry.find(code)!.match!.tick;
    await back.next('snap', (s) => s.tick > tick, 6000);
  }, 20_000);

  test('a refresh that takes the seat over closes the old socket', async () => {
    const server = await serve();
    const { guest, code } = await pair(server);
    const room = guest.messages.find((m) => m.t === 'room');
    const fresh = await Client.open(server);
    fresh.send({ t: 'rejoin', code, token: room?.t === 'room' ? room.token : '' });
    await fresh.next('room');
    await until(() => guest.closed, 5000, 'old socket closed');
    expect(server.registry.find(code)!.hasGuest).toBe(true);
  });

  test('a socket that stops answering pings is treated as a drop', async () => {
    const server = await serve({}, { pingMs: 100 });
    const host = await Client.open(server);
    host.send({ t: 'create', options: LOS });
    await host.next('room');
    const guest = await Client.open(server, { autoPong: false });
    guest.send({ t: 'join', code: (host.messages[0] as { code: string }).code });
    await host.next('lobby', (m) => m.guest);
    // A guest gone from the lobby frees the seat, and the host is told.
    await host.next('lobby', (m) => !m.guest, 2000);
  });

  test('leaving on purpose', async () => {
    const server = await serve();
    const { host, guest } = await pair(server);
    host.send({ t: 'start' });
    await host.next('snap');
    guest.send({ t: 'leave' });
    expect(await host.next('snap', (s) => s.phase === 'gameOver')).toMatchObject({
      forfeit: true,
      winnerId: 'p1',
    });
  });

  test('playing the test bot', async () => {
    const server = await serve({ testBot: true });
    const host = await Client.open(server);
    host.send({ t: 'create', options: WAVES });
    await host.next('room');
    host.send({ t: 'bot' });
    await host.next('board');
    const snap = await host.next('snap');
    expect(snap.tanks.filter((t) => t.kind === 'human').map((t) => t.id)).toEqual(['p1', 'p2']);
  });
});

describe('game server: start-up', () => {
  function capture(): Log & { lines: string[] } {
    const lines: string[] = [];
    return {
      lines,
      info: (m) => lines.push(`info: ${m}`),
      warn: (m) => lines.push(`warn: ${m}`),
      error: (m) => lines.push(`error: ${m}`),
    };
  }

  test('Bad setting: nothing starts, and the variable is named', async () => {
    const log = capture();
    expect(await launch({ MAX_ROOMS: 'lots' }, log)).toBeNull();
    expect(log.lines).toHaveLength(1);
    expect(log.lines[0]).toMatch(/^error: .*MAX_ROOMS is invalid/);
  });

  test('no allow-list: it starts, with a warning', async () => {
    const log = capture();
    const server = await launch({ PORT: '0' }, log);
    running.push(server!);
    expect(log.lines[0]).toBe(`warn: ${OPEN_ORIGINS_WARNING}`);
    expect(log.lines[1]).toMatch(/^info: Tank Command server listening on port \d+/);
  });

  test('with an allow-list: no warning', async () => {
    const log = capture();
    const server = await launch({ PORT: '0', ALLOWED_ORIGINS: 'https://example.com' }, log);
    running.push(server!);
    expect(log.lines.some((l) => l.startsWith('warn'))).toBe(false);
  });
});
