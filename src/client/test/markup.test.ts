import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { MOUNT_ID, mountStage, STAGE_HTML, STAGE_IDS, type MountDocument } from '../src/markup';

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('hosting: the game builds its own screens', () => {
  test('every element the game looks up is in its markup, exactly once', () => {
    for (const id of STAGE_IDS) {
      expect(STAGE_HTML.split(`id="${id}"`).length - 1, id).toBe(1);
    }
  });

  test('main.ts only looks up elements by the known ids', () => {
    // el(), show(), isShown() and setText() are typed to StageId; this also catches a lookup via getElementById.
    const main = read('../src/main.ts');
    const looked = [...main.matchAll(/getElementById\(([^)]*)\)/g)].map((m) => m[1]);
    // el()'s own lookup, typed to StageId. (The mount element is found by mountStage in markup.ts.)
    expect(looked).toEqual(['id']);
  });

  test('A host template: index.html is just the minimal host page', () => {
    const html = read('../index.html');
    const body = /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? '';
    const tags = [...body.matchAll(/<([a-z]+)[\s>]/g)].map((m) => m[1]);
    expect(tags).toEqual(['div', 'script']);
    expect(body).toContain(`<div id="${MOUNT_ID}"></div>`);
    expect(html).not.toContain('id="stage"');
  });
});

describe('hosting: mounting', () => {
  type FakeElement = { id: string; innerHTML: string };

  /** A page with (or without) the mount element; records what gets added to the body. */
  function page(withMount: boolean): { doc: MountDocument; mount: FakeElement | null; added: FakeElement[] } {
    const mount = withMount ? { id: MOUNT_ID, innerHTML: '' } : null;
    const added: FakeElement[] = [];
    const doc = {
      getElementById: (id: string) => (id === MOUNT_ID ? mount : null),
      createElement: () => ({ id: '', innerHTML: '' }),
      body: { appendChild: (node: FakeElement) => added.push(node) },
    } as unknown as MountDocument;
    return { doc, mount, added };
  }

  test('A host template: the screens are built inside the page’s mount element', () => {
    const { doc, mount, added } = page(true);
    const warn = vi.fn();
    mountStage(doc, warn);
    expect(mount?.innerHTML).toBe(STAGE_HTML);
    expect(added).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  test('Missing mount element', () => {
    const { doc, added } = page(false);
    const warn = vi.fn();
    mountStage(doc, warn);
    expect(added).toHaveLength(1);
    expect(added[0]).toEqual({ id: MOUNT_ID, innerHTML: STAGE_HTML });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toContain(MOUNT_ID);
  });
});
