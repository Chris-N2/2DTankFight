import type { Clock, SocketLike } from '../src/net';

/** A clock the test moves on by hand, with timers that fire as it passes them. */
export class FakeClock implements Clock {
  time = 0;
  private timers: { at: number; fn: () => void; id: number }[] = [];
  private nextId = 0;

  now(): number {
    return this.time;
  }

  after(ms: number, fn: () => void): () => void {
    const id = this.nextId++;
    this.timers.push({ at: this.time + ms, fn, id });
    return () => (this.timers = this.timers.filter((t) => t.id !== id));
  }

  advance(ms: number): void {
    const end = this.time + ms;
    for (;;) {
      const due = this.timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.timers = this.timers.filter((t) => t !== due);
      this.time = due.at;
      due.fn();
    }
    this.time = end;
  }
}

/** A socket the test opens, closes and talks through. */
export class FakeSocket implements SocketLike {
  readyState = 0;
  readonly sent: string[] = [];
  closedByClient = false;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;

  constructor(readonly url: string) {}

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closedByClient = true;
    this.readyState = 3;
  }

  /** Messages sent, parsed. */
  get messages(): { t: string; [key: string]: unknown }[] {
    return this.sent.map((s) => JSON.parse(s));
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }

  receive(message: object): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  drop(code = 1006): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

/** Every socket made, newest last. */
export function socketFactory(): { make: (url: string) => FakeSocket; sockets: FakeSocket[] } {
  const sockets: FakeSocket[] = [];
  return {
    sockets,
    make: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
  };
}
