import winston from "winston";

/**
 * Masks sensitive authorization tokens and secrets in log messages.
 * @param message Raw message or object string.
 * @returns Sanitized string.
 */
export function maskSensitive(message: string): string {
  return message
    .replace(/(Bearer\s+)([A-Za-z0-9._~+/-]{6,})/gi, "$1***")
    .replace(/(apiKey|clientSecret|password|api_key|token)([:=]\s*)([^\s&,"']+)/gi, "$1$2***");
}

export const maskSensitiveInfo = maskSensitive;


const customFormat = winston.format.printf(({ level, message, timestamp }) => {
  const safeMessage = typeof message === "string" ? maskSensitive(message) : maskSensitive(JSON.stringify(message));
  return `[${timestamp}] [${level.toUpperCase()}]: ${safeMessage}`;
});

const winstonInstance = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    customFormat,
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ["error", "warn", "info", "debug"],
    }),
  ],
});

export const logger = {
  get level(): string {
    return winstonInstance.level;
  },
  set level(newLevel: string) {
    this.setLevel(newLevel);
  },
  debug(message: string, ...args: unknown[]): void {
    winstonInstance.debug(message, ...args);
  },
  info(message: string, ...args: unknown[]): void {
    winstonInstance.info(message, ...args);
  },
  warn(message: string, ...args: unknown[]): void {
    winstonInstance.warn(message, ...args);
  },
  error(message: string, ...args: unknown[]): void {
    winstonInstance.error(message, ...args);
  },
  setLevel(level: string): void {
    const validLevels = ["debug", "info", "warn", "error"];
    const normalized = level.toLowerCase();
    if (validLevels.includes(normalized)) {
      winstonInstance.level = normalized;
    }
  },
  getLevel(): string {
    return winstonInstance.level;
  },
};

export function setLogLevel(level: string): void {
  logger.setLevel(level);
}

export function getLogLevel(): string {
  return logger.getLevel();
}

