import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import config, { ENTRY_SCRIPT, ENTRY_STYLES } from '../vite.config';

const clientRoot = fileURLToPath(new URL('..', import.meta.url));
let outDir = '';

describe('hosting: the build', () => {
  beforeAll(async () => {
    outDir = mkdtempSync(join(tmpdir(), 'tank-command-build-'));
    await build({
      root: clientRoot,
      configFile: join(clientRoot, 'vite.config.ts'),
      logLevel: 'silent',
      build: { outDir, emptyOutDir: true },
    });
  }, 120_000);

  afterAll(() => {
    if (outDir) rmSync(outDir, { recursive: true, force: true });
  });

  test('Same names after a code change: the entry files have fixed names, not content hashes', () => {
    expect(existsSync(join(outDir, ENTRY_SCRIPT))).toBe(true);
    expect(existsSync(join(outDir, ENTRY_STYLES))).toBe(true);
    // The names come from the config, not the content, so they can't change between builds.
    const output = config.build?.rolldownOptions?.output;
    const entry = Array.isArray(output) ? undefined : output?.entryFileNames;
    expect(entry).toBe(ENTRY_SCRIPT);
    expect(ENTRY_SCRIPT + ENTRY_STYLES).not.toContain('[hash]');
  });

  test('No absolute paths in the build; the page refers to its files relatively', () => {
    const html = readFileSync(join(outDir, 'index.html'), 'utf8');
    expect(html).toContain(`src="./${ENTRY_SCRIPT}"`);
    expect(html).toContain(`href="./${ENTRY_STYLES}"`);
    expect(html).not.toMatch(/(src|href)="\//);
    const css = readFileSync(join(outDir, ENTRY_STYLES), 'utf8');
    expect(css).not.toMatch(/url\(\s*['"]?\//);
  });

  test('No theme looks as before: the build ships no theme.json, only the example', () => {
    // A local test theme left in public/ would be copied into every build and replace the original look.
    expect(existsSync(join(outDir, 'theme.json'))).toBe(false);
    expect(existsSync(join(outDir, 'theme.example.json'))).toBe(true);
  });

  test('Served from a sub-folder: the theme file is looked for beside the game, relative to the script', () => {
    const js = readFileSync(join(outDir, ENTRY_SCRIPT), 'utf8');
    expect(js).toContain('../theme.json');
    expect(js).toContain('import.meta.url');
  });
});
