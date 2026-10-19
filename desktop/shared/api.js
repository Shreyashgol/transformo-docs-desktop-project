/**
 * Contract between the preload script and the renderer.
 *
 * The renderer only ever sees `window.transformo`, a set of named functions. It never
 * receives the backend port, auth token, or any Node/Electron primitive.
 */

export const IPC = {
  appGetInfo: 'app:get-info',
  backendGetStatus: 'backend:get-status',
  backendRestart: 'backend:restart',
  backendHealth: 'backend:health',
  backendStatusChanged: 'backend:status-changed',
  documentsSelectAndImport: 'documents:select-and-import',
  documentsUploadBuffer: 'documents:upload-buffer',
  documentsList: 'documents:list',
  documentsGet: 'documents:get',
  documentsDelete: 'documents:delete',
  documentsStats: 'documents:stats',
};
