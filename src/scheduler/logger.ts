export interface ILogger {
  info: ConsoleLogFn;
  debug: ConsoleLogFn;
  warn: ConsoleLogFn;
  error: ConsoleLogFn;
}

type ConsoleLogFn = (...args: Parameters<(typeof console)["log"]>) => void;

export enum LogLevel {
  Debug = 3,
  Info = 2,
  Warn = 1,
  Error = 0,
}
export function getLogger(level: LogLevel = LogLevel.Error) {
  const logger: ILogger = {
    debug: (...args) => (level >= LogLevel.Debug ? console.debug(...args) : undefined),
    info: (...args) => (level >= LogLevel.Info ? console.log(...args) : undefined),
    warn: (...args) => (level >= LogLevel.Warn ? console.warn(...args) : undefined),
    error: (...args) => (level >= LogLevel.Error ? console.error(...args) : undefined),
  };

  return logger;
}
