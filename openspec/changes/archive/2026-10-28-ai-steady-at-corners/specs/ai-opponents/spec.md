## MODIFIED Requirements

### Requirement: Target selection
An AI tank SHALL choose a target from the live tanks it may target in the current mode, preferring tanks it has a
clear line of sight to, and then nearer tanks. A hidden tank that is much nearer MAY be preferred to a visible one far
away. Once it has a target, the AI SHALL keep it while that target has only briefly slipped out of sight, unless
another tank it may target is in plain view. When its target is eliminated it SHALL choose a new target.

#### Scenario: Retarget after elimination
- **WHEN** an AI tank's current target is eliminated
- **THEN** within a short time the AI selects another live tank it may target, if there is one

#### Scenario: Sticks with a target that ducks out of sight
- **WHEN** an AI tank's target moves behind cover, and the only other possible target is also hidden, though nearer
- **THEN** the AI keeps its target for a while, and changes only once the target has stayed out of sight

#### Scenario: A distant tank in view doesn't pull it off a nearby hunt
- **WHEN** an AI tank is hunting a nearby target hidden behind cover, and another possible target is in view right
  across the board
- **THEN** the AI keeps hunting the nearby target

### Requirement: Navigation
An AI tank SHALL navigate around obstacles towards a position from which it can attack its target. It SHALL NOT
remain stuck against an obstacle or another tank indefinitely, whether it is hunting a hidden target or closing in on
a visible one. This includes being held up by an ally that is itself in position and firing.

#### Scenario: Hunting a hidden target
- **WHEN** an AI tank's only possible target is stationary behind cover with no line of sight from the AI's spawn
- **THEN** within a bounded time the AI reaches a position with line of sight to the target

#### Scenario: Recovering from being stuck
- **WHEN** an AI tank has made no meaningful progress for a period of time
- **THEN** it takes a recovery action (for example, reversing and turning) and resumes navigation

#### Scenario: Blocked by an ally
- **WHEN** in Waves an AI tank's route runs through a spot where an allied AI tank is parked, engaging the target
- **THEN** within a few seconds the blocked AI takes a recovery action rather than pushing against its ally
  indefinitely

### Requirement: Aiming and firing
An AI tank SHALL fire only when its target is within line of sight and the tank is facing the target within an aim
tolerance. An AI SHALL NOT knowingly fire at a target when an obstacle blocks the direct path, and in Waves it SHALL
NOT fire while an ally is in its firing lane before the target. If an AI tank is lined up on its target but cover
blocks its barrel's actual line (for example, because of its aim error), it SHALL hold its aim rather than swing its
barrel back and forth, and then reposition within a bounded time, so that it never stays silent and motionless
indefinitely.

#### Scenario: Fires when lined up
- **WHEN** an AI tank has line of sight to its target and is facing it within the aim tolerance
- **THEN** it fires once its cooldown allows

#### Scenario: Lined up but blocked by cover
- **WHEN** an AI tank has line of sight to its target and is facing it within the aim tolerance, but its aim error puts
  the barrel's line into a nearby corner
- **THEN** it does not turn back and forth while it waits, and within a bounded time it moves to a new position and
  goes on to fire

#### Scenario: Holds fire behind cover
- **WHEN** an obstacle lies directly between an AI tank and its target
- **THEN** the AI does not fire at that target

#### Scenario: An ally in the way doesn't freeze the AI
- **WHEN** in Waves an ally stays in an AI tank's firing lane
- **THEN** within a bounded time the AI moves or re-aims rather than waiting indefinitely

## ADDED Requirements

### Requirement: Decisive movement
An AI tank SHALL look decisive: it SHALL NOT turn back and forth on the spot while making no progress. A change of
mind between attacking from where it is and moving somewhere better SHALL need a clear change in the situation (the
AI or its target moving), not the tiny shifts a tank makes when it bumps into something. An AI tank in play SHALL NOT
go more than a few seconds without either moving meaningfully or firing, except while it completes a mortar lob.
These rules SHALL NOT make the AI more accurate, faster to react or quicker to fire than the *Beatable imperfection*
requirement allows.

#### Scenario: Steady at a corner
- **WHEN** an AI tank and its target are both stationary, with the AI beside an obstacle corner at the edge of a clear
  line to the target
- **THEN** it does not swing back and forth: in any one-second span, at most one turn held for two ticks or more
  reverses the direction of the one before it (one-tick nudges that keep the aim on target don't count)

#### Scenario: Always making progress
- **WHEN** an AI tank in play has neither moved meaningfully nor fired for a few seconds, and is not completing a lob
- **THEN** it takes a recovery action and plans afresh

#### Scenario: Corner dance stays rare
- **WHEN** Waves is simulated on Ricochet Alley with four AI tanks and a scripted human who survives, over a fixed
  set of seeds
- **THEN** AI tanks spend under 1% of their one-second spans turning back and forth on the spot without firing, and
  no AI tank goes more than 6 seconds without moving meaningfully or firing, except while completing a lob (the
  longest stalls left are AI tanks queuing behind an ally parked in their way, which is left to a later change)
