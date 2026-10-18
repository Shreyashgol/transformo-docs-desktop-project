import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
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

  // Native File Picker & Import
  handle(IPC.documentsSelectAndImport, async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(focusedWindow || undefined, {
      title: 'Import Documents',
      buttonLabel: 'Import',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Supported Documents (*.pdf, *.docx, *.txt)', extensions: ['pdf', 'docx', 'txt'] },
        { name: 'PDF Documents (*.pdf)', extensions: ['pdf'] },
        { name: 'Word Documents (*.docx)', extensions: ['docx'] },
        { name: 'Plain Text (*.txt)', extensions: ['txt'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: true, data: { canceled: true, imported: [], errors: [] } };
    }

    const imported = [];
    const errors = [];

    for (const filePath of result.filePaths) {
      const filename = path.basename(filePath);
      try {
        const fileBytes = await fs.readFile(filePath);
        const formData = new FormData();
        const blob = new Blob([fileBytes]);
        formData.append('file', blob, filename);

        const doc = await backend.request('/api/documents/import', {
          method: 'POST',
          body: formData,
        });
        imported.push(doc);
      } catch (err) {
        errors.push({
          filename,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      ok: true,
      data: {
        canceled: false,
        imported,
        errors,
      },
    };
  });

  // Upload file buffer (e.g. from Drag & Drop)
  handle(IPC.documentsUploadBuffer, async (_event, { name, buffer }) => {
    try {
      const formData = new FormData();
      const blob = new Blob([buffer]);
      formData.append('file', blob, name);

      const doc = await backend.request('/api/documents/import', {
        method: 'POST',
        body: formData,
      });
      return { ok: true, data: doc };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // List all imported documents
  handle(IPC.documentsList, async () => {
    try {
      const docs = await backend.request('/api/documents');
      return { ok: true, data: docs };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Get single document detail
  handle(IPC.documentsGet, async (_event, docId) => {
    try {
      const doc = await backend.request(`/api/documents/${encodeURIComponent(docId)}`);
      return { ok: true, data: doc };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
