# ai-opponents Specification

## Purpose

Code-controlled tanks that give a human something worth fighting: they hunt, take cover-blocking routes into account,
aim and fire. They play by exactly the same rules as a human.

## Requirements

### Requirement: AI acts only through player inputs
An AI tank SHALL be controlled solely by producing the same per-tick input (throttle, turn, fire) that a human player
produces. AI tanks SHALL have no abilities, speed, damage, hit points or cooldowns different from a human's tank. An
AI MAY read the current game state to make decisions.

#### Scenario: Same rules for everyone
- **WHEN** an AI tank and a human tank are given identical inputs from identical positions
- **THEN** they move, fire and take damage identically

### Requirement: Every tank for itself
An AI tank SHALL treat every other live tank, human or AI, as a potential target.

#### Scenario: AI tanks fight each other
- **WHEN** two AI tanks have a clear line of sight to each other and no human is visible to either
- **THEN** they engage each other

### Requirement: Target selection
An AI tank SHALL choose a target from the other live tanks, preferring tanks it has a clear line of sight to, and
then nearer tanks. When its target is eliminated it SHALL choose a new target.

#### Scenario: Retarget after elimination
- **WHEN** an AI tank's current target is eliminated
- **THEN** within a short time the AI selects another live tank as its target

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
tolerance. An AI SHALL NOT knowingly fire at a target when an obstacle blocks the direct path. If an AI tank is lined
up on its target but cover blocks its barrel's actual line (for example, because of its aim error), it SHALL re-aim
or reposition, so that it never stays silent and motionless indefinitely.

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
