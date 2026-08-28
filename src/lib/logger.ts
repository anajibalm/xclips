import pino from "pino";
import * as path from "path";
import * as fs from "fs";

// Ensure logs directory exists
const LOGS_DIR = path.resolve(process.cwd(), "logs");
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const isDev = process.env.NODE_ENV !== "production";

// Configure file streams
const appLogPath = path.join(LOGS_DIR, "app.log");
const errorLogPath = path.join(LOGS_DIR, "error.log");

const fileTransport = pino.transport({
  targets: [
    // Console output: pretty formatted in dev, json in prod
    isDev
      ? {
          target: "pino-pretty",
          level: process.env.LOG_LEVEL || "debug",
          options: {
            colorize: true,
            translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
            ignore: "pid,hostname",
          },
        }
      : {
          target: "pino/file",
          level: process.env.LOG_LEVEL || "info",
          options: { destination: 1 }, // stdout
        },
    // Combined log file
    {
      target: "pino/file",
      level: "debug",
      options: { destination: appLogPath, mkdir: true },
    },
    // Error only log file
    {
      target: "pino/file",
      level: "error",
      options: { destination: errorLogPath, mkdir: true },
    },
  ],
});

/**
 * Root Pino Logger Instance
 */
export const rootLogger = pino(
  {
    level: process.env.LOG_LEVEL || "debug",
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      req: (req) => ({
        method: req.method,
        url: req.url,
        path: req.path,
        query: req.query,
        headers: {
          host: req.headers?.host,
          "user-agent": req.headers?.["user-agent"],
          "x-trace-id": req.headers?.["x-trace-id"],
        },
      }),
      res: (res) => ({
        statusCode: res.statusCode || res.status,
      }),
    },
  },
  fileTransport
);

/**
 * Creates a scoped child logger with an explicit module identifier
 */
export function createScopedLogger(moduleName: string, context?: Record<string, unknown>) {
  return rootLogger.child({
    module: moduleName,
    ...context,
  });
}

/**
 * Generates a unique trace ID for request and job tracing
 */
export function generateTraceId(prefix = "trc"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// Pre-configured scoped loggers
export const httpLogger = createScopedLogger("http:server");
export const mediaLogger = createScopedLogger("media:engine");
export const ytdlpLogger = createScopedLogger("media:ytdlp");
export const ffmpegLogger = createScopedLogger("media:ffmpeg");
export const queueLogger = createScopedLogger("queue:worker");
export const dbLogger = createScopedLogger("db:sqlite");
export const aiLogger = createScopedLogger("ai:gemini");
