import './styles.css';
import {
  AI_COUNT_MAX,
  AI_COUNT_MIN,
  aiCountMax,
  BUILT_IN_BOARDS,
  createMatch,
  HUMAN_ID,
  IDLE_INPUT,
  ROUND_CHOICES,
  step,
  type GameMode,
  type MatchState,
  type SimEvent,
  type WaveChange,
} from '@tank/sim';
import { FixedStepLoop, normalizeCode } from '@tank/protocol';
import { readServerTag, serverAddress } from './address';
import { browserStorage, recordBest } from './best';
import { Effects } from './effects';
import { inputFromGamepad, isActive, MenuInput, type GamepadSnapshot, type MenuAction } from './gamepad';
import { combineInputs, FireLatch, GAME_KEYS, KeyboardState, menuActionForKey } from './input';
import {
  applyOptions,
  fitForTwo,
  freezeText,
  joinLink,
  lobbyStatus,
  onLoad,
  onlineOptionsFor,
  onlineResultText,
  typedCodeProblem,
  withoutJoin,
} from './lobby';
import { mountStage, type StageId } from './markup';
import { Connection, sessionSeatStore, type Clock, type SocketLike } from './net';
import { colorOf, Renderer, snapshot, type Snapshot } from './renderer';
import {
  addToSequence,
  bannerFor,
  boardName,
  DEFAULT_CHOICES,
  fitSequence,
  gameOverText,
  hpPips,
  hudScore,
  matchOptionsFor,
  mortarHud,
  removeFromSequence,
  roundLine,
  sequenceCount,
  setupProblem,
  wavesGameOverText,
  type GameOverText,
  type MapMode,
  type SetupChoices,
} from './screens';
import { OnlineSession, type SessionDeps } from './session';
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
const MAP_MODES: readonly MapMode[] = ['random', 'sequence'];
const MAP_MODE_NAMES: Record<MapMode, string> = { random: 'Random', sequence: 'Sequence' };
/** Every built-in board is the same size, so the canvas is sized from the first. */
const ARENA = BUILT_IN_BOARDS[0]!;
/** Thumbnail sizes on the page, in CSS pixels: the library's cards and the sequence strip's entries. */
const CARD_SIZE = [96, 64] as const;
const ENTRY_SIZE = [48, 32] as const;
const GO_MS = 700;
/** Lets the final explosion play before the result screen appears. */
const RESULT_DELAY_MS = 1200;
/** Keys can't start a new game this soon after the result screen appears, so a fire-hammering player sees it. */
const RESULT_KEY_GRACE_MS = 600;
/** The most AI tanks an online game can have, with two humans. */
const ONLINE_AI_MAX = aiCountMax(2);
/** The setup screen's buttons below the options, in the order the d-pad reaches them. */
const SETUP_BUTTONS: readonly StageId[] = ['start', 'host-online', 'join-online', 'lobby-bot', 'lobby-leave'];
const RESULT_BUTTONS: readonly StageId[] = ['again', 'settings', 'go-leave'];
const MENU_BUTTONS: readonly StageId[] = ['menu-back', 'menu-leave', 'menu-no', 'menu-yes'];
const JOIN_BUTTONS: readonly StageId[] = ['join-go', 'join-cancel'];

type InputMode = 'keyboard' | 'mouse' | 'gamepad';

function el<T extends HTMLElement = HTMLElement>(id: StageId): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

/** Owns the browser side of a game: screens, input, the fixed-step loop and rendering, locally or online. */
class Game {
  private match: MatchState | null = null;
  private prev: Snapshot | null = null;
  private readonly choices: SetupChoices = { ...DEFAULT_CHOICES, sequence: [...DEFAULT_CHOICES.sequence] };
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
  private readonly renderer = new Renderer(el<HTMLCanvasElement>('game'), ARENA.width, ARENA.height);
  private readonly loop = new FixedStepLoop(1000 / 60, () => this.tick());
  private readonly hudText = new Map<string, string>();
  /** Redraws each option row's selection, for when the options change under the player (the guest's lobby). */
  private readonly optionRenders: (() => void)[] = [];

  // Online play: only ever set up when the page names a server.
  private session: OnlineSession | null = null;
  private readonly seats = sessionSeatStore(() => window.sessionStorage);
  /** What had to change to fit the setup screen's choices to two players. */
  private fitNote: string | null = null;
  private seenGameId = 0;
  /** When the online result screen appears, once the game is over; null while it's on. */
  private resultAt: number | null = null;
  private resultShown = false;
  private menuOpen = false;

  constructor(
    theme: Theme,
    private readonly server: string | null,
  ) {
    this.renderer.setTheme(theme);
    this.buildChoices(
      'opt-mode',
      MODES,
      () => this.choices.mode,
      (v) => {
        this.choices.mode = v;
        this.showModeOptions();
        this.limitChanged();
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
      (v) => {
        this.choices.rounds = v;
        this.limitChanged();
      },
    );
    this.buildChoices(
      'opt-start-ai',
      range(AI_COUNT_MIN, AI_COUNT_MAX),
      () => this.choices.startAiCount,
      (v) => (this.choices.startAiCount = v),
    );
    this.buildChoices(
      'opt-ff',
      ['off', 'on'] as const,
      () => (this.choices.friendlyFire ? 'on' : 'off'),
      (v) => (this.choices.friendlyFire = v === 'on'),
      (v) => (v === 'on' ? 'On' : 'Off'),
    );
    this.buildChoices(
      'opt-mortars',
      ['on', 'off'] as const,
      () => (this.choices.mortars ? 'on' : 'off'),
      (v) => (this.choices.mortars = v === 'on'),
      (v) => (v === 'on' ? 'On' : 'Off (classic)'),
    );
    this.buildChoices(
      'opt-maps',
      MAP_MODES,
      () => this.choices.maps,
      (v) => {
        this.choices.maps = v;
        this.renderMapPicker();
      },
      (v) => MAP_MODE_NAMES[v],
    );
    this.buildMapLibrary();
    this.showModeOptions();
    this.renderMapPicker();
    el('start').addEventListener('click', () => this.startPressed());
    el('again').addEventListener('click', () => (this.session ? this.session.playAgain() : this.start()));
    el('settings').addEventListener('click', () =>
      this.session ? this.session.toLobby() : this.showSetup(),
    );
    el('go-leave').addEventListener('click', () => this.leaveOnline());
    this.wireOnline();

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
    this.resumeOnline();
    requestAnimationFrame((now) => this.frame(now));
  }

  /** A theme file that arrived after the game had started. */
  setTheme(theme: Theme): void {
    this.renderer.setTheme(theme);
    this.drawThumbnails();
  }

  /** A local game in progress. */
  private get inGame(): boolean {
    return this.match !== null && this.match.phase !== 'gameOver';
  }

  /** An online game on screen (in play, or showing its result). */
  private get onlineGame(): boolean {
    return this.session?.phase === 'game';
  }

  /** The player's own controls drive a tank: a local game, or an online one before its result. */
  private get driving(): boolean {
    return this.inGame || (this.onlineGame && !this.resultShown && !this.menuOpen);
  }

  /** In a room's lobby (or on the way to it), where the setup screen shows the room's options. */
  private get inLobby(): boolean {
    return this.session !== null && (this.session.phase === 'lobby' || this.session.phase === 'connecting');
  }

  /** The guest can see the room's options but not change them. */
  private get readOnly(): boolean {
    return this.inLobby && !this.session!.isHost;
  }

  /** Start, from the button, Enter or the gamepad: a local game, or the room's game for an online host. */
  private startPressed(): void {
    if (this.session) {
      if (!setupProblem(this.choices)) this.session.start();
      return;
    }
    this.start();
  }

  private start(): void {
    // Every way of starting comes through here (button, Enter, the gamepad's Start), so this one check covers them.
    if (setupProblem(this.choices)) return;
    const seed = (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
    // "Play again" comes through here too, so it keeps the mode and options.
    this.match = createMatch(matchOptionsFor(this.choices), seed);
    this.prev = null;
    this.selfInflicted = false;
    this.waveChanges = [];
    this.effects.clear();
    this.loop.reset();
    this.loop.setPaused(false);
    this.renderer.viewer = HUMAN_ID;
    this.enterPlay();
  }

  /** Hands the screen over to the arena, for a local game or an online one. */
  private enterPlay(): void {
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

  /** Effects and the banner's bookkeeping, for local and online games alike. `viewer` is this player's seat. */
  private playEvent(match: MatchState, event: SimEvent, viewer: string): void {
    const now = performance.now();
    this.effects.add(event, now, (id) => colorOf(match, id, viewer), match.config.mortarSplashRadius);
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
        if (event.tankId === viewer && event.byId === viewer) this.selfInflicted = true;
        break;
      default:
        break;
    }
  }

  private onEvent(match: MatchState, event: SimEvent): void {
    this.playEvent(match, event, HUMAN_ID);
    if (event.type !== 'gameEnded') return;
    this.keyboard.active = false;
    this.keyboard.clear();
    // Bests are kept for local games only.
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
    this.setResultText(text);
    this.setResultButtons();
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
  }

  private frame(now: number): void {
    // Poll before stepping, so this frame's ticks see the latest gamepad state.
    this.pads = pollGamepads();
    if (this.pads.some(isActive)) {
      this.setInputMode('gamepad');
      if (this.inGame || this.onlineGame) this.gamepadInUse = true;
    }
    for (const action of this.menu.update(this.pads, now)) this.onMenuAction(action, now);

    if (this.session && this.onlineGame) {
      this.onlineFrame(this.session, now);
    } else {
      const { alpha } = this.loop.frame(now);
      const match = this.match;
      if (match) {
        this.renderer.draw(match, this.prev, alpha, this.effects, now);
        this.updateHud(match, HUMAN_ID);
        const banner = bannerFor(match, now < this.goUntil, this.selfInflicted, this.waveChanges);
        this.showBanner(banner !== null && !this.loop.isPaused ? banner : null);
      } else {
        this.renderer.drawIdle(ARENA);
      }
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  /** One frame of an online game: send the controls, play back the server's snapshots, and draw them. */
  private onlineFrame(session: OnlineSession, now: number): void {
    session.tick(now);
    const viewer = session.seat ?? HUMAN_ID;
    if (session.gameId !== this.seenGameId) {
      // A new game, or this one picked up again after a drop.
      this.seenGameId = session.gameId;
      this.effects.clear();
      this.selfInflicted = false;
      this.waveChanges = [];
      this.resultAt = null;
      this.resultShown = false;
      this.renderer.viewer = viewer;
      this.enterPlay();
    }

    const input = combineInputs(this.keyboard.sample(), ...this.pads.map(inputFromGamepad));
    session.sendInput(this.driving ? this.fireLatch.apply(input) : IDLE_INPUT, now);

    const { state, prev, alpha, events } = session.mirror.frame(now);
    if (!state) {
      this.renderer.drawIdle(ARENA);
      return;
    }
    for (const event of events) this.playEvent(state, event, viewer);
    this.renderer.draw(state, prev, alpha, this.effects, now);
    this.updateHud(state, viewer);

    const frozen = freezeText(session, now);
    show('freeze', frozen !== null && !this.resultShown);
    if (frozen) {
      this.setText('freeze-title', frozen.title);
      this.setText('freeze-sub', frozen.sub);
    }
    const banner = bannerFor(state, now < this.goUntil, this.selfInflicted, this.waveChanges, viewer);
    this.showBanner(frozen === null && !this.resultShown ? banner : null);

    if (state.phase === 'gameOver' && this.resultAt === null) {
      // No best is recorded for an online game.
      this.setResultText(onlineResultText(state, viewer));
      this.resultAt = now + RESULT_DELAY_MS;
    }
    if (this.resultAt !== null && now >= this.resultAt && !this.resultShown) {
      this.resultShown = true;
      this.keyboard.active = false;
      this.keyboard.clear();
      this.closeMenu();
      this.setResultButtons();
      show('gameover', true);
      this.enterLockedUntil = now + RESULT_KEY_GRACE_MS;
      window.setTimeout(() => {
        if (this.resultShown) firstVisible(RESULT_BUTTONS)?.focus();
      }, RESULT_KEY_GRACE_MS);
    }
  }

  private showBanner(banner: { title: string; sub: string } | null): void {
    show('banner', banner !== null);
    if (banner) {
      this.setText('banner-title', banner.title);
      this.setText('banner-sub', banner.sub);
    }
  }

  private updateHud(match: MatchState, viewer: string): void {
    this.setText('hud-hp', hpPips(match, viewer));
    this.setText('hud-round', roundLine(match));
    this.setText('hud-score', hudScore(match, viewer));
    const mortar = mortarHud(match, viewer);
    show('hud-mortar-cell', mortar !== null);
    this.setText('hud-mortar', mortar ?? '');
  }

  private setResultText(text: GameOverText): void {
    el('go-title').textContent = text.title;
    el('go-score').textContent = text.score;
    el('go-best').textContent = text.best;
    el('go-quip').textContent = text.quip;
  }

  /**
   * The result screen's choices. Locally: play again or change settings. Online, the host decides (play again,
   * settings, or leave), and the guest waits for them or leaves.
   */
  private setResultButtons(): void {
    const session = this.session;
    const host = session === null || (session.isHost && !session.hostLeft);
    // The guest left mid-game: nobody to play again with, so the way on is the lobby, to wait for another player.
    const alone = session !== null && session.isHost && !session.guest;
    show('again', host && !alone);
    show('settings', host);
    el('settings').textContent = !session ? 'Change settings' : alone ? 'Back to the lobby' : 'Settings';
    show('go-leave', session !== null);
    el('go-leave').textContent = session?.hostLeft ? 'Back to setup' : 'Leave room';
    const wait =
      session === null
        ? null
        : session.isHost
          ? alone
            ? 'The other player has left. Wait in the lobby for someone else to join, with the same code.'
            : null
          : session.hostLeft
            ? 'The host has left.'
            : 'Waiting for the host to choose what’s next…';
    show('go-wait', wait !== null);
    el('go-wait').textContent = wait ?? '';
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (isShown('join')) {
      // Typing a code: W, A, S and D are letters here, not directions.
      if (e.code === 'Escape') this.closeJoin();
      if (e.code === 'Enter') this.submitJoin();
      return;
    }
    if (e.code === 'Escape' && this.onlineGame && !this.resultShown) {
      // Online games don't pause: Escape opens a menu, and the game carries on behind it.
      e.preventDefault();
      this.toggleMenu();
      return;
    }
    if (e.code === 'Escape' && this.inGame) {
      e.preventDefault();
      this.setPaused(!this.loop.isPaused);
      return;
    }
    if (
      e.code === 'Enter' &&
      !this.driving &&
      !this.menuOpen &&
      document.activeElement === document.body &&
      performance.now() >= this.enterLockedUntil
    ) {
      // Enter starts from the setup or result screen when no button has focus (buttons handle Enter themselves).
      if (this.onlineGame) return;
      this.startPressed();
      return;
    }
    const menuAction = this.driving ? null : menuActionForKey(e.code);
    if (menuAction) {
      e.preventDefault(); // arrows mustn't also scroll the page
      this.onMenuAction(menuAction, performance.now());
      return;
    }
    this.keyboard.onKeyDown(e);
  }

  /**
   * Menu actions from the gamepad (and the keyboard's driving keys): pausing (or the online menu) during play, and
   * moving round the setup, lobby, result and dialog screens otherwise.
   */
  private onMenuAction(action: MenuAction, now: number): void {
    if (this.inGame) {
      if (action === 'start' || (action === 'back' && this.loop.isPaused))
        this.setPaused(!this.loop.isPaused);
      return;
    }
    if (this.onlineGame && !this.resultShown) {
      if (action === 'start' || (action === 'back' && this.menuOpen)) {
        this.toggleMenu();
        return;
      }
      if (!this.menuOpen) return;
    }

    const onJoin = isShown('join');
    const onMenu = this.menuOpen;
    const onSetup = !onJoin && isShown('setup');
    // The result screen ignores presses at first, so a player still hammering fire gets to see it.
    const onResult = !onMenu && isShown('gameover') && now >= this.enterLockedUntil;
    if (!onJoin && !onMenu && !onSetup && !onResult) return;

    // Rows follow what's on show, so they change with the mode and with online play.
    const rows: HTMLButtonElement[][] = onJoin
      ? visibleRows(JOIN_BUTTONS)
      : onMenu
        ? visibleRows(MENU_BUTTONS)
        : onSetup
          ? [...visibleOptionRows(), visibleButtons(SETUP_BUTTONS)].filter((r) => r.length > 0)
          : visibleRows(RESULT_BUTTONS);
    // The main button: Start on the setup screen, otherwise the first one on show.
    const primary = onSetup ? rows.at(-1)?.[0] : rows[0]?.[0];
    const focused = document.activeElement;
    let row = rows.findIndex((r) => r.some((b) => b === focused));
    if (row < 0) {
      // Nothing focused yet: start from the main button. A or B only highlights it; a direction moves on from it.
      primary?.focus();
      if (action === 'confirm' || action === 'back') return;
      row = rows.findIndex((r) => r.some((b) => b === primary));
      if (row < 0) return;
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
        if (onJoin) this.closeJoin();
        else if (onMenu) this.toggleMenu();
        else if (onResult && !this.session) el('settings').click();
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

  /**
   * The tab is hidden, the window lost focus or the gamepad went: a local game pauses. An online game can't, so the
   * player's tank just gets no input while they're away.
   */
  private autoPause(): void {
    this.keyboard.clear(); // no stuck keys when focus comes back
    if (this.session && this.onlineGame) this.session.sendInput(IDLE_INPUT, performance.now());
    else if (this.inGame) this.setPaused(true);
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

  // --- Online play -------------------------------------------------------------------------------------------

  private wireOnline(): void {
    show('host-online', this.server !== null);
    show('join-online', this.server !== null);
    el('host-online').addEventListener('click', () => this.hostOnline());
    el('join-online').addEventListener('click', () => this.openJoin());
    el('lobby-bot').addEventListener('click', () => this.session?.playBot());
    el('lobby-leave').addEventListener('click', () => this.leaveOnline());
    el('lobby-copy').addEventListener('click', () => this.copyLink());
    el('join-go').addEventListener('click', () => this.submitJoin());
    el('join-cancel').addEventListener('click', () => this.closeJoin());
    el('menu-back').addEventListener('click', () => this.closeMenu());
    el('menu-leave').addEventListener('click', () => this.confirmLeave(true));
    el('menu-no').addEventListener('click', () => this.confirmLeave(false));
    el('menu-yes').addEventListener('click', () => this.leaveOnline());
  }

  /** At page load: back into a seat this tab held (a refresh), or straight into a room from a join link. */
  private resumeOnline(): void {
    const action = onLoad(this.server, this.seats.load(), location.href);
    if (action.t === 'rejoin') this.beginOnline(OnlineSession.rejoin(action.seat, this.sessionDeps()));
    else if (action.t === 'join') this.beginOnline(OnlineSession.join(action.code, this.sessionDeps()));
  }

  private hostOnline(): void {
    if (this.server === null || this.session || setupProblem(this.choices)) return;
    this.fitNote = fitForTwo(this.choices);
    this.beginOnline(OnlineSession.host(onlineOptionsFor(this.choices), this.sessionDeps()));
  }

  private beginOnline(session: OnlineSession): void {
    this.session = session;
    // Each session counts its games from 1, so a new one mustn't look like a game already on screen.
    this.seenGameId = 0;
    this.setNotice(null);
    this.renderOnline();
  }

  private sessionDeps(): SessionDeps {
    const server = this.server!;
    const clock: Clock = {
      now: () => performance.now(),
      after: (ms, fn) => {
        const id = window.setTimeout(fn, ms);
        return () => window.clearTimeout(id);
      },
    };
    return {
      server,
      connect: (events) =>
        new Connection(server, (url) => new WebSocket(url) as unknown as SocketLike, clock, events),
      store: this.seats,
      now: () => performance.now(),
      changed: () => this.renderOnline(),
      // A refresh from here on rejoins by token, not by the code in the address.
      joined: () => history.replaceState(history.state, '', withoutJoin(location.href)),
    };
  }

  /** Brings the screen up to date with the online session: the lobby, back to setup, or the result's choices. */
  private renderOnline(): void {
    const session = this.session;
    if (!session) return;
    switch (session.phase) {
      case 'ended':
        this.endOnline(session.notice);
        break;
      case 'connecting':
      case 'lobby':
        this.showLobby(session);
        break;
      case 'game':
        if (this.resultShown) this.setResultButtons();
        break;
    }
  }

  /** The setup panel becomes the room's lobby: its code and link on top, the options below. */
  private showLobby(session: OnlineSession): void {
    this.match = null;
    this.keyboard.active = false;
    this.resultShown = false;
    this.resultAt = null;
    this.closeMenu();
    for (const id of ['gameover', 'hud', 'banner', 'freeze', 'pause'] as const) show(id, false);
    show('setup', true);

    const setup = el('setup');
    setup.classList.toggle('read-only', !session.isHost);
    if (session.options && !session.isHost) applyOptions(this.choices, session.options);
    this.renderAllChoices();

    show('lobby', true);
    const code = session.code ?? '····';
    el('lobby-code').textContent = code;
    el<HTMLInputElement>('lobby-link').value = session.code ? joinLink(location.href, session.code) : '';
    const connecting = session.phase === 'connecting';
    el('lobby-status').textContent =
      connecting || !session.seat ? 'Connecting to the server…' : lobbyStatus(session.seat, session.guest);
    const note = session.lobbyNote ?? (session.isHost ? this.fitNote : null);
    show('lobby-note', note !== null);
    el('lobby-note').textContent = note ?? '';

    show('host-online', false);
    show('join-online', false);
    show('start', session.isHost || connecting);
    el('start').setAttribute('aria-disabled', String(!session.guest || setupProblem(this.choices) !== null));
    show('lobby-bot', session.isHost && session.botOffered && !session.guest && !connecting);
    show('lobby-leave', true);
    if (!setup.contains(document.activeElement) || isHiddenElement(document.activeElement)) {
      firstVisible(session.isHost ? ['start', 'lobby-leave'] : ['lobby-leave'])?.focus();
    }
  }

  /** Back to the setup screen as it was before going online, saying why if there's a reason. */
  private endOnline(notice: string | null): void {
    this.session = null;
    this.fitNote = null;
    this.resultShown = false;
    this.resultAt = null;
    this.closeMenu();
    show('freeze', false);
    show('lobby', false);
    el('setup').classList.remove('read-only');
    show('host-online', this.server !== null);
    show('join-online', this.server !== null);
    show('lobby-bot', false);
    show('lobby-leave', false);
    show('start', true);
    this.renderer.viewer = HUMAN_ID;
    this.renderAllChoices();
    this.setNotice(notice);
    this.showSetup();
  }

  private leaveOnline(): void {
    if (this.session) this.session.leave();
    else this.showSetup();
  }

  /** The host changed an option in the lobby: the room gets the new options. */
  private optionsChanged(): void {
    const session = this.session;
    if (!session || !session.isHost || session.phase !== 'lobby') return;
    el('start').setAttribute('aria-disabled', String(!session.guest || setupProblem(this.choices) !== null));
    if (!setupProblem(this.choices)) session.setOptions(onlineOptionsFor(this.choices));
  }

  private setNotice(notice: string | null): void {
    show('online-notice', notice !== null);
    el('online-notice').textContent = notice ?? '';
  }

  private copyLink(): void {
    const input = el<HTMLInputElement>('lobby-link');
    const done = (text: string): void => {
      el('lobby-copy').textContent = text;
      window.setTimeout(() => (el('lobby-copy').textContent = 'Copy link'), 1500);
    };
    // Clipboard access can be refused (an insecure page, say): then the link is selected, ready to copy by hand.
    const byHand = (): void => {
      input.select();
      done('Press Ctrl+C');
    };
    if (navigator.clipboard) navigator.clipboard.writeText(input.value).then(() => done('Copied!'), byHand);
    else byHand();
  }

  private openJoin(): void {
    if (this.server === null || this.session) return;
    el<HTMLInputElement>('join-code').value = '';
    show('join-error', false);
    show('join', true);
    el('join-code').focus();
  }

  private closeJoin(): void {
    show('join', false);
    el('join-online').focus();
  }

  private submitJoin(): void {
    const typed = el<HTMLInputElement>('join-code').value;
    const problem = typedCodeProblem(typed);
    show('join-error', problem !== null);
    el('join-error').textContent = problem ?? '';
    if (problem) {
      el('join-code').focus();
      return;
    }
    show('join', false);
    this.beginOnline(OnlineSession.join(normalizeCode(typed), this.sessionDeps()));
  }

  private toggleMenu(): void {
    if (this.menuOpen) {
      this.closeMenu();
      return;
    }
    this.menuOpen = true;
    this.keyboard.clear();
    this.confirmLeave(false);
    show('online-menu', true);
  }

  private closeMenu(): void {
    this.menuOpen = false;
    show('online-menu', false);
    (document.activeElement as HTMLElement | null)?.blur();
  }

  private confirmLeave(confirming: boolean): void {
    show('menu-main', !confirming);
    show('menu-confirm', confirming);
    el(confirming ? 'menu-no' : 'menu-back').focus();
  }

  // --- The setup screen --------------------------------------------------------------------------------------

  /**
   * Shows only the selected mode's options. Online-only options (friendly fire) show in the lobby, and the AI counts
   * stop at what two players allow.
   */
  private showModeOptions(): void {
    const lobby = this.inLobby;
    for (const option of document.querySelectorAll<HTMLElement>('#setup .option[data-mode]')) {
      const online = option.dataset['online'] !== undefined;
      option.classList.toggle('hidden', option.dataset['mode'] !== this.choices.mode || (online && !lobby));
    }
    for (const id of ['opt-ai', 'opt-start-ai'] as const) {
      for (const button of el(id).querySelectorAll<HTMLElement>('button')) {
        button.classList.toggle('hidden', lobby && Number(button.dataset['value']) > ONLINE_AI_MAX);
      }
    }
    el('tagline').textContent = TAGLINES[this.choices.mode];
  }

  /** Every option row, the map picker and which options show, after the choices changed under the player. */
  private renderAllChoices(): void {
    for (const render of this.optionRenders) render();
    this.showModeOptions();
    this.renderMapPicker();
  }

  /** The number of rounds or the mode changed, so the sequence's limit may have too. */
  private limitChanged(): void {
    fitSequence(this.choices);
    this.renderMapPicker();
  }

  /** The library: every built-in board, as a card that adds it to the end of the sequence. */
  private buildMapLibrary(): void {
    const library = el('map-library');
    for (const board of BUILT_IN_BOARDS) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'map-card';
      card.setAttribute('aria-label', `Add ${board.name}`);
      card.append(thumbnailCanvas(board.id, CARD_SIZE), board.name);
      card.addEventListener('click', () => {
        if (this.readOnly) return;
        if (addToSequence(this.choices, board.id)) this.renderMapPicker();
        this.optionsChanged();
      });
      library.appendChild(card);
    }
  }

  /**
   * Brings the Maps option's dependants up to date: the picker (shown for Sequence only), the sequence strip, its
   * count, which cards can still be added, and whether the game can start.
   */
  private renderMapPicker(): void {
    show('map-picker', this.choices.maps === 'sequence');
    const strip = el('map-sequence');
    const focusedIndex = [...strip.querySelectorAll('button')].findIndex((b) => b === document.activeElement);
    strip.replaceChildren();
    this.choices.sequence.forEach((id, i) => {
      const entry = document.createElement('button');
      entry.type = 'button';
      entry.className = 'map-entry';
      entry.title = boardName(id);
      entry.setAttribute('aria-label', `Remove map ${i + 1}, ${boardName(id)}`);
      entry.append(`${i + 1}`, thumbnailCanvas(id, ENTRY_SIZE));
      entry.addEventListener('click', () => {
        if (this.readOnly) return;
        removeFromSequence(this.choices, i);
        this.renderMapPicker();
        this.optionsChanged();
      });
      strip.appendChild(entry);
    });
    if (this.choices.sequence.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'map-empty';
      empty.textContent = 'No maps yet: add some from above.';
      strip.appendChild(empty);
    }
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'map-clear';
    clear.textContent = 'Clear';
    clear.setAttribute('aria-disabled', String(this.choices.sequence.length === 0));
    clear.addEventListener('click', () => {
      if (this.readOnly) return;
      this.choices.sequence.length = 0;
      this.renderMapPicker();
      this.optionsChanged();
    });
    strip.appendChild(clear);
    // Removing an entry rebuilds the strip; keep the focus in the same place so the d-pad doesn't lose its way.
    if (focusedIndex >= 0) {
      const buttons = strip.querySelectorAll('button');
      buttons[Math.min(focusedIndex, buttons.length - 1)]?.focus();
    }

    const count = sequenceCount(this.choices);
    el('map-count').textContent = count.full ? `${count.text} · full` : count.text;
    for (const card of el('map-library').querySelectorAll('button')) {
      card.setAttribute('aria-disabled', String(count.full));
    }
    const problem = setupProblem(this.choices);
    el('setup-problem').textContent = problem ?? '';
    show('setup-problem', problem !== null);
    el('start').setAttribute(
      'aria-disabled',
      String(problem !== null || (this.session !== null && !this.session.guest)),
    );
    this.drawThumbnails();
  }

  /** (Re)draws every map thumbnail in the current theme's colours. */
  private drawThumbnails(): void {
    for (const canvas of el('setup').querySelectorAll<HTMLCanvasElement>('canvas[data-board]')) {
      const board = BUILT_IN_BOARDS.find((b) => b.id === canvas.dataset['board']);
      const [w, h] = canvas.closest('.map-entry') ? ENTRY_SIZE : CARD_SIZE;
      if (board) this.renderer.drawThumbnail(canvas, board, w, h);
    }
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
        if (this.readOnly) return; // the guest's view of the room's options
        set(value);
        render();
        this.optionsChanged();
      });
      container.appendChild(button);
    }
    this.optionRenders.push(render);
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
  return [...document.querySelectorAll<HTMLElement>('#setup .choices')]
    .filter((choices) => choices.closest('.hidden') === null)
    .map((choices) => [...choices.querySelectorAll('button')].filter((b) => !b.classList.contains('hidden')))
    .filter((row) => row.length > 0);
}

/** The buttons with these ids that are on show, as one row. */
function visibleButtons(ids: readonly StageId[]): HTMLButtonElement[] {
  return ids.map((id) => el<HTMLButtonElement>(id)).filter((b) => !isHiddenElement(b));
}

/** The buttons with these ids that are on show, one to a row. */
function visibleRows(ids: readonly StageId[]): HTMLButtonElement[][] {
  return visibleButtons(ids).map((b) => [b]);
}

function firstVisible(ids: readonly StageId[]): HTMLButtonElement | undefined {
  return visibleButtons(ids)[0];
}

function isHiddenElement(element: Element | null): boolean {
  return element === null || element.closest('.hidden') !== null;
}

/** A canvas for a board's thumbnail, sized for the page; Game.drawThumbnails draws it. */
function thumbnailCanvas(boardId: string, [width, height]: readonly [number, number]): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.dataset['board'] = boardId;
  canvas.width = width;
  canvas.height = height;
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
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
  // No server tag (and not the development server): single-player only, and no connection is ever made.
  const server = serverAddress({
    serverTag: readServerTag(document),
    hostname: location.hostname,
    dev: import.meta.env.DEV,
  });
  game = new Game(first.theme, server);
  if (late) use(late);
}

void boot();
