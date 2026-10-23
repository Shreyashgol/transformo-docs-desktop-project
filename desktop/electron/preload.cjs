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
    list: (params) => invoke('documents:list', params),
    get: (docId) => invoke('documents:get', docId),
    delete: (docId) => invoke('documents:delete', docId),
    stats: () => invoke('documents:stats'),
  },
  ai: {
    getSettings: () => invoke('ai:get-settings'),
    updateSettings: (config) => invoke('ai:update-settings', config),
    validate: () => invoke('ai:validate'),
    setConsent: (consent) => invoke('ai:set-consent', consent),
    generateSummary: (params) => invoke('ai:generate-summary', params),
    getSummary: (docId) => invoke('ai:get-summary', docId),
    extractDocument: (params) => invoke('ai:extract-document', params),
    getExtraction: (docId, profile) => invoke('ai:get-extraction', { docId, profile }),
    updateExtraction: (params) => invoke('ai:update-extraction', params),
    exportExtraction: (params) => invoke('ai:export-extraction', params),
  },
};

contextBridge.exposeInMainWorld('transformo', api);
