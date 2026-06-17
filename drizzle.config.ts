import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Limit drizzle to the public schema and skip Postgres extension objects
  // (e.g. Xata's pre-installed pg_stat_statements view). Without this,
  // `drizzle-kit push` tries to drop those system views and Postgres
  // rejects the drop.
  schemaFilter: ["public"],
  tablesFilter: ["!pg_stat_statements*"],
});
