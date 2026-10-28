import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { PALETTE, SHELL } from '../src/colours';
import { createMatch, HUMAN_ID } from '@tank/sim';
import { arenaColours, colorOf } from '../src/renderer';
import {
  applyTheme,
  colourDistance,
  contrastWarnings,
  cssVarName,
  loadTheme,
  parseCanvasColour,
  readPageOverrides,
  resolveTheme,
  startTheme,
  THEME_DEFAULTS,
  THEME_KEYS,
  themeUrl,
  validateTheme,
  type ThemeCheck,
} from '../src/theme';

/** Good enough for tests: hex colours, rgb()/rgba() and a few names. The browser uses CSS.supports instead. */
const isColour = (v: string): boolean =>
  /^#[0-9a-f]{3,8}$/i.test(v) || /^rgba?\(/i.test(v) || ['white', 'black', 'pink'].includes(v);

/** Normalises the colours tests use (hex only), as the browser's canvas does for any colour. */
const normalise = (v: string) => parseCanvasColour(v);

const response = (status: number, body: unknown, badJson = false) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => (badJson ? Promise.reject(new SyntaxError('bad')) : Promise.resolve(body)),
});

describe('theme: settings', () => {
  test('No theme looks as before', () => {
    const theme = resolveTheme(THEME_DEFAULTS, {}, {});
    expect(theme).toEqual(THEME_DEFAULTS);
    expect(arenaColours(theme)).toEqual({
      backdrop: '#0d100b',
      floor: '#26301f',
      grid: '#2d3925',
      wall: '#c9a66b',
      wallEdge: '#8a6d3f',
      border: '#8a6d3f',
    });
  });

  test('every setting has a --tank- custom property', () => {
    expect(cssVarName('wallEdge')).toBe('--tank-wall-edge');
    expect(cssVarName('floor')).toBe('--tank-floor');
    expect(new Set(THEME_KEYS.map(cssVarName)).size).toBe(THEME_KEYS.length);
  });

  test('Arena and menus follow the theme', () => {
    const { values } = validateTheme({ floor: '#ffffff', accent: '#ff00aa' }, isColour);
    const theme = resolveTheme(THEME_DEFAULTS, values, {});
    expect(arenaColours(theme).floor).toBe('#ffffff');
    // The menus read the same values through the custom properties written onto the page.
    const written = new Map<string, string>();
    applyTheme(
      { style: { setProperty: (name: string, value: string | null) => written.set(name, value ?? '') } },
      theme,
    );
    expect(written.get('--tank-accent')).toBe('#ff00aa');
    expect(written.get('--tank-floor')).toBe('#ffffff');
    expect(written.size).toBe(THEME_KEYS.length);
  });
});

describe('theme: precedence', () => {
  test('The host stylesheet wins', () => {
    const theme = resolveTheme(THEME_DEFAULTS, { floor: '#111111' }, { floor: '#222222' });
    expect(theme.floor).toBe('#222222');
  });

  test('Mixing sources', () => {
    const theme = resolveTheme(THEME_DEFAULTS, { wall: '#334455' }, { accent: '#ff00aa' });
    expect(theme).toEqual({ ...THEME_DEFAULTS, wall: '#334455', accent: '#ff00aa' });
  });

  test("the page's overrides are the --tank-* values its CSS sets", () => {
    const set: Record<string, string> = { '--tank-floor': ' #222222 ', '--tank-wall-edge': '#010203' };
    const page = readPageOverrides({ getPropertyValue: (name: string) => set[name] ?? '' });
    expect(page).toEqual({ floor: '#222222', wallEdge: '#010203' });
  });
});

describe('theme: validation', () => {
  test('One bad colour', () => {
    const { values, warnings } = validateTheme({ floor: 'not-a-colour', wall: '#334455' }, isColour);
    expect(values).toEqual({ wall: '#334455' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"floor"');
  });

  test('Unknown setting', () => {
    const { values, warnings } = validateTheme({ tankColour: '#ff0000', wall: '#334455' }, isColour);
    expect(values).toEqual({ wall: '#334455' });
    expect(warnings[0]).toContain('"tankColour"');
    expect(warnings[0]).toContain('not a theme setting');
  });

  test('Broken file: not an object', () => {
    for (const json of [[1, 2], 'floor', 42, null]) {
      const { values, warnings } = validateTheme(json, isColour);
      expect(values).toEqual({});
      expect(warnings).toHaveLength(1);
    }
  });

  test('font must be a non-empty string; colours must be strings', () => {
    const { values, warnings } = validateTheme(
      { font: '  ', ink: 12, muted: '#abcdef', accent: 'pink' },
      isColour,
    );
    expect(values).toEqual({ muted: '#abcdef', accent: 'pink' });
    expect(warnings.map((w) => /"(\w+)"/.exec(w)?.[1])).toEqual(['font', 'ink']);
    expect(validateTheme({ font: 'Georgia, serif' }, isColour).values).toEqual({ font: 'Georgia, serif' });
  });
});

describe('theme: contrast', () => {
  test('Green floor', () => {
    const warnings = contrastWarnings({ ...THEME_DEFAULTS, floor: PALETTE[0]! }, normalise);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(PALETTE[0]);
    expect(warnings[0]).toContain('tank colour 1');
  });

  test('a floor close to the shell colour warns too', () => {
    expect(contrastWarnings({ ...THEME_DEFAULTS, floor: '#fffbe0' }, normalise).join()).toContain(SHELL);
  });

  test('Default theme is fine', () => {
    expect(contrastWarnings(THEME_DEFAULTS, normalise)).toEqual([]);
  });

  test('colours a canvas hands back are read, others are not', () => {
    expect(parseCanvasColour('#ff8000')).toEqual([255, 128, 0]);
    expect(parseCanvasColour('rgba(20, 26, 16, 0.92)')).toEqual([20, 26, 16]);
    expect(parseCanvasColour('papayawhip')).toBeNull();
    expect(colourDistance([0, 0, 0], [0, 0, 0])).toBe(0);
    expect(colourDistance([0, 0, 0], [255, 255, 255])).toBeGreaterThan(700);
  });
});

describe('theme: the theme file', () => {
  const doc = (meta: string | null, baseURI = 'https://example.com/games/tank/') => ({
    baseURI,
    querySelector: (selector: string) =>
      meta !== null && selector.includes('tank-command-theme')
        ? ({ getAttribute: (name: string) => (name === 'content' ? meta : null) } as unknown as Element)
        : null,
  });
  const script = 'https://example.com/games/tank/assets/tank-command.js';

  test('Theme next to the game', () => {
    expect(themeUrl(doc(null), script)).toBe('https://example.com/games/tank/theme.json');
  });

  test('Theme elsewhere', () => {
    expect(themeUrl(doc('/site-themes/tank.json'), script)).toBe('https://example.com/site-themes/tank.json');
    expect(themeUrl(doc('tank.json', 'https://example.com/play/'), script)).toBe(
      'https://example.com/play/tank.json',
    );
    expect(themeUrl(doc('  '), script)).toBe('https://example.com/games/tank/theme.json'); // an empty tag is no tag
  });

  test('a theme file next to the game is loaded and checked', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(response(200, { wall: '#334455' })));
    expect(await loadTheme('https://x/theme.json', fetchFn, isColour)).toEqual({
      values: { wall: '#334455' },
      warnings: [],
    });
    expect(fetchFn).toHaveBeenCalledWith('https://x/theme.json', { cache: 'no-cache' });
  });

  test('No theme file', async () => {
    expect(await loadTheme('u', () => Promise.resolve(response(404, null)), isColour)).toEqual({
      values: {},
      warnings: [],
    });
  });

  test('Broken file: invalid JSON, a server error or no connection', async () => {
    for (const fetchFn of [
      () => Promise.resolve(response(200, null, true)),
      () => Promise.resolve(response(500, null)),
      () => Promise.reject(new TypeError('offline')),
    ]) {
      const check = await loadTheme('u', fetchFn, isColour);
      expect(check.values).toEqual({});
      expect(check.warnings).toHaveLength(1);
    }
  });
});

describe('theme: start-up', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('Themed from the first frame', async () => {
    const onLate = vi.fn();
    const load = Promise.resolve<ThemeCheck>({ values: { floor: '#123456' }, warnings: ['w'] });
    const result = await startTheme({ accent: '#ff00aa' }, load, 1000, onLate);
    expect(result.theme).toEqual({ ...THEME_DEFAULTS, floor: '#123456', accent: '#ff00aa' });
    expect(result.warnings).toEqual(['w']);
    expect(onLate).not.toHaveBeenCalled();
  });

  test('Slow theme', async () => {
    vi.useFakeTimers();
    let arrive: (check: ThemeCheck) => void = () => {};
    const load = new Promise<ThemeCheck>((resolve) => (arrive = resolve));
    const onLate = vi.fn();
    const starting = startTheme({ accent: '#ff00aa' }, load, 1000, onLate);
    await vi.advanceTimersByTimeAsync(1000);
    const first = await starting;
    // Starts with the defaults (and the page's own values) rather than waiting any longer...
    expect(first.theme).toEqual({ ...THEME_DEFAULTS, accent: '#ff00aa' });
    // ...and switches to the theme once it arrives.
    arrive({ values: { floor: '#123456' }, warnings: [] });
    await vi.advanceTimersByTimeAsync(0);
    expect(onLate).toHaveBeenCalledWith({
      theme: { ...THEME_DEFAULTS, floor: '#123456', accent: '#ff00aa' },
      warnings: [],
    });
  });
});

describe('theme: gameplay colours', () => {
  test('You are green, and Tanks keep their colours, whatever the theme', () => {
    const state = createMatch(
      {
        mode: 'lastOneStanding',
        aiCount: 4,
        rounds: 3,
        mortars: true,
        maps: { kind: 'sequence', ids: ['proving-ground'] },
      },
      1,
    );
    // The theme never reaches tank colours: they come from the fixed palette, by tank.
    expect(colorOf(state, HUMAN_ID)).toBe('#7be36f');
    expect(state.tanks.map((t) => colorOf(state, t.id))).toEqual([...PALETTE]);
  });
});

describe('theme: in-game text', () => {
  /** The declarations in one CSS rule (just that selector, not a longer one starting with it). */
  const rule = (css: string, selector: string): string =>
    new RegExp(`(?:^|\\n)${selector.replace('.', '\\.')} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';

  test('Banner text stays readable over the arena', () => {
    // The banner floats over the walls, so it mustn't share their colour, and its halo keeps it readable on anything.
    const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
    const banner = rule(css, '.banner');
    expect(banner).toContain('--halo: var(--t-backdrop)');
    expect(banner).toMatch(/text-shadow:[^;]*var\(--halo\)/);
    expect(banner).not.toMatch(/background/);
    for (const selector of ['.banner', '.banner-title', '.banner-sub']) {
      expect(rule(css, selector), selector).not.toContain('--t-wall');
    }
    expect(rule(css, '.banner-sub')).toContain('color: var(--t-ink)');
  });
});

describe('theme: the sample theme', () => {
  test('theme.example.json has every setting, at its default, and validates cleanly', () => {
    const sample: unknown = JSON.parse(
      readFileSync(new URL('../public/theme.example.json', import.meta.url), 'utf8'),
    );
    expect(validateTheme(sample, isColour)).toEqual({ values: { ...THEME_DEFAULTS }, warnings: [] });
  });
});
