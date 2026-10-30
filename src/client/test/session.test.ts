import type { ServerMessage } from '@tank/protocol';
import { PROVING_GROUND, type MatchOptions } from '@tank/sim';
import { describe, expect, test } from 'vitest';
import { Connection, type SeatStore, type StoredSeat } from '../src/net';
import { OnlineSession } from '../src/session';
import { FakeClock, socketFactory, type FakeSocket } from './fakes';

const SERVER = 'ws://localhost:8080';
const OPTIONS: MatchOptions = {
  mode: 'lastOneStanding',
  aiCount: 2,
  rounds: 5,
  mortars: true,
  maps: { kind: 'random' },
  humans: 2,
};

function memoryStore(): SeatStore & { seat: StoredSeat | null } {
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

/** A session against fake sockets and a fake clock, with everything it does recorded. */
function setUp(begin: (deps: ConstructorParameters<typeof OnlineSession>[1]) => OnlineSession) {
  const clock = new FakeClock();
  const { make, sockets } = socketFactory();
  const store = memoryStore();
  let joined = 0;
  let changes = 0;
  const session = begin({
    server: SERVER,
    connect: (events) => new Connection(SERVER, make, clock, events),
    store,
    now: () => clock.now(),
    changed: () => changes++,
    joined: () => joined++,
  });
  const socket = (): FakeSocket => sockets.at(-1)!;
  const receive = (...messages: ServerMessage[]): void => {
    for (const m of messages) socket().receive(m);
  };
  return { session, clock, sockets, socket, store, receive, joined: () => joined, changes: () => changes };
}

const ROOM_HOST: ServerMessage = {
  t: 'room',
  code: 'KTXW',
  seat: 'p1',
  token: 'host-token',
  options: OPTIONS,
  guest: false,
};
const ROOM_GUEST: ServerMessage = {
  t: 'room',
  code: 'KTXW',
  seat: 'p2',
  token: 'guest-token',
  options: OPTIONS,
  guest: true,
};
const SNAP = {
  t: 'snap',
  tick: 0,
  phase: 'countdown',
  phaseTicks: 180,
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
} as const satisfies ServerMessage;

function hosting() {
  const t = setUp((deps) => OnlineSession.host(OPTIONS, deps));
  t.socket().open();
  t.receive({ t: 'welcome', bot: true, version: 1 }, ROOM_HOST);
  return t;
}

function guestInGame() {
  const t = setUp((deps) => OnlineSession.join('KTXW', deps));
  t.socket().open();
  t.receive(
    { t: 'welcome', bot: false, version: 1 },
    ROOM_GUEST,
    { t: 'board', board: PROVING_GROUND },
    SNAP,
  );
  return t;
}

describe('online play: hosting and joining', () => {
  test('Hosting', () => {
    const t = setUp((deps) => OnlineSession.host(OPTIONS, deps));
    expect(t.session.phase).toBe('connecting');
    t.socket().open();
    expect(t.socket().messages).toEqual([{ t: 'hello' }, { t: 'create', options: OPTIONS }]);
    t.receive({ t: 'welcome', bot: false, version: 1 }, ROOM_HOST);
    expect(t.session).toMatchObject({ phase: 'lobby', code: 'KTXW', seat: 'p1', guest: false, isHost: true });
    expect(t.store.seat).toEqual({ server: SERVER, code: 'KTXW', seat: 'p1', token: 'host-token' });
    expect(t.joined()).toBe(1);
  });

  test('Joining by code', () => {
    const t = setUp((deps) => OnlineSession.join('KTXW', deps));
    t.socket().open();
    expect(t.socket().messages).toEqual([{ t: 'hello' }, { t: 'join', code: 'KTXW' }]);
    t.receive(ROOM_GUEST);
    expect(t.session).toMatchObject({ phase: 'lobby', seat: 'p2', options: OPTIONS, isHost: false });
  });

  test('Wrong code', () => {
    const t = setUp((deps) => OnlineSession.join('ZZZZ', deps));
    t.socket().open();
    t.receive({ t: 'refused', reason: 'noSuchGame' });
    expect(t.session.phase).toBe('ended');
    expect(t.session.notice).toMatch(/no game with that code/);
    expect(t.socket().closedByClient).toBe(true);
  });

  test('other refusals say why', () => {
    for (const [reason, text] of [
      ['full', /full/],
      ['started', /already started/],
      ['busy', /busy/],
    ] as const) {
      const t = setUp((deps) => OnlineSession.join('KTXW', deps));
      t.socket().open();
      t.receive({ t: 'refused', reason });
      expect(t.session.notice).toMatch(text);
    }
  });

  test('Server down', () => {
    const t = setUp((deps) => OnlineSession.host(OPTIONS, deps));
    t.socket().drop();
    expect(t.session.phase).toBe('ended');
    expect(t.session.notice).toBe("The online server isn't available right now. Single-player still works.");
    t.clock.advance(60_000);
    expect(t.sockets).toHaveLength(1);
  });

  test('a server that never answers is down too', () => {
    const t = setUp((deps) => OnlineSession.host(OPTIONS, deps));
    t.clock.advance(5000);
    expect(t.session.notice).toMatch(/isn't available/);
  });
});

describe('online play: the lobby', () => {
  test('Options change under the guest', () => {
    const t = setUp((deps) => OnlineSession.join('KTXW', deps));
    t.socket().open();
    t.receive(ROOM_GUEST, { t: 'options', options: { ...OPTIONS, rounds: 3 } });
    expect(t.session.options).toEqual({ ...OPTIONS, rounds: 3 });
  });

  test('the host sends option changes; the guest cannot', () => {
    const t = hosting();
    t.session.setOptions({ ...OPTIONS, mortars: false });
    expect(t.socket().messages.at(-1)).toEqual({ t: 'options', options: { ...OPTIONS, mortars: false } });
    const g = setUp((deps) => OnlineSession.join('KTXW', deps));
    g.socket().open();
    g.receive(ROOM_GUEST);
    g.session.setOptions({ ...OPTIONS, mortars: false });
    expect(g.socket().messages.map((m) => m.t)).toEqual(['hello', 'join']);
  });

  test("Can't start alone", () => {
    const t = hosting();
    t.session.start();
    expect(t.socket().messages.map((m) => m.t)).not.toContain('start');
    t.receive({ t: 'lobby', guest: true });
    expect(t.session.guest).toBe(true);
    t.session.start();
    expect(t.socket().messages.at(-1)).toEqual({ t: 'start' });
  });

  test('Practice against the bot, when the server offers one', () => {
    const t = hosting(); // welcome said bot: true
    expect(t.session.botOffered).toBe(true);
    t.session.playBot();
    expect(t.socket().messages.at(-1)).toEqual({ t: 'bot' });
  });

  test('a game against the bot is marked as one, until the bot is sent away', () => {
    const t = hosting();
    expect(t.session.vsBot).toBe(false);
    t.session.playBot();
    t.receive({ t: 'board', board: PROVING_GROUND }, SNAP);
    expect(t.session).toMatchObject({ phase: 'game', vsBot: true });
    t.receive({ t: 'lobby', guest: false });
    expect(t.session.vsBot).toBe(false);
  });

  test('a refresh during a bot game still knows it is one', () => {
    const t = hosting();
    t.session.playBot();
    expect(t.store.seat).toMatchObject({ code: 'KTXW', seat: 'p1', vsBot: true });
    // The page reloads: a new session from the stored seat.
    const u = setUp((deps) => OnlineSession.rejoin(t.store.seat!, deps));
    expect(u.session.vsBot).toBe(true);
    u.socket().open();
    // What goes to the server is just the seat's code and token.
    expect(u.socket().messages).toEqual([{ t: 'hello' }, { t: 'rejoin', code: 'KTXW', token: 'host-token' }]);
    u.receive(ROOM_HOST, { t: 'board', board: PROVING_GROUND }, { ...SNAP, tick: 900 });
    expect(u.session).toMatchObject({ phase: 'game', vsBot: true });
    expect(u.store.seat?.vsBot).toBe(true);
    // Play again with the bot: a new game, still against the bot.
    u.receive({ ...SNAP, tick: 0 });
    expect(u.session).toMatchObject({ phase: 'game', vsBot: true });
    // Back in the lobby the bot has gone, and the stored seat forgets it.
    u.receive({ t: 'lobby', guest: false });
    expect(u.session.vsBot).toBe(false);
    expect(u.store.seat?.vsBot).toBeUndefined();
  });

  test('a refresh during a game with a guest is not a bot game', () => {
    const seat: StoredSeat = { server: SERVER, code: 'KTXW', seat: 'p1', token: 'host-token' };
    expect(setUp((deps) => OnlineSession.rejoin(seat, deps)).session.vsBot).toBe(false);
  });

  test('a refused bot leaves no mark', () => {
    const t = hosting();
    t.session.playBot();
    t.receive({ t: 'refused', reason: 'invalid', detail: 'The test bot is switched off on this server.' });
    expect(t.session.vsBot).toBe(false);
  });

  test('a game against a guest is not a bot game', () => {
    const t = guestInGame();
    expect(t.session.vsBot).toBe(false);
  });

  test('No bot unless the server offers one', () => {
    const t = setUp((deps) => OnlineSession.host(OPTIONS, deps));
    t.socket().open();
    t.receive({ t: 'welcome', bot: false, version: 1 }, ROOM_HOST);
    expect(t.session.botOffered).toBe(false);
    t.session.playBot();
    expect(t.socket().messages.map((m) => m.t)).not.toContain('bot');
  });

  test('a refused option is shown in the lobby, which stays open', () => {
    const t = hosting();
    t.receive({ t: 'refused', reason: 'invalid', detail: 'Number of AI opponents must be between 1 and 3.' });
    expect(t.session.phase).toBe('lobby');
    expect(t.session.lobbyNote).toBe('Number of AI opponents must be between 1 and 3.');
  });

  test('back after a drop in the lobby, but the room has gone: told so, not left in a dead lobby', () => {
    const t = hosting();
    t.socket().drop();
    t.clock.advance(500);
    t.socket().open();
    expect(t.socket().messages.at(-1)).toEqual({ t: 'rejoin', code: 'KTXW', token: 'host-token' });
    t.receive({ t: 'refused', reason: 'noSuchGame' });
    expect(t.session).toMatchObject({ phase: 'ended', notice: 'The game you were in has ended.' });
  });

  test('back after a drop in the lobby, but someone else has the seat: told so', () => {
    const t = setUp((deps) => OnlineSession.join('KTXW', deps));
    t.socket().open();
    t.receive(ROOM_GUEST);
    t.socket().drop();
    t.clock.advance(500);
    t.socket().open();
    t.receive({ t: 'refused', reason: 'full' });
    expect(t.session).toMatchObject({ phase: 'ended', notice: 'That game is full.' });
  });

  test('The host leaves', () => {
    const t = setUp((deps) => OnlineSession.join('KTXW', deps));
    t.socket().open();
    t.receive(ROOM_GUEST, { t: 'closed', reason: 'hostLeft' });
    expect(t.session.phase).toBe('ended');
    expect(t.session.notice).toBe('The host has left the game.');
    expect(t.store.seat).toBeNull();
  });

  test('leaving the lobby', () => {
    const t = hosting();
    t.session.leave();
    expect(t.socket().messages.at(-1)).toEqual({ t: 'leave' });
    expect(t.session).toMatchObject({ phase: 'ended', notice: null });
    expect(t.store.seat).toBeNull();
  });
});

describe('online play: playing', () => {
  test('the first snapshot starts the game', () => {
    const t = guestInGame();
    expect(t.session.phase).toBe('game');
    expect(t.session.gameId).toBe(1);
    expect(t.session.mirror.frame(0).state?.board).toEqual(PROVING_GROUND);
  });

  test('controls are sent while playing, and only then', () => {
    const t = hosting();
    const idle = { throttle: 0 as const, turn: 0, fire: false };
    t.session.sendInput(idle, 0);
    expect(t.socket().messages.map((m) => m.t)).not.toContain('input');
    const g = guestInGame();
    g.session.sendInput({ ...idle, throttle: 1 }, 0);
    expect(g.socket().messages.at(-1)).toEqual({
      t: 'input',
      throttle: 1,
      turn: 0,
      fire: false,
      mortar: false,
    });
  });

  test('Leaving deliberately', () => {
    const t = guestInGame();
    t.session.leave();
    expect(t.socket().messages.at(-1)).toEqual({ t: 'leave' });
    expect(t.session.phase).toBe('ended');
    expect(t.session.notice).toBeNull();
    expect(t.socket().closedByClient).toBe(true);
  });

  test('the other player dropping freezes, with their time counting down, then a 3-2-1', () => {
    const t = guestInGame();
    t.clock.advance(1000);
    t.receive({ t: 'frozen', seat: 'p1', until: 15_000 });
    expect(t.session.othersDeadline).toBe(16_000);
    t.clock.advance(4000);
    t.receive({ t: 'resume', at: 3000 });
    expect(t.session.resumeAt).toBe(8000);
    t.session.tick(7999);
    expect(t.session.resumeAt).toBe(8000);
    t.session.tick(8000);
    expect(t.session).toMatchObject({ resumeAt: null, othersDeadline: null });
  });

  test('A blip: reconnects by itself, rejoins the seat, and resumes after a 3-2-1', () => {
    const t = guestInGame();
    t.socket().drop();
    expect(t.session.reconnecting).toBe(true);
    expect(t.session.phase).toBe('game');
    t.clock.advance(500);
    expect(t.sockets).toHaveLength(2);
    t.socket().drop(); // still down
    t.clock.advance(1000);
    t.socket().open();
    expect(t.socket().messages).toEqual([
      { t: 'hello' },
      { t: 'rejoin', code: 'KTXW', token: 'guest-token' },
    ]);
    t.receive(
      ROOM_GUEST,
      { t: 'board', board: PROVING_GROUND },
      { ...SNAP, tick: 400 },
      { t: 'resume', at: 3000 },
    );
    expect(t.session).toMatchObject({ reconnecting: false, phase: 'game', resumeAt: t.clock.now() + 3000 });
    expect(t.session.gameId).toBe(2); // picked up afresh
  });

  test('Reload to rejoin: a stored seat is taken back before anything else', () => {
    const seat: StoredSeat = { server: SERVER, code: 'KTXW', seat: 'p1', token: 'host-token' };
    const t = setUp((deps) => OnlineSession.rejoin(seat, deps));
    t.socket().open();
    expect(t.socket().messages).toEqual([{ t: 'hello' }, { t: 'rejoin', code: 'KTXW', token: 'host-token' }]);
    t.receive(
      ROOM_HOST,
      { t: 'board', board: PROVING_GROUND },
      { ...SNAP, tick: 900 },
      { t: 'resume', at: 3000 },
    );
    expect(t.session).toMatchObject({ phase: 'game', seat: 'p1', resumeAt: 3000 });
  });

  test('Gone for good, from the side of the one who dropped: told the game went on without them', () => {
    const seat: StoredSeat = { server: SERVER, code: 'KTXW', seat: 'p2', token: 'guest-token' };
    const t = setUp((deps) => OnlineSession.rejoin(seat, deps));
    t.socket().open();
    t.receive({ t: 'closed', reason: 'gone' });
    expect(t.session).toMatchObject({ phase: 'ended', notice: 'The game went on without you.' });
    const u = setUp((deps) => OnlineSession.rejoin(seat, deps));
    u.socket().open();
    u.receive({ t: 'refused', reason: 'noSuchGame' });
    expect(u.session.notice).toBe('The game you were in has ended.');
  });

  test('a connection that cannot be restored ends the session, saying so', () => {
    const t = guestInGame();
    t.socket().drop();
    for (let i = 0; i < 400; i++) {
      const n = t.sockets.length;
      t.clock.advance(100);
      if (t.sockets.length > n) t.socket().drop();
    }
    expect(t.session).toMatchObject({ phase: 'ended', notice: 'Lost the connection to the online server.' });
  });
});

describe('online play: after a game', () => {
  test('Rematch: the host plays again, and the new game starts afresh', () => {
    const t = hosting();
    t.receive(
      { t: 'lobby', guest: true },
      { t: 'board', board: PROVING_GROUND },
      { ...SNAP, tick: 3000, phase: 'gameOver' },
    );
    t.session.playAgain();
    expect(t.socket().messages.at(-1)).toEqual({ t: 'playAgain' });
    t.receive({ t: 'board', board: PROVING_GROUND }, SNAP);
    expect(t.session.gameId).toBe(2);
    expect(t.session.mirror.frame(0).state?.tick).toBe(0);
  });

  test('Settings: back to the lobby together', () => {
    const t = hosting();
    t.receive({ t: 'lobby', guest: true }, { t: 'board', board: PROVING_GROUND }, SNAP);
    t.session.toLobby();
    expect(t.socket().messages.at(-1)).toEqual({ t: 'toLobby' });
    t.receive({ t: 'lobby', guest: true });
    expect(t.session).toMatchObject({ phase: 'lobby', guest: true });
  });

  test('The guest heads off: the host is in the lobby, waiting, with the same code', () => {
    const t = hosting();
    t.receive({ t: 'lobby', guest: true }, { t: 'board', board: PROVING_GROUND }, SNAP);
    t.receive({ t: 'lobby', guest: false });
    expect(t.session).toMatchObject({ phase: 'lobby', guest: false, code: 'KTXW' });
  });

  test('the guest leaving mid-game empties their seat: no playing again until someone joins', () => {
    const t = hosting();
    t.receive({ t: 'lobby', guest: true }, { t: 'board', board: PROVING_GROUND }, SNAP);
    t.receive({
      ...SNAP,
      tick: 900,
      phase: 'gameOver',
      forfeit: true,
      events: [{ type: 'left', tankId: 'p2' }],
    });
    expect(t.session.guest).toBe(false);
    t.session.playAgain();
    expect(t.socket().messages.map((m) => m.t)).not.toContain('playAgain');
    t.session.toLobby();
    expect(t.socket().messages.at(-1)).toEqual({ t: 'toLobby' });
  });

  test('only the host decides what is next', () => {
    const t = guestInGame();
    t.session.playAgain();
    t.session.toLobby();
    t.session.start();
    expect(t.socket().messages.map((m) => m.t)).toEqual(['hello', 'join']);
  });

  test('the host leaving after the game: the guest keeps the result on screen', () => {
    const t = guestInGame();
    t.receive({ ...SNAP, tick: 2000, phase: 'gameOver' }, { t: 'closed', reason: 'hostLeft' });
    expect(t.session).toMatchObject({ phase: 'game', hostLeft: true });
    expect(t.store.seat).toBeNull();
    // The socket is closed on purpose: no reconnecting.
    t.socket().drop();
    t.clock.advance(30_000);
    expect(t.sockets).toHaveLength(1);
  });
});
