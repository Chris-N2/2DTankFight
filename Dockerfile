# The multiplayer server, for anyone hosting their own copy. Configured by the same environment variables as
# everywhere else (see the README). The browser game itself is a static build and doesn't need this.
#
#   docker build -t tank-command-server .
#   docker run -p 8080:8080 -e ALLOWED_ORIGINS=https://example.com tank-command-server

FROM node:22 AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY src/sim/package.json src/sim/
COPY src/protocol/package.json src/protocol/
COPY src/client/package.json src/client/
COPY src/server/package.json src/server/
RUN npm ci
COPY src ./src
RUN npm run build:server

# Just the bundle: one server.js and its package.json, nothing to install.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/dist/server ./
USER node
EXPOSE 8080
CMD ["npm", "start"]
