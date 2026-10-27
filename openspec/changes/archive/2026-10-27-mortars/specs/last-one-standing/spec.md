## MODIFIED Requirements

### Requirement: Game options
Before a single-player Last One Standing game, the player SHALL choose the number of AI opponents (1 to 4 inclusive),
the number of rounds (1, 3, 5 or 7) and whether mortars are on (see the `mortars` spec). Odd round counts guarantee a
majority is possible.

#### Scenario: Valid options accepted
- **WHEN** the player starts a game with 4 AI opponents, 5 rounds and mortars on
- **THEN** each round is played by the human and 4 AI tanks, for up to 5 rounds, with mortars

#### Scenario: Out-of-range options rejected
- **WHEN** a game is requested with 0 or 5 AI opponents, or with a round count other than 1, 3, 5 or 7
- **THEN** the game is not started

### Requirement: Round start
At the start of each round every tank SHALL be alive with full hit points at its assigned spawn point, all shells and
mortars in flight SHALL be cleared, and no tank SHALL be slowed. With mortars on, every tank, human and AI alike,
SHALL have one mortar loaded. A countdown SHALL run during which all tank inputs are ignored. Play begins when the
countdown ends.

#### Scenario: Countdown freezes tanks
- **WHEN** a player presses keys during the round-start countdown
- **THEN** no tank moves, fires or launches a mortar until the countdown has finished

#### Scenario: Everyone is armed
- **WHEN** a round begins with mortars on
- **THEN** the human and every AI tank each have one mortar loaded
