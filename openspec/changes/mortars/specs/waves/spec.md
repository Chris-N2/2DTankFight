## MODIFIED Requirements

### Requirement: Waves options
Before a Waves game, the player SHALL choose the number of AI tanks in the first wave, from 1 to 4 inclusive, with a
default of 1, and whether mortars are on (see the `mortars` spec). Waves SHALL NOT offer a number of rounds.

#### Scenario: Choosing the starting wave size
- **WHEN** the player starts a Waves game with a starting AI count of 2
- **THEN** wave 1 has the human and 2 AI tanks

#### Scenario: Invalid starting count is rejected
- **WHEN** a Waves game is requested with a starting AI count of 0 or 5
- **THEN** the game is not created and the reason is reported

### Requirement: Wave start
At the start of each wave, the human and that wave's AI tanks SHALL all be alive at shuffled spawn points. The human
SHALL have full hit points, and each AI tank SHALL have the hit points for that wave's size and escalation. All
shells and mortars in flight SHALL be cleared, and no tank SHALL be slowed. With mortars on, the human SHALL have one
mortar loaded and the AI tanks SHALL have none: in Waves the mortar is the outnumbered human's tool. A countdown SHALL
run during which all tank inputs are ignored. Play begins when the countdown ends.

#### Scenario: Full armour every wave
- **WHEN** the human finishes a wave with 1 hit point left and the next wave begins
- **THEN** the human starts the new wave with full hit points

#### Scenario: Countdown before each wave
- **WHEN** a wave begins
- **THEN** no tank moves or fires until the countdown has ended

#### Scenario: Mortar refilled each wave
- **WHEN** the human launches their mortar in wave 2 and wave 3 begins, with mortars on
- **THEN** the human has one mortar loaded again

#### Scenario: Only humans have mortars
- **WHEN** a wave begins with mortars on
- **THEN** no AI tank has a mortar, and none launches one at any point during the wave
