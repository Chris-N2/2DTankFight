# 2-D Tank Command

A top-down tank battle for the browser, in the spirit of **Combat** for the Atari 2600.
Drive, hide behind cover, and shoot shells that bounce once. They aren't fussy about whom they hit next,
and that includes you.

Currently playable, on your own or with a friend online:

- **Last One Standing** against 1–4 AI tanks, over 1, 3, 5 or 7 rounds. Every tank for itself.
- **Waves**: survive wave after wave of AI tanks, starting with 1–4. Each wave brings one more tank, up to four;
  after that they get tougher armour, then harder hits (until one hit is lethal), then faster shells. The AI tanks
  work together and hold fire rather than shoot each other, though a stray bounce still counts. Your armour is
  restored every wave, and your best run is remembered on this device.
- **Mortars** (on by default, or switch them off for classic play): one per round, or per wave. Hold to aim, release
  to lob it over the walls. It does no damage, but it bogs down every tank it splashes, yours included. In Waves
  only you have one, and the mud also jams the AI tanks' guns for as long as they're bogged down.

- **Online, two players**: either mode with a friend on another machine, over a small multiplayer server (see
  [Playing online](#playing-online)). Last One Standing is every tank for itself; Waves is co-operative, with
  friendly fire if you want it.

See [CLAUDE.md](CLAUDE.md) for the full vision.

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
| Online menu (online games don't pause) | <kbd>Esc</kbd> | <kbd>Start</kbd> |
| Menus | Arrows or <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to move (<kbd>Tab</kbd> works too), <kbd>Enter</kbd> or <kbd>Space</kbd> to select | D-pad or stick to move, <kbd>A</kbd> to select, <kbd>B</kbd> to go back |

Browsers only reveal a gamepad once one of its buttons has been pressed on the page, so press any button when you
arrive and the setup screen will confirm it's been detected. Button names are Xbox-style; on other pads, use the button
in the same position (for example, the bottom face button for <kbd>A</kbd>).

## Playing online

When the page has a multiplayer server (see [Hosting the multiplayer server](#hosting-the-multiplayer-server)), the
setup screen offers **Host online game** and **Join a game**.

- **Hosting:** set the options and choose *Host online game*. You get a four-character room code and a link: send
  either to your friend. The options stay yours to change in the lobby, and *Start* lights up once they've joined.
  With two players there can be at most 3 AI tanks, and Waves offers friendly fire (off unless you choose it).
- **Joining:** open the host's link, or choose *Join a game* and type the code (handy when it's read out over the
  phone). You see the host's options while you wait for them to start.
- **Playing:** you're always the green tank on your own screen, and your friend is always blue. The AI tanks are the
  same colours on both screens, so "the red one" means the same tank to both of you. Online games don't pause:
  <kbd>Esc</kbd> or <kbd>Start</kbd> opens a small menu while the game carries on, with *Leave game* if you need to go.
- **Dropped connections:** if either connection drops, the game freezes on both screens for up to 15 seconds while
  the dropped player gets back in. That happens by itself, or by reloading the page. Play resumes after a 3-2-1. If
  they don't make it back, they've left: in Last One Standing the other player wins by forfeit, and in Waves they carry
  on alone.
- **Afterwards:** the host chooses *Play again* or goes back to the lobby to change the settings, and the guest comes
  along either way.

Online games don't set a Waves best on either device.

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

## Hosting the multiplayer server

Online play needs a small Node server that runs the game for both players. Clients only send their controls. The
browser game itself stays a static site: without a server, it's single-player and never connects to anything.

### Turning it on

Name the server on the page with one more `<meta>` tag (on `index.html`, or your own page or template):

```html
<meta name="tank-command-server" content="wss://tank-server.example.net" />
```

Join links point back at the page the game is on, with the room code added, so a guest lands on your page and your
theme. For online play, put the game on a page of its own rather than in an `<iframe>`: a join link made inside a
frame points at the frame's address, not your page.

### Settings

The server takes its settings from environment variables. A bad value stops it at start-up with a message naming the
variable.

| Variable | What it does | Default |
|---|---|---|
| `PORT` | The port to listen on | `8080` |
| `ALLOWED_ORIGINS` | Comma-separated page origins whose players may connect, such as `https://example.com`. Set it on a public server. | unset: any page, with a warning |
| `MAX_ROOMS` | Rooms open at once; a host asking for one more is told the server is busy | `10` |
| `GRACE_SECONDS` | How long a dropped player's seat is kept | `15` |
| `LOBBY_IDLE_MINUTES` | How long a room may wait without a game starting before it closes | `30` |
| `TEST_BOT` | `on` lets a host play against a bot that uses the AI's brain, for testing on your own | `off` |

`GET /health` answers `200` with the number of rooms open, for a hosting platform's health check.

Rooms live in the server's memory: restarting or redeploying it ends every game in progress. Run **one** instance;
two instances wouldn't know about each other's rooms.

### On Azure App Service (Zip Deploy)

`npm run build:server` puts the whole server in `dist/server`: one `server.js` (everything bundled, nothing to
install) and a `package.json` whose `start` script runs it. Zip that folder and deploy it to a Linux Web App:

```powershell
npm run build:server
Compress-Archive -Path dist/server/server.js, dist/server/package.json -DestinationPath dist/tank-server.zip -Force

$rg = "my-resource-group"; $plan = "my-linux-plan"; $app = "my-tank-server"
az webapp create --resource-group $rg --plan $plan --name $app --runtime "NODE:22-lts"
az webapp config set --resource-group $rg --name $app --web-sockets-enabled true --always-on true --startup-file "npm start"
az webapp config appsettings set --resource-group $rg --name $app --settings SCM_DO_BUILD_DURING_DEPLOYMENT=false ALLOWED_ORIGINS=https://example.com
az webapp deploy --resource-group $rg --name $app --src-path dist/tank-server.zip --type zip
```

The first three `az` lines are one-off set-up. After that, a new version is just the build, the zip and the last line.
The server is then at `wss://<app>.azurewebsites.net`, which is what goes in the page's meta tag. App Service provides
`PORT` itself. WebSockets and Always On must both be on (Always On needs a Basic plan or above), and the plan should
run a single instance. Optionally, point the Web App's health check at `/health`.

**In the Azure portal instead:** the same set-up, by hand. Build and zip on your machine as above, then:

1. **Create the Web App.** *Create a resource* → *Web App*. Publish: *Code*. Runtime stack: *Node 22 LTS*.
   Operating system: *Linux*. Choose your existing Linux App Service plan.
2. **Add the app settings.** In the new Web App: *Settings* → *Environment variables*. Add
   `SCM_DO_BUILD_DURING_DEPLOYMENT` = `false` and `ALLOWED_ORIGINS` = your page origin(s), then *Apply*.
3. **Switch on what it needs.** *Settings* → *Configuration* → *General settings*: Startup Command `npm start`,
   Web sockets *On*, Always on *On*. *Save*.
4. **Upload the zip.** The portal's drag-and-drop Zip Deploy page (in Kudu) doesn't work for Linux apps, so use
   **Cloud Shell**, which is already signed in as you: the `>_` button at the top of the portal. Upload
   `tank-server.zip` with *Manage files* → *Upload*, then run:

   ```sh
   az webapp deploy --resource-group <your-resource-group> --name <your-app> --src-path tank-server.zip --type zip
   ```

5. **Check it.** `https://<your-app>.azurewebsites.net/health` should say `"status":"ok"`.

For a new version, repeat steps 4 and 5 with a fresh build. (The portal's menu names move around from time to time;
the settings they lead to don't.)

### With Docker

The `Dockerfile` builds the same server into a small image:

```sh
docker build -t tank-command-server .
docker run -p 8080:8080 -e ALLOWED_ORIGINS=https://example.com tank-command-server
```

### Locally, and on a LAN

```sh
npm run dev:server   # the server on port 8080, rebuilt and restarted on every change, with the test bot on
npm run dev          # the game; with no meta tag, it uses the server on the same host, port 8080
```

Open the game in two tabs to play yourself: each tab keeps its own seat, so a refresh rejoins as the same player. For
someone else on your network, start the game with `npm run dev -w @tank/client -- --host` (plain `npm run dev -- --host`
loses the flag on its way to Vite) and give them the network address it prints.

## Making a board

Boards are plain data in `src/sim/src/boards/`. Making a valid one is quick; making a fun one takes playtesting.

1. **Draw it.** Copy `frustration.ts` or `pacTank.ts`: the board is an ASCII picture, 30 characters by 20 rows, where
   each character is one 40-unit square (about one tank) and `#` is wall. `wallsFromGrid` turns the picture into wall
   rectangles. Keep driving corridors at least 3 squares wide.
2. **Add spawn points**: at least 5, each with a position and a heading (the direction the tank faces at the start).
   Give the board a unique `id` (lower-case words joined by hyphens) and a `name`.
3. **Register it** by adding it to `BUILT_IN_BOARDS` in `src/sim/src/boards/index.ts`. The map picker, the thumbnails
   and Random mode pick it up from there.
4. **Run `npm test`.** The tests check every built-in board against the arena rules:
   - at least 6 obstacles;
   - room for a tank at every spawn, and at least 250 units between spawns;
   - every spawn can drive to every other (nothing sealed off);
   - no free first shot: no spawn starts aimed straight at another with nothing in between.
5. **Playtest it** with a one-map Sequence, in both game modes. Then playtest it some more.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run dev:server` | The multiplayer server, rebuilt and restarted on every change (test bot on) |
| `npm run build` | Production build to `src/client/dist` (a static site) |
| `npm run build:server` | The multiplayer server, bundled to `dist/server` (ready to zip and deploy) |
| `npm test` | All tests (Vitest) |
| `npm run typecheck` | TypeScript checks for every package and the client tests |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Project layout

```
src/sim/      @tank/sim — the game itself: simulation, rules, AI, boards. Pure TypeScript with no DOM, clocks or
              networking, so the browser and the multiplayer server run exactly the same code.
src/protocol/ @tank/protocol — what client and server say to each other: messages, checking them, snapshots, room
              codes, and the fixed-step loop both ends use.
src/client/   @tank/client — the browser: Canvas rendering, keyboard and gamepad input, screens, the game loop, and
              online play (the connection, the lobby, and drawing the server's game).
src/server/   @tank/server — the multiplayer server: rooms, the authoritative game, WebSockets and /health.
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
