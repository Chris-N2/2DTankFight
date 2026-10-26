import { describe, expect, test } from 'vitest';
import { addShell, cfg, count, makeBoard, ofType, place, playing, R, retire, tank, world } from './helpers';

const COOLDOWN_TICKS = Math.round(cfg.fireCooldown * cfg.tickRate);

describe('simulation: firing shells', () => {
  test('Pressing fire launches a shell', () => {
    const state = playing();
    retire(state, 'ai1');
    place(state, 'p1', 300, 300, 0);
    const events = world(state, { p1: { fire: true } });
    const shots = ofType(events, 'shotFired');
    expect(shots).toHaveLength(1);
    expect(shots[0]!.tankId).toBe('p1');
    expect(state.shells).toHaveLength(1);
    const shell = state.shells[0]!;
    expect(shell.x).toBeCloseTo(300 + R + cfg.muzzleOffset);
    expect(shell.y).toBeCloseTo(300);
    expect(shell.vx).toBeCloseTo(cfg.shellSpeed);
    expect(shell.vy).toBeCloseTo(0);
  });

  test('Holding fire does not auto-fire', () => {
    const state = playing();
    retire(state, 'ai1');
    place(state, 'p1', 100, 300, 0);
    let shots = 0;
    for (let i = 0; i < COOLDOWN_TICKS * 5; i++)
      shots += count(world(state, { p1: { fire: true } }), 'shotFired');
    expect(shots).toBe(1);
  });

  test('Cooldown limits fire rate', () => {
    const state = playing();
    retire(state, 'ai1');
    place(state, 'p1', 100, 300, 0);
    let shots = count(world(state, { p1: { fire: true } }), 'shotFired');
    shots += count(world(state, { p1: { fire: false } }), 'shotFired');
    shots += count(world(state, { p1: { fire: true } }), 'shotFired');
    expect(shots).toBe(1);

    // Once the cooldown has elapsed, a fresh press fires again.
    for (let i = 0; i < COOLDOWN_TICKS; i++) world(state, { p1: { fire: false } });
    expect(count(world(state, { p1: { fire: true } }), 'shotFired')).toBe(1);
  });
});

describe('simulation: shells bounce once', () => {
  test('Bounce off a wall', () => {
    const ceiling = { x: 100, y: 200, w: 600, h: 20 };
    const state = playing(makeBoard([ceiling]));
    retire(state, 'p1', 'ai1');
    // "North-east" on screen: +x, -y (y grows downwards).
    addShell(state, 300, 300, -Math.PI / 4);
    let bounced = false;
    for (let i = 0; i < 60 && !bounced; i++) bounced = count(world(state), 'bounce') > 0;
    expect(bounced).toBe(true);
    const shell = state.shells[0]!;
    expect(shell.bounces).toBe(1);
    expect(shell.vx).toBeGreaterThan(0); // still heading east...
    expect(shell.vy).toBeGreaterThan(0); // ...but now south
    expect(shell.vx).toBeCloseTo(shell.vy); // angle of reflection equals angle of incidence
    expect(shell.y).toBeGreaterThan(ceiling.y + ceiling.h);
  });

  test('Second contact destroys the shell', () => {
    const wall = { x: 500, y: 0, w: 20, h: 600 };
    const state = playing(makeBoard([wall]));
    retire(state, 'p1', 'ai1');
    addShell(state, 300, 300, 0, { bounces: 1 });
    const events = [];
    for (let i = 0; i < 60; i++) events.push(...world(state));
    expect(state.shells).toHaveLength(0);
    expect(count(events, 'bounce')).toBe(0);
    expect(count(events, 'shellDestroyed')).toBe(1);
  });

  test('a shell bounces off the arena boundary too', () => {
    const state = playing();
    retire(state, 'p1', 'ai1');
    addShell(state, 700, 300, 0);
    let bounced = false;
    for (let i = 0; i < 30 && !bounced; i++) bounced = count(world(state), 'bounce') > 0;
    expect(bounced).toBe(true);
    expect(state.shells[0]!.vx).toBeLessThan(0);
  });

  test('No tunnelling', () => {
    const thin = { x: 400, y: 0, w: 1, h: 600 };
    const state = playing(makeBoard([thin]));
    retire(state, 'p1', 'ai1');
    // One tick moves a shell 6 units, so from x=397 it would end up past the 1-unit wall.
    addShell(state, 397, 300, 0);
    const events = world(state);
    expect(count(events, 'bounce')).toBe(1);
    expect(state.shells[0]!.x).toBeLessThan(400);
  });

  test('shells expire at the end of their lifetime', () => {
    const state = playing(makeBoard([], 4000, 600));
    retire(state, 'p1', 'ai1');
    addShell(state, 100, 300, 0);
    const lifetime = Math.round(cfg.shellLifetime * cfg.tickRate);
    for (let i = 0; i < lifetime - 1; i++) world(state);
    expect(state.shells).toHaveLength(1);
    world(state);
    expect(state.shells).toHaveLength(0);
  });

  test('Shells do not collide with each other', () => {
    const state = playing();
    retire(state, 'p1', 'ai1');
    addShell(state, 300, 300, 0); // eastwards; reaches (360, 300) after 10 ticks
    addShell(state, 360, 240, Math.PI / 2); // southwards; also reaches (360, 300) after 10 ticks
    const events = [];
    for (let i = 0; i < 20; i++) events.push(...world(state));
    expect(state.shells).toHaveLength(2);
    expect(events).toHaveLength(0);
    expect(state.shells[0]!.vx).toBeCloseTo(cfg.shellSpeed);
    expect(state.shells[1]!.vy).toBeCloseTo(cfg.shellSpeed);
  });
});

describe('simulation: shell hits and damage', () => {
  test('Hitting an opponent', () => {
    const state = playing();
    place(state, 'p1', 200, 300, 0);
    const target = place(state, 'ai1', 400, 300, Math.PI);
    const events = world(state, { p1: { fire: true } });
    for (let i = 0; i < 60; i++) events.push(...world(state));
    expect(target.hp).toBe(cfg.tankMaxHp - cfg.shellDamage);
    expect(state.shells).toHaveLength(0);
    const hits = ofType(events, 'hit');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ shooterId: 'p1', targetId: 'ai1', damage: cfg.shellDamage });
  });

  test('No self-hit on launch', () => {
    const state = playing();
    retire(state, 'ai1');
    const p1 = place(state, 'p1', 200, 300, 0);
    world(state, { p1: { fire: true } });
    for (let i = 0; i < 30; i++) world(state);
    expect(p1.hp).toBe(cfg.tankMaxHp);
  });

  test('Self-hit after a bounce', () => {
    const wall = { x: 400, y: 0, w: 20, h: 600 };
    const state = playing(makeBoard([wall]));
    retire(state, 'ai1');
    const p1 = place(state, 'p1', 300, 300, 0);
    const events = world(state, { p1: { fire: true } });
    for (let i = 0; i < 60; i++) events.push(...world(state));
    expect(count(events, 'bounce')).toBe(1);
    expect(p1.hp).toBe(cfg.tankMaxHp - cfg.shellDamage);
    expect(ofType(events, 'hit')[0]).toMatchObject({ shooterId: 'p1', targetId: 'p1' });
  });

  test('firing while pressed against a wall bounces straight back at the firer', () => {
    const wall = { x: 400, y: 0, w: 20, h: 600 };
    const state = playing(makeBoard([wall]));
    retire(state, 'ai1');
    const p1 = place(state, 'p1', 400 - R - 1, 300, 0);
    const events = world(state, { p1: { fire: true } });
    events.push(...world(state));
    expect(count(events, 'bounce')).toBe(1);
    expect(p1.hp).toBe(cfg.tankMaxHp - cfg.shellDamage);
  });
});

describe('simulation: elimination', () => {
  test('Tank destroyed', () => {
    const state = playing();
    place(state, 'p1', 200, 300, 0);
    const target = place(state, 'ai1', 400, 300, Math.PI);
    target.hp = 1;
    const events = world(state, { p1: { fire: true } });
    for (let i = 0; i < 60; i++) events.push(...world(state));
    expect(target.alive).toBe(false);
    const elim = ofType(events, 'eliminated');
    expect(elim).toHaveLength(1);
    expect(elim[0]).toMatchObject({ tankId: 'ai1', byId: 'p1' });
    // Eliminated tanks no longer block or get hit.
    const before = state.shells.length;
    world(state, { p1: { fire: true } });
    expect(state.shells.length).toBe(before + 1);
  });

  test('Shells outlive their tank', () => {
    const state = playing();
    const p1 = place(state, 'p1', 100, 300, 0);
    const target = place(state, 'ai1', 600, 300, Math.PI);
    world(state, { p1: { fire: true } });
    p1.hp = 0;
    const elim = ofType(world(state), 'eliminated');
    expect(elim.map((e) => e.tankId)).toEqual(['p1']);
    expect(state.shells).toHaveLength(1);
    const events = [];
    for (let i = 0; i < 120; i++) events.push(...world(state));
    expect(target.hp).toBe(cfg.tankMaxHp - cfg.shellDamage);
    expect(ofType(events, 'hit')[0]).toMatchObject({ shooterId: 'p1', targetId: 'ai1' });
  });

  test('Simultaneous elimination', () => {
    const state = playing();
    const a = place(state, 'p1', 200, 300, 0);
    const b = place(state, 'ai1', 400, 300, Math.PI);
    a.hp = 1;
    b.hp = 1;
    world(state, { p1: { fire: true }, ai1: { fire: true } });
    let elimTick: string[] = [];
    for (let i = 0; i < 60 && elimTick.length === 0; i++) {
      elimTick = ofType(world(state), 'eliminated').map((e) => e.tankId);
    }
    expect(elimTick.sort()).toEqual(['ai1', 'p1']);
    expect(tank(state, 'p1').alive).toBe(false);
    expect(tank(state, 'ai1').alive).toBe(false);
  });

  test('Point-blank trade', () => {
    for (const reversed of [false, true]) {
      const state = playing();
      if (reversed) state.tanks.reverse();
      const a = place(state, 'p1', 300, 300, 0);
      const b = place(state, 'ai1', 300 + 2 * R + 2, 300, Math.PI); // muzzles overlap the other tank
      a.hp = 1;
      b.hp = 1;
      const events = world(state, { p1: { fire: true }, ai1: { fire: true } });
      expect(count(events, 'shotFired')).toBe(2);
      expect(
        ofType(events, 'eliminated')
          .map((e) => e.tankId)
          .sort(),
      ).toEqual(['ai1', 'p1']);
    }
  });

  test('Destroyed tank still stops shells that tick', () => {
    const state = playing();
    place(state, 'p1', 100, 300, 0);
    const target = place(state, 'ai1', 400, 300, Math.PI);
    target.hp = 1;
    retire(state, 'p1'); // shells only; nobody behind the target either
    // Two shells arrive at the target in the same tick.
    addShell(state, 400 - R, 290, 0);
    addShell(state, 400 - R, 310, 0);
    const events = world(state);
    expect(count(events, 'hit')).toBe(2);
    expect(state.shells).toHaveLength(0);
    expect(ofType(events, 'eliminated').map((e) => e.tankId)).toEqual(['ai1']);
  });
});

describe('simulation: per-tank combat values', () => {
  test("Shells carry their tank's speed and damage", () => {
    const state = playing();
    const p1 = place(state, 'p1', 100, 300, 0);
    p1.shellSpeed = cfg.shellSpeed * 1.5;
    p1.shellDamage = 2;
    const target = place(state, 'ai1', 700, 300, Math.PI);
    target.maxHp = 5;
    target.hp = 5;

    world(state, { p1: { fire: true } });
    const shell = state.shells[0]!;
    expect(Math.hypot(shell.vx, shell.vy)).toBeCloseTo(cfg.shellSpeed * 1.5);
    const x0 = shell.x;
    world(state);
    expect(shell.x - x0).toBeCloseTo((cfg.shellSpeed * 1.5) / cfg.tickRate);

    const events = [];
    for (let i = 0; i < 120 && state.shells.length > 0; i++) events.push(...world(state));
    expect(ofType(events, 'hit')[0]).toMatchObject({ shooterId: 'p1', targetId: 'ai1', damage: 2 });
    expect(target.hp).toBe(3);
  });

  test('Defaults are equal', () => {
    const state = playing(makeBoard(), 4);
    expect(state.tanks).toHaveLength(5);
    for (const t of state.tanks) {
      expect(t).toMatchObject({
        maxHp: cfg.tankMaxHp,
        hp: cfg.tankMaxHp,
        shellDamage: cfg.shellDamage,
        shellSpeed: cfg.shellSpeed,
      });
    }
  });
});
