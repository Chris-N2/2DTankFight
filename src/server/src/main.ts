import { launch } from './launch';

const server = await launch(process.env, console);
if (!server) process.exit(1);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void server.close().then(() => process.exit(0));
  });
}
