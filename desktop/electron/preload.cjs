const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

const statusChannel = 'backend:status-changed';

const api = {
  app: {
    getInfo: () => invoke('app:get-info'),
  },
  backend: {
    getStatus: () => invoke('backend:get-status'),
    restart: () => invoke('backend:restart'),
    health: () => invoke('backend:health'),
    onStatusChange(listener) {
      const handler = (_event, status) => listener(status);
      ipcRenderer.on(statusChannel, handler);
      return () => {
        ipcRenderer.removeListener(statusChannel, handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld('transformo', api);
