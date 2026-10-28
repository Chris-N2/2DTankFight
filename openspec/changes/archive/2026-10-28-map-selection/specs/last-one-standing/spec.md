## MODIFIED Requirements

### Requirement: Game options
Before a single-player Last One Standing game, the player SHALL choose:
- the number of AI opponents (1 to 4 inclusive);
- the number of rounds (1, 3, 5 or 7);
- whether mortars are on (see the `mortars` spec);
- the map mode (see the `map-selection` spec).

Odd round counts guarantee a majority is possible.

#### Scenario: Valid options accepted
- **WHEN** the player starts a game with 4 AI opponents, 5 rounds, mortars on and Random maps
- **THEN** each round is played by the human and 4 AI tanks, for up to 5 rounds, with mortars, on boards chosen at
  random

#### Scenario: Out-of-range options rejected
- **WHEN** a game is requested with 0 or 5 AI opponents, or with a round count other than 1, 3, 5 or 7
- **THEN** the game is not started

### Requirement: Rounds are independent
AI opponents SHALL NOT change difficulty between rounds. Nothing SHALL carry over from one round to the next except:
- the score;
- the round number;
- the position in the map rotation, which decides only which board the next round is played on.

#### Scenario: Fresh round
- **WHEN** a new round starts after the human finished the previous round on 1 hit point
- **THEN** the human starts the new round on full hit points and the AI tanks behave with the same difficulty as before

#### Scenario: New board, same difficulty
- **WHEN** round 2 is played on a different board from round 1
- **THEN** the AI tanks have the same hit points, damage and shell speed as in round 1
