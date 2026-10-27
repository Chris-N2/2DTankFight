import { PALETTE, SHELL } from './colours';

// The arena and menu theme: built-in defaults, then a theme file, then the host page's own --tank-* CSS variables.
// The decisions are pure functions; the few browser bits (fetch, styles, meta tags) are passed in, so it all tests
// without a DOM.

export const THEME_KEYS = [
  'backdrop',
  'floor',
  'grid',
  'wall',
  'wallEdge',
  'border',
  'panel',
  'ink',
  'muted',
  'accent',
  'font',
] as const;

export type ThemeKey = (typeof THEME_KEYS)[number];
export type Theme = Record<ThemeKey, string>;
export type PartialTheme = Partial<Theme>;

/** The original look. */
export const THEME_DEFAULTS: Readonly<Theme> = Object.freeze({
  backdrop: '#0d100b',
  floor: '#26301f',
  grid: '#2d3925',
  wall: '#c9a66b',
  wallEdge: '#8a6d3f',
  border: '#8a6d3f',
  panel: 'rgba(20, 26, 16, 0.92)',
  ink: '#f2ecd8',
  muted: '#a9a58f',
  accent: '#7be36f',
  font: "ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace",
});

/** The page's `<meta name="tank-command-theme" content="...">` tag points at a theme file elsewhere. */
export const THEME_META_NAME = 'tank-command-theme';
/** How long to hold the first frame for the theme file, so the default look doesn't flash first. */
export const THEME_WAIT_MS = 1000;
/** Below this (redmean) distance from a tank or shell colour, the floor counts as too close to see clearly. */
export const CONTRAST_MIN_DISTANCE = 80;

/** `wallEdge` → `--tank-wall-edge`. */
export function cssVarName(key: ThemeKey): string {
  return `--tank-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

export interface ThemeCheck {
  values: PartialTheme;
  warnings: string[];
}

export interface ThemeResult {
  theme: Theme;
  warnings: string[];
}

function isThemeKey(key: string): key is ThemeKey {
  return (THEME_KEYS as readonly string[]).includes(key);
}

/**
 * Checks a parsed theme file. Valid settings are kept and each problem becomes a warning; nothing here ever
 * stops the game. `isColour` decides what counts as a colour (in the browser, whatever CSS accepts).
 */
export function validateTheme(json: unknown, isColour: (value: string) => boolean): ThemeCheck {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return { values: {}, warnings: ['Theme file ignored: it should be a JSON object of settings.'] };
  }
  const values: PartialTheme = {};
  const warnings: string[] = [];
  for (const [key, value] of Object.entries(json)) {
    if (!isThemeKey(key)) {
      warnings.push(`Theme setting "${key}" ignored: it is not a theme setting (${THEME_KEYS.join(', ')}).`);
      continue;
    }
    const text = typeof value === 'string' ? value.trim() : '';
    if (key === 'font' ? text === '' : text === '' || !isColour(text)) {
      warnings.push(
        `Theme setting "${key}" ignored: ${key === 'font' ? 'expected a font name' : 'expected a CSS colour'}, got ${JSON.stringify(value)}.`,
      );
      continue;
    }
    values[key] = text;
  }
  return { values, warnings };
}

/** Defaults, overridden by the theme file, overridden by the host page's own CSS variables. */
export function resolveTheme(defaults: Readonly<Theme>, file: PartialTheme, page: PartialTheme): Theme {
  return { ...defaults, ...file, ...page };
}

export type Rgb = readonly [number, number, number];

/** A cheap, roughly perceptual distance between two colours ("redmean"); 0 is identical, about 765 is black–white. */
export function colourDistance(a: Rgb, b: Rgb): number {
  const rMean = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db);
}

/** Reads the colour formats a canvas hands back from `fillStyle`: `#rrggbb` or `rgb(a)(r, g, b[, a])`. */
export function parseCanvasColour(text: string): Rgb | null {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(text.trim());
  if (hex) return [parseInt(hex[1]!, 16), parseInt(hex[2]!, 16), parseInt(hex[3]!, 16)];
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(text.trim());
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

/**
 * Warnings for a floor too close to a tank or shell colour to see them clearly. `normalise` turns any CSS colour
 * into RGB (or null if it can't). Only the floor matters: it's what tanks and shells are seen against.
 */
export function contrastWarnings(theme: Theme, normalise: (colour: string) => Rgb | null): string[] {
  const floor = normalise(theme.floor);
  if (!floor) return [];
  const warnings: string[] = [];
  for (const [name, colour] of [
    ...PALETTE.map((c, i) => [`tank colour ${i + 1}`, c]),
    ['shell colour', SHELL],
  ]) {
    const rgb = normalise(colour!);
    if (rgb && colourDistance(floor, rgb) < CONTRAST_MIN_DISTANCE) {
      warnings.push(
        `Theme floor ${theme.floor} is hard to tell apart from the ${name} (${colour}); tanks or shells may be hard to see.`,
      );
    }
  }
  return warnings;
}

/** The browser's answers to "is this a colour?" and "what RGB is it?", for validation and the contrast check. */
export function browserColourTools(): {
  isColour: (value: string) => boolean;
  normalise: (colour: string) => Rgb | null;
} {
  const ctx = document.createElement('canvas').getContext('2d');
  return {
    isColour: (value) => CSS.supports('color', value),
    normalise: (colour) => {
      if (!ctx) return null;
      // A canvas reads back any CSS colour as #rrggbb or rgba(...); an invalid one leaves the black in place.
      ctx.fillStyle = '#000000';
      ctx.fillStyle = colour;
      return parseCanvasColour(String(ctx.fillStyle));
    },
  };
}

/** Where to look for the theme file: the page's meta tag if it has one, otherwise `theme.json` beside the game. */
export function themeUrl(doc: Pick<Document, 'querySelector' | 'baseURI'>, scriptUrl: string): string {
  const content = doc.querySelector(`meta[name="${THEME_META_NAME}"]`)?.getAttribute('content')?.trim();
  // The script lives in assets/, so the game's own folder is one up.
  return content ? new URL(content, doc.baseURI).href : new URL('../theme.json', scriptUrl).href;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

/** Loads and checks the theme file. A missing file just means no theme; anything else that goes wrong warns. */
export async function loadTheme(
  url: string,
  fetchFn: FetchLike,
  isColour: (value: string) => boolean,
): Promise<ThemeCheck> {
  let json: unknown;
  try {
    const response = await fetchFn(url, { cache: 'no-cache' });
    if (response.status === 404) return { values: {}, warnings: [] };
    if (!response.ok) {
      return { values: {}, warnings: [`Theme file ${url} ignored: the server answered ${response.status}.`] };
    }
    json = await response.json();
  } catch {
    return {
      values: {},
      warnings: [`Theme file ${url} ignored: it could not be loaded or isn't valid JSON.`],
    };
  }
  return validateTheme(json, isColour);
}

/** The --tank-* values the host page's own CSS sets. Read before the game applies anything of its own. */
export function readPageOverrides(style: Pick<CSSStyleDeclaration, 'getPropertyValue'>): PartialTheme {
  const page: PartialTheme = {};
  for (const key of THEME_KEYS) {
    const value = style.getPropertyValue(cssVarName(key)).trim();
    if (value) page[key] = value;
  }
  return page;
}

/** Writes the final theme onto the root element, where both the CSS and the canvas read it. */
export function applyTheme(root: { style: Pick<CSSStyleDeclaration, 'setProperty'> }, theme: Theme): void {
  for (const key of THEME_KEYS) root.style.setProperty(cssVarName(key), theme[key]);
}

/**
 * The theme to start with. Waits up to `waitMs` for the theme file so the first frame is already themed; if it's
 * slower than that, starts without it and hands the full theme to `onLate` when it arrives.
 */
export async function startTheme(
  page: PartialTheme,
  load: Promise<ThemeCheck>,
  waitMs: number,
  onLate: (result: ThemeResult) => void,
): Promise<ThemeResult> {
  const finish = (check: ThemeCheck): ThemeResult => ({
    theme: resolveTheme(THEME_DEFAULTS, check.values, page),
    warnings: check.warnings,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), waitMs);
  });
  const first = await Promise.race([load, timedOut]);
  clearTimeout(timer);
  if (first) return finish(first);
  void load.then((check) => onLate(finish(check)));
  return finish({ values: {}, warnings: [] });
}
