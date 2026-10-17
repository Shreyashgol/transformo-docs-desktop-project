import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import type { BackendState, BackendStatus } from '../shared/api.js';
import type { BackendCommand } from './backend-command.js';
import { findFreePort } from './port.js';

export interface BackendManagerOptions {
  command: BackendCommand;
  dataDir: string;
  readyTimeoutMs?: number;
  stopTimeoutMs?: number;
  maxPortAttempts?: number;
  /** Sink for backend output lines (e.g. the main-process log file). */
  log?: (line: string) => void;
}

export class BackendError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

const LOG_TAIL_LINES = 60;
const ENV_PASSTHROUGH = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'USER'];
const PORT_IN_USE = /address already in use|errno 48|eaddrinuse/i;

type StartupOutcome = 'ready' | 'port-in-use';

/**
 * Owns the backend child process: free-port selection, per-launch auth token, readiness
 * polling, crash detection, and graceful shutdown. The port and token never leave the
 * main process.
 */
export class BackendManager extends EventEmitter<{ status: [BackendStatus] }> {
  private child: ChildProcess | null = null;
  private port = 0;
  private readonly token = randomBytes(32).toString('hex');
  private logTail: string[] = [];
  private current: BackendStatus = { state: 'stopped', since: Date.now() };
  private starting: Promise<BackendStatus> | null = null;
  private generation = 0;

  constructor(private readonly opts: BackendManagerOptions) {
    super();
  }

  get status(): BackendStatus {
    return this.current;
  }

  start(): Promise<BackendStatus> {
    if (this.current.state === 'ready') return Promise.resolve(this.current);
    if (!this.starting) {
      this.starting = this.startInternal().finally(() => {
        this.starting = null;
      });
    }
    return this.starting;
  }

  async restart(): Promise<BackendStatus> {
    if (this.starting) await this.starting;
    await this.stop();
    return this.start();
  }

  async stop(): Promise<void> {
    await this.killChild();
    this.setState('stopped');
  }

  private async killChild(): Promise<void> {
    const child = this.child;
    this.generation += 1; // exit events from this child are now expected
    this.child = null;
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
      child.kill('SIGTERM');
      const timeout = this.opts.stopTimeoutMs ?? 5000;
      const graceful = await Promise.race([
        exited.then(() => true),
        delay(timeout).then(() => false),
      ]);
      if (!graceful) {
        this.log(`Backend did not exit within ${timeout} ms; sending SIGKILL`);
        child.kill('SIGKILL');
        await exited;
      }
    }
  }

  /** Authenticated request to the backend. Only callable from the main process. */
  async request<T>(pathname: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
    if (this.current.state !== 'ready') {
      throw new BackendError('The document engine is not running.');
    }
    const { timeoutMs = 30_000, headers, ...rest } = init;
    let res: Response;
    try {
      res = await fetch(`http://127.0.0.1:${this.port}${pathname}`, {
        ...rest,
        headers: { ...headers, 'X-Transformo-Token': this.token },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new BackendError(`Could not reach the document engine: ${errorMessage(err)}`);
    }
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const detail =
        body && typeof body === 'object' && 'detail' in body ? String(body.detail) : res.statusText;
      throw new BackendError(detail, res.status);
    }
    return body as T;
  }

  private async startInternal(): Promise<BackendStatus> {
    this.logTail = [];
    this.setState('starting');
    const { command } = this.opts;

    if (!fs.existsSync(command.command)) {
      return this.fail(`Backend executable not found: ${command.command}`);
    }

    const attempts = this.opts.maxPortAttempts ?? 3;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const outcome = await this.launchOnce();
        if (outcome === 'ready') {
          this.setState('ready');
          return this.current;
        }
        this.log(`Port ${this.port} was taken during startup (attempt ${attempt}); retrying`);
      } catch (err) {
        await this.killChild();
        return this.fail(errorMessage(err));
      }
    }
    return this.fail('Could not find a free local port for the document engine.');
  }

  private async launchOnce(): Promise<StartupOutcome> {
    this.port = await findFreePort();
    const generation = ++this.generation;
    const { command, args, cwd } = this.opts.command;

    const env: NodeJS.ProcessEnv = {};
    for (const key of ENV_PASSTHROUGH) if (process.env[key]) env[key] = process.env[key];
    Object.assign(env, {
      PYTHONUNBUFFERED: '1',
      PYTHONDONTWRITEBYTECODE: '1',
      TRANSFORMO_PORT: String(this.port),
      TRANSFORMO_TOKEN: this.token,
      TRANSFORMO_DATA_DIR: this.opts.dataDir,
      TRANSFORMO_PARENT_PID: String(process.pid),
    });

    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    this.child = child;
    child.stdout?.setEncoding('utf8').on('data', (chunk: string) => this.captureOutput(chunk));
    child.stderr?.setEncoding('utf8').on('data', (chunk: string) => this.captureOutput(chunk));

    const exited = new Promise<never>((_, reject) => {
      child.once('error', (err) => reject(new Error(`Failed to start backend: ${err.message}`)));
      child.once('exit', (code, signal) => {
        reject(new ExitError(code, signal));
      });
    });
    // The race below may settle first; later exits must not become unhandled rejections.
    exited.catch(() => undefined);
    // Crash after a successful start: surface it to the UI.
    child.once('exit', (code, signal) => {
      if (generation !== this.generation || this.current.state !== 'ready') return;
      this.child = null;
      this.fail(`The document engine stopped unexpectedly (${describeExit(code, signal)}).`);
    });

    try {
      await Promise.race([this.waitForHealth(), exited]);
      return 'ready';
    } catch (err) {
      if (err instanceof ExitError) {
        this.child = null;
        if (this.logTail.some((line) => PORT_IN_USE.test(line))) return 'port-in-use';
        throw new Error(`The document engine exited during startup (${err.describe()}).`);
      }
      throw err;
    }
  }

  private async waitForHealth(): Promise<void> {
    const deadline = Date.now() + (this.opts.readyTimeoutMs ?? 30_000);
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/health`, {
          headers: { 'X-Transformo-Token': this.token },
          signal: AbortSignal.timeout(1000),
        });
        if (res.ok) return;
      } catch {
        // Not listening yet.
      }
      await delay(200);
    }
    throw new Error('The document engine did not become ready in time.');
  }

  private captureOutput(chunk: string): void {
    for (const raw of chunk.split('\n')) {
      const line = raw.replaceAll(this.token, '[redacted]').trimEnd();
      if (!line) continue;
      this.logTail.push(line);
      if (this.logTail.length > LOG_TAIL_LINES) this.logTail.shift();
      this.opts.log?.(`[backend] ${line}`);
    }
  }

  private fail(error: string): BackendStatus {
    this.log(error);
    return this.setState('failed', error);
  }

  private setState(state: BackendState, error?: string): BackendStatus {
    this.current = {
      state,
      since: Date.now(),
      ...(error ? { error, logTail: [...this.logTail] } : {}),
    };
    this.emit('status', this.current);
    return this.current;
  }

  private log(line: string): void {
    this.opts.log?.(`[backend-manager] ${line}`);
  }
}

class ExitError extends Error {
  constructor(
    readonly code: number | null,
    readonly signal: NodeJS.Signals | null,
  ) {
    super('Backend exited');
  }

  describe(): string {
    return describeExit(this.code, this.signal);
  }
}

function describeExit(code: number | null, signal: NodeJS.Signals | null): string {
  return signal ? `signal ${signal}` : `exit code ${code}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
