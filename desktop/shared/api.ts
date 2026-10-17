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
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

export interface AppInfo {
  name: string;
  version: string;
  isPackaged: boolean;
  platform: string;
  arch: string;
  userDataDir: string;
}

export type BackendState = 'starting' | 'ready' | 'failed' | 'stopped';

export interface BackendStatus {
  state: BackendState;
  /** Human-readable reason when state is "failed". */
  error?: string;
  /** Recent backend stderr lines for diagnostics (never contains credentials). */
  logTail?: string[];
  /** Epoch milliseconds of the last state change. */
  since: number;
}

export interface BackendHealth {
  status: string;
  version: string;
  api_version: number;
  data_dir: string;
  data_dir_writable: boolean;
}

/** Result wrapper so renderer code can show errors without unhandled rejections. */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export interface TransformoApi {
  app: {
    getInfo(): Promise<AppInfo>;
  };
  backend: {
    getStatus(): Promise<BackendStatus>;
    restart(): Promise<BackendStatus>;
    health(): Promise<Result<BackendHealth>>;
    /** Returns an unsubscribe function. */
    onStatusChange(listener: (status: BackendStatus) => void): () => void;
  };
}
