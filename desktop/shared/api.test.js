import { describe, expect, it } from 'vitest';
import { IPC } from './api.js';

describe('shared/api IPC channels', () => {
  it('defines the required IPC channels', () => {
    expect(IPC.appGetInfo).toBe('app:get-info');
    expect(IPC.backendGetStatus).toBe('backend:get-status');
    expect(IPC.backendRestart).toBe('backend:restart');
    expect(IPC.backendHealth).toBe('backend:health');
    expect(IPC.backendStatusChanged).toBe('backend:status-changed');
    expect(IPC.documentsSelectAndImport).toBe('documents:select-and-import');
    expect(IPC.documentsUploadBuffer).toBe('documents:upload-buffer');
    expect(IPC.documentsList).toBe('documents:list');
    expect(IPC.documentsGet).toBe('documents:get');
    expect(IPC.documentsDelete).toBe('documents:delete');
    expect(IPC.documentsStats).toBe('documents:stats');
    expect(IPC.aiGetSettings).toBe('ai:get-settings');
    expect(IPC.aiSetConsent).toBe('ai:set-consent');
    expect(IPC.aiGenerateSummary).toBe('ai:generate-summary');
    expect(IPC.aiGetSummary).toBe('ai:get-summary');
    expect(IPC.aiExtractDocument).toBe('ai:extract-document');
    expect(IPC.aiGetExtraction).toBe('ai:get-extraction');
    expect(IPC.aiUpdateExtraction).toBe('ai:update-extraction');
    expect(IPC.aiExportExtraction).toBe('ai:export-extraction');
  });
});
