# 2-D Tank Command

A top-down tank battle for the browser, in the spirit of **Combat** for the Atari 2600.
Drive, hide behind cover, and shoot shells that bounce once. They aren't fussy about whom they hit next,
and that includes you.

Currently playable: **single-player Last One Standing** against 1–4 AI tanks, over 1, 3, 5 or 7 rounds.
Waves (co-op), mortars, tank designs, more boards and two-player online play are on the way. See
[CLAUDE.md](CLAUDE.md) for the full vision.

## Running it

Requires Node.js 22.12 or later.

```sh
npm install
npm run dev        # then open the URL Vite prints (usually http://localhost:5173)
```

## Controls

| Action | Keys |
|---|---|
| Drive forward / reverse | <kbd>W</kbd> / <kbd>S</kbd> or <kbd>↑</kbd> / <kbd>↓</kbd> |
| Turn left / right | <kbd>A</kbd> / <kbd>D</kbd> or <kbd>←</kbd> / <kbd>→</kbd> |
| Fire | <kbd>Space</kbd> (one shell per press) |
| Pause / resume | <kbd>Esc</kbd> (switching tabs pauses too) |

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
src/client/   @tank/client — the browser: Canvas rendering, keyboard input, screens and the game loop.
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
