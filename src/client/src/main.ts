import './styles.css';
import {
  AI_COUNT_MAX,
  AI_COUNT_MIN,
  createMatch,
  HUMAN_ID,
  PROVING_GROUND,
  ROUND_CHOICES,
  step,
  type GameMode,
  type MatchState,
  type SimEvent,
  type WaveChange,
} from '@tank/sim';
import { browserStorage, recordBest } from './best';
import { Effects } from './effects';
import { inputFromGamepad, isActive, MenuInput, type GamepadSnapshot, type MenuAction } from './gamepad';
import { combineInputs, FireLatch, GAME_KEYS, KeyboardState, menuActionForKey } from './input';
import { FixedStepLoop } from './loop';
import { mountStage, type StageId } from './markup';
import { colorOf, Renderer, snapshot, type Snapshot } from './renderer';
import {
  bannerFor,
  DEFAULT_CHOICES,
  gameOverText,
  hpPips,
  hudScore,
  matchOptionsFor,
  mortarHud,
  roundLine,
  wavesGameOverText,
  type SetupChoices,
} from './screens';
import {
  applyTheme,
  browserColourTools,
  contrastWarnings,
  loadTheme,
  readPageOverrides,
  startTheme,
  THEME_WAIT_MS,
  themeUrl,
  type Theme,
  type ThemeResult,
} from './theme';

const MODES: readonly GameMode[] = ['lastOneStanding', 'waves'];
const MODE_NAMES: Record<GameMode, string> = { lastOneStanding: 'Last One Standing', waves: 'Waves' };
const TAGLINES: Record<GameMode, string> = {
  lastOneStanding: 'Last One Standing · every tank for itself',
  waves: 'Waves · they keep coming, and they work together',
};
const GO_MS = 700;
/** Lets the final explosion play before the result screen appears. */
const RESULT_DELAY_MS = 1200;
/** Keys can't start a new game this soon after the result screen appears, so a fire-hammering player sees it. */
const RESULT_KEY_GRACE_MS = 600;

type InputMode = 'keyboard' | 'mouse' | 'gamepad';

function el<T extends HTMLElement = HTMLElement>(id: StageId): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

/** Owns the browser side of a game: screens, input, the fixed-step loop and rendering. */
class Game {
  private match: MatchState | null = null;
  private prev: Snapshot | null = null;
  private readonly choices: SetupChoices = { ...DEFAULT_CHOICES };
  /** The escalation steps the current wave brought, for the countdown banner. */
  private waveChanges: readonly WaveChange[] = [];
  private goUntil = 0;
  private enterLockedUntil = 0;
  private selfInflicted = false;
  private readonly keyboard = new KeyboardState();
  private readonly menu = new MenuInput();
  private readonly fireLatch = new FireLatch();
  private pads: GamepadSnapshot[] = [];
  /** True while the player is driving with a gamepad, so unplugging it mid-round pauses the game. */
  private gamepadInUse = false;
  private readonly effects = new Effects();
  private readonly renderer = new Renderer(
    el<HTMLCanvasElement>('game'),
    PROVING_GROUND.width,
    PROVING_GROUND.height,
  );
  private readonly loop = new FixedStepLoop(1000 / 60, () => this.tick());
  private readonly hudText = new Map<string, string>();

  constructor(theme: Theme) {
    this.renderer.setTheme(theme);
    this.buildChoices(
      'opt-mode',
      MODES,
      () => this.choices.mode,
      (v) => {
        this.choices.mode = v;
        this.showModeOptions();
      },
      (v) => MODE_NAMES[v],
    );
    this.buildChoices(
      'opt-ai',
      range(AI_COUNT_MIN, AI_COUNT_MAX),
      () => this.choices.aiCount,
      (v) => (this.choices.aiCount = v),
    );
    this.buildChoices(
      'opt-rounds',
      ROUND_CHOICES,
      () => this.choices.rounds,
      (v) => (this.choices.rounds = v),
    );
    this.buildChoices(
      'opt-start-ai',
      range(AI_COUNT_MIN, AI_COUNT_MAX),
      () => this.choices.startAiCount,
      (v) => (this.choices.startAiCount = v),
    );
    this.buildChoices(
      'opt-mortars',
      ['on', 'off'] as const,
      () => (this.choices.mortars ? 'on' : 'off'),
      (v) => (this.choices.mortars = v === 'on'),
      (v) => (v === 'on' ? 'On' : 'Off (classic)'),
    );
    this.showModeOptions();
    el('start').addEventListener('click', () => this.start());
    el('again').addEventListener('click', () => this.start());
    el('settings').addEventListener('click', () => this.showSetup());

    window.addEventListener('keydown', (e) => {
      this.setInputMode('keyboard');
      if (GAME_KEYS.has(e.code)) this.gamepadInUse = false;
      this.onKeyDown(e);
    });
    window.addEventListener('mousemove', () => this.setInputMode('mouse'));
    window.addEventListener('mousedown', () => this.setInputMode('mouse'));
    window.addEventListener('gamepadconnected', () => this.updatePadStatus());
    window.addEventListener('gamepaddisconnected', () => {
      this.updatePadStatus();
      if (this.gamepadInUse) this.autoPause();
    });
    window.addEventListener('keyup', (e) => this.keyboard.onKeyUp(e));
    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('blur', () => this.autoPause());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.autoPause();
    });

    el('start').focus();
    this.updatePadStatus();
    requestAnimationFrame((now) => this.frame(now));
  }

  /** A theme file that arrived after the game had started. */
  setTheme(theme: Theme): void {
    this.renderer.setTheme(theme);
  }

  private get inGame(): boolean {
    return this.match !== null && this.match.phase !== 'gameOver';
  }

  private start(): void {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
    // "Play again" comes through here too, so it keeps the mode and options.
    this.match = createMatch(matchOptionsFor(this.choices), PROVING_GROUND, seed);
    this.prev = null;
    this.selfInflicted = false;
    this.waveChanges = [];
    this.effects.clear();
    this.loop.reset();
    this.loop.setPaused(false);
    this.keyboard.clear();
    this.keyboard.active = true;
    this.fireLatch.arm(); // the button that started the game mustn't also fire
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
    const input = combineInputs(this.keyboard.sample(), ...this.pads.map(inputFromGamepad));
    const events = step(match, { [HUMAN_ID]: this.fireLatch.apply(input) });
    for (const event of events) this.onEvent(match, event);
  }

  private onEvent(match: MatchState, event: SimEvent): void {
    const now = performance.now();
    this.effects.add(event, now, (id) => colorOf(match, id), match.config.mortarSplashRadius);
    switch (event.type) {
      case 'roundStarted':
        this.selfInflicted = false;
        break;
      case 'waveStarted':
        this.selfInflicted = false;
        this.waveChanges = event.changes;
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
        const text =
          event.result === 'over'
            ? wavesGameOverText(
                match.round,
                event.wavesCleared,
                recordBest(
                  browserStorage(),
                  match.waves?.startAiCount ?? 0,
                  match.options.mortars,
                  event.wavesCleared,
                ),
                this.selfInflicted,
              )
            : gameOverText(event.result, event.scores);
        el('go-title').textContent = text.title;
        el('go-score').textContent = text.score;
        el('go-best').textContent = text.best;
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
    // Poll before stepping, so this frame's ticks see the latest gamepad state.
    this.pads = pollGamepads();
    if (this.pads.some(isActive)) {
      this.setInputMode('gamepad');
      if (this.inGame) this.gamepadInUse = true;
    }
    for (const action of this.menu.update(this.pads, now)) this.onMenuAction(action, now);

    const { alpha } = this.loop.frame(now);
    const match = this.match;
    if (match) {
      this.renderer.draw(match, this.prev, alpha, this.effects, now);
      this.updateHud(match);
      const banner = bannerFor(match, now < this.goUntil, this.selfInflicted, this.waveChanges);
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
    this.setText('hud-score', hudScore(match));
    const mortar = mortarHud(match);
    show('hud-mortar-cell', mortar !== null);
    this.setText('hud-mortar', mortar ?? '');
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
    const menuAction = this.inGame ? null : menuActionForKey(e.code);
    if (menuAction) {
      e.preventDefault(); // arrows mustn't also scroll the page
      this.onMenuAction(menuAction, performance.now());
      return;
    }
    this.keyboard.onKeyDown(e);
  }

  /**
   * Menu actions from the gamepad (and the keyboard's driving keys): pausing during play, and moving round the
   * setup and result screens otherwise.
   */
  private onMenuAction(action: MenuAction, now: number): void {
    if (this.inGame) {
      if (action === 'start' || (action === 'back' && this.loop.isPaused))
        this.setPaused(!this.loop.isPaused);
      return;
    }
    const onSetup = isShown('setup');
    // The result screen ignores presses at first, so a player still hammering fire gets to see it.
    const onResult = isShown('gameover') && now >= this.enterLockedUntil;
    if (!onSetup && !onResult) return;

    // Rows follow the options on show, so they change as the mode does.
    const rows: HTMLButtonElement[][] = onSetup
      ? [...visibleOptionRows(), [el<HTMLButtonElement>('start')]]
      : [[el<HTMLButtonElement>('again')], [el<HTMLButtonElement>('settings')]];
    const focused = document.activeElement;
    let row = rows.findIndex((r) => r.some((b) => b === focused));
    if (row < 0) {
      // Nothing focused yet: start from the main button. A or B only highlights it; a direction moves on from it.
      (onSetup ? el('start') : el('again')).focus();
      if (action === 'confirm' || action === 'back') return;
      row = rows.length - (onSetup ? 1 : 2);
    }
    const current = rows[row]!;
    const col = Math.max(
      0,
      current.findIndex((b) => b === document.activeElement),
    );

    switch (action) {
      case 'up':
      case 'down': {
        const next = rows[Math.max(0, Math.min(rows.length - 1, row + (action === 'up' ? -1 : 1)))]!;
        (next.find((b) => b.getAttribute('aria-checked') === 'true') ?? next[0])?.focus();
        break;
      }
      case 'left':
      case 'right': {
        const target = current[Math.max(0, Math.min(current.length - 1, col + (action === 'left' ? -1 : 1)))];
        target?.focus();
        if (target?.getAttribute('role') === 'radio') target.click(); // radio groups select as you move
        break;
      }
      case 'confirm':
        (document.activeElement as HTMLElement | null)?.click();
        break;
      case 'back':
        if (!onSetup) el('settings').click();
        break;
      case 'start':
        if (onSetup) el('start').click();
        break;
    }
  }

  /** Shows a strong focus outline only while the gamepad is in use; mouse and keyboard keep the usual styling. */
  private setInputMode(mode: InputMode): void {
    if (document.body.dataset['input'] !== mode) document.body.dataset['input'] = mode;
  }

  private updatePadStatus(): void {
    const detected = pollGamepads().length > 0;
    this.setText(
      'pad-status',
      detected
        ? 'Gamepad detected: A selects, Start begins.'
        : 'Have a gamepad? Press any button on it to wake it up.',
    );
    el('pad-status').classList.toggle('detected', detected);
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

  private setText(id: StageId, text: string): void {
    if (this.hudText.get(id) === text) return;
    this.hudText.set(id, text);
    el(id).textContent = text;
  }

  /** Shows only the selected mode's options. */
  private showModeOptions(): void {
    for (const option of document.querySelectorAll<HTMLElement>('#setup .option[data-mode]')) {
      option.classList.toggle('hidden', option.dataset['mode'] !== this.choices.mode);
    }
    el('tagline').textContent = TAGLINES[this.choices.mode];
  }

  private buildChoices<T extends string | number>(
    id: StageId,
    values: readonly T[],
    get: () => T,
    set: (v: T) => void,
    label: (v: T) => string = String,
  ): void {
    const container = el(id);
    const render = (): void => {
      for (const button of container.querySelectorAll('button')) {
        button.setAttribute('aria-checked', String(button.dataset['value'] === String(get())));
      }
    };
    for (const value of values) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label(value);
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

/** Connected gamepads. Empty if the browser has no Gamepad API (or blocks it, e.g. outside https). */
function pollGamepads(): GamepadSnapshot[] {
  if (typeof navigator.getGamepads !== 'function') return [];
  try {
    return navigator.getGamepads().filter((pad): pad is Gamepad => pad !== null && pad.connected);
  } catch {
    return [];
  }
}

/** The setup screen's option rows that are on show, in order, as rows of buttons for gamepad navigation. */
function visibleOptionRows(): HTMLButtonElement[][] {
  return [...document.querySelectorAll<HTMLElement>('#setup .option:not(.hidden) .choices')].map(
    (choices) => [...choices.querySelectorAll('button')],
  );
}

function isShown(id: StageId): boolean {
  return !el(id).classList.contains('hidden');
}

function show(id: StageId, visible: boolean): void {
  el(id).classList.toggle('hidden', !visible);
}

function range(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

/**
 * Applies the theme, then builds the screens and starts. The theme file gets a moment to arrive first, so the
 * opening screen is already themed; a slower one is applied when it turns up.
 */
async function boot(): Promise<void> {
  const root = document.documentElement;
  // Read the host page's own --tank-* values before anything of ours is written over them.
  const page = readPageOverrides(getComputedStyle(root));
  const colours = browserColourTools();
  const load = loadTheme(
    themeUrl(document, import.meta.url),
    (url, init) => fetch(url, init),
    colours.isColour,
  );

  let game: Game | null = null;
  let late: ThemeResult | null = null;
  let checkedFloor: string | null = null;
  const use = (result: ThemeResult): void => {
    // A late theme file re-applies the theme; only check the floor's contrast again if the floor has changed.
    const contrast =
      result.theme.floor === checkedFloor ? [] : contrastWarnings(result.theme, colours.normalise);
    checkedFloor = result.theme.floor;
    for (const warning of [...result.warnings, ...contrast]) console.warn(`[Tank Command] ${warning}`);
    applyTheme(root, result.theme);
    game?.setTheme(result.theme);
  };

  const first = await startTheme(page, load, THEME_WAIT_MS, (result) => {
    if (game) use(result);
    else late = result; // arrived just as the game was starting
  });
  use(first);
  mountStage(document, (message) => console.warn(message));
  game = new Game(first.theme);
  if (late) use(late);
}

void boot();
