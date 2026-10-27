## Why

The game is going on the developer's website, and possibly on other people's. It should look like part of each site.
Today every arena colour is hard-coded in the renderer, and the menus' CSS variables have generic names that could
clash with a host page's. Getting it onto a page is also awkward:
- the build gives its files new hashed names every time;
- the game's screens live as markup in `index.html`, so a host template (such as an Umbraco document type) would have
  to copy that markup and keep it in step with every release.

The roadmap's next item was "tank selection & cosmetics". Exploration replaced it with something simpler:
- The tank graphics stay as they are.
- Rather than choosing a tank, **every player sees themselves in green, with the "YOU" ring**. The other human is
  always blue, and the AI tanks' colours are fixed and the same on every screen. So nobody needs a selection screen,
  and "the red one" means the same tank to both players.

That rule only shows once there are two humans, so it's recorded now and built with multiplayer.

## What Changes

- **A theme for the arena and menus**, so a host can match their site:
  - Themeable: page backdrop, floor, grid, walls and wall edge, arena border, menu panel, text, muted text, accent
    colour and font.
  - Supplied by an optional **`theme.json`**, found next to the game's files or wherever a `<meta>` tag in the page
    points. A host page's **CSS variables** override it. The built-in defaults are today's look.
  - Invalid or unknown values are skipped one by one with a console warning. A missing or broken theme never stops
    the game.
  - A console warning (never an error) if the floor colour is too close to a tank colour to see clearly.
  - The game waits briefly for the theme before its first frame, so there's no flash of the default colours.
- **Gameplay colours stay fixed** and aren't themeable: tank colours, shells, explosions, mud and the "YOU" ring.
  Players must always be able to read them.
- **Easy hosting:**
  - The built game works from any folder (it already uses relative paths; now this is specified and tested).
  - The entry script and stylesheet get **stable file names**, so a host template can refer to them across releases.
  - The game **builds its own screens** inside a single mount element. A host page needs only the stylesheet, a
    `<div>`, the script and, optionally, a theme. `index.html` becomes that minimal page.
- **The menus' CSS variables are namespaced** (`--tank-*`), so they can't clash with a host site's own.
- **Docs:**
  - `theme.example.json`, a sample theme;
  - a README section, "Putting it on your site";
  - CLAUDE.md: "Tanks" and the roadmap describe the "you're always green" rule in place of tank selection.

## Capabilities

### New Capabilities
- `theme`: the themeable settings and their defaults, where a theme comes from (`theme.json`, the `<meta>` tag, page
  CSS variables) and in what order they apply, validation and warnings, the contrast warning, no flash of default
  colours, and which colours are deliberately not themeable.
- `hosting`: what a host page needs. That covers working from any folder, stable entry file names, and the game
  building its own screens inside one mount element.

### Modified Capabilities
- `game-client`: "Arena rendering" takes the arena's colours from the theme. It also states that the human is always
  drawn in the "you" colour (green), whatever the theme.

## Impact

- **Client (`src/client`):**
  - `renderer.ts`: arena colours come from the theme rather than constants;
  - `styles.css`: namespaced variables, and colours that were hard-coded taken from the theme;
  - new `theme.ts` (loading, validating, applying and checking contrast) and `markup.ts` (the screens' markup, moved
    out of `index.html`);
  - `main.ts`: waits for the theme, then mounts the screens and starts;
  - `index.html`: the minimal host page;
  - `vite.config.ts`: stable entry file names.
- **New files:** `src/client/public/theme.example.json`.
- **Simulation:** none. Themes are purely presentation.
- **Docs:** README and CLAUDE.md.
- **Deploying:** stable file names mean browsers may cache an old build after a deploy, so the README shows adding a
  version query string in the host page. No new dependencies.
