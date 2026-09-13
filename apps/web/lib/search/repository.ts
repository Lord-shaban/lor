import "server-only";

import { and, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import {
  canvasSnapshots,
  decisions,
  getDb,
  meetingOccurrences,
  searchDocuments,
  transcriptLines,
} from "@lor/db";
import * as Y from "yjs";
import { canvasKeptSince, canvasRetentionDays } from "@/lib/canvas-retention";
import { notesFragment } from "@/lib/notes-yjs";
import { keptSince, retentionDays } from "@/lib/stt/retention";
import { sweepTranscript } from "@/lib/transcript-retention";
import {
  type EmbeddingsProviderConfig,
  EmbeddingsProviderError,
  configuredEmbeddings,
  embedTexts,
} from "./embeddings";
import {
  MAX_SEARCH_RESULTS,
  type SearchCandidate,
  type SearchResult,
  fuseSearchCandidates,
} from "./contract";

/** One deliberate click never scans or sends an unbounded meeting archive. */
export const MAX_EVIDENCE_SOURCES = 96;
export const MAX_EMBEDDINGS_PER_INDEX = 24;
export const MAX_SEARCH_CANDIDATES = 24;
const MAX_EVIDENCE_CHARACTERS = 6_000;

type SearchKind = "transcript" | "decision" | "notes";

interface EvidenceSource {
  kind: SearchKind;
  roomId: string;
  transcriptLineId: string | null;
  decisionId: string | null;
  notesSnapshotRoomId: string | null;
  occurrenceId: string | null;
  sourceCreatedAt: Date;
  speakerName: string | null;
  content: string;
}

interface IndexedDocument {
  id: string;
  content: string;
  embedding: number[] | null;
  embeddingModel: string | null;
}

export type IndexState = "empty" | "ready" | "unconfigured" | "degraded";

export interface IndexOutcome {
  state: IndexState;
  sourceCount: number;
  embedded: number;
}

export interface SearchOutcome {
  state: "empty" | "available" | "degraded";
  results: SearchResult[];
}

/** The shared predicate every persisted search read uses; no global corpus exists. */
export function roomSearchScope(roomId: string) {
  return eq(searchDocuments.roomId, roomId);
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_EVIDENCE_CHARACTERS);
}

function sourceTieBreaker(source: EvidenceSource) {
  return source.transcriptLineId ?? source.decisionId ?? source.notesSnapshotRoomId ?? "";
}

function decodeNotes(update: Buffer) {
  const document = new Y.Doc();
  try {
    Y.applyUpdate(document, new Uint8Array(update));
    // Y.XmlFragment serialises rich-text markup. Search its visible text only:
    // formatting is not meeting evidence and must not become provider input.
    return compactText(notesFragment(document).toString().replace(/<[^>]*>/g, " "));
  } catch {
    // A malformed snapshot is dealt with by the Canvas read route. Until then
    // it is simply not eligible to leave the database for search.
    return "";
  } finally {
    document.destroy();
  }
}

/** Remove expired sources before any search projection or provider call. */
export async function sweepSearchRetention(roomId: string, now = new Date()) {
  await sweepTranscript(roomId, keptSince(now, retentionDays(process.env)));
  await getDb()
    .delete(canvasSnapshots)
    .where(and(
      eq(canvasSnapshots.roomId, roomId),
      lt(canvasSnapshots.updatedAt, canvasKeptSince(now, canvasRetentionDays(process.env))),
    ));
}

/**
 * Resolve only server-owned, retained evidence. Transcript and decision rows
 * must belong to a completed occurrence; unreviewed decision proposals and the
 * current call never enter the cross-meeting search corpus.
 */
async function eligibleEvidence(roomId: string, now: Date): Promise<EvidenceSource[]> {
  const db = getDb();
  const transcriptCutoff = keptSince(now, retentionDays(process.env));
  const canvasCutoff = canvasKeptSince(now, canvasRetentionDays(process.env));
  const [transcripts, confirmedDecisions, snapshots] = await Promise.all([
    db
      .select({
        id: transcriptLines.id,
        occurrenceId: transcriptLines.occurrenceId,
        sourceCreatedAt: transcriptLines.createdAt,
        speakerName: transcriptLines.speakerName,
        content: transcriptLines.text,
      })
      .from(transcriptLines)
      .innerJoin(meetingOccurrences, and(
        eq(transcriptLines.roomId, meetingOccurrences.roomId),
        eq(transcriptLines.occurrenceId, meetingOccurrences.id),
      ))
      .where(and(
        eq(transcriptLines.roomId, roomId),
        gte(transcriptLines.createdAt, transcriptCutoff),
        isNotNull(meetingOccurrences.endedAt),
      ))
      .orderBy(desc(transcriptLines.createdAt), desc(transcriptLines.id))
      .limit(MAX_EVIDENCE_SOURCES),
    db
      .select({
        id: decisions.id,
        sourceLineId: transcriptLines.id,
        occurrenceId: transcriptLines.occurrenceId,
        sourceCreatedAt: transcriptLines.createdAt,
        speakerName: transcriptLines.speakerName,
        content: decisions.text,
      })
      .from(decisions)
      .innerJoin(transcriptLines, eq(decisions.sourceLineId, transcriptLines.id))
      .innerJoin(meetingOccurrences, and(
        eq(transcriptLines.roomId, meetingOccurrences.roomId),
        eq(transcriptLines.occurrenceId, meetingOccurrences.id),
      ))
      .where(and(
        eq(decisions.roomId, roomId),
        eq(decisions.status, "confirmed"),
        gte(transcriptLines.createdAt, transcriptCutoff),
        isNotNull(meetingOccurrences.endedAt),
      ))
      .orderBy(desc(transcriptLines.createdAt), desc(decisions.id))
      .limit(MAX_EVIDENCE_SOURCES),
    db
      .select({
        roomId: canvasSnapshots.roomId,
        document: canvasSnapshots.document,
        sourceCreatedAt: canvasSnapshots.updatedAt,
      })
      .from(canvasSnapshots)
      .where(and(
        eq(canvasSnapshots.roomId, roomId),
        gte(canvasSnapshots.updatedAt, canvasCutoff),
      ))
      .limit(1),
  ]);

  const sources: EvidenceSource[] = [
    ...transcripts.map((line) => ({
      kind: "transcript" as const,
      roomId,
      transcriptLineId: line.id,
      decisionId: null,
      notesSnapshotRoomId: null,
      occurrenceId: line.occurrenceId,
      sourceCreatedAt: line.sourceCreatedAt,
      speakerName: line.speakerName,
      content: compactText(line.content),
    })),
    ...confirmedDecisions.map((decision) => ({
      kind: "decision" as const,
      roomId,
      transcriptLineId: null,
      decisionId: decision.id,
      notesSnapshotRoomId: null,
      occurrenceId: decision.occurrenceId,
      sourceCreatedAt: decision.sourceCreatedAt,
      speakerName: decision.speakerName,
      content: compactText(decision.content),
    })),
  ];
  for (const snapshot of snapshots) {
    const content = decodeNotes(snapshot.document);
    if (!content) continue;
    sources.push({
      kind: "notes",
      roomId,
      transcriptLineId: null,
      decisionId: null,
      notesSnapshotRoomId: snapshot.roomId,
      occurrenceId: null,
      sourceCreatedAt: snapshot.sourceCreatedAt,
      speakerName: null,
      content,
    });
  }

  return sources
    .filter((source) => Boolean(source.content))
    .sort((left, right) => (
      right.sourceCreatedAt.getTime() - left.sourceCreatedAt.getTime()
      || sourceTieBreaker(left).localeCompare(sourceTieBreaker(right))
    ))
    .slice(0, MAX_EVIDENCE_SOURCES);
}

function embeddingResetWhenContentChanges(content: string) {
  return sql`case when ${searchDocuments.content} is distinct from ${content}
    then null else ${searchDocuments.embedding} end`;
}

function embeddingModelResetWhenContentChanges(content: string) {
  return sql`case when ${searchDocuments.content} is distinct from ${content}
    then null else ${searchDocuments.embeddingModel} end`;
}

function embeddedAtResetWhenContentChanges(content: string) {
  return sql`case when ${searchDocuments.content} is distinct from ${content}
    then null else ${searchDocuments.embeddedAt} end`;
}

async function upsertEvidence(source: EvidenceSource): Promise<IndexedDocument> {
  const db = getDb();
  const values = {
    roomId: source.roomId,
    kind: source.kind,
    transcriptLineId: source.transcriptLineId,
    decisionId: source.decisionId,
    notesSnapshotRoomId: source.notesSnapshotRoomId,
    occurrenceId: source.occurrenceId,
    sourceCreatedAt: source.sourceCreatedAt,
    speakerName: source.speakerName,
    content: source.content,
  };
  const set = {
    ...values,
    embedding: embeddingResetWhenContentChanges(source.content),
    embeddingModel: embeddingModelResetWhenContentChanges(source.content),
    embeddedAt: embeddedAtResetWhenContentChanges(source.content),
    updatedAt: new Date(),
  };
  const target = source.kind === "transcript"
    ? searchDocuments.transcriptLineId
    : source.kind === "decision"
      ? searchDocuments.decisionId
      : searchDocuments.notesSnapshotRoomId;
  const [document] = await db
    .insert(searchDocuments)
    .values(values)
    .onConflictDoUpdate({ target, set })
    .returning({
      id: searchDocuments.id,
      content: searchDocuments.content,
      embedding: searchDocuments.embedding,
      embeddingModel: searchDocuments.embeddingModel,
    });
  if (!document) throw new Error("Could not upsert search evidence");
  return document;
}

async function embedPending(
  documents: readonly IndexedDocument[],
  config: EmbeddingsProviderConfig,
) {
  const pending = documents
    .filter((document) => !document.embedding || document.embeddingModel !== config.model)
    .slice(0, MAX_EMBEDDINGS_PER_INDEX);
  if (pending.length === 0) return 0;

  const embeddings = await embedTexts(
    config,
    pending.map((document) => document.content),
    "retrieval.passage",
  );
  const db = getDb();
  const now = new Date();
  await Promise.all(pending.map((document, index) => db
    .update(searchDocuments)
    .set({
      embedding: embeddings[index],
      embeddingModel: config.model,
      embeddedAt: now,
      updatedAt: now,
    })
    // A concurrent Canvas/decision edit invalidates this write instead of
    // attaching an old vector to new words.
    .where(and(eq(searchDocuments.id, document.id), eq(searchDocuments.content, document.content)))));
  return pending.length;
}

/** Index a bounded slice at request time; never during an active caption write. */
export async function indexSearchEvidence(roomId: string, now = new Date()): Promise<IndexOutcome> {
  await sweepSearchRetention(roomId, now);
  const sources = await eligibleEvidence(roomId, now);
  if (sources.length === 0) return { state: "empty", sourceCount: 0, embedded: 0 };

  const documents = await Promise.all(sources.map(upsertEvidence));
  const config = configuredEmbeddings(process.env);
  if (!config) return { state: "unconfigured", sourceCount: sources.length, embedded: 0 };

  try {
    return {
      state: "ready",
      sourceCount: sources.length,
      embedded: await embedPending(documents, config),
    };
  } catch (error) {
    if (error instanceof EmbeddingsProviderError) {
      return { state: "degraded", sourceCount: sources.length, embedded: 0 };
    }
    throw error;
  }
}

function candidateFields() {
  return {
    id: searchDocuments.id,
    kind: searchDocuments.kind,
    speakerName: searchDocuments.speakerName,
    content: searchDocuments.content,
    transcriptLineId: searchDocuments.transcriptLineId,
    decisionId: searchDocuments.decisionId,
    notesSnapshotRoomId: searchDocuments.notesSnapshotRoomId,
    // A decision is its own indexed document, but its reviewable evidence is
    // still the caption it was confirmed from. Returning this link lets the
    // call workspace take people to that exact kept caption instead of making
    // a decision look like an independent meeting fact.
    decisionSourceLineId: decisions.sourceLineId,
    occurrenceId: searchDocuments.occurrenceId,
    sourceCreatedAt: searchDocuments.sourceCreatedAt,
  };
}

interface CandidateRow {
  id: string;
  kind: SearchCandidate["kind"];
  speakerName: string | null;
  content: string;
  transcriptLineId: string | null;
  decisionId: string | null;
  notesSnapshotRoomId: string | null;
  decisionSourceLineId: string | null;
  occurrenceId: string | null;
  sourceCreatedAt: Date;
}

function toCandidate(row: CandidateRow): SearchCandidate {
  return {
    id: row.id,
    kind: row.kind,
    speakerName: row.speakerName,
    content: row.content,
    source: {
      transcriptLineId: row.transcriptLineId ?? row.decisionSourceLineId,
      decisionId: row.decisionId,
      notesSnapshotRoomId: row.notesSnapshotRoomId,
      occurrenceId: row.occurrenceId,
      at: row.sourceCreatedAt,
    },
  };
}

const SEARCH_VECTOR = sql.raw('"search_documents"."search_vector"');

async function lexicalCandidates(roomId: string, query: string) {
  const rank = sql<number>`ts_rank_cd(${SEARCH_VECTOR}, websearch_to_tsquery('simple', ${query}))`;
  const rows = await getDb()
    .select({ ...candidateFields(), rank })
    .from(searchDocuments)
    .leftJoin(decisions, eq(searchDocuments.decisionId, decisions.id))
    .where(and(
      roomSearchScope(roomId),
      sql`${SEARCH_VECTOR} @@ websearch_to_tsquery('simple', ${query})`,
    ))
    .orderBy(desc(rank), desc(searchDocuments.sourceCreatedAt), searchDocuments.id)
    .limit(MAX_SEARCH_CANDIDATES);
  return rows.map(toCandidate);
}

function vectorLiteral(values: readonly number[]) {
  return `[${values.join(",")}]`;
}

async function semanticCandidates(
  roomId: string,
  query: string,
  config: EmbeddingsProviderConfig,
) {
  const [embedding] = await embedTexts(config, [query], "retrieval.query");
  const distance = sql<number>`${searchDocuments.embedding} <=> ${vectorLiteral(embedding)}::vector`;
  const rows = await getDb()
    .select({ ...candidateFields(), distance })
    .from(searchDocuments)
    .leftJoin(decisions, eq(searchDocuments.decisionId, decisions.id))
    .where(and(
      roomSearchScope(roomId),
      eq(searchDocuments.embeddingModel, config.model),
      isNotNull(searchDocuments.embedding),
    ))
    .orderBy(distance, desc(searchDocuments.sourceCreatedAt), searchDocuments.id)
    .limit(MAX_SEARCH_CANDIDATES);
  return rows.map(toCandidate);
}

/** Search one room's existing, retained projection. Provider trouble falls back to lexical evidence. */
export async function searchIndexedEvidence(roomId: string, query: string): Promise<SearchOutcome> {
  const db = getDb();
  const [anyDocument] = await db
    .select({ id: searchDocuments.id })
    .from(searchDocuments)
    .where(roomSearchScope(roomId))
    .limit(1);
  // Do this before embedding the query. An empty room must make no outbound
  // request, even if an operator configured a provider.
  if (!anyDocument) return { state: "empty", results: [] };

  const lexical = await lexicalCandidates(roomId, query);
  const config = configuredEmbeddings(process.env);
  if (!config) {
    return {
      state: "available",
      results: fuseSearchCandidates(query, lexical, []),
    };
  }

  try {
    const semantic = await semanticCandidates(roomId, query, config);
    return {
      state: "available",
      results: fuseSearchCandidates(query, lexical, semantic),
    };
  } catch (error) {
    if (error instanceof EmbeddingsProviderError) {
      return {
        state: "degraded",
        results: fuseSearchCandidates(query, lexical, []),
      };
    }
    throw error;
  }
}

export { MAX_SEARCH_RESULTS };
