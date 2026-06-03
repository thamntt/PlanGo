import * as Sentry from "@sentry/node";
import { env, isProd } from "./env";
import { logger } from "./logger";

/**
 * Initialize Sentry if SENTRY_DSN is configured. Idempotent — safe to call once
 * at boot. When DSN is missing (dev/CI), Sentry stays inert and capture calls
 * no-op.
 */
let initialized = false;
export function initSentry(): void {
  if (initialized) return;
  initialized = true;

  if (!env.SENTRY_DSN) {
    logger.info("Sentry: DSN not configured, error tracking disabled");
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: isProd ? 0.1 : 1.0,
    release: env.SENTRY_RELEASE,
    // Don't send sensitive data
    sendDefaultPii: false,
  });

  logger.info({ environment: env.NODE_ENV }, "Sentry initialized");
}

/**
 * Capture an exception with optional context. Safe to call even if Sentry is
 * not initialized (becomes a no-op).
 */
export function captureException(
  err: unknown,
  context?: { requestId?: string; userId?: number; tags?: Record<string, string> },
): void {
  if (!initialized || !env.SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    if (context?.requestId) scope.setTag("requestId", context.requestId);
    if (context?.userId !== undefined) scope.setUser({ id: String(context.userId) });
    if (context?.tags) {
      for (const [k, v] of Object.entries(context.tags)) scope.setTag(k, v);
    }
    Sentry.captureException(err);
  });
}
