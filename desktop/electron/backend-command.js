import path from 'node:path';

export const PACKAGED_BACKEND_DIR = 'backend';
export const PACKAGED_BACKEND_NAME = 'transformo-backend';

/**
 * Decide how to launch the backend.
 * - Packaged: the PyInstaller executable under Contents/Resources/backend/ (built in Phase 08).
 * - Development: `python -m app` from backend/.venv in the repository.
 *
 * @param {{
 *   isPackaged: boolean;
 *   resourcesPath: string;
 *   appPath: string;
 *   pythonOverride?: string;
 * }} opts
 * @returns {{ command: string; args: string[]; cwd: string }}
 */
export function resolveBackendCommand(opts) {
  if (opts.isPackaged) {
    const dir = path.join(opts.resourcesPath, PACKAGED_BACKEND_DIR, PACKAGED_BACKEND_NAME);
    return { command: path.join(dir, PACKAGED_BACKEND_NAME), args: [], cwd: dir };
  }
  const backendDir = path.resolve(opts.appPath, '..', 'backend');
  const python = opts.pythonOverride || path.join(backendDir, '.venv', 'bin', 'python');
  return { command: python, args: ['-m', 'app'], cwd: backendDir };
}
