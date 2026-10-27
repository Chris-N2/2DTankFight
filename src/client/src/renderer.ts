import {
  HUMAN_ID,
  mortarLanding,
  type Board,
  type MatchState,
  type MortarState,
  type TankState,
} from '@tank/sim';
import type { Effects } from './effects';

/** Tank colours by colorIndex. Index 0 is always the human. */
export const PALETTE = ['#7be36f', '#ff6b5e', '#5eaaff', '#ffd35e', '#d78bff'];

const FLOOR = '#26301f';
const GRID = '#2d3925';
const WALL = '#c9a66b';
const WALL_EDGE = '#8a6d3f';
const BORDER = '#8a6d3f';
const SHELL = '#fff8dc';
const OUTLINE = '#141810';
const MORTAR = '#3b3a32';
const SHADOW = 'rgba(0, 0, 0, 0.35)';
const MUD = '#5a3d22';
const MUD_LIGHT = '#7a5532';

/** Render-relevant positions captured before a tick, so frames can interpolate between ticks. */
export interface Snapshot {
  tanks: Record<string, { x: number; y: number; heading: number }>;
  shells: Record<number, { x: number; y: number }>;
}

/** Anything that moved further than this in one tick teleported (e.g. a respawn): don't interpolate it. */
const TELEPORT_DISTANCE = 40;

export function snapshot(state: MatchState): Snapshot {
  const tanks: Snapshot['tanks'] = {};
  for (const t of state.tanks) tanks[t.id] = { x: t.x, y: t.y, heading: t.heading };
  const shells: Snapshot['shells'] = {};
  for (const s of state.shells) shells[s.id] = { x: s.x, y: s.y };
  return { tanks, shells };
}

/**
 * Where to draw a tank this frame, between its previous and current tick. A tank that's new this tick
 * (say, one joining at a wave start) or that teleported (a respawn) is drawn where it is, not swept there.
 */
export function tankPose(
  tank: Pick<TankState, 'id' | 'x' | 'y' | 'heading'>,
  prev: Snapshot | null,
  alpha: number,
): { x: number; y: number; heading: number } {
  const p = prev?.tanks[tank.id];
  if (!p || Math.hypot(tank.x - p.x, tank.y - p.y) >= TELEPORT_DISTANCE) {
    return { x: tank.x, y: tank.y, heading: tank.heading };
  }
  return {
    x: lerp(p.x, tank.x, alpha),
    y: lerp(p.y, tank.y, alpha),
    heading: lerpAngle(p.heading, tank.heading, alpha),
  };
}

/** Peak height of a mortar's arc, as a fraction of its range. */
const MORTAR_ARC = 0.3;

/**
 * Where to draw a mortar this frame. It moves steadily over the ground from launch to landing point; its height
 * is just for show, a parabola peaking mid-flight at a fraction of the range, so longer lobs arc higher.
 */
export function mortarPose(
  mortar: MortarState,
  alpha: number,
): { x: number; y: number; height: number; progress: number } {
  // ticksLeft has already counted down this tick, so alpha = 0 is the previous tick's position.
  const elapsed = mortar.flightTicks - mortar.ticksLeft - 1 + alpha;
  const progress = Math.max(0, Math.min(1, elapsed / mortar.flightTicks));
  const range = Math.hypot(mortar.toX - mortar.fromX, mortar.toY - mortar.fromY);
  return {
    x: lerp(mortar.fromX, mortar.toX, progress),
    y: lerp(mortar.fromY, mortar.toY, progress),
    height: 4 * MORTAR_ARC * range * progress * (1 - progress),
    progress,
  };
}

export function colorOf(state: MatchState, id: string): string {
  const tank = state.tanks.find((t) => t.id === id);
  return PALETTE[(tank?.colorIndex ?? 0) % PALETTE.length]!;
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private dpr = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly worldWidth: number,
    private readonly worldHeight: number,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not supported in this browser.');
    this.ctx = ctx;
    this.resize();
  }

  /** Fits the world into the window, letterboxed, keeping its aspect ratio; crisp on high-DPI screens. */
  resize(): void {
    const cssW = this.canvas.clientWidth || window.innerWidth;
    const cssH = this.canvas.clientHeight || window.innerHeight;
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.scale = Math.min(cssW / this.worldWidth, cssH / this.worldHeight);
    this.offsetX = (cssW - this.worldWidth * this.scale) / 2;
    this.offsetY = (cssH - this.worldHeight * this.scale) / 2;
  }

  /** Just the empty arena — the backdrop behind the setup screen. */
  drawIdle(board: Board): void {
    this.beginFrame();
    this.drawArena(board);
  }

  draw(state: MatchState, prev: Snapshot | null, alpha: number, effects: Effects, now: number): void {
    const ctx = this.ctx;
    this.beginFrame();
    this.drawArena(state.board);

    for (const shell of state.shells) {
      const p = prev?.shells[shell.id];
      const near = p && Math.hypot(shell.x - p.x, shell.y - p.y) < TELEPORT_DISTANCE;
      const x = near ? lerp(p.x, shell.x, alpha) : shell.x;
      const y = near ? lerp(p.y, shell.y, alpha) : shell.y;
      ctx.fillStyle = SHELL;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const mortar of state.mortarShells) this.drawLandingMarker(state, mortar);

    for (const tank of state.tanks) {
      if (!tank.alive) continue;
      const { x, y, heading } = tankPose(tank, prev, alpha);
      this.drawTank(state, tank, x, y, heading, effects.isFlashing(tank.id, now), now);
      if (tank.id === HUMAN_ID && tank.mortarCharge >= 0) this.drawReticle(state, tank, x, y, heading);
    }

    effects.draw(ctx, now);

    // Mortars fly above everything else.
    for (const mortar of state.mortarShells) this.drawMortar(mortar, alpha);
  }

  /** Where your mortar will land if you let go now, with the splash it'll make. */
  private drawReticle(state: MatchState, tank: TankState, x: number, y: number, heading: number): void {
    const ctx = this.ctx;
    const at = mortarLanding(state, { ...tank, x, y, heading }, tank.mortarCharge);
    const color = colorOf(state, tank.id);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.45;
    ctx.setLineDash([3, 7]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(at.x, at.y);
    ctx.stroke();
    ctx.globalAlpha = 0.85;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(at.x, at.y, state.config.mortarSplashRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(at.x - 8, at.y);
    ctx.lineTo(at.x + 8, at.y);
    ctx.moveTo(at.x, at.y - 8);
    ctx.lineTo(at.x, at.y + 8);
    ctx.stroke();
    ctx.restore();
  }

  /** A faint ring where a mortar in flight will come down, in its owner's colour. */
  private drawLandingMarker(state: MatchState, mortar: MortarState): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = colorOf(state, mortar.ownerId);
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(mortar.toX, mortar.toY, state.config.mortarSplashRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** The shell up on its arc, and its shadow on the ground beneath it. */
  private drawMortar(mortar: MortarState, alpha: number): void {
    const ctx = this.ctx;
    const { x, y, height } = mortarPose(mortar, alpha);
    // The higher it is, the smaller and fainter its shadow, and the bigger the shell looks.
    const lift = Math.min(1, height / 120);
    ctx.fillStyle = SHADOW;
    ctx.beginPath();
    ctx.ellipse(x, y, 6 - 2 * lift, 3.5 - 1 * lift, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = MORTAR;
    ctx.strokeStyle = SHELL;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y - height, 5 + 3 * lift, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  /** Clears the canvas and sets up the world-to-screen transform. */
  private beginFrame(): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d100b';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(
      this.dpr * this.scale,
      0,
      0,
      this.dpr * this.scale,
      this.dpr * this.offsetX,
      this.dpr * this.offsetY,
    );
  }

  private drawArena(board: Board): void {
    const ctx = this.ctx;
    const { width, height, obstacles } = board;
    ctx.fillStyle = FLOOR;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 50; x < width; x += 50) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 50; y < height; y += 50) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    for (const r of obstacles) {
      ctx.fillStyle = WALL_EDGE;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = WALL;
      ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    }

    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 6;
    ctx.strokeRect(-3, -3, width + 6, height + 6);
  }

  private drawTank(
    state: MatchState,
    tank: TankState,
    x: number,
    y: number,
    heading: number,
    flashing: boolean,
    now: number,
  ): void {
    const ctx = this.ctx;
    const color = flashing ? '#ffffff' : colorOf(state, tank.id);
    const isYou = tank.id === HUMAN_ID;

    if (isYou) {
      // A gently pulsing ring under your tank, so you can always find yourself.
      const pulse = 0.5 + 0.5 * Math.sin(now / 250);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.35 + 0.35 * pulse;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 27 + 2 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    ctx.lineWidth = 2;
    ctx.strokeStyle = OUTLINE;
    // Tracks
    ctx.fillStyle = shade(color, -0.45);
    ctx.fillRect(-17, -16, 34, 9);
    ctx.strokeRect(-17, -16, 34, 9);
    ctx.fillRect(-17, 7, 34, 9);
    ctx.strokeRect(-17, 7, 34, 9);
    // Hull
    ctx.fillStyle = color;
    ctx.fillRect(-14, -10, 28, 20);
    ctx.strokeRect(-14, -10, 28, 20);
    // Barrel and turret
    ctx.fillStyle = shade(color, -0.2);
    ctx.fillRect(2, -2.5, 23, 5);
    ctx.strokeRect(2, -2.5, 23, 5);
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (tank.slowTicks > 0) drawMud(ctx);
    ctx.restore();

    if (isYou) {
      ctx.font = 'bold 13px ui-monospace, Consolas, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3;
      ctx.strokeStyle = OUTLINE;
      ctx.strokeText('YOU', x, y - 30);
      ctx.fillStyle = color;
      ctx.fillText('YOU', x, y - 30);
    }
  }
}

/** Mud caked over the tracks and splashed up the hull: this tank is bogged down. Drawn in the tank's frame. */
function drawMud(ctx: CanvasRenderingContext2D): void {
  const blobs: readonly [number, number, number][] = [
    [-12, -12, 5],
    [-2, -13, 4],
    [10, -11, 5],
    [-9, 12, 5],
    [3, 11, 4],
    [13, 13, 4],
    [-6, -3, 3],
    [7, 5, 3],
  ];
  ctx.fillStyle = MUD;
  for (const [x, y, r] of blobs) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = MUD_LIGHT;
  for (const [x, y, r] of blobs) {
    ctx.beginPath();
    ctx.arc(x - 1, y - 1, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Lightens (amount > 0) or darkens (amount < 0) a #rrggbb colour. */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number): number => {
    const c = (n >> shift) & 0xff;
    const v = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
    return Math.round(Math.max(0, Math.min(255, v)));
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}
