import { config } from '../config';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const ORDER: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = ORDER[config.logLevel as LogLevel] ?? ORDER.info;

export interface Logger {
  error(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  debug(message: string, meta?: unknown): void;
  child(scope: string): Logger;
}

function emit(level: LogLevel, scope: string, message: string, meta?: unknown): void {
  if (ORDER[level] > threshold) return;

  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
  };
  if (meta !== undefined) entry.meta = meta;

  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function createLogger(scope = 'app'): Logger {
  return {
    error: (message, meta) => emit('error', scope, message, meta),
    warn: (message, meta) => emit('warn', scope, message, meta),
    info: (message, meta) => emit('info', scope, message, meta),
    debug: (message, meta) => emit('debug', scope, message, meta),
    child: (childScope) => createLogger(`${scope}:${childScope}`),
  };
}

export const logger = createLogger();
