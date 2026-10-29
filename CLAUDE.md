# 2-D Tank Command — Game Vision & Design Intent

## What This Is

A single-player and multiplayer, 2-dimensional game played in a browser.

The idea is based on the classic "Combat" game for the Atari 2600. Initially only the "Tank" variation is in scope,
with AI-controlled opponents as well as humans. ("AI" here means "controlled by the code", and does not imply an LLM
or agentic AI.)

## Technology

- **TypeScript end-to-end.** Browser client (Canvas / PixiJS or similar), Node server for multiplayer.
- **The simulation is a standalone module**: fixed timestep, driven purely by inputs, with no rendering or networking
  inside it. Single-player runs it in the browser; multiplayer runs the *same code* on the server.
- **Multiplayer is server-authoritative.** Clients send inputs only; the server runs the simulation (including AI)
  and broadcasts state. Clients interpolate remote entities and predict their own tank's movement.
- Single-player is built first; multiplayer is added as a later change without reworking the simulation.

## Core Loop

A simple arcade game: players manoeuvre around a top-down arena with obstacles and shoot at opponents.
Every tank looks the same apart from its colour, and **you are always the green tank** on your own screen
(see *Tanks*), so there is no tank selection.

There are two game modes, each playable single-player or with two humans:

| Mode | Humans | Goal |
|---|---|---|
| **Waves** | 1–2 (co-operative) | Survive and clear as many waves of AI tanks as possible |
| **Last One Standing** | 1–2 | Be the last tank alive; win rounds to win the game |

The hosting player chooses the options, then either starts immediately (single-player) or waits for another
player to join (multiplayer).

### Waves

- With two humans, the host chooses whether **friendly fire** is on or off.
- The host chooses the starting number of AI opponents.
- Each new wave adds 1 AI opponent until the **maximum of 5 tanks in total** is reached:
  - single-player: up to 4 AI opponents
  - two players: up to 3 AI opponents
- Once the maximum is reached, each further wave escalates difficulty:
  1. AI tanks need more hits to destroy.
  2. AI shots do more damage, until one AI hit destroys a human.
  3. After that, AI projectiles get faster, capped at roughly **2× their initial speed**.
  (Exact numbers are a balancing exercise — expect to tune them.)
- **Mortars refill** at the start of each wave (humans only; the AI never has them in Waves).
- **Respawning:** if one human is destroyed and the other survives the wave, the destroyed player respawns at the
  start of the next wave (nobody should be stuck watching for long).
- **Game over** when no human players remain alive.
- **Disconnect:** if one player disconnects, the game continues as single-player for the remaining human.

### Last One Standing

- Every tank for itself.
- The host chooses the number of AI opponents and how many rounds to play.
- AI opponents do **not** become more difficult between rounds.
- A round ends when only one tank is left, or immediately when all human players have been eliminated.
- If a human is the last tank remaining, they score a point.
- If both last humans are destroyed simultaneously (e.g. mutual hits, or bounced shells), they **share the point**.
  (Sudden death may be worth trying later for extra drama.)
- **Single-player:** the AI tanks count collectively as one opponent for scoring. The game ends when either side
  wins a majority of the rounds (e.g. 3 out of 5), at which point the human has won or lost.
- **Two players:** rounds won by the AI score for nobody but still count towards the round total. The game ends when:
  - all selected rounds have been played (win / loss / draw on points), or
  - one human has enough points that the other can no longer catch them.
  - Level on points after the final round is a **draw**.
- **Disconnect:** the remaining human **wins by forfeit**.

## Scope & Multiplayer

- Maximum of 2 human players and 5 tanks in total, in any mode.
- Single-player: 1–4 AI opponents.
- Two players: up to 3 AI opponents.
- Joining is by **room code / shareable link**. There is no public lobby browser.

## Tanks

- All tanks share one simple design and identical stats, to keep things fair. The simple procedurally drawn tanks
  are a deliberate homage to the original.
- **Perspective colours instead of tank selection:**
  - **you are always green** on your own screen, with the pulsing "YOU" ring and label;
  - the other human is always **blue**;
  - AI tanks have fixed colours that are the same on every player's screen.

  So "the red one" means the same tank to both players, and nobody has to pick a tank. The rule is built with
  multiplayer. Open question for that change: reserving blue for the other human means single-player with 4 AI needs
  a fifth AI colour, or blue allowed for AI when there's no second human.
- The arena and menus can be **themed** by whoever hosts the game (`theme.json` or `--tank-*` CSS variables) to
  match their site. Gameplay colours are never themeable.
- Tanks have **hit points**. Exact values are set during balancing.

## Combat

- **Turret:** infinite ammunition and fires straight ahead. A shell can bounce **once** off an obstacle. A bounced
  shell can hit the tank that fired it, as tradition demands.
- **Mortars:** **1** per round (Last One Standing) or per wave (Waves). The player **holds the mortar button to
  charge** — a longer hold gives a longer range — and releases to lob it straight ahead. The shell arcs over obstacles
  and lands where it was aimed. The splash **does no damage: it bogs down (slows) everyone in range, including the
  firer**, setting up a turret kill rather than replacing one.
  - In Last One Standing every tank has one, AI included. In **Waves only humans have them** — the outnumbered
    player's tool, which keeps hide-and-hunt viable. In Waves the mud also **jams AI turrets** for as long as the
    slow lasts, so a well-placed mortar opens a window to attack on the later waves (see the `mortar-silences-ai`
    change).
  - Mortars are a host option, **on by default**; off is "classic" play.
  - Why not damage? The original plan (3 damaging mortars) would have made cover worthless and rounds swingy; see the
    `mortars` change for the reasoning.
- Friendly fire (two-player Waves) is a host option; it does not apply in Last One Standing, where everyone is fair game.

## Boards

- A set of seven **hand-made boards**: Proving Ground, Run For Cover, Nowhere (Much) To Hide, Pac-Tank, Frustration,
  Ricochet Alley and Checkerboard. Each round or wave can be on a different board. Most are fast; Frustration is
  slower on purpose, and Ricochet Alley is built for bank shots. No board starts a tank aimed at another spawn.
- The host picks the **map mode**, for either game mode:
  - **Random** (the default): every board is played once, in a shuffled order, before any repeats, and never the same
    board twice in a row.
  - **Sequence**: up to 7 boards in order, repeats allowed. When the list runs out it starts again from the top.
    In Last One Standing the list can't be longer than the number of rounds. A one-map sequence means "always this
    map", which is also the quick way to playtest a board.
- Boards are 1200 × 800, laid out on a **40-unit design grid** (one square is about one tank). Driving corridors are at
  least 3 squares wide. A maze can be drawn as an ASCII picture (see `pacTank.ts`).
- The Keep (a walled central fortress) is a maybe for later; it was too close to Pac-Tank and Frustration. Wraparound
  edges are parked: every system would need to know about the seam.
- User-made boards (e.g. JSON files) are out of scope for now. Boards are already plain data, so it may not be hard later.
- A random board generator was considered and **dropped**: lots of pitfalls (a valid board isn't necessarily a fun
  one) for little gain in a small project with seven boards that play well. Hand-making a board is easy; the README
  explains how.

## Assets (graphics/audio)

Tanks can be simple SVG or procedurally drawn shapes, easy to recolour per player. Appropriate assets can be
purchased if needed, or there are existing assets on this machine.

The assets on this machine are mostly fantasy/SF based, so there may be nothing suitable. They are available at:
@D:\Applications\NDD\Games\assets

## Licence

Open source under the MIT licence (see `LICENSE`).

## Feature Development Process

Feature work must go through the OpenSpec skill (`/opsx`) before implementation begins. This ensures design
decisions, constraints, and rationale are captured explicitly — not just the code that results from them.

Suggested change sequence:
1. Core simulation + single-player Last One Standing on a fixed board (movement, turret, bounce, hits, basic AI)
2. Waves mode (hit points, escalation, wave progression, respawn)
3. Mortars
4. Arena theme & hosting (replaces tank selection: see *Tanks*)
5. Board variety:
   1. map selection (Random / Sequence) and the first new boards (Run For Cover, Nowhere (Much) To Hide, Pac-Tank);
   2. more boards after playtesting (Frustration, Ricochet Alley, Checkerboard), plus spawn fixes for Pac-Tank and
      Run For Cover. (A third step, a random board generator, was dropped: see *Boards*.)
6. Multiplayer (room codes, authoritative server, prediction, disconnect handling)

### QA feedback loop

QA (run as a sub-agent in its own context) must pass before `/opsx:archive` is run.
`/qa` launches the `qa` agent (`.claude/agents/qa.md`), which checks the code against the change's spec scenarios,
runs the build and tests, and writes `openspec/changes/<name>/qa-report.md` with a PASS/FAIL verdict.

If QA raises issues:

- **Implementation bugs** (the spec was right, the code wasn't): the agent that wrote the code should fix it,
  then re-run `/qa`. The spec may be amended here with approval from the human developer.
- **Design or spec gaps** (the spec was wrong or incomplete): update the spec via `/opsx:propose`, then re-run
  `/opsx:apply`, then `/qa`, then `/opsx:archive`.

### Other notes

- The human defines *what* is wanted; OpenSpec captures the spec before agents build it.
- If a feature is being extended or revisited, update the existing spec rather than working around it.
- The goal is that any future collaborator (or the developer returning after six months) can read the specs and
  understand not just what was built but why.

### Team disposition

We have fun, but we're serious about code and building a quality product.
- Humour is explicitly encouraged.
- Making a fun game is our primary objective.
- Fun is our guiding principle. We want players to enjoy their time in the game, and we should have fun building it
  (but we are serious about our code quality).
- We are not mean to each other, including when giving feedback.
- Humour is welcome; humour at anyone's expense is not.

## Explicit Non-Goals

- Solving problems that don't exist yet
- Public matchmaking / lobby browser
- More than 2 human players
