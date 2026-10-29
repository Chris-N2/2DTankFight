import type { MatchOptions } from '@tank/sim';
import { afterEach, describe, expect, test } from 'vitest';
import { WebSocket } from 'ws';
import { DEFAULTS } from '../../server/src/config';
import { startServer, type RunningServer } from '../../server/src/server';
import { Connection, type Clock, type SeatStore, type SocketLike, type StoredSeat } from '../src/net';
import { OnlineSession } from '../src/session';

// The client's online session against the real server, in-process, over real WebSockets: everything but the DOM.

const LOS: MatchOptions = {
  mode: 'lastOneStanding',
  aiCount: 1,
  rounds: 1,
  mortars: true,
  maps: { kind: 'random' },
  humans: 2,
};

const clock: Clock = {
  now: () => performance.now(),
  after: (ms, fn) => {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
  },
};

let server: RunningServer | null = null;
const sessions: OnlineSession[] = [];

afterEach(async () => {
  for (const s of sessions.splice(0)) s.leave();
  await server?.close();
  server = null;
});

function store(): SeatStore & { seat: StoredSeat | null } {
  return {
    seat: null,
    load() {
      return this.seat;
    },
    save(seat) {
      this.seat = seat;
    },
    clear() {
      this.seat = null;
    },
  };
}

/** A player's session, with the sockets it opened (so a test can pull the plug on one). */
function player(
  begin: (deps: ConstructorParameters<typeof OnlineSession>[1]) => OnlineSession,
  seats = store(),
): { session: OnlineSession; sockets: WebSocket[]; seats: typeof seats } {
  const url = `ws://localhost:${server!.port}`;
  const sockets: WebSocket[] = [];
  const session = begin({
    server: url,
    connect: (events) =>
      new Connection(
        url,
        (u) => {
          const ws = new WebSocket(u);
          sockets.push(ws);
          return ws as unknown as SocketLike;
        },
        clock,
        events,
      ),
    store: seats,
    now: () => performance.now(),
    changed: () => {},
  });
  sessions.push(session);
  return { session, sockets, seats };
}

async function until(done: () => boolean, what: string, timeoutMs = 8000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (!done()) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('online play, end to end against the real server', () => {
  test('host, join by code, change options, start, play, finish, rematch, back to the lobby, leave', async () => {
    server = await startServer({ ...DEFAULTS, port: 0 });
    const host = player((deps) => OnlineSession.host(LOS, deps));
    await until(() => host.session.phase === 'lobby', 'the host’s lobby');
    expect(host.session.code).toMatch(/^[A-Z2-9]{4}$/);

    const guest = player((deps) => OnlineSession.join(host.session.code!.toLowerCase(), deps));
    await until(() => guest.session.phase === 'lobby' && host.session.guest, 'the guest to join');
    expect(guest.session.seat).toBe('p2');

    host.session.setOptions({ ...LOS, mortars: false });
    await until(() => guest.session.options?.mortars === false, 'the options to reach the guest');

    host.session.start();
    await until(() => host.session.phase === 'game' && guest.session.phase === 'game', 'the game to start');

    // Both play back the same game; each sees the other as the second human.
    await until(() => guest.session.mirror.latest?.phase === 'playing', 'the countdown', 10_000);
    host.session.sendInput({ throttle: 1, turn: 0.2, fire: true }, performance.now());
    const start = guest.session.mirror.latest!.tanks.find((t) => t.id === 'p1')!;
    await until(() => {
      const now = guest.session.mirror.latest!.tanks.find((t) => t.id === 'p1')!;
      return Math.hypot(now.x - start.x, now.y - start.y) > 20;
    }, 'the host’s tank to move on the guest’s screen');

    // Finish it: everyone but the guest is out.
    for (const t of server.registry.find(host.session.code!)!.match!.tanks)
      if (t.id !== 'p2') t.alive = false;
    await until(
      () =>
        host.session.mirror.latest?.phase === 'gameOver' && guest.session.mirror.latest?.phase === 'gameOver',
      'the result',
    );
    expect(guest.session.mirror.latest!.winnerId).toBe('p2');

    host.session.playAgain();
    await until(() => host.session.gameId === 2 && guest.session.gameId === 2, 'the rematch');
    expect(guest.session.mirror.latest!.phase).toBe('countdown');

    for (const t of server.registry.find(host.session.code!)!.match!.tanks)
      if (t.id !== 'p1') t.alive = false;
    await until(() => host.session.mirror.latest?.phase === 'gameOver', 'the second result', 10_000);
    host.session.toLobby();
    await until(() => host.session.phase === 'lobby' && guest.session.phase === 'lobby', 'back to the lobby');

    host.session.leave();
    await until(() => guest.session.phase === 'ended', 'the guest to be told');
    expect(guest.session.notice).toBe('The host has left the game.');
  }, 40_000);

  test('a blip: the guest’s connection drops, both freeze, it reconnects by itself, and play resumes', async () => {
    server = await startServer({ ...DEFAULTS, port: 0 });
    const host = player((deps) =>
      OnlineSession.host({ ...LOS, mode: 'waves', startAiCount: 1 } as MatchOptions, deps),
    );
    await until(() => host.session.phase === 'lobby', 'the lobby');
    const guest = player((deps) => OnlineSession.join(host.session.code!, deps));
    await until(() => host.session.guest, 'the guest');
    host.session.start();
    await until(() => guest.session.phase === 'game', 'the game');

    guest.sockets.at(-1)!.terminate(); // the Wi-Fi goes
    await until(() => guest.session.reconnecting, 'the guest to notice');
    await until(() => host.session.othersDeadline !== null, 'the host to see the freeze');
    await until(
      () => !guest.session.reconnecting && guest.session.resumeAt !== null,
      'the guest to get back',
      10_000,
    );
    await until(() => host.session.resumeAt !== null, 'the host’s 3-2-1');
    expect(guest.sockets.length).toBeGreaterThan(1);
    expect(guest.session.seat).toBe('p2');

    const tick = host.session.mirror.latest!.tick;
    await until(() => host.session.mirror.latest!.tick > tick, 'play to resume', 8000);
  }, 30_000);

  test('a reload rejoins the same seat', async () => {
    server = await startServer({ ...DEFAULTS, port: 0 });
    const host = player((deps) => OnlineSession.host(LOS, deps));
    await until(() => host.session.phase === 'lobby', 'the lobby');
    const guest = player((deps) => OnlineSession.join(host.session.code!, deps));
    await until(() => host.session.guest, 'the guest');
    host.session.start();
    await until(() => host.session.phase === 'game', 'the game');

    // The host's tab reloads: the old page's socket goes, and a new page finds its seat in the tab's storage.
    const kept = host.seats.seat!;
    host.sockets.at(-1)!.terminate();
    const again = player((deps) => OnlineSession.rejoin(kept, deps), host.seats);
    await until(
      () => again.session.phase === 'game' && again.session.resumeAt !== null,
      'the host to be back',
    );
    expect(again.session.seat).toBe('p1');
    await until(() => guest.session.resumeAt !== null, 'the guest’s 3-2-1');
  }, 30_000);

  test('the test bot, when the server offers it', async () => {
    server = await startServer({ ...DEFAULTS, port: 0, testBot: true });
    const host = player((deps) =>
      OnlineSession.host({ ...LOS, mode: 'waves', startAiCount: 1 } as MatchOptions, deps),
    );
    await until(() => host.session.phase === 'lobby' && host.session.botOffered, 'the lobby, with a bot');
    host.session.playBot();
    await until(() => host.session.phase === 'game', 'the game');
    await until(
      () => (host.session.mirror.latest?.tanks.filter((t) => t.kind === 'human').length ?? 0) === 2,
      'two humans',
    );
  }, 20_000);
});
