#!/usr/bin/env node
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

// Reject virtual / VPN / loopback adapters that confuse Expo's auto-detection
const VIRTUAL_PATTERNS = [
  /vEthernet/i,
  /Hyper-?V/i,
  /WSL/i,
  /Virtual ?Box/i,
  /VMware/i,
  /VMnet/i,
  /TAP/i,
  /Bluetooth/i,
  /Loopback/i,
];

// RFC1918 private LAN ranges — the IP your phone can reach
const PRIVATE_RANGE = /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01])\.)/;

function findLanIp() {
  const ifaces = os.networkInterfaces();
  const candidates = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (VIRTUAL_PATTERNS.some((re) => re.test(name))) continue;
    for (const a of addrs || []) {
      if (a.family !== "IPv4") continue;
      if (a.internal) continue;
      if (a.address.startsWith("169.254")) continue; // link-local
      candidates.push({ name, address: a.address });
    }
  }
  const lan = candidates.find((c) => PRIVATE_RANGE.test(c.address));
  return lan || candidates[0] || null;
}

const ENV_PATH = path.resolve(process.cwd(), ".env");

function parseEnv(text) {
  const map = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m) map[m[1]] = m[2];
  }
  return map;
}

function syncEnvDomain(targetDomain) {
  if (!fs.existsSync(ENV_PATH)) {
    console.warn(`[expo:lan] .env not found at ${ENV_PATH} — skipping API URL sync`);
    return;
  }
  const original = fs.readFileSync(ENV_PATH, "utf8");
  const env = parseEnv(original);
  const port = env.PORT || "5001";
  const next = `${targetDomain}:${port}`;
  if (env.EXPO_PUBLIC_DOMAIN === next) {
    console.log(`[expo:lan] EXPO_PUBLIC_DOMAIN already ${next} — no change`);
    return;
  }
  let updated;
  if (/^EXPO_PUBLIC_DOMAIN=.*$/m.test(original)) {
    updated = original.replace(/^EXPO_PUBLIC_DOMAIN=.*$/m, `EXPO_PUBLIC_DOMAIN=${next}`);
  } else {
    updated = (original.endsWith("\n") ? original : original + "\n") + `EXPO_PUBLIC_DOMAIN=${next}\n`;
  }
  fs.writeFileSync(ENV_PATH, updated);
  console.log(`[expo:lan] EXPO_PUBLIC_DOMAIN → ${next}  (was ${env.EXPO_PUBLIC_DOMAIN || "<unset>"})`);
}

const passthroughArgs = process.argv.slice(2);
const lan = findLanIp();
if (!lan) {
  console.error("[expo:lan] No reachable LAN interface found.");
  console.error("           Either you're not connected to Wi-Fi/Ethernet, or every");
  console.error("           detected adapter looks virtual. Falling back to Expo's");
  console.error("           auto-detection — if the QR shows 127.0.0.1, switch to tunnel.");
} else {
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME = lan.address;
  console.log(`[expo:lan] Binding Metro to ${lan.address}  (${lan.name})`);
  syncEnvDomain(lan.address);
}

const isWindows = process.platform === "win32";
const child = spawn(
  "npx",
  ["expo", "start", "--lan", "-c", ...passthroughArgs],
  { stdio: "inherit", env: process.env, shell: isWindows },
);
child.on("exit", (code) => process.exit(code ?? 0));
