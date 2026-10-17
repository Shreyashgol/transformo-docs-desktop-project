import { app, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { IPC, type AppInfo, type BackendHealth, type Result } from '../shared/api.js';
import type { BackendManager } from './backend-manager.js';
import { isTrustedRendererUrl, type TrustConfig } from './trust.js';

export function registerIpcHandlers(backend: BackendManager, trust: TrustConfig): void {
  const handle = <T>(channel: string, fn: (event: IpcMainInvokeEvent) => Promise<T> | T) => {
    ipcMain.handle(channel, (event) => {
      if (!isTrustedRendererUrl(event.senderFrame?.url, trust)) {
        throw new Error('Untrusted IPC sender');
      }
      return fn(event);
    });
  };

  handle(
    IPC.appGetInfo,
    (): AppInfo => ({
      name: app.getName(),
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      platform: process.platform,
      arch: process.arch,
      userDataDir: app.getPath('userData'),
    }),
  );

  handle(IPC.backendGetStatus, () => backend.status);
  handle(IPC.backendRestart, () => backend.restart());
  handle(IPC.backendHealth, async (): Promise<Result<BackendHealth>> => {
    try {
      return { ok: true, data: await backend.request<BackendHealth>('/health') };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
