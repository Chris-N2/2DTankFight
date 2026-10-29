import type { SimEvent } from '@tank/sim';

/** A purely visual effect, in world coordinates, timed in real milliseconds. */
interface Effect {
  kind: 'flash' | 'spark' | 'ring' | 'explosion' | 'mud';
  x: number;
  y: number;
  start: number;
  duration: number;
  /** Debris for explosions and sparks: direction (radians) and speed (units/s) per particle. */
  particles: { angle: number; speed: number; size: number }[];
  color: string;
  /** How far a mud splash spreads. */
  radius: number;
}

const SPARK_COLOR = '#ffe9a8';
const CLANG_COLOR = '#c8d4e0';
const FLASH_COLOR = '#fff4c2';
const HIT_FLASH_MS = 120;
const LAUNCH_COLOR = '#d9d2bf';
const MUD_COLOR = '#6b4826';
const MUD_SPLATTER = '#8a6038';

/**
 * Turns simulation events into short-lived visual effects. Visual randomness is fine here:
 * none of it feeds back into the simulation.
 */
export class Effects {
  private effects: Effect[] = [];
  private flashUntil = new Map<string, number>();

  /** `splashRadius` sizes mortar splashes to match the simulation's. */
  add(event: SimEvent, now: number, tankColor: (id: string) => string, splashRadius = 60): void {
    switch (event.type) {
      case 'mortarLaunched':
        this.push('flash', event.x, event.y, now, 160, 0, LAUNCH_COLOR);
        this.push('spark', event.x, event.y, now, 300, 5, LAUNCH_COLOR);
        break;
      case 'mortarLanded':
        this.push('mud', event.x, event.y, now, 1100, 26, MUD_SPLATTER, splashRadius);
        break;
      case 'shotFired':
        this.push('flash', event.x, event.y, now, 90, 0, FLASH_COLOR);
        break;
      case 'bounce':
        this.push('spark', event.x, event.y, now, 220, 6, SPARK_COLOR);
        break;
      case 'shellDestroyed':
        this.push('spark', event.x, event.y, now, 160, 4, SPARK_COLOR);
        break;
      case 'friendlyHit':
        // Friendly fire is off: a harmless clang, a small ricochet with no hit flash.
        this.push('spark', event.x, event.y, now, 180, 5, CLANG_COLOR);
        break;
      case 'hit':
        this.push('ring', event.x, event.y, now, 260, 8, SPARK_COLOR);
        this.flashUntil.set(event.targetId, now + HIT_FLASH_MS);
        break;
      case 'eliminated':
        this.push('explosion', event.x, event.y, now, 900, 22, tankColor(event.tankId));
        break;
      default:
        break;
    }
  }

  /** True while a tank should be drawn flashing from a hit. */
  isFlashing(tankId: string, now: number): boolean {
    return (this.flashUntil.get(tankId) ?? 0) > now;
  }

  /** The kinds of effect showing, oldest first (for tests). */
  kinds(): string[] {
    return this.effects.map((e) => e.kind);
  }

  clear(): void {
    this.effects = [];
    this.flashUntil.clear();
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    this.effects = this.effects.filter((e) => now - e.start < e.duration);
    for (const e of this.effects) {
      const t = (now - e.start) / e.duration; // 0 → 1
      const age = (now - e.start) / 1000;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      switch (e.kind) {
        case 'flash':
          ctx.fillStyle = e.color;
          disc(ctx, e.x, e.y, 9 * (1 - t) + 3);
          break;
        case 'ring':
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(e.x, e.y, 6 + 22 * t, 0, Math.PI * 2);
          ctx.stroke();
          drawParticles(ctx, e, age);
          break;
        case 'spark':
          drawParticles(ctx, e, age);
          break;
        case 'explosion': {
          ctx.fillStyle = '#fff2b0';
          disc(ctx, e.x, e.y, 34 * Math.min(1, t * 4) * (1 - t));
          ctx.fillStyle = '#ff9d3b';
          ctx.globalAlpha = Math.max(0, 1 - t * 1.4);
          disc(ctx, e.x, e.y, 20 + 30 * t);
          ctx.globalAlpha = 1 - t;
          drawParticles(ctx, e, age);
          break;
        }
        case 'mud': {
          // A splat that spreads quickly to the splash radius and soaks away, with clods thrown out.
          ctx.fillStyle = MUD_COLOR;
          ctx.globalAlpha = 0.75 * (1 - t);
          disc(ctx, e.x, e.y, e.radius * Math.min(1, t * 6));
          ctx.globalAlpha = 1 - t;
          drawParticles(ctx, e, age);
          break;
        }
      }
      ctx.restore();
    }
  }

  private push(
    kind: Effect['kind'],
    x: number,
    y: number,
    start: number,
    duration: number,
    count: number,
    color: string,
    radius = 0,
  ): void {
    const particles = Array.from({ length: count }, () => ({
      angle: Math.random() * Math.PI * 2,
      speed: 60 + Math.random() * (kind === 'explosion' || kind === 'mud' ? 220 : 120),
      size: 1.5 + Math.random() * (kind === 'explosion' || kind === 'mud' ? 4 : 1.5),
    }));
    this.effects.push({ kind, x, y, start, duration, particles, color, radius });
  }
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (r <= 0) return;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticles(ctx: CanvasRenderingContext2D, e: Effect, age: number): void {
  ctx.fillStyle = e.color;
  for (const p of e.particles) {
    // Particles decelerate as they fly out.
    const d = p.speed * age * (1 - Math.min(1, age * 0.9));
    ctx.fillRect(
      e.x + Math.cos(p.angle) * d - p.size / 2,
      e.y + Math.sin(p.angle) * d - p.size / 2,
      p.size,
      p.size,
    );
  }
}
