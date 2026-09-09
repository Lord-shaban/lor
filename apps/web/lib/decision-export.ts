export interface ExportDecision {
  text: string;
  source: {
    seq: number;
    speaker: string;
    quote: string;
    at: Date | string;
  };
}

/**
 * A portable decision record deliberately has no model provenance or database
 * identifiers. Its evidence is the retained transcript line, not a mutable
 * snapshot from the decision row.
 */
export function exportDecisions(records: ExportDecision[]): string {
  return records
    .toSorted((a, b) => a.source.seq - b.source.seq)
    .map((record) => {
      const at = new Date(record.source.at).toISOString();
      return [
        `[${at}] ${normaliseLineEndings(record.source.speaker)}`,
        `Decision: ${normaliseLineEndings(record.text)}`,
        `Evidence: ${normaliseLineEndings(record.source.quote)}`,
      ].join("\n");
    })
    .join("\n\n");
}

/** Keep the file stable when a pasted name or quote contains Windows line endings. */
function normaliseLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}
