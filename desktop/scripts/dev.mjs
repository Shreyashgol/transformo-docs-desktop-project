// Development launcher: Vite dev server for the renderer, a one-off TypeScript build of the
// Electron main/preload code, then Electron pointed at the dev server. Quitting Electron
// stops Vite. Restart this script after changing files under electron/.
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);

const tsc = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.electron.build.json'], {
  stdio: 'inherit',
});
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

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
