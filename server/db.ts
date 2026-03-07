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
  `CREATE TABLE IF NOT EXISTS "unified_approvals" (
    "id" serial PRIMARY KEY NOT NULL,
    "approval_id" text NOT NULL,
    "rail" text NOT NULL,
    "owner_uid" text NOT NULL,
    "owner_email" text NOT NULL,
    "bot_name" text NOT NULL,
    "amount_display" text NOT NULL,
    "amount_raw" integer NOT NULL,
    "merchant_name" text NOT NULL,
    "item_name" text,
    "hmac_token" text NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "expires_at" timestamp NOT NULL,
    "decided_at" timestamp,
    "rail_ref" text NOT NULL,
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "unified_approvals_approval_id_unique" UNIQUE("approval_id")
  )`,
  `CREATE INDEX IF NOT EXISTS "unified_approvals_approval_id_idx" ON "unified_approvals" USING btree ("approval_id")`,
  `CREATE INDEX IF NOT EXISTS "unified_approvals_owner_uid_idx" ON "unified_approvals" USING btree ("owner_uid")`,
  `CREATE INDEX IF NOT EXISTS "unified_approvals_status_idx" ON "unified_approvals" USING btree ("status")`,
  `CREATE INDEX IF NOT EXISTS "unified_approvals_rail_idx" ON "unified_approvals" USING btree ("rail")`,
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
