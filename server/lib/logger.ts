import pino from "pino";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import { env, isDev } from "./env";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "plango-api", env: env.NODE_ENV },
  // Pretty-print only in dev for human readability
  transport: isDev
    ? {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss.l",
        ignore: "pid,hostname,service,env",
        singleLine: false,
      },
    }
    : undefined,
});

/**
 * HTTP request logger middleware. Attaches a request-id to every request,
 * logs req/res with duration. Use BEFORE routes.
 */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => {
    const headerId = req.headers["x-request-id"];
    return typeof headerId === "string" && headerId.length > 0
      ? headerId
      : randomUUID();
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} → ${res.statusCode} (${err.message})`,
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
  // Don't log static asset requests
  autoLogging: {
    ignore: (req) => {
      const url = req.url || "";
      return url.startsWith("/assets/") || url === "/favicon.ico";
    },
  },
});
