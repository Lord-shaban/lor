import { describe, expect, it } from "vitest";
import {
  MAX_SEARCH_QUERY_LENGTH,
  MAX_SEARCH_RESULTS,
  fuseSearchCandidates,
  readSearchQuery,
  type SearchCandidate,
} from "./contract";

function candidate(id: string, at: string): SearchCandidate {
  return {
    id,
    kind: "transcript",
    speakerName: "أحمد",
    content: `${id} ناقشنا pricing مع فريق الـ design`,
    source: {
      transcriptLineId: `${id}-line`,
      decisionId: null,
      notesSnapshotRoomId: null,
      occurrenceId: "occurrence-a",
      at: new Date(at),
    },
  };
}

describe("semantic search contract", () => {
  it("normalises a bounded query and rejects empty or oversized input", () => {
    expect(readSearchQuery("  متى   تكلمنا عن   pricing؟ ")).toEqual({
      kind: "valid",
      value: "متى تكلمنا عن pricing؟",
    });
    expect(readSearchQuery(" ")).toEqual({ kind: "invalid" });
    expect(readSearchQuery("x".repeat(MAX_SEARCH_QUERY_LENGTH + 1))).toEqual({ kind: "invalid" });
  });

  it("fuses exact Arabic/English lexical hits with vectors in a deterministic order", () => {
    const older = candidate("older", "2026-09-01T10:00:00Z");
    const newer = candidate("newer", "2026-09-02T10:00:00Z");
    const results = fuseSearchCandidates("pricing", [older, newer], [older, newer]);

    expect(results.map((result) => result.id)).toEqual(["older", "newer"]);
    expect(results[0]?.match).toBe("hybrid");
    expect(results[0]?.excerpt).toContain("pricing");
    expect(fuseSearchCandidates("pricing", [older, newer], [older, newer])).toEqual(results);
  });

  it("caps the returned evidence cards", () => {
    const many = Array.from({ length: MAX_SEARCH_RESULTS + 4 }, (_, index) =>
      candidate(String(index), `2026-09-${String(index + 1).padStart(2, "0")}T10:00:00Z`));
    expect(fuseSearchCandidates("pricing", many, []).length).toBe(MAX_SEARCH_RESULTS);
  });
});
