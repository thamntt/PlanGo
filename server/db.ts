import { drizzle } from "drizzle-orm/node-postgres";
import { AsyncLocalStorage } from "node:async_hooks";
import pg from "pg";
import * as schema from "../shared/schema";
import { env, isProd } from "./lib/env";

function buildSslConfig() {
  // Local Postgres on the same machine: no SSL.
  // Anything else (Railway proxy, Neon, Supabase, etc.): SSL with permissive cert
  // check so dev machines without the root CA don't blow up.
  const url = env.DATABASE_URL;
  const isLocal =
    url.includes("localhost") || url.includes("127.0.0.1") || url.includes("@postgres:");
  if (isLocal) return undefined;
  return { rejectUnauthorized: false };
}

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: buildSslConfig(),
});

const baseDb = drizzle(pool, { schema });
type DrizzleDb = typeof baseDb;
type DrizzleTx = Parameters<Parameters<DrizzleDb["transaction"]>[0]>[0];

/**
 * AsyncLocalStorage holding the active transaction object for the current async
 * context. When set (via `withTransaction`), all storage calls that go through
 * the exported `db` proxy will execute on the transaction instead of the pool.
 */
const txStorage = new AsyncLocalStorage<DrizzleTx>();

/**
 * Exported `db`: a Proxy that transparently routes calls to either the active
 * transaction (if inside `withTransaction`) or the base Drizzle DB. Existing
 * storage code that does `db.select()`, `db.insert(...)`, `db.query.trips...`
 * keeps working unchanged.
 */
export const db = new Proxy(baseDb, {
  get(target, prop, receiver) {
    const active = txStorage.getStore();
    const source: any = active ?? target;
    const value = source[prop as keyof typeof source];
    return typeof value === "function" ? value.bind(source) : value;
  },
}) as DrizzleDb;

/**
 * Wrap an async function in a database transaction. Any storage call inside
 * automatically runs on the transaction (via the `db` proxy + AsyncLocalStorage).
 * Throws → rollback. Returns → commit.
 */
export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  return baseDb.transaction(async (tx) => {
    return txStorage.run(tx, fn);
  });
}

/** Ping the database; throws on failure. */
export async function pingDb(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}
