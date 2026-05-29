/**
 * Vitest global setup. Forces NODE_ENV=test and provides safe defaults for
 * required env vars so tests don't bomb at import time.
 */
const env = process.env as Record<string, string>;
env.NODE_ENV = env.NODE_ENV ?? "test";
env.SESSION_SECRET = env.SESSION_SECRET ?? "test-session-secret-12345";
env.JWT_SECRET = env.JWT_SECRET ?? "test-jwt-secret-1234567890";
env.DATABASE_URL = env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/plango_test";
env.LOG_LEVEL = "warn";
