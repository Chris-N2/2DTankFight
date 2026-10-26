import { describe, expect, test, vi } from 'vitest';
import { combineInputs, FireLatch, inputFromKeys, KeyboardState, menuActionForKey } from '../src/input';
import { BUTTON, inputFromGamepad } from '../src/gamepad';

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

describe('combining devices', () => {
  test('Keyboard and gamepad together', () => {
    const keyboard = inputFromKeys(keys('KeyW'));
    const gamepad = { throttle: 0 as const, turn: 0.4, fire: false };
    expect(combineInputs(keyboard, gamepad)).toEqual({ throttle: 1, turn: 0.4, fire: false });
  });

  test('the stronger input wins, equal opposites cancel, and fire from either device counts', () => {
    expect(
      combineInputs({ throttle: 0, turn: -0.3, fire: false }, { throttle: 0, turn: 1, fire: true }),
    ).toEqual({
      throttle: 0,
      turn: 1,
      fire: true,
    });
    expect(
      combineInputs({ throttle: 1, turn: -1, fire: false }, { throttle: -1, turn: 1, fire: false }),
    ).toEqual({
      throttle: 0,
      turn: 0,
      fire: false,
    });
    expect(combineInputs()).toEqual({ throttle: 0, turn: 0, fire: false });
  });
});

describe('fire latch', () => {
  test('Starting a game does not fire', () => {
    const aHeld = inputFromGamepad({
      axes: [0, 0],
      buttons: Array.from({ length: 17 }, (_, i) => ({
        pressed: i === BUTTON.A,
        value: i === BUTTON.A ? 1 : 0,
      })),
    });
    const released = { throttle: 0 as const, turn: 0, fire: false };
    for (const held of [aHeld, inputFromKeys(keys('Space'))]) {
      const latch = new FireLatch();
      latch.arm();
      expect(latch.apply(held).fire).toBe(false); // still held from pressing Start
      expect(latch.apply(held).fire).toBe(false);
      expect(latch.apply(released).fire).toBe(false);
      expect(latch.apply(held).fire).toBe(true); // a fresh press fires
    }
  });

  test('an unarmed latch passes input straight through, other fields included', () => {
    const latch = new FireLatch();
    const input = { throttle: 1 as const, turn: -0.5, fire: true };
    expect(latch.apply(input)).toEqual(input);
    latch.arm();
    expect(latch.apply(input)).toEqual({ ...input, fire: false });
  });
});

describe('keyboard menus', () => {
  test('Menus with the keyboard: arrows and W/A/S/D move like the d-pad', () => {
    expect(['ArrowUp', 'KeyW'].map(menuActionForKey)).toEqual(['up', 'up']);
    expect(['ArrowDown', 'KeyS'].map(menuActionForKey)).toEqual(['down', 'down']);
    expect(['ArrowLeft', 'KeyA'].map(menuActionForKey)).toEqual(['left', 'left']);
    expect(['ArrowRight', 'KeyD'].map(menuActionForKey)).toEqual(['right', 'right']);
  });

  test('Enter, Space and Tab are left to the browser and the focused button', () => {
    for (const code of ['Enter', 'Space', 'Tab', 'Escape', 'KeyQ']) expect(menuActionForKey(code)).toBeNull();
  });
});
