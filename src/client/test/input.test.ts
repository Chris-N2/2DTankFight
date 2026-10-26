import { describe, expect, test, vi } from 'vitest';
import { inputFromKeys, KeyboardState } from '../src/input';

const keys = (...codes: string[]): Set<string> => new Set(codes);
const event = (code: string) => ({ code, preventDefault: vi.fn() });

describe('keyboard controls', () => {
  test('Both key sets work', () => {
    expect(inputFromKeys(keys('KeyW')).throttle).toBe(1);
    expect(inputFromKeys(keys('ArrowUp')).throttle).toBe(1);
    expect(inputFromKeys(keys('KeyS')).throttle).toBe(-1);
    expect(inputFromKeys(keys('ArrowDown')).throttle).toBe(-1);
    expect(inputFromKeys(keys('KeyA')).turn).toBe(-1);
    expect(inputFromKeys(keys('ArrowLeft')).turn).toBe(-1);
    expect(inputFromKeys(keys('KeyD')).turn).toBe(1);
    expect(inputFromKeys(keys('ArrowRight')).turn).toBe(1);
    expect(inputFromKeys(keys('Space')).fire).toBe(true);
  });

  test('no keys means idle, and opposing keys cancel out', () => {
    expect(inputFromKeys(keys())).toEqual({ throttle: 0, turn: 0, fire: false });
    expect(inputFromKeys(keys('KeyW', 'ArrowDown', 'KeyA', 'ArrowRight'))).toEqual({
      throttle: 0,
      turn: 0,
      fire: false,
    });
  });

  test('Keys do not scroll the page', () => {
    const kb = new KeyboardState();
    kb.active = true;
    for (const code of ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      const e = event(code);
      kb.onKeyDown(e);
      expect(e.preventDefault).toHaveBeenCalled();
    }
  });

  test('other keys, and game keys outside a game, are left alone', () => {
    const kb = new KeyboardState();
    kb.active = true;
    const other = event('KeyQ');
    kb.onKeyDown(other);
    expect(other.preventDefault).not.toHaveBeenCalled();
    kb.active = false;
    const space = event('Space');
    kb.onKeyDown(space);
    expect(space.preventDefault).not.toHaveBeenCalled();
  });

  test('pressing and releasing keys drives the sampled input', () => {
    const kb = new KeyboardState();
    kb.onKeyDown(event('KeyW'));
    kb.onKeyDown(event('Space'));
    expect(kb.sample()).toEqual({ throttle: 1, turn: 0, fire: true });
    kb.onKeyUp(event('Space'));
    expect(kb.sample().fire).toBe(false);
  });

  test('clearing releases every key (no stuck keys after losing focus)', () => {
    const kb = new KeyboardState();
    kb.onKeyDown(event('KeyW'));
    kb.onKeyDown(event('ArrowLeft'));
    kb.clear();
    expect(kb.sample()).toEqual({ throttle: 0, turn: 0, fire: false });
  });
});
