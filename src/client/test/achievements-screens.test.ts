import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { STAGE_HTML } from '../src/markup';

// There's no DOM in these tests, so these check the page's wiring. What it shows (which achievements, the rows, the
// notes, when unlocks are released) is tested through achievements.ts in achievements.test.ts.

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

function method(name: string): string {
  const body = new RegExp(`\\n  private ${name}\\([^)]*\\)(?:: [^{]+)? \\{([\\s\\S]*?)\\n  \\}`).exec(
    main,
  )?.[1];
  if (body === undefined) throw new Error(`No method ${name} in main.ts`);
  return body;
}

/** The opening tag of the element with this id. */
function tag(id: string): string {
  const found = new RegExp(`<[a-z]+[^>]*id="${id}"[^>]*>`).exec(STAGE_HTML)?.[0];
  if (found === undefined) throw new Error(`No element ${id}`);
  return found;
}

describe('achievements: tracking every game', () => {
  test('a local game gets a tracker from its first state, for the one human', () => {
    expect(method('start')).toContain(
      'this.tracker = new AchievementTracker(this.book, HUMAN_ID, this.match);',
    );
  });

  test('an online game gets a tracker from its first snapshot, which knows if the round was seen from the start', () => {
    const frame = method('onlineFrame');
    // A new game id (a new game, or back in after a drop) forgets the old tracker...
    expect(frame).toMatch(/this\.seenGameId = session\.gameId;[\s\S]*this\.tracker = null;/);
    // ...and the first state makes the new one, before that frame's events are played.
    const made = frame.indexOf(
      'this.tracker ??= new AchievementTracker(this.book, viewer, state, !session.vsBot);',
    );
    expect(made).toBeGreaterThan(0);
    expect(made).toBeLessThan(frame.indexOf('this.playEvent(state, event, viewer)'));
  });

  test('every event of every game goes through the tracker, from the player’s own seat', () => {
    expect(method('playEvent')).toContain(
      'if (this.tracker) this.unlocks.add(this.tracker.onEvent(match, event));',
    );
    expect(method('onEvent')).toContain('this.playEvent(match, event, HUMAN_ID);');
  });

  test('leaving for the setup screen ends tracking and clears anything unannounced', () => {
    const setup = method('showSetup');
    expect(setup).toContain('this.tracker = null;');
    expect(setup).toContain('this.clearUnlocks();');
    expect(method('enterPlay')).toContain('this.clearUnlocks();');
  });
});

describe('achievements: unlocks announced between rounds', () => {
  test('both local and online frames announce unlocks by phase', () => {
    expect(main.match(/this\.showUnlocks\((match|state)\);/g)).toHaveLength(2);
    const show = method('showUnlocks');
    expect(show).toContain('this.unlocks.release(match.phase)');
    // Released in the pause: the panel under the banner. Released at the end: the result screen's list.
    expect(show).toContain("el(match.phase === 'gameOver' ? 'go-unlocks' : 'unlocks')");
    // The pause's panel goes once the next round is under way.
    expect(show).toContain(
      "if (match.phase !== 'roundOver' && between.childElementCount > 0) between.replaceChildren();",
    );
  });

  test('the panel between rounds is polite, so the banner still gets read out', () => {
    expect(tag('unlocks')).toContain('aria-live="polite"');
    expect(tag('unlocks')).toContain('class="unlocks unlock-list hidden"');
  });

  test('the result screen has a list of unlocks', () => {
    const gameover = STAGE_HTML.slice(STAGE_HTML.indexOf('id="gameover"'), STAGE_HTML.indexOf('id="freeze"'));
    expect(gameover).toContain('id="go-unlocks"');
  });

  test('each unlock shows its name and what earned it', () => {
    const item =
      /function unlockItem\(a: Achievement\): HTMLLIElement \{([\s\S]*?)\n\}/.exec(main)?.[1] ?? '';
    expect(item).toContain('name.textContent = `Achievement: ${a.name}`;');
    expect(item).toContain('item.append(name, a.description);');
  });
});

describe('achievements: the Achievements screen', () => {
  test('the setup screen has the Achievements button, with the count, reachable with the d-pad', () => {
    const setup = STAGE_HTML.slice(STAGE_HTML.indexOf('id="setup"'), STAGE_HTML.indexOf('id="pause"'));
    expect(setup).toContain('id="achievements-open"');
    expect(method('updateAchievementsButton')).toContain('achievementsButtonLabel(this.book)');
    expect(method('showSetup')).toContain('this.updateAchievementsButton();');
    expect(main).toMatch(/const SETUP_BUTTONS: readonly StageId\[\] = \[[^\]]*'achievements-open'/);
  });

  test('it lists every achievement, marks the two-player ones without a server, and says where they are kept', () => {
    const open = method('openAchievements');
    expect(open).toContain('achievementRows(this.book, this.server !== null)');
    expect(open).toContain("el('achievements-note').textContent = storageNote(this.book);");
    expect(open).toContain("show('achievements', true);");
  });

  test('Locked ones greyed, with a mark rather than colour alone', () => {
    const item = /function achievementItem\(row: AchievementRow\): HTMLLIElement \{([\s\S]*?)\n\}/.exec(
      main,
    )?.[1];
    expect(item).toContain("item.className = row.earned ? 'achievement' : 'achievement locked';");
    expect(item).toContain("mark.setAttribute('aria-label', row.earned ? 'Earned' : 'Not earned yet');");
    expect(item).toContain("if (row.note) parts.push(['achievement-note', row.note]);");
  });

  test('Gamepad: B closes it, A on Back closes it, and up and down scroll the list', () => {
    expect(method('onMenuAction')).toMatch(
      /if \(isShown\('achievements'\)\) \{\s*this\.onAchievementsAction\(action\);\s*return;/,
    );
    const actions = method('onAchievementsAction');
    expect(actions).toMatch(/case 'back':\s*this\.closeAchievements\(\);/);
    expect(actions).toContain(
      "if (document.activeElement === el('achievements-back')) this.closeAchievements();",
    );
    expect(actions).toContain('scrollBy');
  });

  test('the keyboard: Escape closes it, and Enter there never starts a game', () => {
    const keys = method('onKeyDown');
    expect(keys).toMatch(
      /if \(isShown\('achievements'\) && e\.code === 'Escape'\) \{[\s\S]*?this\.closeAchievements\(\);/,
    );
    expect(keys).toContain("!isShown('achievements') &&");
  });

  test('closing returns to the setup screen, with the focus back on the button', () => {
    const close = method('closeAchievements');
    expect(close).toContain("show('achievements', false);");
    expect(close).toContain("el('achievements-open').focus();");
    expect(main).toContain(
      "el('achievements-back').addEventListener('click', () => this.closeAchievements());",
    );
  });

  test('the button is out of the way in an online lobby, and back afterwards', () => {
    expect(method('showLobby')).toContain("show('achievements-open', false);");
    expect(method('endOnline')).toContain("show('achievements-open', true);");
    expect(method('openAchievements')).toContain('if (this.session) return;');
  });
});
