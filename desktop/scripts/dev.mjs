// Development launcher: Vite dev server for the renderer,
// then Electron pointed at the dev server. Quitting Electron
// stops Vite.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);

const server = await createServer();
await server.listen();
const url = server.resolvedUrls?.local[0];
if (!url) {
  console.error('Vite did not report a local URL');
  await server.close();
  process.exit(1);
}
console.log(`Renderer dev server: ${url}`);

const electronBinary = require('electron');
const electron = spawn(electronBinary, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});

const shutdown = () => electron.kill('SIGTERM');
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

electron.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
