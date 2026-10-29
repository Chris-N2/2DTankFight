## MODIFIED Requirements

### Requirement: Splash slows tanks
When a mortar lands, a "mortar landed" event SHALL be emitted. Every live tank whose body lies at least partly within
the configured splash radius of the landing point SHALL be slowed, **including the tank that launched it**.
Obstacles SHALL NOT shield a tank from the splash. The splash SHALL do no damage.

While slowed, a tank's forward and reverse driving speeds SHALL be multiplied by the configured slow factor for the
configured slow duration. Its turning and mortar SHALL be unaffected. Its firing SHALL be unaffected too, unless the
game mode's rules say that the mud jams that tank's turret (see the `waves` spec); a jammed turret SHALL NOT fire for
exactly as long as the tank is slowed. A slowed tank caught by another splash SHALL have its slow restarted at the
full duration. Slows SHALL NOT stack to make the tank slower. Slows SHALL be cleared when a round or wave starts.

#### Scenario: Bogged down
- **WHEN** a mortar lands within the splash radius of a tank
- **THEN** that tank drives forward at the slowed speed for the slow duration, and then at its normal speed

#### Scenario: No damage
- **WHEN** a mortar lands on a tank
- **THEN** the tank's hit points are unchanged

#### Scenario: Turning and firing unaffected
- **WHEN** a slowed tank whose turret the game mode does not jam turns and fires
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

#### Scenario: Last One Standing keeps every turret
- **WHEN** in Last One Standing a mortar slows an AI tank and a human tank, and both press fire while slowed
- **THEN** both fire as normal
