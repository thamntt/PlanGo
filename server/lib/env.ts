import { z } from "zod";

/**
 * Validated environment. Fail-fast at startup: import this module before
 * anything else that depends on env vars.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z
    .string()
    .default("5001")
    .transform((s) => parseInt(s, 10))
    .pipe(z.number().int().positive()),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Auth
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be >= 16 chars"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be >= 16 chars").optional(),
  JWT_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_ROUNDS: z
    .string()
    .default("10")
    .transform((s) => parseInt(s, 10))
    .pipe(z.number().int().min(8).max(15)),

  // External APIs (all optional — server still boots without them, just with reduced features)
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  GOONG_API_KEY: z.string().optional(),
  SERPAPI_KEY: z.string().optional(),

  // Deployment
  REPLIT_DEV_DOMAIN: z.string().optional(),
  REPLIT_DOMAINS: z.string().optional(),
  EXPO_PUBLIC_DOMAIN: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // Observability
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),

  // OAuth — provider client IDs (FE sends them as audience; BE verifies)
  GOOGLE_OAUTH_CLIENT_ID_WEB: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID_IOS: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID_ANDROID: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  APPLE_BUNDLE_ID: z.string().optional(),
  APPLE_SERVICE_ID: z.string().optional(),

  // Email — Resend for transactional emails (reset password, verification)
  RESEND_API_KEY: z.string().optional(),
  // Accept both bare email `noreply@plango.vn` and display-name format `PlanGo <noreply@plango.vn>`
  EMAIL_FROM: z
    .string()
    .min(3)
    .default("PlanGo <noreply@plango.vn>"),
  APP_URL: z.string().url().default("http://localhost:8081"),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  // JWT_SECRET falls back to SESSION_SECRET if not set separately
  const raw = { ...process.env };
  if (!raw.JWT_SECRET && raw.SESSION_SECRET) {
    raw.JWT_SECRET = raw.SESSION_SECRET;
  }

  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const flat = result.error.flatten();
    console.error("\n❌ Invalid environment variables:");
    for (const [field, messages] of Object.entries(flat.fieldErrors)) {
      console.error(`   ${field}: ${(messages ?? []).join(", ")}`);
    }
    console.error("");
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();

export const isProd = env.NODE_ENV === "production";
export const isDev = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";
