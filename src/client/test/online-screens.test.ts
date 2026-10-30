import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { STAGE_HTML } from '../src/markup';

// There's no DOM in these tests, so these check the wiring in main.ts and the markup that online play depends on;
// the decisions themselves are tested through lobby.ts, session.ts and online.ts, and end to end in e2e.test.ts.

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

/** The body of a method in main.ts's Game class. */
function method(name: string): string {
  const body = new RegExp(`\\n  private ${name}\\([^)]*\\)(?:: [^{]+)? \\{([\\s\\S]*?)\\n  \\}`).exec(
    main,
  )?.[1];
  if (body === undefined) throw new Error(`No method ${name} in main.ts`);
  return body;
}

/** The opening tag of the element with this id. */
function tag(id: string): string {
  return new RegExp(`<[a-z]+[^>]*id="${id}"[^>]*>`).exec(STAGE_HTML)?.[0] ?? '';
}

describe('game client: online only with a server', () => {
  test('Online only with a server: the online buttons start hidden, and only a server shows them', () => {
    expect(tag('host-online')).toContain('class="hidden"');
    expect(tag('join-online')).toContain('class="hidden"');
    expect(method('wireOnline')).toContain("show('host-online', this.server !== null);");
    expect(method('wireOnline')).toContain("show('join-online', this.server !== null);");
    expect(method('hostOnline')).toContain('if (this.server === null');
    expect(method('openJoin')).toContain('if (this.server === null');
  });

  test('Static as ever: the server address comes from the tag (or the dev server), and nothing else connects', () => {
    expect(main).toContain('serverTag: readServerTag(document)');
    expect(main).toContain('dev: import.meta.env.DEV');
    // The only socket is made for an online session, which needs a server to exist.
    expect([...main.matchAll(/new WebSocket\(/g)]).toHaveLength(1);
    expect(method('sessionDeps')).toContain('new WebSocket(url)');
    expect(main).toContain('const action = onLoad(this.server, this.seats.load(), location.href);');
  });

  test('the join code is removed from the address after joining', () => {
    expect(method('sessionDeps')).toContain(
      "joined: () => history.replaceState(history.state, '', withoutJoin(location.href))",
    );
  });
});

describe('game client: hosting and the lobby', () => {
  test('Four AI won’t fit: hosting fits the choices to two players, and the lobby says so', () => {
    expect(method('hostOnline')).toContain('this.fitNote = fitForTwo(this.choices);');
    expect(method('showLobby')).toContain('session.lobbyNote ?? (session.isHost ? this.fitNote : null)');
    // The AI counts stop at three in the lobby.
    expect(method('showModeOptions')).toContain("lobby && Number(button.dataset['value']) > ONLINE_AI_MAX");
  });

  test('Friendly fire offered for Waves: a Waves-only row, shown only in the lobby', () => {
    expect(STAGE_HTML).toMatch(
      /<div class="option hidden" data-mode="waves" data-online>\s*<span class="option-label">Friendly fire/,
    );
    expect(method('showModeOptions')).toContain('(online && !lobby)');
  });

  test('Hosting: the lobby shows the code, the link and a copy button', () => {
    for (const id of ['lobby-code', 'lobby-link', 'lobby-copy', 'lobby-status'])
      expect(STAGE_HTML).toContain(`id="${id}"`);
    expect(method('showLobby')).toContain('joinLink(location.href, session.code)');
  });

  test("Can't start alone: Start is unavailable to the host until a guest is in, and hidden from the guest", () => {
    expect(method('showLobby')).toContain("el('start').setAttribute('aria-disabled', String(!session.guest");
    expect(method('showLobby')).toContain("show('start', session.isHost || connecting);");
  });

  test('Practice against the bot, and no bot unless the server offers one', () => {
    expect(method('showLobby')).toContain(
      "show('lobby-bot', session.isHost && session.botOffered && !session.guest && !connecting);",
    );
  });

  test('Options change under the guest: the guest’s rows show the room’s options, read-only', () => {
    expect(method('showLobby')).toContain(
      'if (session.options && !session.isHost) applyOptions(this.choices, session.options);',
    );
    expect(method('showLobby')).toContain("setup.classList.toggle('read-only', !session.isHost);");
    // Every way of changing an option ignores the guest.
    expect([...main.matchAll(/if \(this\.readOnly\) return;/g)].length).toBe(4);
  });

  test('the lobby and its dialogs are reachable with the d-pad and arrow keys', () => {
    expect(main).toContain(
      "const SETUP_BUTTONS: readonly StageId[] = ['start', 'host-online', 'join-online', 'lobby-bot', 'lobby-leave'];",
    );
    expect(main).toContain('[...visibleOptionRows(), visibleButtons(SETUP_BUTTONS)]');
    expect(STAGE_HTML).toMatch(/class="choices lobby-link-row"/);
  });
});

describe('game client: a second trip online', () => {
  test('a new session’s first game takes over the screen, whatever game the last session got to', () => {
    // Each session counts its games from 1; the page must forget the count from the session before.
    const begin = method('beginOnline');
    expect(begin).toContain('this.seenGameId = 0;');
    expect(begin.indexOf('this.seenGameId = 0;')).toBeLessThan(begin.indexOf('this.renderOnline();'));
    expect(method('onlineFrame')).toContain('if (session.gameId !== this.seenGameId) {');
  });
});

describe('game client: online games don’t pause', () => {
  test('Escape doesn’t stop the game: it opens the online menu, and nothing pauses', () => {
    const keys = method('onKeyDown');
    const online = keys.indexOf("e.code === 'Escape' && this.onlineGame");
    const local = keys.indexOf("e.code === 'Escape' && this.inGame");
    expect(online).toBeGreaterThan(-1);
    expect(online).toBeLessThan(local);
    expect(keys.slice(online, local)).toContain('this.toggleMenu();');
    expect(keys.slice(online, local)).not.toContain('setPaused');
    // The online frame never touches the fixed-step loop or the pause.
    expect(method('onlineFrame')).not.toMatch(/loop|setPaused/);
  });

  test('Online games don’t pause: hiding the tab or losing focus just sends no controls', () => {
    const away = method('autoPause');
    expect(away).toContain(
      'if (this.session && this.onlineGame) this.session.sendInput(IDLE_INPUT, performance.now());',
    );
    expect(away).toContain('else if (this.inGame) this.setPaused(true);');
    // And while the menu is open, the tank gets no controls either.
    expect(method('onlineFrame')).toContain(
      'session.sendInput(this.driving ? this.fireLatch.apply(input) : IDLE_INPUT, now);',
    );
  });

  test('Leaving deliberately: the menu asks first', () => {
    expect(STAGE_HTML).toContain('id="menu-leave"');
    expect(method('wireOnline')).toContain(
      "el('menu-leave').addEventListener('click', () => this.confirmLeave(true));",
    );
    expect(method('wireOnline')).toContain(
      "el('menu-yes').addEventListener('click', () => this.leaveOnline());",
    );
  });

  test('a freeze shows on screen, with the countdown and the 3-2-1', () => {
    expect(method('onlineFrame')).toContain('const frozen = freezeText(session, now);');
    expect(STAGE_HTML).toContain('id="freeze-title"');
  });
});

describe('game client: online results', () => {
  test('No online bests: only a local game records one', () => {
    expect([...main.matchAll(/recordBest\(/g)]).toHaveLength(1);
    expect(method('onEvent')).toContain('recordBest(');
    expect(method('onlineFrame')).toContain('this.setResultText(onlineResultText(state, viewer));');
  });

  test('Rematch and settings are the host’s; the guest waits, or leaves', () => {
    const buttons = method('setResultButtons');
    expect(buttons).toContain("show('again', host && !alone);");
    expect(buttons).toContain('const alone = session !== null && session.isHost && !session.guest;');
    expect(buttons).toContain(
      'The other player has left. Wait in the lobby for someone else to join, with the same code.',
    );
    expect(buttons).toContain("show('settings', host);");
    expect(buttons).toContain("show('go-leave', session !== null);");
    expect(buttons).toContain('Waiting for the host to choose what’s next…');
    expect(main).toContain(
      "el('again').addEventListener('click', () => (this.session ? this.session.playAgain() : this.start()));",
    );
  });

  test('Server down: the setup screen says so, and single-player is as it was', () => {
    const end = method('endOnline');
    expect(end).toContain('this.session = null;');
    expect(end).toContain('this.setNotice(notice);');
    expect(end).toContain('this.showSetup();');
    expect(STAGE_HTML).toContain('id="online-notice"');
  });
});
