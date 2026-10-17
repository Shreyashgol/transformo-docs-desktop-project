import { describe, expect, it } from 'vitest';
import { IPC } from './api';

describe('shared/api IPC channels', () => {
  it('defines the required IPC channels', () => {
    expect(IPC.appGetInfo).toBe('app:get-info');
    expect(IPC.backendGetStatus).toBe('backend:get-status');
    expect(IPC.backendRestart).toBe('backend:restart');
    expect(IPC.backendHealth).toBe('backend:health');
    expect(IPC.backendStatusChanged).toBe('backend:status-changed');
  });
});
