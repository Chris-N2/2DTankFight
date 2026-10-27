# 2-D Tank Command

A top-down tank battle for the browser, in the spirit of **Combat** for the Atari 2600.
Drive, hide behind cover, and shoot shells that bounce once. They aren't fussy about whom they hit next,
and that includes you.

Currently playable, single-player:

- **Last One Standing** against 1–4 AI tanks, over 1, 3, 5 or 7 rounds. Every tank for itself.
- **Waves**: survive wave after wave of AI tanks, starting with 1–4. Each wave brings one more tank, up to four;
  after that they get tougher armour, then harder hits (until one hit is lethal), then faster shells. The AI tanks
  work together and hold fire rather than shoot each other, though a stray bounce still counts. Your armour is
  restored every wave, and your best run is remembered on this device.
- **Mortars** (on by default, or switch them off for classic play): one per round, or per wave. Hold to aim, release
  to lob it over the walls. It does no damage, but it bogs down every tank it splashes, yours included. In Waves
  only you have one.

Two-player co-op, more boards and online play are on the way. See
[CLAUDE.md](CLAUDE.md) for the full vision.

## Running it

Requires Node.js 22.12 or later.

```sh
npm install
npm run dev        # then open the URL Vite prints (usually http://localhost:5173)
```

## Controls

Best played with a gamepad. The keyboard and a gamepad both work at any time.

| Action | Keyboard | Gamepad |
|---|---|---|
| Drive forward / reverse | <kbd>W</kbd> / <kbd>S</kbd> or <kbd>↑</kbd> / <kbd>↓</kbd> | Left stick up / down, or d-pad |
| Turn left / right | <kbd>A</kbd> / <kbd>D</kbd> or <kbd>←</kbd> / <kbd>→</kbd> | Left stick (analogue: push further to turn faster), or d-pad |
| Fire | <kbd>Space</kbd> (one shell per press) | <kbd>A</kbd> or <kbd>RT</kbd> (one shell per press) |
| Mortar | Hold either <kbd>Shift</kbd> to aim, release to lob | Hold <kbd>LB</kbd> or <kbd>RB</kbd> to aim, release to lob |
| Pause / resume | <kbd>Esc</kbd> (switching tabs pauses too) | <kbd>Start</kbd> (unplugging the pad pauses too) |
| Menus | Arrows or <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to move (<kbd>Tab</kbd> works too), <kbd>Enter</kbd> or <kbd>Space</kbd> to select | D-pad or stick to move, <kbd>A</kbd> to select, <kbd>B</kbd> to go back |

Browsers only reveal a gamepad once one of its buttons has been pressed on the page, so press any button when you
arrive and the setup screen will confirm it's been detected. Button names are Xbox-style; on other pads, use the button
in the same position (for example, the bottom face button for <kbd>A</kbd>).

## Putting it on your site

`npm run build` produces a static site in `src/client/dist`. Copy that folder anywhere on a web server, including a
sub-folder of an existing site: it only uses relative paths. Browsers only allow gamepads on secure pages, so serve
it over **https** (localhost is fine for development). If you put the game in an `<iframe>`, add
`allow="gamepad"` to it.

### Your own page or template

The game builds all of its screens itself, and its file names don't change between releases. So a page of your own,
such as an Umbraco template or a CMS page type, needs just these lines. The game takes over the whole window, as it
does on its own page.

```html
<head>
  <link rel="stylesheet" href="/tank-command/assets/tank-command.css?v=1" />
  <!-- Optional: a theme file somewhere other than beside the game -->
  <meta name="tank-command-theme" content="/css/tank-command-theme.json" />
</head>
<body>
  <div id="tank-command"></div>
  <script type="module" src="/tank-command/assets/tank-command.js?v=1"></script>
</body>
```

Because the file names stay the same, browsers may keep an old copy after you deploy a new version. Bump the `?v=`
number when you do.

### Theming

Make the arena and menus match your site. Put a **`theme.json`** beside the game's `index.html`, or wherever a
`tank-command-theme` meta tag points. Then set any of these:

(A local `theme.json` in `src/client/public/` is handy for trying a theme with `npm run dev`. It's git-ignored, but
Vite copies it into the build, so remove it before running `npm run build`.)

| Setting | What it colours | Default |
|---|---|---|
| `backdrop` | The page behind the arena | `#0d100b` |
| `floor` | The arena floor | `#26301f` |
| `grid` | The grid lines on the floor | `#2d3925` |
| `wall` | Obstacles; also menu headings and highlights | `#c9a66b` |
| `wallEdge` | Obstacle edges; also menu borders | `#8a6d3f` |
| `border` | The arena's outer border | `#8a6d3f` |
| `panel` | Menu and overlay panels | `rgba(20, 26, 16, 0.92)` |
| `ink` | Main text | `#f2ecd8` |
| `muted` | Secondary text | `#a9a58f` |
| `accent` | Focus outlines, the Start button, highlights | `#7be36f` |
| `font` | Menu, HUD and banner text | a monospace stack |

```json
{ "floor": "#1d2433", "wall": "#8fa3bf", "accent": "#ffb000", "font": "'Fira Sans', sans-serif" }
```

`theme.example.json`, which ships with the build, lists every setting at its default.

If the game sits on your own page, you can set the same settings as **CSS variables** in your stylesheet instead.
They're named `--tank-` plus the setting in kebab-case, and they override `theme.json`:

```css
:root {
  --tank-floor: #1d2433;
  --tank-wall-edge: #5b6b85;
}
```

A few things to know:

- **Fonts:** the game uses whatever font you name, but your page has to load it (for example with a Google Fonts
  `<link>`).
- **Fixed colours:** tank colours, shells, explosions and mud aren't themeable, so players can always read the game.
  You're always the green tank with the "YOU" ring.
- **Warnings:** a bad value or an unknown setting is skipped with a warning in the browser console, and the game still
  starts. So does a floor colour that would make tanks or shells hard to see.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build to `src/client/dist` (a static site) |
| `npm test` | All tests (Vitest) |
| `npm run typecheck` | TypeScript checks for both packages and the client tests |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Project layout

```
src/sim/      @tank/sim — the game itself: simulation, rules, AI, boards. Pure TypeScript with no DOM, clocks or
              networking, so a future multiplayer server can run exactly the same code.
src/client/   @tank/client — the browser: Canvas rendering, keyboard and gamepad input, screens and the game loop.
openspec/     Specs and change history. Every feature is specified here before it's built.
```

The simulation advances in fixed 60 Hz ticks, driven only by inputs. Its purity is enforced mechanically: the sim
package has no DOM types, and lint rules ban `Date`, timers and `Math.random` there. Balance values live in
`src/sim/src/config.ts`.

## How we work

Features go through [OpenSpec](https://github.com/Fission-AI/OpenSpec): propose → apply → QA → archive.
See *Feature Development Process* in [CLAUDE.md](CLAUDE.md).

## Licence

[MIT](LICENSE)
