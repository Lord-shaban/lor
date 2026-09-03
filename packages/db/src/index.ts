import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";

let client: ReturnType<typeof postgres> | undefined;

/**
 * The database handle.
 *
 * Route handlers are short-lived and can run on many instances at once, so the
 * pool is deliberately tiny and the connection is created lazily and reused
 * across invocations of the same instance. `prepare: false` is required by
 * transaction-mode poolers such as Supabase's and PgBouncer, which cannot carry
 * a prepared statement between checkouts.
 */
export function getDb() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
      );
    }

    client = postgres(url, {
      max: 1,
      idle_timeout: 20,
      prepare: false,
    });
  }

  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof getDb>;
