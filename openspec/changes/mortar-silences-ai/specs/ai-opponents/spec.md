## ADDED Requirements

### Requirement: Waiting out a jammed turret
An AI tank whose turret is jammed by mud (see the `waves` spec) SHALL NOT press fire. It SHALL otherwise behave as
usual (choosing targets, navigating and aiming, at its slowed speed), so that once the jam ends it fires as soon as
it is lined up and ready. Holding its aim with a jammed turret SHALL NOT count as being stuck.

#### Scenario: Holds its aim through the jam
- **WHEN** in Waves an AI tank lined up on a stationary target in clear view is jammed by a mortar
- **THEN** it keeps facing the target without pressing fire or taking a recovery action, and fires once the jam ends

## MODIFIED Requirements

### Requirement: Decisive movement
An AI tank SHALL look decisive: it SHALL NOT turn back and forth on the spot while making no progress. A change of
mind between attacking from where it is and moving somewhere better SHALL need a clear change in the situation (the
AI or its target moving), not the tiny shifts a tank makes when it bumps into something. An AI tank in play SHALL NOT
go more than a few seconds without either moving meaningfully or firing, except while it completes a mortar lob or
its turret is jammed by mud. These rules SHALL NOT make the AI more accurate, faster to react or quicker to fire than
the *Beatable imperfection* requirement allows.

#### Scenario: Steady at a corner
- **WHEN** an AI tank and its target are both stationary, with the AI beside an obstacle corner at the edge of a clear
  line to the target
- **THEN** it does not swing back and forth: in any one-second span, at most one turn held for two ticks or more
  reverses the direction of the one before it (one-tick nudges that keep the aim on target don't count)

#### Scenario: Always making progress
- **WHEN** an AI tank in play has neither moved meaningfully nor fired for a few seconds, and is not completing a lob
  or jammed
- **THEN** it takes a recovery action and plans afresh

#### Scenario: Corner dance stays rare
- **WHEN** Waves is simulated on Ricochet Alley with four AI tanks and a scripted human who survives, over a fixed
  set of seeds
- **THEN** AI tanks spend under 1% of their one-second spans turning back and forth on the spot without firing, and
  no AI tank goes more than 6 seconds without moving meaningfully or firing, except while completing a lob (the
  longest stalls left are AI tanks queuing behind an ally parked in their way, which is left to a later change)
