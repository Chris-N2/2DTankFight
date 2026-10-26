import './styles.css';
import {
  AI_COUNT_MAX,
  AI_COUNT_MIN,
  createMatch,
  HUMAN_ID,
  PROVING_GROUND,
  ROUND_CHOICES,
  step,
  type MatchOptions,
  type MatchState,
  type SimEvent,
} from '@tank/sim';
import { Effects } from './effects';
import { KeyboardState } from './input';
import { FixedStepLoop } from './loop';
import { colorOf, Renderer, snapshot, type Snapshot } from './renderer';
import { bannerFor, gameOverText, hpPips, roundLine, scoreLine } from './screens';

const DEFAULT_OPTIONS: MatchOptions = { aiCount: 3, rounds: 5 };
const GO_MS = 700;
/** Lets the final explosion play before the result screen appears. */
const RESULT_DELAY_MS = 1200;
/** Keys can't start a new game this soon after the result screen appears, so a fire-hammering player sees it. */
const RESULT_KEY_GRACE_MS = 600;

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

/** Owns the browser side of a game: screens, input, the fixed-step loop and rendering. */
class Game {
  private match: MatchState | null = null;
  private prev: Snapshot | null = null;
  private options: MatchOptions = { ...DEFAULT_OPTIONS };
  private goUntil = 0;
  private enterLockedUntil = 0;
  private selfInflicted = false;
  private readonly keyboard = new KeyboardState();
  private readonly effects = new Effects();
  private readonly renderer = new Renderer(
    el<HTMLCanvasElement>('game'),
    PROVING_GROUND.width,
    PROVING_GROUND.height,
  );
  private readonly loop = new FixedStepLoop(1000 / 60, () => this.tick());
  private readonly hudText = new Map<string, string>();

  constructor() {
    this.buildChoices(
      'opt-ai',
      range(AI_COUNT_MIN, AI_COUNT_MAX),
      () => this.options.aiCount,
      (v) => (this.options.aiCount = v),
    );
    this.buildChoices(
      'opt-rounds',
      [...ROUND_CHOICES],
      () => this.options.rounds,
      (v) => (this.options.rounds = v),
    );
    el('start').addEventListener('click', () => this.start());
    el('again').addEventListener('click', () => this.start());
    el('settings').addEventListener('click', () => this.showSetup());

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.keyboard.onKeyUp(e));
    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('blur', () => this.autoPause());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.autoPause();
    });

    el('start').focus();
    requestAnimationFrame((now) => this.frame(now));
  }

  private get inGame(): boolean {
    return this.match !== null && this.match.phase !== 'gameOver';
  }

  private start(): void {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
    this.match = createMatch({ ...this.options }, PROVING_GROUND, seed);
    this.prev = null;
    this.selfInflicted = false;
    this.effects.clear();
    this.loop.reset();
    this.loop.setPaused(false);
    this.keyboard.clear();
    this.keyboard.active = true;
    (document.activeElement as HTMLElement | null)?.blur(); // so Space can't re-press a button
    show('setup', false);
    show('gameover', false);
    show('pause', false);
    show('hud', true);
    this.renderer.resize();
  }

  private showSetup(): void {
    this.match = null;
    this.keyboard.active = false;
    show('gameover', false);
    show('hud', false);
    show('banner', false);
    show('setup', true);
    el('start').focus();
  }

  private tick(): void {
    const match = this.match;
    if (!match || match.phase === 'gameOver') return;
    this.prev = snapshot(match);
    const events = step(match, { [HUMAN_ID]: this.keyboard.sample() });
    for (const event of events) this.onEvent(match, event);
  }

  private onEvent(match: MatchState, event: SimEvent): void {
    const now = performance.now();
    this.effects.add(event, now, (id) => colorOf(match, id));
    switch (event.type) {
      case 'roundStarted':
        this.selfInflicted = false;
        break;
      case 'playStarted':
        this.goUntil = now + GO_MS;
        break;
      case 'eliminated':
        if (event.tankId === HUMAN_ID && event.byId === HUMAN_ID) this.selfInflicted = true;
        break;
      case 'gameEnded': {
        this.keyboard.active = false;
        this.keyboard.clear();
        const text = gameOverText(event.result, event.scores);
        el('go-title').textContent = text.title;
        el('go-score').textContent = text.score;
        el('go-quip').textContent = text.quip;
        this.enterLockedUntil = performance.now() + RESULT_DELAY_MS + RESULT_KEY_GRACE_MS;
        window.setTimeout(() => {
          if (this.match?.phase !== 'gameOver') return;
          show('gameover', true);
          show('banner', false);
        }, RESULT_DELAY_MS);
        // Focus "Play again" only after the grace period, so a Space press can't activate it straight away.
        window.setTimeout(() => {
          if (this.match?.phase === 'gameOver') el('again').focus();
        }, RESULT_DELAY_MS + RESULT_KEY_GRACE_MS);
        break;
      }
      default:
        break;
    }
  }

  private frame(now: number): void {
    const { alpha } = this.loop.frame(now);
    const match = this.match;
    if (match) {
      this.renderer.draw(match, this.prev, alpha, this.effects, now);
      this.updateHud(match);
      const banner = bannerFor(match, now < this.goUntil, this.selfInflicted);
      show('banner', banner !== null && !this.loop.isPaused);
      if (banner) {
        this.setText('banner-title', banner.title);
        this.setText('banner-sub', banner.sub);
      }
    } else {
      this.renderer.drawIdle(PROVING_GROUND);
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  private updateHud(match: MatchState): void {
    this.setText('hud-hp', hpPips(match));
    this.setText('hud-round', roundLine(match));
    this.setText('hud-score', scoreLine(match.scores));
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'Escape' && this.inGame) {
      e.preventDefault();
      this.setPaused(!this.loop.isPaused);
      return;
    }
    if (
      e.code === 'Enter' &&
      !this.inGame &&
      document.activeElement === document.body &&
      performance.now() >= this.enterLockedUntil
    ) {
      // Enter starts from the setup or result screen when no button has focus (buttons handle Enter themselves).
      this.start();
      return;
    }
    this.keyboard.onKeyDown(e);
  }

  private autoPause(): void {
    this.keyboard.clear(); // no stuck keys when focus comes back
    if (this.inGame) this.setPaused(true);
  }

  private setPaused(paused: boolean): void {
    this.loop.setPaused(paused);
    this.keyboard.clear();
    show('pause', paused);
  }

  private setText(id: string, text: string): void {
    if (this.hudText.get(id) === text) return;
    this.hudText.set(id, text);
    el(id).textContent = text;
  }

  private buildChoices(id: string, values: number[], get: () => number, set: (v: number) => void): void {
    const container = el(id);
    const render = (): void => {
      for (const button of container.querySelectorAll('button')) {
        button.setAttribute('aria-checked', String(Number(button.dataset['value']) === get()));
      }
    };
    for (const value of values) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = String(value);
      button.dataset['value'] = String(value);
      button.setAttribute('role', 'radio');
      button.addEventListener('click', () => {
        set(value);
        render();
      });
      container.appendChild(button);
    }
    render();
  }
}

function show(id: string, visible: boolean): void {
  el(id).classList.toggle('hidden', !visible);
}

function range(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

new Game();
