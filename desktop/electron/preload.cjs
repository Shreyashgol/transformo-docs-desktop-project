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
  documents: {
    selectAndImport: () => invoke('documents:select-and-import'),
    uploadBuffer: (data) => invoke('documents:upload-buffer', data),
    list: () => invoke('documents:list'),
    get: (docId) => invoke('documents:get', docId),
  },
};

contextBridge.exposeInMainWorld('transformo', api);
