import { app, BrowserWindow, session, shell } from 'electron';
import path from 'node:path';
import { IPC } from '../shared/api.js';
import { resolveBackendCommand } from './backend-command.js';
import { BackendManager } from './backend-manager.js';
import { registerIpcHandlers } from './ipc.js';
import { createFileLogger } from './logger.js';
import { isSafeExternalUrl, isTrustedRendererUrl } from './trust.js';

const APP_NAME = 'Transformo Docs';
const devServerUrl = app.isPackaged ? undefined : process.env.VITE_DEV_SERVER_URL;
const here = import.meta.dirname;

// Keep development data separate from an installed copy of the app.
app.setName(APP_NAME);
app.setPath('userData', path.join(app.getPath('appData'), devServerUrl ? `${APP_NAME} Dev` : APP_NAME));

const trust = {
  devServerUrl,
  rendererIndexPath: path.join(here, '..', 'dist', 'index.html'),
};

const log = createFileLogger(path.join(app.getPath('userData'), 'logs'));

const backend = new BackendManager({
  command: resolveBackendCommand({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
    pythonOverride: app.isPackaged ? undefined : process.env.TRANSFORMO_PYTHON,
  }),
  dataDir: app.getPath('userData'),
  readyTimeoutMs: app.isPackaged ? 60_000 : 30_000,
  log,
});

backend.on('status', (status) => {
  log(`[main] backend state: ${status.state}${status.error ? ` — ${status.error}` : ''}`);
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.backendStatusChanged, status);
  }
});

function applySecurityPolicies() {
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (isSafeExternalUrl(url)) void shell.openExternal(url);
      return { action: 'deny' };
    });
    contents.on('will-navigate', (event, url) => {
      if (!isTrustedRendererUrl(url, trust)) event.preventDefault();
    });
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: APP_NAME,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });
  win.once('ready-to-show', () => win.show());
  if (devServerUrl) {
    void win.loadURL(devServerUrl);
  } else {
    void win.loadFile(trust.rendererIndexPath);
  }
  return win;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  let shutdownComplete = false;
  app.on('before-quit', (event) => {
    if (shutdownComplete) return;
    event.preventDefault();
    log('[main] quitting; stopping backend');
    void backend.stop().finally(() => {
      shutdownComplete = true;
      app.quit();
    });
  });

  // Ctrl+C / kill of the dev Electron process should still stop the backend cleanly.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => app.quit());
  }

  void app.whenReady().then(() => {
    log(`[main] ${APP_NAME} ${app.getVersion()} starting (packaged=${app.isPackaged})`);
    applySecurityPolicies();
    registerIpcHandlers(backend, trust);
    createWindow();
    // Startup failures are reported in the renderer (with log tail and a Retry action).
    void backend.start();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}
