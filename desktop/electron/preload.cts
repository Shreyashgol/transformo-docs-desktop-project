/**
 * Preload script. Runs sandboxed, so it may only `require('electron')`; shared code is
 * imported as types only. Channel names are checked against `IpcChannel` at compile time.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { BackendStatus, IpcChannel, TransformoApi } from '../shared/api.js';

const invoke = <T,>(channel: IpcChannel, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args) as Promise<T>;

const statusChannel: IpcChannel = 'backend:status-changed';

const api: TransformoApi = {
  app: {
    getInfo: () => invoke('app:get-info'),
  },
  backend: {
    getStatus: () => invoke('backend:get-status'),
    restart: () => invoke('backend:restart'),
    health: () => invoke('backend:health'),
    onStatusChange(listener) {
      const handler = (_event: IpcRendererEvent, status: BackendStatus) => listener(status);
      ipcRenderer.on(statusChannel, handler);
      return () => {
        ipcRenderer.removeListener(statusChannel, handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld('transformo', api);
