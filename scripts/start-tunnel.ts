/**
 * Start a tunnel for the backend server using localtunnel.
 * Usage: npm run tunnel
 *
 * This will:
 * 1. Start a tunnel pointing to port 5001
 * 2. Print the public URL
 * 3. Tell you what to put in .env
 */

const port = parseInt(process.env.PORT || "5001", 10);

async function startTunnel() {
  try {
    console.log(`\n🚀 Starting tunnel for port ${port}...\n`);

    // Dynamic import for localtunnel
    const localtunnel = (await import("localtunnel")).default;
    const tunnel = await localtunnel({ port });

    const url = tunnel.url;
    const domain = url.replace("https://", "").replace("http://", "");

    console.log(`✅ Tunnel is live!`);
    console.log(`🔗 Public URL: ${url}`);
    console.log(``);
    console.log(`📋 Copy this line to your .env file:`);
    console.log(`──────────────────────────────────────`);
    console.log(`EXPO_PUBLIC_DOMAIN=${domain}`);
    console.log(`──────────────────────────────────────`);
    console.log(``);
    console.log(`Then restart Expo: npx expo start --tunnel`);
    console.log(``);
    console.log(`Press Ctrl+C to stop the tunnel.\n`);

    tunnel.on("close", () => {
      console.log("\n🛑 Tunnel closed.");
      process.exit(0);
    });

    tunnel.on("error", (err: Error) => {
      console.error("❌ Tunnel error:", err);
    });

    process.on("SIGINT", () => {
      console.log("\n🛑 Stopping tunnel...");
      tunnel.close();
      process.exit(0);
    });
  } catch (err) {
    console.error("❌ Failed to start tunnel:", err);
    console.log("\nMake sure localtunnel is installed:");
    console.log("  npm install -D localtunnel");
    console.log("\nOr try manually:");
    console.log("  npx localtunnel --port 5001");
    process.exit(1);
  }
}

startTunnel();
