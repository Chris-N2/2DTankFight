# ai-opponents Specification

## Purpose

Code-controlled tanks that give a human something worth fighting: they hunt, take cover-blocking routes into account,
aim and fire. They play by exactly the same rules as a human.

## Requirements

### Requirement: AI acts only through player inputs
An AI tank SHALL be controlled solely by producing the same per-tick input (throttle, turn, fire, mortar) that a
human player produces. AI tanks SHALL have no abilities, speed, damage, hit points or cooldowns different from a
human's tank, with two exceptions: the Waves rules (see the `waves` spec) set AI hit points by wave size, escalation
changes AI hit points, shell damage and shell speed, and AI tanks have no mortar in Waves. An AI MAY read the current
game state to make decisions.

#### Scenario: Same rules for everyone
- **WHEN** an AI tank and a human tank are given identical inputs from identical positions in Last One Standing
- **THEN** they move, fire, launch mortars, take damage and are slowed identically

### Requirement: Every tank for itself
In Last One Standing, an AI tank SHALL treat every other live tank, human or AI, as a potential target. In Waves, AI
tanks are allies and SHALL treat only humans as targets (see the `waves` spec).

#### Scenario: AI tanks fight each other
- **WHEN** in Last One Standing two AI tanks have a clear line of sight to each other and no human is visible to either
- **THEN** they engage each other

### Requirement: Target selection
An AI tank SHALL choose a target from the live tanks it may target in the current mode, preferring tanks it has a
clear line of sight to, and then nearer tanks. When its target is eliminated it SHALL choose a new target.

#### Scenario: Retarget after elimination
- **WHEN** an AI tank's current target is eliminated
- **THEN** within a short time the AI selects another live tank it may target, if there is one

### Requirement: Navigation
An AI tank SHALL navigate around obstacles towards a position from which it can attack its target. It SHALL NOT
remain stuck against an obstacle or another tank indefinitely, whether it is hunting a hidden target or closing in on
a visible one.

#### Scenario: Hunting a hidden target
- **WHEN** an AI tank's only possible target is stationary behind cover with no line of sight from the AI's spawn
- **THEN** within a bounded time the AI reaches a position with line of sight to the target

#### Scenario: Recovering from being stuck
- **WHEN** an AI tank has made no meaningful progress for a period of time
- **THEN** it takes a recovery action (for example, reversing and turning) and resumes navigation

### Requirement: Aiming and firing
An AI tank SHALL fire only when its target is within line of sight and the tank is facing the target within an aim
tolerance. An AI SHALL NOT knowingly fire at a target when an obstacle blocks the direct path, and in Waves it SHALL
NOT fire while an ally is in its firing lane before the target. If an AI tank is lined up on its target but cover
blocks its barrel's actual line (for example, because of its aim error), it SHALL re-aim or reposition, so that it
never stays silent and motionless indefinitely.

#### Scenario: Fires when lined up
- **WHEN** an AI tank has line of sight to its target and is facing it within the aim tolerance
- **THEN** it fires once its cooldown allows

#### Scenario: Lined up but blocked by cover
- **WHEN** an AI tank has line of sight to its target and is facing it within the aim tolerance, but its aim error puts
  the barrel's line into a nearby corner
- **THEN** within a bounded time it re-aims or moves, and goes on to fire

#### Scenario: Holds fire behind cover
- **WHEN** an obstacle lies directly between an AI tank and its target
- **THEN** the AI does not fire at that target

#### Scenario: An ally in the way doesn't freeze the AI
- **WHEN** in Waves an ally stays in an AI tank's firing lane
- **THEN** within a bounded time the AI moves or re-aims rather than waiting indefinitely

### Requirement: Beatable imperfection
AI tanks SHALL be imperfect so that a human can win: they SHALL have a reaction delay before engaging a newly visible
target, their aim SHALL include a small random error, and after reloading they SHALL wait a random extra pause
before firing again rather than always firing the instant they can. These imperfections SHALL use seeded randomness
so AI behaviour is reproducible for a given seed.

#### Scenario: Reaction delay
- **WHEN** a target first comes into an AI tank's line of sight
- **THEN** the AI does not fire at it until its reaction delay has elapsed

#### Scenario: AI fires slower than the reload allows
- **WHEN** an AI tank has a clear shot at a target for a sustained period
- **THEN** the gap between its shots is never shorter than the fire cooldown, is at most the cooldown plus the
  maximum AI fire pause, and varies from shot to shot

#### Scenario: Reproducible behaviour
- **WHEN** the same round is simulated twice with the same seed and the same human inputs
- **THEN** every AI tank produces the same inputs on every tick

### Requirement: Mortar use
In Last One Standing with mortars on, an AI tank with a loaded mortar SHALL lob it at a target that has been hidden
from its turret behind cover for at least the configured AI mortar patience, and is within mortar range. To lob, the
AI SHALL stop, turn to face the target, hold the mortar button until the charged range matches the distance to the
target, and release. Its aim and range SHALL include a small seeded random error, so it is beatable. Once it has
committed to a lob, it SHALL complete it. An AI SHALL NOT lob at a target it has a clear turret shot at, and SHALL
NOT lob at a target so close that it would be caught in its own splash.

#### Scenario: Flushing out a hider
- **WHEN** in Last One Standing with mortars on, an AI tank's target stays hidden behind an obstacle within mortar
  range for longer than the AI mortar patience
- **THEN** within a bounded time the AI launches its mortar, and it lands close enough to slow the target if the
  target does not move

#### Scenario: Turret first
- **WHEN** an AI tank has a clear turret shot at its target
- **THEN** it does not launch its mortar at that target

#### Scenario: Patience
- **WHEN** an AI tank's target has only just moved behind cover
- **THEN** the AI does not launch its mortar until the target has stayed hidden for the AI mortar patience

#### Scenario: No mortars, no lobbing
- **WHEN** the game is Waves, or mortars are off
- **THEN** no AI tank ever holds the mortar button

#### Scenario: Reproducible lobs
- **WHEN** the same round is simulated twice with the same seed, mortars on and the same human inputs
- **THEN** every AI tank launches its mortar on the same tick, to the same landing point, both times
