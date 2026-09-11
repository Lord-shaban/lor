import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Drizzle's Postgres column catalogue does not currently expose a `bytea`
// builder. Keeping the mapping here gives the database a real binary column —
// not an accidental Base64/text copy of a Yjs update.
const binary = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * The durable meeting record through v0.3: retained transcript, verified
 * decisions, evidence-backed action items, and recurring-meeting boundaries.
 * Embeddings still wait for their later release.
 *
 * Plain Postgres only — no Supabase-specific types or functions. Self-hosting is
 * a first-class path, and the hosted deployment must not diverge from it.
 */

/**
 * A room is created before anyone joins and outlives any single meeting, so a
 * recurring link keeps working. v0.3 hangs occurrence lifecycle metadata from
 * this row without making the recurring URL itself a meeting record.
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

/**
 * A durable boundary between two visits to the same recurring room.
 *
 * The token route creates this record only after asking LiveKit whether the
 * media room is empty. It is room-scoped lifecycle metadata, not a second copy
 * of anything somebody said in the meeting.
 */
export const meetingOccurrences = pgTable(
  "meeting_occurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),

    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [
    // Transcript timing references this pair. Keeping the room in the
    // referenced key makes a cross-room occurrence impossible in Postgres,
    // not merely unlikely in route code.
    unique("meeting_occurrences_room_id_id_key").on(table.roomId, table.id),
    index("meeting_occurrences_room_started_at_idx").on(
      table.roomId,
      table.startedAt,
    ),
    // One active occurrence is the recurrence invariant and the final
    // database backstop if two token requests race through separate instances.
    uniqueIndex("meeting_occurrences_room_active_unique")
      .on(table.roomId)
      .where(sql`${table.endedAt} is null`),
    check(
      "meeting_occurrences_end_after_start_check",
      sql`${table.endedAt} is null or ${table.endedAt} >= ${table.startedAt}`,
    ),
  ],
);

export type MeetingOccurrence = typeof meetingOccurrences.$inferSelect;
export type NewMeetingOccurrence = typeof meetingOccurrences.$inferInsert;

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
     * The server-confirmed occurrence current when this settled caption
     * arrived. Legacy rows stay null: guessing a recurring-meeting boundary
     * from a browser clock would make the timeline look more certain than it
     * is.
     */
    occurrenceId: uuid("occurrence_id"),

    /**
     * Captured VAD span, in milliseconds. This is deliberately not talk time
     * in the attendance sense: it is only the duration of retained captions.
     * The paired check below keeps a timeline row complete and bounded.
     */
    durationMs: integer("duration_ms"),

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
    foreignKey({
      columns: [table.roomId, table.occurrenceId],
      foreignColumns: [meetingOccurrences.roomId, meetingOccurrences.id],
    }),
    check(
      "transcript_lines_timeline_timing_check",
      sql`(
        (${table.occurrenceId} is null and ${table.durationMs} is null)
        or (
          ${table.occurrenceId} is not null
          and ${table.durationMs} between 250 and 21000
        )
      )`,
    ),
    // Every read is "this room, in order", and every delete is "this room".
    index("transcript_lines_room_seq_idx").on(table.roomId, table.seq),
    // One occurrence's timeline is always rendered in transcript order. The
    // same index also supports the composite occurrence foreign key.
    index("transcript_lines_room_occurrence_seq_idx").on(
      table.roomId,
      table.occurrenceId,
      table.seq,
    ),
    // Timeline reads one occurrence inside the transcript retention window.
    index("transcript_lines_room_occurrence_created_at_idx").on(
      table.roomId,
      table.occurrenceId,
      table.createdAt,
    ),
    // A composite FK from action items makes a source from another room
    // impossible. Postgres requires the referenced tuple to be unique.
    unique("transcript_lines_room_id_id_key").on(table.roomId, table.id),
    // The action-item trigger resolves an assignee's canonical display-name
    // snapshot from retained evidence, never from model or browser input.
    index("transcript_lines_room_speaker_created_at_idx").on(
      table.roomId,
      table.speakerIdentity,
      table.createdAt,
    ),
  ],
);

export type TranscriptLine = typeof transcriptLines.$inferSelect;
export type NewTranscriptLine = typeof transcriptLines.$inferInsert;

/**
 * A participant-marked point in one occurrence's retained meeting record.
 *
 * It has no browser clock, arbitrary occurrence id, or speaker assertion: the
 * route chooses the active occurrence and lets Postgres assign the timestamp.
 * A manual mark is not evidence and never copies transcript text, which keeps
 * its retention surface intentionally small.
 */
export const timelineManualMoments = pgTable(
  "timeline_manual_moments",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),

    occurrenceId: uuid("occurrence_id").notNull(),

    /** Optional participant wording; it is display text, never instructions. */
    label: text("label"),

    /** Database time is the moment's timeline position. */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // The occurrence's composite key makes a cross-room marker impossible.
    foreignKey({
      columns: [table.roomId, table.occurrenceId],
      foreignColumns: [meetingOccurrences.roomId, meetingOccurrences.id],
    }).onDelete("cascade"),
    check(
      "timeline_manual_moments_label_check",
      sql`${table.label} is null or (
        char_length(btrim(${table.label})) between 1 and 200
      )`,
    ),
    // Tie-break by id because concurrent server inserts can share a timestamp.
    index("timeline_manual_moments_room_occurrence_created_at_idx").on(
      table.roomId,
      table.occurrenceId,
      table.createdAt,
      table.id,
    ),
    index("timeline_manual_moments_room_created_at_idx").on(
      table.roomId,
      table.createdAt,
    ),
  ],
);

export type TimelineManualMoment = typeof timelineManualMoments.$inferSelect;
export type NewTimelineManualMoment = typeof timelineManualMoments.$inferInsert;

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

export const decisionStatus = pgEnum("decision_status", [
  "proposed",
  "confirmed",
]);

/** Whether a host wrote the draft or the bounded extractor proposed it. */
export const decisionOrigin = pgEnum("decision_origin", ["manual", "llm"]);

/**
 * A decision anchored to one retained transcript line.
 *
 * The source foreign key is the deletion authority. The denormalised source
 * fields make the evidence portable with the record, but they are written only
 * from the source row by the server and never accepted from a browser or model.
 * If that source is removed, this record must disappear with it rather than
 * becoming a second, unaccounted-for copy of what somebody said.
 */
export const decisions = pgTable(
  "decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),

    sourceLineId: uuid("source_line_id")
      .notNull()
      .references(() => transcriptLines.id, { onDelete: "cascade" }),

    /** Server arrival order of the source, used for a meeting-ordered read. */
    sourceSeq: integer("source_seq").notNull(),

    /** Immutable server-derived evidence snapshots. */
    sourceSpeaker: text("source_speaker").notNull(),
    sourceQuote: text("source_quote").notNull(),
    sourceCreatedAt: timestamp("source_created_at", { withTimezone: true }).notNull(),

    status: decisionStatus("status").notNull().default("proposed"),

    // A generated proposal must stay distinguishable from host-authored text
    // until the review UI makes its provenance visible to the meeting.
    origin: decisionOrigin("origin").notNull().default("manual"),

    /** The host may refine this wording; it is never the source quotation. */
    text: text("text").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Room reads are always returned in transcript order.
    index("decisions_room_source_seq_idx").on(table.roomId, table.sourceSeq),
    // PostgreSQL does not create this for the source FK; cascading deletion
    // needs it just as much as an explicit source lookup does.
    index("decisions_source_line_id_idx").on(table.sourceLineId),
    // One retained utterance may support only one decision record. Apart from
    // making retries idempotent, the database constraint closes the race
    // between concurrent extraction requests.
    uniqueIndex("decisions_room_source_line_unique").on(table.roomId, table.sourceLineId),
  ],
);

export type Decision = typeof decisions.$inferSelect;
export type NewDecision = typeof decisions.$inferInsert;

export const actionItemStatus = pgEnum("action_item_status", [
  "proposed",
  "open",
  "completed",
]);

/** Whether a host wrote the proposal or a bounded extractor supplied it. */
export const actionItemOrigin = pgEnum("action_item_origin", ["manual", "llm"]);

/**
 * An evidence-backed task the room chose to retain.
 *
 * The application inserts only a source row id, task wording, provenance, and
 * (where applicable) an already-resolved participant identity. The migration
 * trigger fills evidence and the display-name snapshot from the transcript;
 * database constraints then make an invalid lifecycle impossible even if a
 * future route has a bug.
 */
export const actionItems = pgTable(
  "action_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),

    sourceLineId: uuid("source_line_id").notNull(),
    sourceSeq: integer("source_seq").notNull(),
    sourceSpeaker: text("source_speaker").notNull(),
    sourceQuote: text("source_quote").notNull(),
    sourceCreatedAt: timestamp("source_created_at", { withTimezone: true }).notNull(),

    /** A LiveKit identity from this room's retained transcript, never an account. */
    assigneeIdentity: text("assignee_identity"),
    /** Server-derived snapshot matching `assigneeIdentity` at assignment time. */
    assigneeName: text("assignee_name"),

    /** A calendar day, not an invented instant or timezone. */
    dueOn: date("due_on", { mode: "string" }),

    status: actionItemStatus("status").notNull().default("proposed"),
    origin: actionItemOrigin("origin").notNull().default("manual"),

    /** Reviewed task wording; it is distinct from the immutable source quote. */
    text: text("text").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // This composite FK—not an application comparison—rejects a source line
    // from another room. Deleting either source or room cascades this record.
    foreignKey({
      name: "action_items_room_source_line_transcript_lines_fk",
      columns: [table.roomId, table.sourceLineId],
      foreignColumns: [transcriptLines.roomId, transcriptLines.id],
    }).onDelete("cascade"),
    index("action_items_room_source_seq_idx").on(table.roomId, table.sourceSeq),
    // The source FK needs its own leading-column index for fast cascades.
    index("action_items_source_line_id_idx").on(table.sourceLineId),
    // The next-meeting query reads only open work, ordered by when it opened.
    index("action_items_room_opened_at_idx")
      .on(table.roomId, table.openedAt)
      .where(sql`${table.status} = 'open'`),
    // A retry may not create a second copy of the same task from one source.
    uniqueIndex("action_items_room_source_text_unique").on(
      table.roomId,
      table.sourceLineId,
      table.text,
    ),
    check(
      "action_items_nonempty_text_check",
      sql`char_length(btrim(${table.text})) > 0`,
    ),
    check(
      "action_items_assignee_pair_check",
      sql`(
        (${table.assigneeIdentity} is null and ${table.assigneeName} is null)
        or (
          ${table.assigneeIdentity} is not null
          and ${table.assigneeName} is not null
          and char_length(btrim(${table.assigneeIdentity})) > 0
          and char_length(btrim(${table.assigneeName})) > 0
        )
      )`,
    ),
    check(
      "action_items_lifecycle_state_check",
      sql`(
        ${table.status} = 'proposed'
        and ${table.openedAt} is null
        and ${table.completedAt} is null
      ) or (
        ${table.status} = 'open'
        and ${table.assigneeIdentity} is not null
        and ${table.assigneeName} is not null
        and ${table.dueOn} is not null
        and ${table.openedAt} is not null
        and ${table.completedAt} is null
      ) or (
        ${table.status} = 'completed'
        and ${table.assigneeIdentity} is not null
        and ${table.assigneeName} is not null
        and ${table.dueOn} is not null
        and ${table.openedAt} is not null
        and ${table.completedAt} is not null
      )`,
    ),
  ],
);

export type ActionItem = typeof actionItems.$inferSelect;
export type NewActionItem = typeof actionItems.$inferInsert;

/**
 * The current durable form of a room's shared Canvas document.
 *
 * A Canvas is one Yjs document, not separate whiteboard and notes records. That
 * gives a deletion one complete, reviewable blast radius: removing this row
 * removes both kinds of meeting content together. `version` is an optimistic
 * concurrency token rather than a Yjs clock; it stops a browser that loaded an
 * older snapshot from overwriting a newer database write.
 */
export const canvasSnapshots = pgTable("canvas_snapshots", {
  roomId: uuid("room_id")
    .primaryKey()
    .references(() => rooms.id, { onDelete: "cascade" }),

  /** Incremented only after a conditional, successful replacement. */
  version: integer("version").notNull().default(1),

  /** A binary Yjs update for the whole document — never encoded as JSON. */
  document: binary("document").notNull(),

  /** Used by the read-path retention sweep. */
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CanvasSnapshot = typeof canvasSnapshots.$inferSelect;
export type NewCanvasSnapshot = typeof canvasSnapshots.$inferInsert;
