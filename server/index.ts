import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import { env } from "./lib/env";
import { logger, httpLogger } from "./lib/logger";
import { errorHandler } from "./middlewares/error-handler";
import { notFoundHandler } from "./middlewares/not-found";
import { pool, pingDb } from "./db";
import { registerRoutes } from "./routes";

const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ══════════════════════════════════════════════════════════════
// CORS
// ══════════════════════════════════════════════════════════════

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (env.REPLIT_DEV_DOMAIN) origins.add(`https://${env.REPLIT_DEV_DOMAIN}`);
    if (env.REPLIT_DOMAINS) {
      env.REPLIT_DOMAINS.split(",").forEach((d) => origins.add(`https://${d.trim()}`));
    }

    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    const isLanOrigin =
      origin?.startsWith("http://192.168.") ||
      origin?.startsWith("http://10.") ||
      origin?.startsWith("http://172.");
    const isTunnelOrigin = origin?.includes(".ngrok") || origin?.includes(".loca.lt");
    const isRailwayOrigin = origin?.includes(".railway.app") || origin?.includes(".up.railway.app");

    if (origin && (origins.has(origin) || isLocalhost || isLanOrigin || isTunnelOrigin || isRailwayOrigin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Bypass-Tunnel-Reminder, X-Request-Id");
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Access-Control-Expose-Headers", "X-Request-Id");
    }

    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });
}

// ══════════════════════════════════════════════════════════════
// Body parsing
// ══════════════════════════════════════════════════════════════

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      limit: "10mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false }));
}

// ══════════════════════════════════════════════════════════════
// Expo / landing page
// ══════════════════════════════════════════════════════════════

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(process.cwd(), "static-build", platform, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  res.send(fs.readFileSync(manifestPath, "utf-8"));
}

function serveLandingPage(req: Request, res: Response, landingPageTemplate: string, appName: string) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(process.cwd(), "server", "templates", "landing-page.html");
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) return next();
    if (req.path !== "/" && req.path !== "/manifest") return next();

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") return serveLandingPage(req, res, landingPageTemplate, appName);
    next();
  });

  app.get("/join/:code", (req: Request, res: Response) => {
    const code = req.params.code;
    const deepLink = `exp+plango://join/${code}`;
    const html = `<!doctype html>
<html><head><title>${appName} - Tham gia chuyến đi</title>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<style>* { box-sizing: border-box; } body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 32px 20px; text-align: center; background: #fff; color: #222; line-height: 1.5; min-height: 100vh; display: flex; align-items: center; justify-content: center; } .wrapper { max-width: 420px; margin: 0 auto; } .icon { font-size: 56px; margin-bottom: 16px; } h1 { font-size: 24px; font-weight: 600; margin: 0 0 8px; } .subtitle { font-size: 15px; color: #666; margin-bottom: 24px; } .code-box { background: #f5f5f5; border: 1px solid #ddd; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-family: monospace; font-size: 18px; letter-spacing: 2px; word-break: break-all; } .btn { display: block; width: 100%; padding: 14px; font-size: 16px; font-weight: 600; border: none; border-radius: 12px; cursor: pointer; text-decoration: none; margin-bottom: 12px; transition: opacity 0.15s; text-align: center; } .btn:hover { opacity: 0.9; } .btn-primary { background: #0066FF; color: #fff; } .separator { color: #999; font-size: 13px; margin: 16px 0; } .qr-wrapper { background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 16px; margin: 16px auto; width: fit-content; } .help-text { font-size: 13px; color: #999; margin-top: 16px; } .help-text a { color: #0066FF; }
@media (prefers-color-scheme: dark) { body { background: #0d0d0d; color: #e0e0e0; } h1 { color: #f5f5f5; } .subtitle { color: #888; } .code-box { background: #1a1a1a; border-color: #333; color: #e0e0e0; } .btn-primary { background: #0055DD; } .separator { color: #666; } .qr-wrapper { background: #1a1a1a; border-color: #333; } .help-text { color: #666; } }
</style></head><body><div class="wrapper"><div class="icon">✈️</div><h1>Bạn được mời tham gia chuyến đi!</h1><p class="subtitle">Mở ứng dụng ${appName} để tham gia</p><div class="code-box">${code}</div><a href="${deepLink}" class="btn btn-primary">Mở trong ứng dụng</a><div class="separator">hoặc quét mã QR bên dưới bằng Expo Go</div><div class="qr-wrapper" id="qr-code"></div><p class="help-text">Chưa có ứng dụng? Tải <a href="https://apps.apple.com/app/id982107779">App Store</a> hoặc <a href="https://play.google.com/store/apps/details?id=host.exp.exponent">Google Play</a></p></div>
<script src="https://unpkg.com/qr-code-styling@1.6.0/lib/qr-code-styling.js"><\/script>
<script>(function() { var ua = navigator.userAgent; var isAndroid = /Android/i.test(ua); var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); if (isAndroid || isIOS) { window.location.href = "${deepLink}"; } try { var qr = new QRCodeStyling({ width: 200, height: 200, data: "${deepLink}", dotsOptions: { color: "#333", type: "rounded" }, backgroundOptions: { color: "#fff" }, cornersSquareOptions: { type: "extra-rounded" }, cornersDotOptions: { type: "dot" }, qrOptions: { errorCorrectionLevel: "H" } }); qr.append(document.getElementById("qr-code")); } catch(e) {} })();<\/script>
</body></html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use(express.static(path.resolve(process.cwd(), "static-build")));
}

// ══════════════════════════════════════════════════════════════
// Health endpoints
// ══════════════════════════════════════════════════════════════

function setupHealthChecks(app: express.Application) {
  // Liveness — just confirms the process is running
  app.get("/api/status", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Readiness — confirms DB is reachable
  app.get("/api/health", async (_req, res) => {
    const checks: Record<string, { status: "up" | "down"; latencyMs?: number; error?: string }> = {};

    const t0 = Date.now();
    try {
      await pingDb();
      checks.database = { status: "up", latencyMs: Date.now() - t0 };
    } catch (err) {
      checks.database = { status: "down", error: (err as Error).message };
    }

    const allUp = Object.values(checks).every((c) => c.status === "up");
    res.status(allUp ? 200 : 503).json({
      status: allUp ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    });
  });
}

// ══════════════════════════════════════════════════════════════
// Graceful shutdown
// ══════════════════════════════════════════════════════════════

function setupGracefulShutdown(server: import("node:http").Server) {
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutdown initiated");

    // Stop accepting new connections
    server.close((err) => {
      if (err) logger.error({ err }, "HTTP server close error");
      else logger.info("HTTP server closed");
    });

    // Drain DB pool
    try {
      await pool.end();
      logger.info("Database pool drained");
    } catch (err) {
      logger.error({ err }, "Database pool drain error");
    }

    // Force-exit after 10s if not closed cleanly
    const timer = setTimeout(() => {
      logger.error("Forced exit after 10s timeout");
      process.exit(1);
    }, 10_000);
    (timer as { unref?: () => void }).unref?.();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception");
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    logger.fatal({ reason }, "Unhandled promise rejection");
    process.exit(1);
  });
}

// ══════════════════════════════════════════════════════════════
// Bootstrap
// ══════════════════════════════════════════════════════════════

(async () => {
  setupCors(app);
  setupBodyParsing(app);
  app.use(httpLogger);

  configureExpoAndLanding(app);
  setupHealthChecks(app);

  const server = await registerRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  server.listen({ port: env.PORT, host: "0.0.0.0" }, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "Server listening");
  });

  setupGracefulShutdown(server);
})().catch((err) => {
  logger.fatal({ err }, "Failed to bootstrap server");
  process.exit(1);
});
