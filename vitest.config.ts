import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/__tests__/**/*.ts"],
    exclude: ["node_modules", "admin-plango", "static-build", "server_dist"],
    globals: false,
    testTimeout: 15_000,
    setupFiles: ["server/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
