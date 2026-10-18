import fs from 'node:fs';
import path from 'node:path';

const MAX_BYTES = 2_000_000;

/**
 * Append-only main-process log in the user data directory, rotated once at startup.
 * @param {string} logDir
 * @param {string} [name='main.log']
 * @returns {(line: string) => void}
 */
export function createFileLogger(logDir, name = 'main.log') {
  fs.mkdirSync(logDir, { recursive: true, mode: 0o700 });
  const file = path.join(logDir, name);
  try {
    if (fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, `${file}.1`);
  } catch {
    // No existing log.
  }
  const stream = fs.createWriteStream(file, { flags: 'a', mode: 0o600 });
  return (line) => {
    const entry = `${new Date().toISOString()} ${line}\n`;
    stream.write(entry);
    if (process.env.VITE_DEV_SERVER_URL) process.stderr.write(entry);
  };
}
