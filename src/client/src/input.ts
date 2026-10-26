import type { TankInput } from '@tank/sim';

/** Keys the game uses while a round is in progress (KeyboardEvent.code, so layout-independent). */
export const GAME_KEYS: ReadonlySet<string> = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'Space',
]);

/** Maps the set of currently pressed keys to a tank input. Opposing keys cancel out. */
export function inputFromKeys(pressed: ReadonlySet<string>): TankInput {
  const forward = pressed.has('ArrowUp') || pressed.has('KeyW');
  const back = pressed.has('ArrowDown') || pressed.has('KeyS');
  const left = pressed.has('ArrowLeft') || pressed.has('KeyA');
  const right = pressed.has('ArrowRight') || pressed.has('KeyD');
  return {
    throttle: forward === back ? 0 : forward ? 1 : -1,
    turn: left === right ? 0 : left ? -1 : 1,
    fire: pressed.has('Space'),
  };
}

/** The parts of a KeyboardEvent we use, so the handler can be tested without a DOM. */
export interface KeyEventLike {
  code: string;
  preventDefault(): void;
}

/** Tracks pressed game keys and samples them into a TankInput once per tick. */
export class KeyboardState {
  private readonly pressed = new Set<string>();
  /** While a game is active, game keys are captured so they don't scroll or otherwise affect the page. */
  active = false;

  onKeyDown(e: KeyEventLike): void {
    if (!GAME_KEYS.has(e.code)) return;
    if (this.active) e.preventDefault();
    this.pressed.add(e.code);
  }

  onKeyUp(e: KeyEventLike): void {
    if (!GAME_KEYS.has(e.code)) return;
    if (this.active) e.preventDefault();
    this.pressed.delete(e.code);
  }

  /** Releases everything — used when the window loses focus, so keys can't get stuck down. */
  clear(): void {
    this.pressed.clear();
  }

  sample(): TankInput {
    return inputFromKeys(this.pressed);
  }
}
