import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * True only for the application's own renderer: the dev server origin in development,
 * or the exact bundled index.html file in production. Used to validate IPC senders and
 * navigation targets.
 *
 * @param {string | undefined} rawUrl
 * @param {{ devServerUrl?: string; rendererIndexPath: string }} cfg
 * @returns {boolean}
 */
export function isTrustedRendererUrl(rawUrl, cfg) {
  if (!rawUrl) return false;
  let url;
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

/**
 * External links may only open in the user's browser, and only over https.
 * @param {string} rawUrl
 * @returns {boolean}
 */
export function isSafeExternalUrl(rawUrl) {
  try {
    return new URL(rawUrl).protocol === 'https:';
  } catch {
    return false;
  }
}
