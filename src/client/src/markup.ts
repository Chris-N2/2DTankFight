// The game's screens and overlays. The game builds them itself inside the host page's mount element, so a host
// page needs only a few lines (see index.html) and stays the same from release to release.

/** Every element the game looks up by id. `el()` in main.ts only accepts these. */
export const STAGE_IDS = [
  'achievements',
  'achievements-back',
  'achievements-count',
  'achievements-list',
  'achievements-note',
  'achievements-open',
  'again',
  'banner',
  'banner-sub',
  'banner-title',
  'freeze',
  'freeze-sub',
  'freeze-title',
  'game',
  'gameover',
  'go-best',
  'go-leave',
  'go-quip',
  'go-score',
  'go-title',
  'go-unlocks',
  'go-wait',
  'host-online',
  'hud',
  'hud-hp',
  'hud-mortar',
  'hud-mortar-cell',
  'hud-round',
  'hud-score',
  'join',
  'join-cancel',
  'join-code',
  'join-error',
  'join-go',
  'join-online',
  'lobby',
  'lobby-bot',
  'lobby-code',
  'lobby-copy',
  'lobby-leave',
  'lobby-link',
  'lobby-note',
  'lobby-status',
  'map-count',
  'map-library',
  'map-picker',
  'map-sequence',
  'menu-back',
  'menu-confirm',
  'menu-leave',
  'menu-main',
  'menu-no',
  'menu-yes',
  'online-menu',
  'online-notice',
  'opt-ai',
  'opt-ff',
  'opt-maps',
  'opt-mode',
  'opt-mortars',
  'opt-rounds',
  'opt-start-ai',
  'pad-status',
  'pause',
  'settings',
  'setup',
  'setup-problem',
  'start',
  'tagline',
  'unlocks',
] as const;

export type StageId = (typeof STAGE_IDS)[number];

/** The id of the element a host page provides for the game to build itself in. */
export const MOUNT_ID = 'tank-command';

/** The parts of the page `mountStage` uses (tests pass a small fake). */
export type MountDocument = Pick<Document, 'getElementById' | 'createElement'> & {
  body: Pick<HTMLElement, 'appendChild'>;
};
/** Builds the game's screens inside the host page's mount element, creating one if the page didn't provide it. */
export function mountStage(doc: MountDocument, warn: (message: string) => void): void {
  let mount = doc.getElementById(MOUNT_ID);
  if (!mount) {
    warn(`[Tank Command] The page has no <div id="${MOUNT_ID}">, so one was added; see the README.`);
    mount = doc.createElement('div');
    mount.id = MOUNT_ID;
    doc.body.appendChild(mount);
  }
  mount.innerHTML = STAGE_HTML;
}

export const STAGE_HTML = `
<div id="stage">
  <canvas id="game" aria-label="Arena"></canvas>

  <div id="hud" class="hud hidden" aria-live="polite">
    <div class="hud-cell">
      <span class="hud-label">Armour</span> <span id="hud-hp" class="hud-hp"></span>
    </div>
    <div class="hud-cell hidden" id="hud-mortar-cell">
      <span class="hud-label">Mortar</span> <span id="hud-mortar" class="hud-mortar"></span>
    </div>
    <div class="hud-cell" id="hud-round"></div>
    <div class="hud-cell" id="hud-score"></div>
  </div>

  <div id="banner" class="banner hidden" aria-live="assertive">
    <div id="banner-title" class="banner-title"></div>
    <div id="banner-sub" class="banner-sub"></div>
  </div>

  <ul id="unlocks" class="unlocks unlock-list hidden" aria-live="polite" aria-label="Achievements unlocked"></ul>

  <div id="setup" class="overlay">
    <div class="panel">
      <h1>2-D Tank Command</h1>
      <p id="tagline" class="tagline"></p>
      <div id="lobby" class="lobby hidden">
        <p class="lobby-room">Room <span id="lobby-code" class="lobby-code"></span></p>
        <div class="choices lobby-link-row">
          <input id="lobby-link" class="lobby-link" readonly aria-label="Join link" />
          <button id="lobby-copy" type="button">Copy link</button>
        </div>
        <p id="lobby-status" class="lobby-status" aria-live="polite"></p>
        <p id="lobby-note" class="lobby-note hidden" role="status"></p>
      </div>
      <div class="option">
        <span class="option-label">Mode</span>
        <div class="choices" id="opt-mode" role="radiogroup" aria-label="Mode"></div>
      </div>
      <div class="option" data-mode="lastOneStanding">
        <span class="option-label">AI opponents</span>
        <div class="choices" id="opt-ai" role="radiogroup" aria-label="AI opponents"></div>
      </div>
      <div class="option" data-mode="lastOneStanding">
        <span class="option-label">Rounds</span>
        <div class="choices" id="opt-rounds" role="radiogroup" aria-label="Rounds"></div>
      </div>
      <div class="option" data-mode="waves">
        <span class="option-label">Starting AI tanks</span>
        <div class="choices" id="opt-start-ai" role="radiogroup" aria-label="Starting AI tanks"></div>
      </div>
      <div class="option hidden" data-mode="waves" data-online>
        <span class="option-label">Friendly fire</span>
        <div class="choices" id="opt-ff" role="radiogroup" aria-label="Friendly fire"></div>
      </div>
      <div class="option">
        <span class="option-label">Mortars</span>
        <div class="choices" id="opt-mortars" role="radiogroup" aria-label="Mortars"></div>
      </div>
      <div class="option">
        <span class="option-label">Maps</span>
        <div class="choices" id="opt-maps" role="radiogroup" aria-label="Maps"></div>
      </div>
      <div id="map-picker" class="map-picker hidden">
        <div class="option option-stacked">
          <span class="option-label">Add a map</span>
          <div class="choices map-library" id="map-library" role="group" aria-label="Maps to add"></div>
        </div>
        <div class="option option-stacked">
          <span class="option-label">Sequence <span id="map-count" class="map-count"></span></span>
          <div class="choices map-sequence" id="map-sequence" role="group" aria-label="Map sequence"></div>
        </div>
      </div>
      <p id="setup-problem" class="setup-problem hidden" role="alert"></p>
      <p id="online-notice" class="online-notice hidden" role="alert"></p>
      <button id="start" class="primary">Start</button>
      <div class="buttons online-buttons">
        <button id="host-online" class="hidden">Host online game</button>
        <button id="join-online" class="hidden">Join a game</button>
        <button id="lobby-bot" class="hidden">Play the test bot</button>
        <button id="lobby-leave" class="hidden">Leave</button>
      </div>
      <div class="buttons achievements-buttons">
        <button id="achievements-open">Achievements</button>
      </div>
      <table class="controls">
        <thead>
          <tr>
            <th></th>
            <th scope="col">Keyboard</th>
            <th scope="col">Gamepad</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Drive</th>
            <td><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows</td>
            <td>Left stick or d-pad</td>
          </tr>
          <tr>
            <th scope="row">Fire</th>
            <td><kbd>Space</kbd></td>
            <td><kbd>A</kbd> or <kbd>RT</kbd></td>
          </tr>
          <tr>
            <th scope="row">Mortar</th>
            <td>Hold <kbd>Shift</kbd> to aim, release to lob</td>
            <td>Hold <kbd>LB</kbd> or <kbd>RB</kbd></td>
          </tr>
          <tr>
            <th scope="row">Pause</th>
            <td><kbd>Esc</kbd></td>
            <td><kbd>Start</kbd></td>
          </tr>
        </tbody>
      </table>
      <p id="pad-status" class="pad-status" aria-live="polite"></p>
      <p class="hint">Best played with a gamepad.</p>
      <p class="hint">Shells bounce once, and they aren't fussy about whom they hit next.</p>
      <p class="hint">
        One mortar per round: it lobs over walls and bogs tanks down in mud. Including yours. In Waves, the mud
        jams the enemy's guns too.
      </p>
    </div>
  </div>

  <div id="pause" class="overlay hidden">
    <div class="panel">
      <h2>Paused</h2>
      <p>Press <kbd>Esc</kbd> or <kbd>Start</kbd> to resume</p>
    </div>
  </div>

  <div id="gameover" class="overlay hidden">
    <div class="panel">
      <h2 id="go-title"></h2>
      <p id="go-score" class="go-score"></p>
      <p id="go-best" class="go-best"></p>
      <p id="go-quip" class="hint"></p>
      <ul id="go-unlocks" class="unlock-list hidden" aria-label="Achievements unlocked"></ul>
      <p id="go-wait" class="go-wait hidden" aria-live="polite"></p>
      <div class="buttons">
        <button id="again" class="primary">Play again</button>
        <button id="settings">Change settings</button>
        <button id="go-leave" class="hidden">Leave room</button>
      </div>
    </div>
  </div>

  <div id="freeze" class="banner freeze hidden" aria-live="assertive">
    <div id="freeze-title" class="banner-title"></div>
    <div id="freeze-sub" class="banner-sub"></div>
  </div>

  <div id="online-menu" class="overlay overlay-light hidden">
    <div class="panel">
      <div id="menu-main">
        <h2>Game on</h2>
        <p>Online games don't pause: the game keeps going while this is open.</p>
        <div class="buttons">
          <button id="menu-back" class="primary">Back to the game</button>
          <button id="menu-leave">Leave game</button>
        </div>
      </div>
      <div id="menu-confirm" class="hidden">
        <h2>Leave the game?</h2>
        <p>There's no coming back to this one. In Last One Standing, it hands the other player the win.</p>
        <div class="buttons">
          <button id="menu-no" class="primary">Stay and fight</button>
          <button id="menu-yes">Yes, leave</button>
        </div>
      </div>
    </div>
  </div>

  <div id="achievements" class="overlay hidden">
    <div class="panel achievements-panel">
      <h2>Achievements</h2>
      <p id="achievements-count" class="achievements-count"></p>
      <ul id="achievements-list" class="achievement-list" tabindex="-1"></ul>
      <p id="achievements-note" class="hint"></p>
      <div class="buttons">
        <button id="achievements-back" class="primary">Back</button>
      </div>
    </div>
  </div>

  <div id="join" class="overlay hidden">
    <div class="panel">
      <h2>Join a game</h2>
      <p>Type the code the host gave you.</p>
      <input
        id="join-code"
        class="join-code"
        maxlength="4"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        aria-label="Room code"
      />
      <p id="join-error" class="setup-problem hidden" role="alert"></p>
      <div class="buttons">
        <button id="join-go" class="primary">Join</button>
        <button id="join-cancel">Cancel</button>
      </div>
    </div>
  </div>
</div>
`;
