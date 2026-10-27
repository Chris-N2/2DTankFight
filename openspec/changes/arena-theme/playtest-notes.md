# Arena theme: check notes

## Local check by the developer (2026-10-27)

- A custom `theme.json` (dark navy floor, lilac walls) works well. The arena and menus restyle as expected.
- **Found:** the banner's second line ("Round x of y", "You 1 – 0 AI") was coloured with the **wall** colour, so it
  was hard to read where the banner floats over the centre block. This was already true in the default theme, just
  less obvious.
  - **Fixed:** that line now uses `ink`, and both banner lines have a halo in the `backdrop` colour, with still no
    opaque panel, since the banner is part of the game rather than a menu.
  - A scenario was added to the `theme` spec ("Banner text stays readable over the arena"), with a regression test.
  - The only other text drawn on the arena, the "YOU" label, already has a fixed dark outline.

## Follow-up check by the developer (2026-10-27)

- The banner fix works in the dev build.
- **Working on the developer's own Umbraco website:**
  - the game is served from the site;
  - it uses its own minimal template;
  - the colour theme works well.
