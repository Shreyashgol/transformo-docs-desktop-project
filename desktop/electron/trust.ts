import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface TrustConfig {
  /** Vite dev server URL in development, otherwise undefined. */
  devServerUrl?: string;
  /** Absolute path of the bundled renderer index.html in production. */
  rendererIndexPath: string;
}

/**
 * True only for the application's own renderer: the dev server origin in development,
 * or the exact bundled index.html file in production. Used to validate IPC senders and
 * navigation targets.
 */
export function isTrustedRendererUrl(rawUrl: string | undefined, cfg: TrustConfig): boolean {
  if (!rawUrl) return false;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (cfg.devServerUrl) {
    return url.origin === new URL(cfg.devServerUrl).origin;
  }
  if (url.protocol !== 'file:') return false;
  try {
    return path.resolve(fileURLToPath(url)) === path.resolve(cfg.rendererIndexPath);
  } catch {
    return false;
  }
}

/** External links may only open in the user's browser, and only over https. */
export function isSafeExternalUrl(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).protocol === 'https:';
  } catch {
    return false;
  }
}
