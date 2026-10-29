import { randomBytes, randomInt } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  encode,
  MAX_MESSAGE_BYTES,
  parseClientMessage,
  PROTOCOL_VERSION,
  type ClientMessage,
  type SeatId,
  type ServerMessage,
} from '@tank/protocol';
import { WebSocket, WebSocketServer } from 'ws';
import type { ServerConfig } from './config';
import type { Outgoing, Room } from './room';
import { RoomRegistry, type RegistryDeps, type Seated } from './rooms';

export interface ServerOptions {
  /** Where rooms get their randomness; real randomness unless a test says otherwise. */
  deps?: RegistryDeps;
  /** How often rooms are ticked, ms. */
  tickMs?: number;
  /** How often each socket is pinged; one that hasn't answered the previous ping has dropped, ms. */
  pingMs?: number;
}

export interface RunningServer {
  /** The port listened on: the configured one, or the one chosen for port 0. */
  port: number;
  registry: RoomRegistry;
  close(): Promise<void>;
}

/** One socket: whether it answered the last ping, and the seat it sits in, if any. */
interface Connection {
  alive: boolean;
  room?: Room;
  seat?: SeatId;
}

export const REAL_DEPS: RegistryDeps = {
  token: () => randomBytes(18).toString('base64url'),
  seed: () => randomInt(0, 0xffffffff),
  random: Math.random,
};

/**
 * Starts the multiplayer server: `/health` over HTTP, and the game over WebSockets on the same port. The shell only
 * moves messages between sockets and rooms; everything that decides anything is in `Room`.
 */
export function startServer(config: ServerConfig, options: ServerOptions = {}): Promise<RunningServer> {
  const { deps = REAL_DEPS, tickMs = 4, pingMs = 5000 } = options;
  const registry = new RoomRegistry(
    {
      maxRooms: config.maxRooms,
      graceMs: config.graceSeconds * 1000,
      lobbyIdleMs: config.lobbyIdleMinutes * 60_000,
      testBot: config.testBot,
    },
    deps,
  );
  const connections = new Map<WebSocket, Connection>();
  const seated = new Map<Room, Partial<Record<SeatId, WebSocket>>>();
  const now = (): number => performance.now();

  const http = createServer((req: IncomingMessage, res: ServerResponse) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (req.method === 'GET' && path === '/health') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ status: 'ok', rooms: registry.size }));
    } else {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Tank Command multiplayer server. Nothing to see here: open the game instead.\n');
    }
  });

  const allowed = config.allowedOrigins;
  const wss = new WebSocketServer({
    server: http,
    maxPayload: MAX_MESSAGE_BYTES,
    verifyClient: (info: { origin: string }, done: (ok: boolean, code?: number, reason?: string) => void) =>
      allowed === null || allowed.includes(info.origin) ? done(true) : done(false, 403, 'Origin not allowed'),
  });

  function send(ws: WebSocket | undefined, message: ServerMessage): void {
    if (ws?.readyState === WebSocket.OPEN) ws.send(encode(message));
  }

  function deliver(room: Room, out: Outgoing[]): void {
    const sockets = seated.get(room);
    for (const { seat, message } of out) send(sockets?.[seat], message);
    if (room.closed) {
      for (const ws of Object.values(sockets ?? {})) unseat(ws);
      seated.delete(room);
      registry.sweep();
    }
  }

  function seat(ws: WebSocket, conn: Connection, { room, seat: id, out }: Seated): void {
    const sockets = seated.get(room) ?? {};
    const previous = sockets[id];
    if (previous && previous !== ws) {
      // A refresh or a new connection has taken the seat over: the old socket is finished with.
      unseat(previous);
      previous.close(4000, 'Seat taken over');
    }
    sockets[id] = ws;
    seated.set(room, sockets);
    conn.room = room;
    conn.seat = id;
    deliver(room, out);
  }

  function unseat(ws: WebSocket): void {
    const conn = connections.get(ws);
    if (!conn?.room || !conn.seat) return;
    const sockets = seated.get(conn.room);
    if (sockets?.[conn.seat] === ws) delete sockets[conn.seat];
    conn.room = undefined;
    conn.seat = undefined;
  }

  function handle(ws: WebSocket, conn: Connection, msg: ClientMessage): void {
    const { room, seat: id } = conn;
    switch (msg.t) {
      case 'hello':
        send(ws, { t: 'welcome', bot: config.testBot, version: PROTOCOL_VERSION });
        return;
      case 'create':
      case 'join':
      case 'rejoin': {
        if (room) return; // already in a room
        const result =
          msg.t === 'create'
            ? registry.create(msg.options, now())
            : msg.t === 'join'
              ? registry.join(msg.code)
              : registry.rejoin(msg.code, msg.token, now());
        if ('room' in result) seat(ws, conn, result);
        else if ('gone' in result) send(ws, { t: 'closed', reason: 'gone' });
        else
          send(ws, {
            t: 'refused',
            reason: result.refused,
            ...(result.detail ? { detail: result.detail } : {}),
          });
        return;
      }
      default:
        if (!room || !id) return;
        deliver(room, room.handle(id, msg, now()));
        if (msg.t === 'leave') unseat(ws);
    }
  }

  wss.on('connection', (ws: WebSocket) => {
    const conn: Connection = { alive: true };
    connections.set(ws, conn);
    ws.on('pong', () => (conn.alive = true));
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      const msg = parseClientMessage(String(data));
      if (msg) handle(ws, conn, msg);
    });
    ws.on('close', () => {
      const { room, seat: id } = conn;
      unseat(ws);
      connections.delete(ws);
      if (room && id && !room.closed) deliver(room, room.disconnect(id, now()));
    });
    ws.on('error', () => ws.terminate());
  });

  const ticker = setInterval(() => {
    for (const { room, out } of registry.tick(now())) deliver(room, out);
  }, tickMs);
  const pinger = setInterval(() => {
    for (const [ws, conn] of connections) {
      // No answer to the last ping: treat it as a drop. Terminating fires 'close', which tells the room.
      if (!conn.alive) ws.terminate();
      else {
        conn.alive = false;
        ws.ping();
      }
    }
  }, pingMs);

  return new Promise((resolve, reject) => {
    http.once('error', reject);
    http.listen(config.port, () => {
      resolve({
        port: (http.address() as AddressInfo).port,
        registry,
        close: () =>
          new Promise<void>((done) => {
            clearInterval(ticker);
            clearInterval(pinger);
            for (const ws of connections.keys()) ws.terminate();
            wss.close(() => http.close(() => done()));
          }),
      });
    });
  });
}
