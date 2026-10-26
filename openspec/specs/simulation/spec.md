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
number from −1, full left, to 1, full right, where 0 is no turn and values in between turn part-way) and fire (held or
not held). A turn value outside −1 to 1 SHALL be clamped into that range, and a turn value that is not a finite
number SHALL be treated as 0. The turret SHALL be fixed to the hull and always point in the direction the tank faces.
Inputs for eliminated tanks SHALL be ignored.

#### Scenario: Missing input means idle
- **WHEN** no input is supplied for a live tank on a tick
- **THEN** the tank behaves as if throttle, turn and fire were all inactive

#### Scenario: Out-of-range turn is clamped
- **WHEN** a tank is given a turn value of 2.5 for one tick
- **THEN** it turns exactly as it would with a turn value of 1

#### Scenario: Invalid turn is ignored
- **WHEN** a tank is given a turn value that is not a finite number (for example NaN) for one tick
- **THEN** it does not turn, and the simulation stays deterministic

### Requirement: Tank movement
A tank SHALL rotate at its fixed turn rate multiplied by the size of its turn input, so a full turn input turns at
the full rate and a partial one turns proportionally slower. It SHALL move forward along its heading at a fixed speed
when throttle is forward, and move backward at a reduced fixed speed when throttle is reverse. Turning and moving
SHALL be able to happen in the same tick.

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

#### Scenario: Hitting an opponent
- **WHEN** a shell touches a tank other than its shooter
- **THEN** the target's hit points drop by the shell damage and the shell is removed

#### Scenario: No self-hit on launch
- **WHEN** a shell is fired and has not yet bounced
- **THEN** it cannot damage the tank that fired it

#### Scenario: Self-hit after a bounce
- **WHEN** a shell bounces off a wall and travels back into the tank that fired it
- **THEN** that tank takes damage, as tradition demands

### Requirement: Elimination
A tank whose hit points reach zero or less SHALL be eliminated: it is removed from play, no longer collides or can be
hit, and an "eliminated" event SHALL be emitted. Shells already fired by an eliminated tank SHALL continue in flight.
All hits within a single tick SHALL be resolved together, so several tanks can be eliminated in the same tick. In
particular, a tank that fires in a tick SHALL get its shot away even if another tank's shot fired in that same tick
destroys it, and a tank reduced to zero hit points SHALL stay in play until the end of the tick, so it still stops any
other shell that reaches it in that tick.

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

### Requirement: Hit points
Every tank SHALL have a maximum hit points value and SHALL start each round or wave with that many hit points. By
default every tank's maximum is the configured maximum hit points, and the game mode's rules may set it per tank.

#### Scenario: Full health at round start
- **WHEN** a new round begins
- **THEN** every tank's hit points equal its maximum hit points

#### Scenario: Defaults are equal
- **WHEN** a Last One Standing match is created
- **THEN** every tank has the configured maximum hit points, shell damage and shell speed
