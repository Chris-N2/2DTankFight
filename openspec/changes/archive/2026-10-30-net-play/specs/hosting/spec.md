## ADDED Requirements

### Requirement: Naming a multiplayer server
A host page SHALL be able to name a multiplayer server with `<meta name="tank-command-server" content="...">`, whose
content is the server's WebSocket address (for example `wss://tank-server.example.net`). When the page names one,
the game SHALL offer online play through it. When it doesn't, the game SHALL be single-player only and SHALL make no
network connection for multiplayer. The page needs nothing else for online play. Running the development server
locally SHALL offer online play through a locally run multiplayer server without any tag.

#### Scenario: Turning online play on
- **WHEN** a host page adds `<meta name="tank-command-server" content="wss://tank-server.example.net">`
- **THEN** the setup screen offers online play through that server

#### Scenario: Static as ever
- **WHEN** the built game is served from a page with no server tag
- **THEN** it plays exactly as a single-player game does today, and opens no multiplayer connection

### Requirement: Join links come back to the host page
A join link SHALL be the address of the page the game is running on, with the room code added, so a guest lands on
the same host page (with its theme) and joins straight away. Any address the page already had, such as a path or
other query parameters, SHALL be kept.

#### Scenario: A link to the same page
- **WHEN** the game runs on `https://example.com/games/tank-command/?ref=menu` and the host gets room `KTXW`
- **THEN** the join link opens `https://example.com/games/tank-command/` with `ref=menu` kept and the room code added

### Requirement: Server build
`npm run build:server` SHALL produce a folder that contains the whole multiplayer server in one JavaScript file, plus
a `package.json` whose start script runs it, with no other dependencies to install. Zipping that folder SHALL be
enough to deploy the server to a Node hosting platform such as an Azure App Service. The README SHALL describe:
- deploying the server with Zip Deploy and the App Service settings it needs (Always On, a single
  instance, and `ALLOWED_ORIGINS`);
- running it with Docker;
- running it locally for development and LAN play.

#### Scenario: Nothing else to install
- **WHEN** the server build folder is copied to a clean machine with Node and started with `npm start`
- **THEN** the server runs and answers `/health`, without `npm install`

### Requirement: Container image
The repository SHALL include a Dockerfile that builds and runs the multiplayer server, configured by the same
environment variables, for anyone hosting their own copy.

#### Scenario: Running the container
- **WHEN** the image is built and run with `PORT=8080` published
- **THEN** the server answers `/health` on port 8080
