# simulation Specification

## Purpose

The game simulation: the authoritative rules for how tanks move, collide, shoot and are destroyed. It advances in
fixed time steps driven only by player inputs, so the browser and a future server can run identical code.

## Requirements

### Requirement: Fixed-timestep, input-driven advancement
The simulation SHALL advance only in discrete ticks of a fixed duration. Each tick SHALL be computed solely from the
previous simulation state and the inputs supplied for that tick. Given the same initial state, seed and sequence of
inputs, the simulation SHALL produce an identical sequence of states and events on the same JavaScript engine.

#### Scenario: Ticks advance by a fixed step
- **WHEN** the simulation is advanced by one tick
- **THEN** the tick counter increases by exactly one and simulated time increases by exactly the fixed tick duration, regardless of how much real time has passed

#### Scenario: Deterministic replay
- **WHEN** two simulations are created with the same board, seed and tanks and are fed the same input sequence for 600 ticks
- **THEN** their final states and the events they emitted are identical

### Requirement: Environment independence
The simulation SHALL NOT depend on rendering, the DOM, wall-clock time, timers, networking, or unseeded randomness. It
SHALL be runnable unchanged in both a browser and Node.js.

#### Scenario: Runs headless in Node
- **WHEN** the simulation test suite runs in Node.js with no DOM available
- **THEN** a full round can be simulated to completion

#### Scenario: Randomness is seeded
- **WHEN** the simulation needs a random choice (for example, spawn assignment)
- **THEN** the choice comes from the simulation's seeded random number generator, so the same seed yields the same choice

### Requirement: Tank input model
Each tank SHALL be controlled each tick by an input consisting of: throttle (forward, reverse or none), turn (a
number from −1, full left, to 1, full right, where 0 is no turn and values in between turn part-way), fire (held or
not held) and mortar (held or not held; see the `mortars` spec). A turn value outside −1 to 1 SHALL be clamped into
that range, and a turn value that is not a finite number SHALL be treated as 0. The turret SHALL be fixed to the hull
and always point in the direction the tank faces. Inputs for eliminated tanks SHALL be ignored.

#### Scenario: Missing input means idle
- **WHEN** no input is supplied for a live tank on a tick
- **THEN** the tank behaves as if throttle, turn, fire and mortar were all inactive

#### Scenario: Out-of-range turn is clamped
- **WHEN** a tank is given a turn value of 2.5 for one tick
- **THEN** it turns exactly as it would with a turn value of 1

#### Scenario: Invalid turn is ignored
- **WHEN** a tank is given a turn value that is not a finite number (for example NaN) for one tick
- **THEN** it does not turn, and the simulation stays deterministic

### Requirement: Tank movement
A tank SHALL rotate at its fixed turn rate multiplied by the size of its turn input, so a full turn input turns at
the full rate and a partial one turns proportionally slower. It SHALL move forward along its heading at a fixed speed
when throttle is forward, and move backward at a reduced fixed speed when throttle is reverse. While a tank is slowed
by a mortar (see the `mortars` spec), both driving speeds SHALL be multiplied by the slow factor; its turn rate SHALL
be unchanged. Turning and moving SHALL be able to happen in the same tick.

#### Scenario: Driving forward
- **WHEN** a tank facing east with no obstruction holds forward throttle for one tick
- **THEN** its position moves east by the forward speed multiplied by the tick duration and its heading is unchanged

#### Scenario: Reversing is slower
- **WHEN** a tank holds reverse throttle for one tick with no obstruction
- **THEN** it moves opposite to its heading by a distance smaller than one tick of forward movement

#### Scenario: Turning on the spot
- **WHEN** a tank holds turn left with no throttle for one tick
- **THEN** its heading changes anticlockwise by the turn rate multiplied by the tick duration and its position is unchanged

#### Scenario: Partial turn
- **WHEN** a tank holds a turn value of 0.5 with no throttle for one tick
- **THEN** its heading changes clockwise by half the turn rate multiplied by the tick duration

#### Scenario: Slowed driving
- **WHEN** a slowed tank facing east with no obstruction holds forward throttle for one tick
- **THEN** its position moves east by the forward speed multiplied by the slow factor and the tick duration

### Requirement: Tank collisions
A tank SHALL NOT overlap obstacles, the arena boundary or another live tank. When movement would cause an overlap, the
blocked component of the movement SHALL be cancelled, so a tank driving diagonally into a wall slides along it rather
than stopping dead.

#### Scenario: Blocked by an obstacle
- **WHEN** a tank drives straight into an obstacle face
- **THEN** it stops at the obstacle's edge and does not overlap it on any subsequent tick

#### Scenario: Sliding along a wall
- **WHEN** a tank drives at a 45° angle into a straight wall
- **THEN** it continues moving along the wall and does not move into it

#### Scenario: Tanks block each other
- **WHEN** two tanks drive head-on into each other
- **THEN** neither tank overlaps the other

### Requirement: Firing shells
When a live tank's fire input changes from not held to held, and its fire cooldown has elapsed, the tank SHALL fire one
shell from its muzzle in the direction it faces. The shell SHALL travel at the firing tank's shell speed and deal the
firing tank's shell damage. By default these are the configured shell speed and damage, and the game mode's rules may
set them per tank. Holding fire SHALL NOT fire repeatedly; the player must release and press again. A tank's
ammunition is unlimited.

#### Scenario: Pressing fire launches a shell
- **WHEN** a tank whose cooldown has elapsed presses fire
- **THEN** one shell appears at the tank's muzzle travelling along the tank's heading and a "shot fired" event is emitted

#### Scenario: Holding fire does not auto-fire
- **WHEN** a tank holds fire continuously for longer than several cooldown periods
- **THEN** exactly one shell is fired

#### Scenario: Cooldown limits fire rate
- **WHEN** a tank presses fire, releases, and presses again before its cooldown has elapsed
- **THEN** no second shell is fired

#### Scenario: Shells carry their tank's speed and damage
- **WHEN** a tank whose shell speed is 1.5× the default and whose shell damage is 2 fires, and the shell hits another
  tank
- **THEN** the shell travels at 1.5× the default speed and the target loses 2 hit points

### Requirement: Shells bounce once
A shell SHALL travel in a straight line. On its first contact with an obstacle or the arena boundary it SHALL reflect
off the contacted surface (angle of reflection equals angle of incidence) and emit a "bounce" event. On its second
contact with an obstacle or boundary it SHALL be destroyed. A shell SHALL also be destroyed when its maximum lifetime
expires. Shells SHALL pass through each other without interacting. Fast shells SHALL NOT pass through obstacles
between ticks.

#### Scenario: Bounce off a wall
- **WHEN** a shell travelling north-east hits a horizontal wall from below
- **THEN** it continues travelling south-east from the point of contact

#### Scenario: Second contact destroys the shell
- **WHEN** a shell that has already bounced hits another obstacle
- **THEN** the shell is removed and does not bounce again

#### Scenario: No tunnelling
- **WHEN** a shell's movement in one tick would carry it from one side of a thin obstacle to the other
- **THEN** the shell contacts the obstacle instead of passing through it

#### Scenario: Shells do not collide with each other
- **WHEN** two shells cross paths
- **THEN** both continue unaffected

### Requirement: Shell hits and damage
When a shell touches a live tank, the shell SHALL be destroyed, the tank SHALL lose hit points equal to the shell's
damage, and a "hit" event SHALL be emitted identifying the shooter and the target. A shell SHALL NOT hit the tank that
fired it until that shell has bounced; after bouncing, it SHALL be able to hit its own tank.

When friendly fire is off (two-player Waves; see the `waves` spec), a shell fired by one human that touches the other
human SHALL be destroyed without doing any damage, and a "friendly hit" event SHALL be emitted instead of a "hit"
event, so the client can show a harmless ricochet. This SHALL apply whether or not the shell has bounced. Friendly
fire SHALL NOT protect a human from their own shells, and SHALL NOT affect shells fired by AI tanks.

#### Scenario: Hitting an opponent
- **WHEN** a shell touches a tank other than its shooter
- **THEN** the target's hit points drop by the shell damage and the shell is removed

#### Scenario: No self-hit on launch
- **WHEN** a shell is fired and has not yet bounced
- **THEN** it cannot damage the tank that fired it

#### Scenario: Self-hit after a bounce
- **WHEN** a shell bounces off a wall and travels back into the tank that fired it
- **THEN** that tank takes damage, as tradition demands

#### Scenario: Friendly fire off
- **WHEN** friendly fire is off and one human's shell, bounced or not, touches the other human
- **THEN** the shell is removed, the other human's hit points are unchanged, and a "friendly hit" event is emitted

#### Scenario: Friendly fire on
- **WHEN** friendly fire is on and one human's shell touches the other human
- **THEN** the other human takes damage as from any other shell

#### Scenario: Still hoisted by your own shell
- **WHEN** friendly fire is off and a human's own shell bounces back into them
- **THEN** that human takes damage

### Requirement: Elimination
A tank whose hit points reach zero or less SHALL be eliminated: it is removed from play, no longer collides or can be
hit, and an "eliminated" event SHALL be emitted. Shells already fired by an eliminated tank SHALL continue in flight.
All hits within a single tick SHALL be resolved together, so several tanks can be eliminated in the same tick. In
particular, a tank that fires in a tick SHALL get its shot away even if another tank's shot fired in that same tick
destroys it, and a tank reduced to zero hit points SHALL stay in play until the end of the tick, so it still stops any
other shell that reaches it in that tick.

Besides the eliminated tank and the tank credited with it, the "eliminated" event SHALL report:
- the **tick** on which the tank was eliminated;
- whether the shell credited with it (the last to hit the tank in that tick) had **bounced** before hitting, i.e. a
  bank shot;
- whether the tank was **slowed** by mortar mud at that moment.

These facts SHALL NOT change what happens in the game; they are there so the client can recognise achievements.

#### Scenario: Tank destroyed
- **WHEN** a tank with 1 hit point is hit by a shell dealing 1 damage
- **THEN** the tank is eliminated in that tick and an "eliminated" event is emitted

#### Scenario: Shells outlive their tank
- **WHEN** a tank is eliminated while one of its shells is in flight
- **THEN** that shell keeps travelling and can still hit other tanks

#### Scenario: Simultaneous elimination
- **WHEN** two tanks each with 1 hit point are hit by shells in the same tick
- **THEN** both are eliminated in that same tick

#### Scenario: Point-blank trade
- **WHEN** two tanks with 1 hit point each, close enough that each shot hits as it leaves the barrel, fire in the
  same tick
- **THEN** both shots are fired and both tanks are eliminated, whatever order the tanks are processed in

#### Scenario: Destroyed tank still stops shells that tick
- **WHEN** two shells reach a tank with 1 hit point in the same tick
- **THEN** both shells hit it and are destroyed, and the tank is eliminated at the end of the tick

#### Scenario: Bank-shot kill reported
- **WHEN** a shell bounces off a wall and then destroys a tank
- **THEN** the "eliminated" event reports that the finishing shell had bounced

#### Scenario: Direct kill reported
- **WHEN** a shell that has not bounced destroys a tank
- **THEN** the "eliminated" event reports that the finishing shell had not bounced

#### Scenario: The finishing shell decides
- **WHEN** a direct shell and a bounced shell both hit a tank with 1 hit point in the same tick
- **THEN** the event credits the tank whose shell hit last in that tick, and reports whether that shell had bounced

#### Scenario: Destroyed while bogged down
- **WHEN** a tank still slowed by mortar mud is destroyed
- **THEN** the "eliminated" event reports that it was slowed

#### Scenario: Elimination tick reported
- **WHEN** two tanks are eliminated in the same tick
- **THEN** both "eliminated" events report the same tick, which is the match's tick when that step ran

### Requirement: Hit points
Every tank SHALL have a maximum hit points value and SHALL start each round or wave with that many hit points. By
default every tank's maximum is the configured maximum hit points, and the game mode's rules may set it per tank.

#### Scenario: Full health at round start
- **WHEN** a new round begins
- **THEN** every tank's hit points equal its maximum hit points

#### Scenario: Defaults are equal
- **WHEN** a Last One Standing match is created
- **THEN** every tank has the configured maximum hit points, shell damage and shell speed

### Requirement: One or two human players
A match SHALL be created with one or two human tanks, as its options say; one is the default. Each human tank SHALL
be controlled only by the input supplied for its own id, so two humans move, fire and launch mortars independently.
Together with the AI tanks there SHALL never be more than 5 tanks in a match. A single-player match SHALL behave
exactly as it did before two-player matches existed: for the same options and seed, the same tanks, spawns, events and
results.

#### Scenario: Two humans, two sets of controls
- **WHEN** a two-player match is in play and only the first human's input holds forward throttle for one tick
- **THEN** the first human's tank moves and the second human's tank does not

#### Scenario: Single-player is unchanged
- **WHEN** a single-player match is created with the same options and seed as before this change, and fed the same
  inputs
- **THEN** it produces the same states, events and result as before

#### Scenario: Too many tanks rejected
- **WHEN** a two-player match is requested with 4 AI opponents, or with a starting wave of 4 AI tanks
- **THEN** the match is not created and the reason is reported

### Requirement: Leaving a match
A human SHALL be able to leave a two-player match at any point before the game is over, whatever the phase (countdown,
play, or the pause between rounds or waves). Their tank SHALL be removed from the match straight away, together with
its shells and any mortar it has in flight, so nothing it fired can still score or slow anyone. A "left" event SHALL be
emitted identifying the human. What leaving does to the game is decided by the game mode (see the `waves` and
`last-one-standing` specs). Leaving a game that is already over SHALL change nothing.

#### Scenario: A clean exit
- **WHEN** a human leaves during play with two of their shells in flight
- **THEN** their tank and both shells are gone from the match and a "left" event is emitted

#### Scenario: Too late to leave
- **WHEN** a human leaves a match whose game is already over
- **THEN** the match's state and result are unchanged
