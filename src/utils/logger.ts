import pc from 'picocolors';

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

const LEVELS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export interface Logger {
  level: LogLevel;
  error(msg: string): void;
  warn(msg: string): void;
  info(msg: string): void;
  debug(msg: string): void;
}

class ConsoleLogger implements Logger {
  constructor(public level: LogLevel = 'info') {}

  private should(level: LogLevel): boolean {
    return LEVELS[this.level] >= LEVELS[level];
  }

  error(msg: string): void {
    if (this.should('error')) process.stderr.write(`${pc.red('error')} ${msg}\n`);
  }

  warn(msg: string): void {
    if (this.should('warn')) process.stderr.write(`${pc.yellow('warn')}  ${msg}\n`);
  }

  info(msg: string): void {
    if (this.should('info')) process.stderr.write(`${msg}\n`);
  }

  debug(msg: string): void {
    if (this.should('debug')) process.stderr.write(`${pc.dim(`debug ${msg}`)}\n`);
  }
}

export function createLogger(level: LogLevel = 'info'): Logger {
  return new ConsoleLogger(level);
}

/** Singleton logger used by core modules; the CLI may swap its level. */
export const logger: Logger = createLogger(
  (process.env.SKILL_LOG_LEVEL as LogLevel | undefined) ?? 'info',
);
