export interface ExportLine {
  speaker: string;
  text: string;
  seq: number;
  at: Date | string;
}

/** Plain UTF-8 text: keep the words verbatim, with unambiguous UTC timestamps. */
export function exportTranscript(lines: ExportLine[]): string {
  return lines
    .toSorted((a, b) => a.seq - b.seq)
    .map((line) => `[${new Date(line.at).toISOString()}] ${line.speaker}: ${line.text}`)
    .join("\n");
}
