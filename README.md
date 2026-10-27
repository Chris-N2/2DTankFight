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

Two-player co-op, tank designs, more boards and online play are on the way. See
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

### Hosting it yourself

`npm run build` produces a static site you can put on any web server, with one caveat: browsers only allow gamepads on
secure pages, so serve it over **https** (localhost is fine for development). If you embed the game in an `<iframe>`,
add `allow="gamepad"` to it.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build to `src/client/dist` (a static site) |
| `npm test` | All tests (Vitest) |
| `npm run typecheck` | TypeScript checks for both packages |
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
