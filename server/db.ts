import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@/shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

const pendingMigrations: string[] = [
  `ALTER TABLE sales ADD COLUMN IF NOT EXISTS x402_nonce text`,
  `CREATE INDEX IF NOT EXISTS sales_x402_nonce_idx ON sales (x402_nonce)`,
];

let _migrationPromise: Promise<void> | null = null;

export function ensureMigrations(): Promise<void> {
  if (!_migrationPromise) {
    _migrationPromise = (async () => {
      for (const sql of pendingMigrations) {
        try {
          await pool.query(sql);
          console.log(`[migrate] OK: ${sql.slice(0, 80)}`);
        } catch (err: any) {
          if (err.code === "42701") {
            console.log(`[migrate] SKIP (already exists): ${sql.slice(0, 80)}`);
          } else {
            console.error(`[migrate] FAIL: ${sql.slice(0, 80)}`, err.message);
            throw err;
          }
        }
      }
      console.log("[migrate] All migrations complete");
    })();
  }
  return _migrationPromise;
}

ensureMigrations().catch((err) => {
  console.error("[migrate] Fatal migration error:", err.message);
  process.exit(1);
});
