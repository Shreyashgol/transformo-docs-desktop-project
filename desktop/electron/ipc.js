import { app, ipcMain } from 'electron';
import { IPC } from '../shared/api.js';
import { isTrustedRendererUrl } from './trust.js';

/**
 * @param {import('./backend-manager.js').BackendManager} backend
 * @param {{ devServerUrl?: string; rendererIndexPath: string }} trust
 */
export function registerIpcHandlers(backend, trust) {
  const handle = (channel, fn) => {
    ipcMain.handle(channel, (event, ...args) => {
      if (!isTrustedRendererUrl(event.senderFrame?.url, trust)) {
        throw new Error('Untrusted IPC sender');
      }
      return fn(event, ...args);
    });
  };

  handle(IPC.appGetInfo, () => ({
    name: app.getName(),
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    platform: process.platform,
    arch: process.arch,
    userDataDir: app.getPath('userData'),
  }));

  handle(IPC.backendGetStatus, () => backend.status);
  handle(IPC.backendRestart, () => backend.restart());
  handle(IPC.backendHealth, async () => {
    try {
      return { ok: true, data: await backend.request('/api/health') };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
