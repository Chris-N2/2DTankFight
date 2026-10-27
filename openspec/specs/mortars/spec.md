# mortars Specification

## Purpose

The mortar: a one-shot-per-round weapon that arcs over cover and bogs tanks down instead of damaging them, giving a
player a tactical choice without slowing the pace of the game. It can be switched off for classic play.

## Requirements

### Requirement: Mortars option
Every game SHALL have a mortars setting, on or off. With mortars off, no tank SHALL have a mortar, the mortar input
SHALL be ignored, and the game SHALL play exactly as it would without this feature. A game requested with a mortars
setting that is not on or off SHALL NOT be created, and the reason SHALL be reported.

#### Scenario: Classic play
- **WHEN** a game is played with mortars off and a tank holds and releases the mortar button
- **THEN** nothing is launched and no tank is ever slowed

#### Scenario: Invalid setting rejected
- **WHEN** a game is requested with a mortars setting that is neither on nor off
- **THEN** the game is not created and the reason is reported

### Requirement: One mortar per round or wave
With mortars on, each tank that the game mode arms SHALL start each round (Last One Standing) or wave (Waves) with
exactly one mortar loaded, whether or not it used the previous one. Launching SHALL use up the mortar until the next
round or wave starts.

#### Scenario: Refilled each round
- **WHEN** a tank launches its mortar in round 1 and round 2 begins
- **THEN** the tank has one mortar loaded

#### Scenario: Unused mortars don't stack
- **WHEN** a tank finishes a round without launching its mortar and the next round begins
- **THEN** the tank has exactly one mortar loaded, not two

#### Scenario: One shot only
- **WHEN** a tank has launched its mortar and presses the mortar button again in the same round
- **THEN** nothing is launched

### Requirement: Charging and launching
A live tank with a loaded mortar SHALL start charging when its mortar button goes from not held to held during play.
While charging, the mortar's range SHALL grow steadily from the configured minimum range to the configured maximum
range over the configured full-charge time, and then stay at the maximum. When the button is released, the tank
SHALL launch the mortar along its current heading at the charged range, and a "mortar launched" event SHALL be
emitted. Holding the button SHALL NOT launch by itself.

The landing point SHALL be the tank's position plus the charged range along its heading. If that point lies outside
the arena, it SHALL be moved to the nearest point inside it.

By default, a charging tank SHALL be able to drive and turn, and fire its turret, exactly as when not charging. If a
tank is eliminated while charging, nothing SHALL be launched.

#### Scenario: A tap is the minimum range
- **WHEN** a tank presses the mortar button for one tick and then releases it
- **THEN** a mortar is launched to land at the minimum range straight ahead of the tank

#### Scenario: Range grows with the hold
- **WHEN** a tank holds the mortar button for half the full-charge time and then releases it
- **THEN** the mortar lands halfway between the minimum and maximum range

#### Scenario: Full charge is capped
- **WHEN** a tank holds the mortar button for twice the full-charge time and then releases it
- **THEN** the mortar lands at the maximum range, having launched only on release

#### Scenario: Aiming near a wall
- **WHEN** a tank facing the arena boundary launches a mortar whose range reaches beyond it
- **THEN** the landing point is inside the arena, at the nearest point to where it would have landed

#### Scenario: Moving while charging
- **WHEN** a tank holds the mortar button while driving forward, turning and firing its turret
- **THEN** it drives, turns and fires just as it would without charging, and the mortar launches on release along
  the heading at that moment

#### Scenario: Destroyed mid-charge
- **WHEN** a tank is eliminated while it is still holding the mortar button
- **THEN** no mortar is launched

### Requirement: Mortar flight
A launched mortar SHALL fly from its launch point to its landing point in the configured flight time, whatever its
range. In flight it SHALL pass over obstacles and tanks without touching them, and SHALL NOT be stopped by anything.
A mortar in flight SHALL keep going if the tank that launched it is eliminated. All mortars in flight SHALL be cleared
when a round or wave starts.

#### Scenario: Over the wall
- **WHEN** a tank launches a mortar whose landing point is on the far side of an obstacle
- **THEN** the mortar lands at its landing point after the flight time, unaffected by the obstacle

#### Scenario: Flight time doesn't depend on range
- **WHEN** one mortar is launched at the minimum range and another at the maximum range
- **THEN** both land after the same flight time

#### Scenario: Outlives its tank
- **WHEN** a tank is eliminated while its mortar is in flight
- **THEN** the mortar still lands and still slows the tanks it catches

### Requirement: Splash slows tanks
When a mortar lands, a "mortar landed" event SHALL be emitted. Every live tank whose body lies at least partly within
the configured splash radius of the landing point SHALL be slowed, **including the tank that launched it**.
Obstacles SHALL NOT shield a tank from the splash. The splash SHALL do no damage.

While slowed, a tank's forward and reverse driving speeds SHALL be multiplied by the configured slow factor for the
configured slow duration. Its turning, firing and mortar SHALL be unaffected. A slowed tank caught by another splash
SHALL have its slow restarted at the full duration. Slows SHALL NOT stack to make the tank slower. Slows SHALL be
cleared when a round or wave starts.

#### Scenario: Bogged down
- **WHEN** a mortar lands within the splash radius of a tank
- **THEN** that tank drives forward at the slowed speed for the slow duration, and then at its normal speed

#### Scenario: No damage
- **WHEN** a mortar lands on a tank
- **THEN** the tank's hit points are unchanged

#### Scenario: Turning and firing unaffected
- **WHEN** a slowed tank turns and fires
- **THEN** it turns at its normal rate and fires at its normal rate

#### Scenario: Caught in your own splash
- **WHEN** a tank's own mortar lands within the splash radius of it
- **THEN** that tank is slowed like any other

#### Scenario: Walls don't shield
- **WHEN** a mortar lands next to an obstacle and a tank is on the other side of it within the splash radius
- **THEN** that tank is slowed

#### Scenario: Out of range
- **WHEN** a mortar lands farther than the splash radius from every part of a tank
- **THEN** that tank is not slowed

#### Scenario: A second splash restarts the slow
- **WHEN** a slowed tank is caught by a second mortar partway through its slow
- **THEN** it stays slowed for a full slow duration from the second landing, at the same slowed speed

#### Scenario: Fresh start each round
- **WHEN** a round or wave begins while a tank is slowed
- **THEN** the tank starts the new round or wave at its normal speed and no mortars are in flight
