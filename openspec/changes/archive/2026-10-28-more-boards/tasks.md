## 1. Safety net for spawn headings

- [x] 1.1 Add a test helper that casts a ray from a spawn along its heading and reports whether it passes within a tank's radius of another spawn before reaching an obstacle or the boundary (bounces ignored; see design, *"No free first shot" applies to every board*). Add the *No free first shot* test over every built-in board, and confirm it fails on Run For Cover's current centre spawns and nowhere else. If another existing board fails, note which spawn and fix its heading in 2.x.

## 2. Fixes to existing boards

- [x] 2.1 Run For Cover: give the top- and bottom-centre spawns `towardsCentre` headings and update the comment that explained the old choice. Verify that *No free first shot* and *Open centre* pass.
- [x] 2.2 Pac-Tank: add two inner-corridor spawns, half-turn symmetric (around column 8, row 7 and column 21, row 12), facing along their corridors. Update the doc comment. Verify that `validateBoard`, *No free first shot* and *Pac-Tank has room to spare* (7 spawns: 4 corners, the middle, 2 inner) pass.
- [x] 2.3 Update any test that pins Pac-Tank spawn positions or counts, and verify that the whole sim test suite passes.

## 3. New boards

- [x] 3.1 Add Frustration (`frustration`, `frustration.ts`) as an ASCII maze drawn with `wallsFromGrid`, from the design's starting layout, with the picture in the doc comment. Verify that it passes `validateBoard` and the *No free first shot*, *Frustration's outer strips are sealed* and *No straight line between spawns on Frustration* tests. For the sealed-strips test, check with the nav grid that the outer spawns are cut off from each other once the ring's gaps are blocked.
- [x] 3.2 Add Ricochet Alley (`ricochet-alley`, `ricochetAlley.ts`) from the design's mirrors sketch: corner pockets, long mirrors, side posts and a centre block, with at least 5 spawns. Adjust the layout until it passes `validateBoard`, *No free first shot* and *No straight line between spawns on Ricochet Alley*. Put the final picture in the doc comment.
- [x] 3.3 Add Checkerboard (`checkerboard`, `checkerboard.ts`) from the design's staggered layout (2 × 2 blocks, 4-square gaps), with spawns sheltered beside blocks. Verify that it passes `validateBoard` and *No free first shot*.
- [x] 3.4 Register the three boards in `BUILT_IN_BOARDS` after Pac-Tank, in the order Frustration, Ricochet Alley, Checkerboard. Update the *Seven boards available* test. Verify that the board-catalogue tests and the map-selection tests (Random plays every board before a repeat) pass with seven boards.

## 4. Client and docs

- [x] 4.1 Run the client tests. Then check by hand at 1920 × 1080 that the map picker shows all seven cards with correct thumbnails, and that the setup panel is still usable (it scrolls today). Note the result for the playtest. Result: seven cards squeezed into one row and the thumbnails were distorted. Fixed by wrapping the cards four to a row (short last row centred) and keeping the thumbnails at 3:2.
- [x] 4.2 Update CLAUDE.md *Boards*: the seven boards now exist; The Keep remains a maybe for later. Check that the doc reads correctly.
- [x] 4.3 Run the full build, lint and test suite and verify that everything passes. Then suggest `/qa` and a playtest of the three new boards with a one-map Sequence each, plus Pac-Tank Waves at 4–5 tanks.
