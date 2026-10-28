// The game's screens and overlays. The game builds them itself inside the host page's mount element, so a host
// page needs only a few lines (see index.html) and stays the same from release to release.

/** Every element the game looks up by id. `el()` in main.ts only accepts these. */
export const STAGE_IDS = [
  'again',
  'banner',
  'banner-sub',
  'banner-title',
  'game',
  'gameover',
  'go-best',
  'go-quip',
  'go-score',
  'go-title',
  'hud',
  'hud-hp',
  'hud-mortar',
  'hud-mortar-cell',
  'hud-round',
  'hud-score',
  'map-count',
  'map-library',
  'map-picker',
  'map-sequence',
  'opt-ai',
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

  <div id="setup" class="overlay">
    <div class="panel">
      <h1>2-D Tank Command</h1>
      <p id="tagline" class="tagline"></p>
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
      <button id="start" class="primary">Start</button>
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
        One mortar per round: it lobs over walls and bogs tanks down in mud. Including yours.
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
      <div class="buttons">
        <button id="again" class="primary">Play again</button>
        <button id="settings">Change settings</button>
      </div>
    </div>
  </div>
</div>
`;
