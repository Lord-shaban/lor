export const MAX_SEARCH_QUERY_LENGTH = 400;
export const MAX_SEARCH_RESULTS = 8;

export type SearchQuery =
  | { kind: "valid"; value: string }
  | { kind: "invalid" };

/** Keep every search request small before it reaches the database or a provider. */
export function readSearchQuery(value: unknown): SearchQuery {
  if (typeof value !== "string") return { kind: "invalid" };
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > MAX_SEARCH_QUERY_LENGTH) return { kind: "invalid" };
  return { kind: "valid", value: normalized };
}

export interface SearchSourceCoordinate {
  transcriptLineId: string | null;
  decisionId: string | null;
  notesSnapshotRoomId: string | null;
  occurrenceId: string | null;
  at: Date;
}

export interface SearchCandidate {
  id: string;
  kind: "transcript" | "decision" | "notes";
  speakerName: string | null;
  content: string;
  source: SearchSourceCoordinate;
}

export interface SearchResult extends SearchCandidate {
  match: "lexical" | "semantic" | "hybrid";
  excerpt: string;
}

function excerpt(content: string, query: string) {
  const compact = content.replace(/\s+/g, " ").trim();
  const needle = query.toLocaleLowerCase();
  const exact = compact.toLocaleLowerCase().indexOf(needle);
  const firstWord = needle.split(" ").find(Boolean) ?? "";
  const position = exact >= 0 ? exact : compact.toLocaleLowerCase().indexOf(firstWord);
  const start = position > 120 ? position - 120 : 0;
  const end = Math.min(compact.length, start + 360);
  return `${start > 0 ? "…" : ""}${compact.slice(start, end)}${end < compact.length ? "…" : ""}`;
}

/**
 * Reciprocal-rank fusion puts exact lexical evidence and semantic neighbours on
 * the same bounded scale. The tie-breaks make a repeated query stable instead
 * of presenting a changing order as a changing meeting fact.
 */
export function fuseSearchCandidates(
  query: string,
  lexical: readonly SearchCandidate[],
  semantic: readonly SearchCandidate[],
): SearchResult[] {
  const fused = new Map<string, { candidate: SearchCandidate; lexicalRank?: number; semanticRank?: number }>();
  const add = (candidate: SearchCandidate, kind: "lexicalRank" | "semanticRank", rank: number) => {
    const current = fused.get(candidate.id) ?? { candidate };
    current[kind] = rank;
    fused.set(candidate.id, current);
  };
  lexical.forEach((candidate, index) => add(candidate, "lexicalRank", index + 1));
  semantic.forEach((candidate, index) => add(candidate, "semanticRank", index + 1));

  return [...fused.values()]
    .sort((left, right) => {
      const leftScore = (left.lexicalRank ? 1 / (60 + left.lexicalRank) : 0)
        + (left.semanticRank ? 1 / (60 + left.semanticRank) : 0);
      const rightScore = (right.lexicalRank ? 1 / (60 + right.lexicalRank) : 0)
        + (right.semanticRank ? 1 / (60 + right.semanticRank) : 0);
      if (rightScore !== leftScore) return rightScore - leftScore;
      const dateDifference = right.candidate.source.at.getTime() - left.candidate.source.at.getTime();
      return dateDifference || left.candidate.id.localeCompare(right.candidate.id);
    })
    .slice(0, MAX_SEARCH_RESULTS)
    .map(({ candidate, lexicalRank, semanticRank }) => ({
      ...candidate,
      match: lexicalRank && semanticRank ? "hybrid" : lexicalRank ? "lexical" : "semantic",
      excerpt: excerpt(candidate.content, query),
    }));
}
