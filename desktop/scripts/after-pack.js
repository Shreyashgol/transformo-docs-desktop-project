import { execSync } from 'node:child_process';
import path from 'node:path';

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`\n[afterPack] Re-signing app bundle with valid ad-hoc signature: ${appPath}`);
  try {
    execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
    console.log('[afterPack] Verification:');
    execSync(`codesign --verify --deep --strict --verbose=2 "${appPath}"`, { stdio: 'inherit' });
    console.log('[afterPack] Successfully signed and verified bundle.\n');
  } catch (err) {
    console.error('[afterPack] Signing error:', err);
    throw err;
  }
}
