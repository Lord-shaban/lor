import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Everything v0.1 needs, and nothing it does not. Transcripts, decisions, tasks
 * and embeddings arrive in the releases that introduce them.
 *
 * Plain Postgres only — no Supabase-specific types or functions. Self-hosting is
 * a first-class path, and the hosted deployment must not diverge from it.
 */

/**
 * A room is created before anyone joins and outlives any single meeting, so a
 * recurring link keeps working. `v0.5` hangs meeting memory off this row.
 */
export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * The short code from the URL, e.g. "mza-krf-tqn". Stored normalised:
     * lowercase, dash-separated. This is the room's public identity.
     */
    code: text("code").notNull(),

    /**
     * Name of the corresponding room on the media server. Kept separate from
     * `code` so the public identifier can change, or be recycled, without
     * colliding with a live media room.
     */
    livekitRoom: text("livekit_room").notNull(),

    /**
     * SHA-256 of the secret carried in the host's signed cookie. Only the hash
     * is stored, so a database leak does not hand anyone host rights.
     */
    hostSecretHash: text("host_secret_hash").notNull(),

    /** Locale the room was created in, used for invitation links and emails. */
    locale: text("locale").notNull().default("ar"),

    /** Off by default: most calls are casual and a door slows them down. */
    waitingRoomEnabled: boolean("waiting_room_enabled").notNull().default(false),

    /** When locked, no new participant is issued a token. */
    locked: boolean("locked").notNull().default(false),

    /**
     * Room-level preferences that do not deserve a column yet — captions on or
     * off, the glossary from `v0.1.5`, quality defaults. Anything queried
     * across rooms should graduate to its own column.
     */
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /** Touched whenever someone joins, so idle rooms can be reaped. */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("rooms_code_key").on(table.code),
    index("rooms_last_seen_at_idx").on(table.lastSeenAt),
  ],
);

export const knockStatus = pgEnum("knock_status", [
  "pending",
  "admitted",
  "denied",
]);

/**
 * A request to enter a room that has its waiting room switched on.
 *
 * We run no socket of our own, so admission is a short poll: the visitor writes
 * a knock, the server pushes a notice to the host over the room's data channel,
 * and the visitor polls this row until the host decides.
 */
export const knocks = pgTable(
  "knocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),

    /** What the visitor typed on the prejoin screen. Never trusted as identity. */
    displayName: text("display_name").notNull(),

    /**
     * SHA-256 of a secret handed to the visitor when they knock. Polling
     * requires it, so one person waiting cannot read or resolve another's
     * knock by guessing an id.
     */
    claimSecretHash: text("claim_secret_hash").notNull(),

    status: knockStatus("status").notNull().default("pending"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (table) => [
    // The host's pending list, which is read on every poll.
    index("knocks_room_status_idx").on(table.roomId, table.status),
    // Reaping abandoned knocks.
    index("knocks_created_at_idx").on(table.createdAt),
  ],
);

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type Knock = typeof knocks.$inferSelect;
export type NewKnock = typeof knocks.$inferInsert;
