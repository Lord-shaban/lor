import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
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

    /**
     * The LiveKit identity this knock belongs to.
     *
     * Admission has to be checked per person, not per room: without this, one
     * admitted guest would let every other waiting guest publish. The identity
     * is derived server-side from a secret the tab keeps to itself, so it
     * cannot be claimed by someone else.
     */
    participantIdentity: text("participant_identity").notNull(),

    status: knockStatus("status").notNull().default("pending"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (table) => [
    // The host's pending list, which is read on every poll.
    index("knocks_room_status_idx").on(table.roomId, table.status),
    // One knock per person per room, and the lookup the token route makes on
    // every request.
    uniqueIndex("knocks_room_identity_key").on(
      table.roomId,
      table.participantIdentity,
    ),
    // Reaping abandoned knocks.
    index("knocks_created_at_idx").on(table.createdAt),
  ],
);

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type Knock = typeof knocks.$inferSelect;
export type NewKnock = typeof knocks.$inferInsert;

/**
 * A fixed-window counter, keyed by whatever the caller decides identifies a
 * requester.
 *
 * We run on serverless, where an in-memory limiter is worthless: every instance
 * keeps its own counter and the effective limit is the real one multiplied by
 * however many instances happen to be warm. This has to live in the database.
 *
 * The same table carries the AI quotas in `v0.1.5`, which is why the key is an
 * opaque string rather than something room- or IP-shaped.
 */
export const rateLimits = pgTable("rate_limits", {
  /**
   * Opaque. For room creation it is a daily-salted hash of the client address,
   * so the counter works without keeping an address that can be correlated
   * across days.
   */
  key: text("key").primaryKey(),

  count: integer("count").notNull().default(0),

  windowStart: timestamp("window_start", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type RateLimit = typeof rateLimits.$inferSelect;

/**
 * What was said, once the meeting agreed to keep it.
 *
 * This is the first table in the project that stores what people say, which
 * makes it the first place retention, consent and deletion are real rather than
 * future. Three decisions are load-bearing:
 *
 * **Only settled lines.** The browser's own recogniser produces a fast guess
 * that is often wrong in the exact way this product exists to fix — it
 * transliterates. A guess is a preview, and a preview does not become a record.
 *
 * **Attributed and ordered.** A transcript that cannot say who said what is a
 * wall of text. `seq` rather than a timestamp for ordering: participants'
 * clocks disagree by minutes and the server's arrival order is the only one
 * everybody shares.
 *
 * **Deletable by the room.** Rows go when the room asks, and the summary built
 * from them goes with them. Anything else would keep a derived copy of exactly
 * what was deleted.
 */
export const transcriptLines = pgTable(
  "transcript_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),

    /**
     * The media server's identity for the speaker, and the name they chose.
     *
     * Both, because the identity is stable and meaningless to a reader while
     * the name is readable and can repeat. Neither is an account: `v0.1` has
     * no accounts and this table does not introduce one.
     */
    speakerIdentity: text("speaker_identity").notNull(),
    speakerName: text("speaker_name").notNull(),

    text: text("text").notNull(),

    /** Arrival order at the server. The only clock everybody shares. */
    seq: integer("seq").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Every read is "this room, in order", and every delete is "this room".
    index("transcript_lines_room_seq_idx").on(table.roomId, table.seq),
  ],
);

export type TranscriptLine = typeof transcriptLines.$inferSelect;
export type NewTranscriptLine = typeof transcriptLines.$inferInsert;

/**
 * A meeting summarised for somebody who was not there.
 *
 * One row per room, replaced rather than appended: a meeting has one current
 * summary, and keeping every draft would mean keeping the transcript's contents
 * in a second place that deletion has to remember about.
 */
export const summaries = pgTable("summaries", {
  roomId: uuid("room_id")
    .primaryKey()
    .references(() => rooms.id, { onDelete: "cascade" }),

  text: text("text").notNull(),

  /** How many lines it was built from, so a stale summary can be noticed. */
  fromLines: integer("from_lines").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Summary = typeof summaries.$inferSelect;
