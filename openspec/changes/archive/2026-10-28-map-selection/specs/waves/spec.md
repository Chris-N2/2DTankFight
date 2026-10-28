## MODIFIED Requirements

### Requirement: Waves options
Before a Waves game, the player SHALL choose:
- the number of AI tanks in the first wave, from 1 to 4 inclusive, with a default of 1;
- whether mortars are on (see the `mortars` spec);
- the map mode (see the `map-selection` spec).

Waves SHALL NOT offer a number of rounds. A map sequence in Waves repeats from its start for as long as the game lasts.

#### Scenario: Choosing the starting wave size
- **WHEN** the player starts a Waves game with a starting AI count of 2
- **THEN** wave 1 has the human and 2 AI tanks

#### Scenario: Invalid starting count is rejected
- **WHEN** a Waves game is requested with a starting AI count of 0 or 5
- **THEN** the game is not created and the reason is reported

#### Scenario: A long game outlasts its sequence
- **WHEN** a Waves game with a 7-map sequence reaches wave 8
- **THEN** wave 8 is played on the sequence's first map
