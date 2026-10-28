import { BUILT_IN_BOARDS, createMatch, PAC_TANK, step, type MatchState } from '@tank/sim';
import { describe, expect, test } from 'vitest';
import { drawThumbnail, type ArenaColours, type ThumbnailContext } from '../src/renderer';
import {
  addToSequence,
  bannerFor,
  boardName,
  DEFAULT_CHOICES,
  fitSequence,
  matchOptionsFor,
  removeFromSequence,
  sequenceCount,
  setupProblem,
  type SetupChoices,
} from '../src/screens';

const fresh = (changes: Partial<SetupChoices> = {}): SetupChoices => ({
  ...DEFAULT_CHOICES,
  sequence: [],
  ...changes,
});

/** Steps through the current round's countdown and play until the next round's countdown, ending it by force. */
function nextRound(state: MatchState): void {
  while (state.phase === 'countdown') step(state, {});
  for (const t of state.tanks) t.hp = t.kind === 'ai' ? 0 : t.hp;
  step(state, {});
  while (state.phase === 'roundOver') step(state, {});
}

describe('setup: maps option', () => {
  test('Defaults allow an immediate start, with Random maps', () => {
    const choices = fresh();
    expect(choices.maps).toBe('random');
    expect(setupProblem(choices)).toBeNull();
    expect(matchOptionsFor(choices).maps).toEqual({ kind: 'random' });
    expect(() => createMatch(matchOptionsFor(choices), 1)).not.toThrow();
  });

  test('Building a sequence', () => {
    const choices = fresh({ maps: 'sequence' });
    for (const id of ['pac-tank', 'run-for-cover', 'pac-tank']) expect(addToSequence(choices, id)).toBe(true);
    expect(matchOptionsFor(choices).maps).toEqual({
      kind: 'sequence',
      ids: ['pac-tank', 'run-for-cover', 'pac-tank'],
    });
    const state = createMatch(matchOptionsFor(choices), 7);
    const played = [state.board.id];
    for (let i = 0; i < 2; i++) {
      nextRound(state);
      played.push(state.board.id);
    }
    expect(played).toEqual(['pac-tank', 'run-for-cover', 'pac-tank']);
  });

  test('the options get a copy of the sequence, so later picking doesn’t change a game in progress', () => {
    const choices = fresh({ maps: 'sequence', sequence: ['pac-tank'] });
    const options = matchOptionsFor(choices);
    addToSequence(choices, 'run-for-cover');
    expect(options.maps).toEqual({ kind: 'sequence', ids: ['pac-tank'] });
  });

  test('Removing a map', () => {
    const choices = fresh({ maps: 'sequence', sequence: ['pac-tank', 'run-for-cover', 'proving-ground'] });
    removeFromSequence(choices, 1);
    expect(choices.sequence).toEqual(['pac-tank', 'proving-ground']);
  });

  test('Limit follows the rounds', () => {
    const choices = fresh({ maps: 'sequence', rounds: 3 });
    for (let i = 0; i < 3; i++) expect(addToSequence(choices, 'pac-tank')).toBe(true);
    expect(addToSequence(choices, 'run-for-cover')).toBe(false);
    expect(choices.sequence).toHaveLength(3);
    expect(sequenceCount(choices)).toEqual({ text: '3 / 3', full: true });
  });

  test('Waves allows up to 7 maps', () => {
    const choices = fresh({ maps: 'sequence', mode: 'waves' });
    for (let i = 0; i < 7; i++) expect(addToSequence(choices, 'pac-tank')).toBe(true);
    expect(addToSequence(choices, 'pac-tank')).toBe(false);
    expect(sequenceCount(choices)).toEqual({ text: '7 / 7', full: true });
    expect(() => createMatch(matchOptionsFor(choices), 1)).not.toThrow();
  });

  test('Fewer rounds shortens the sequence', () => {
    const ids = ['pac-tank', 'run-for-cover', 'proving-ground', 'nowhere-to-hide', 'pac-tank'];
    const choices = fresh({ maps: 'sequence', rounds: 5, sequence: [...ids] });
    choices.rounds = 3;
    fitSequence(choices);
    expect(choices.sequence).toEqual(ids.slice(0, 3));
    expect(() => createMatch(matchOptionsFor(choices), 1)).not.toThrow();
  });

  test('Empty sequence can’t start', () => {
    const choices = fresh({ maps: 'sequence' });
    expect(setupProblem(choices)).toMatch(/at least one map/);
    // The setup screen won't start with a problem; the simulation would refuse these options too.
    expect(() => createMatch(matchOptionsFor(choices), 1)).toThrow();
    choices.maps = 'random';
    expect(setupProblem(choices)).toBeNull();
  });

  test('Sequence survives a mode switch', () => {
    const choices = fresh({
      maps: 'sequence',
      rounds: 5,
      sequence: ['pac-tank', 'run-for-cover', 'pac-tank'],
    });
    choices.mode = 'waves';
    fitSequence(choices);
    choices.mode = 'lastOneStanding';
    fitSequence(choices);
    expect(choices.sequence).toEqual(['pac-tank', 'run-for-cover', 'pac-tank']);
  });

  test('Switching to fewer rounds shortens the sequence', () => {
    const ids = ['pac-tank', 'run-for-cover', 'proving-ground', 'nowhere-to-hide', 'pac-tank'];
    const choices = fresh({ maps: 'sequence', mode: 'waves', rounds: 3, sequence: [...ids] });
    choices.mode = 'lastOneStanding';
    fitSequence(choices);
    expect(choices.sequence).toEqual(ids.slice(0, 3));
    expect(() => createMatch(matchOptionsFor(choices), 1)).not.toThrow();
  });

  test('the sequence is kept while Random is chosen', () => {
    const choices = fresh({ maps: 'sequence', sequence: ['pac-tank'] });
    choices.maps = 'random';
    expect(matchOptionsFor(choices).maps).toEqual({ kind: 'random' });
    choices.maps = 'sequence';
    expect(choices.sequence).toEqual(['pac-tank']);
  });

  test('board names for the sequence strip', () => {
    expect(boardName('pac-tank')).toBe('Pac-Tank');
    expect(boardName('nowhere-to-hide')).toBe('Nowhere (Much) To Hide');
  });
});

describe('map names in the countdown', () => {
  test('Name in the countdown', () => {
    const choices = fresh({ maps: 'sequence', sequence: ['proving-ground', 'pac-tank'] });
    const state = createMatch(matchOptionsFor(choices), 3);
    expect(bannerFor(state, false, false)?.sub).toBe('Round 1 of 5 · Proving Ground');
    nextRound(state);
    expect(state.phase).toBe('countdown');
    expect(bannerFor(state, false, false)?.sub).toBe('Round 2 of 5 · Pac-Tank');
  });

  test('Next wave’s board appears with its countdown', () => {
    const choices = fresh({
      mode: 'waves',
      maps: 'sequence',
      sequence: ['run-for-cover', 'nowhere-to-hide'],
    });
    const state = createMatch(matchOptionsFor(choices), 3);
    nextRound(state);
    // The renderer draws state.board, so the arena is the new board from the first frame of the countdown.
    expect(state.phase).toBe('countdown');
    expect(state.board.id).toBe('nowhere-to-hide');
    expect(bannerFor(state, false, false)?.sub).toMatch(/^Wave 2 · Nowhere \(Much\) To Hide/);
  });
});

describe('map thumbnails', () => {
  const colours: ArenaColours = {
    backdrop: 'backdrop',
    floor: 'floor',
    grid: 'grid',
    wall: 'wall',
    wallEdge: 'wallEdge',
    border: 'border',
  };

  /** Records what was filled, in which colour. */
  function recorder(): { ctx: ThumbnailContext; fills: { colour: string; rect: number[] }[] } {
    const fills: { colour: string; rect: number[] }[] = [];
    const ctx = {
      fillStyle: '' as ThumbnailContext['fillStyle'],
      fillRect(x: number, y: number, w: number, h: number) {
        fills.push({ colour: String(this.fillStyle), rect: [x, y, w, h] });
      },
      setTransform() {},
    };
    return { ctx: ctx as unknown as ThumbnailContext, fills };
  }

  test('a thumbnail shows the floor and every wall, in the theme colours', () => {
    for (const board of BUILT_IN_BOARDS) {
      const { ctx, fills } = recorder();
      drawThumbnail(ctx, board, colours, 96, 64);
      expect(fills.filter((f) => f.colour === 'floor')).toEqual([
        { colour: 'floor', rect: [0, 0, board.width, board.height] },
      ]);
      expect(fills.filter((f) => f.colour === 'wall').map((f) => f.rect)).toEqual(
        board.obstacles.map((r) => [r.x, r.y, r.w, r.h]),
      );
    }
  });

  test('a thumbnail gives away no spawn points', () => {
    const { ctx, fills } = recorder();
    drawThumbnail(ctx, PAC_TANK, colours, 96, 64);
    expect(fills.every((f) => ['border', 'floor', 'wall'].includes(f.colour))).toBe(true);
    expect(fills).toHaveLength(2 + PAC_TANK.obstacles.length);
  });
});
