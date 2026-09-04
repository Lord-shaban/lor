import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { score, summarise, tokenise, normalise } from "./metrics.ts";
import type { Score } from "./metrics.ts";

/**
 * Score every case, and say what the numbers mean.
 *
 * Run by `npm run eval:captions`. Any change under `apps/web/lib/stt/` has to
 * report this before and after, because a caption change is very easy to
 * believe in and very hard to see.
 *
 * There is no engine wired in yet — the engines arrive with the issues that
 * introduce them, and each will register itself here. Until then this scores
 * whatever hypothesis a case already carries, which is how a documented model
 * failure becomes a permanent test of the metric rather than a paragraph in a
 * README.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES = join(HERE, "cases");
const AUDIO = join(HERE, "audio");

interface Case {
  id: string;
  /** What was actually said. The thing every hypothesis is measured against. */
  reference: string;
  /** Relative to `audio/`. Absent for a case that is text only. */
  audio?: string;
  /**
   * A hypothesis recorded by hand, with a note saying where it came from.
   *
   * Not a substitute for running an engine. It is how a known failure — a model
   * that transliterates, or one that translates instead of transcribing — stays
   * in the suite as something the metric must keep catching.
   */
  hypotheses?: Record<string, string>;
  notes?: string;
}

interface Row {
  case: string;
  engine: string;
  score: Score;
  referenceWords: number;
  referenceCharacters: number;
}

async function loadCases(): Promise<Case[]> {
  if (!existsSync(CASES)) return [];

  const files = (await readdir(CASES)).filter((name) => name.endsWith(".json"));
  const cases: Case[] = [];

  for (const file of files.sort()) {
    const parsed = JSON.parse(
      await readFile(join(CASES, file), "utf8"),
    ) as Partial<Case>;

    if (typeof parsed.reference !== "string" || !parsed.reference.trim()) {
      throw new Error(`${file}: a case needs a reference transcript`);
    }

    cases.push({
      id: parsed.id ?? basename(file, ".json"),
      reference: parsed.reference,
      audio: parsed.audio,
      hypotheses: parsed.hypotheses ?? {},
      notes: parsed.notes,
    });
  }

  return cases;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function rate(value: number | null): string {
  return value === null ? "  n/a" : percent(value).padStart(6);
}

function table(rows: readonly Row[]): string {
  const width = Math.max(12, ...rows.map((row) => row.case.length));
  const engineWidth = Math.max(6, ...rows.map((row) => row.engine.length));

  const header =
    "case".padEnd(width) +
    "  " +
    "engine".padEnd(engineWidth) +
    "     WER     CER     CSP  latin";

  const lines = rows.map(
    (row) =>
      row.case.padEnd(width) +
      "  " +
      row.engine.padEnd(engineWidth) +
      "  " +
      percent(row.score.wer).padStart(6) +
      "  " +
      percent(row.score.cer).padStart(6) +
      "  " +
      rate(row.score.codeSwitchPreservation) +
      "  " +
      String(row.score.latinWords).padStart(5),
  );

  return [header, "-".repeat(header.length), ...lines].join("\n");
}

function threshold(name: string): number | undefined {
  const argument = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (!argument) return undefined;
  const value = Number(argument.split("=")[1]);
  return Number.isFinite(value) ? value : undefined;
}

const cases = await loadCases();

if (cases.length === 0) {
  console.log(
    [
      "No cases yet.",
      "",
      "A case is one JSON file in eval/captions/cases/ with a reference",
      "transcript and, when there is audio for it, a path into audio/.",
      "The most useful ones come from real meetings: what was said, and what",
      "the caption showed instead.",
    ].join("\n"),
  );
  process.exit(0);
}

const withAudio = cases.filter((entry) => entry.audio).length;
const rows: Row[] = [];

for (const entry of cases) {
  const referenceWords = tokenise(entry.reference).length;
  const referenceCharacters = [...normalise(entry.reference)].length;

  for (const [engine, hypothesis] of Object.entries(entry.hypotheses ?? {})) {
    rows.push({
      case: entry.id,
      engine,
      score: score(entry.reference, hypothesis),
      referenceWords,
      referenceCharacters,
    });
  }
}

if (rows.length === 0) {
  console.log(
    `${cases.length} case(s), none with a hypothesis to score.\n` +
      "Wire an engine in, or record one in the case file.",
  );
  process.exit(0);
}

console.log(table(rows));

const engines = [...new Set(rows.map((row) => row.engine))].sort();
console.log("\nby engine, weighted by length:\n");

let failed = false;
const maxWer = threshold("max-wer");
const minCsp = threshold("min-code-switch");

for (const engine of engines) {
  const total = summarise(rows.filter((row) => row.engine === engine));
  console.log(
    `  ${engine.padEnd(24)}  WER ${percent(total.wer).padStart(6)}` +
      `   CER ${percent(total.cer).padStart(6)}` +
      `   CSP ${rate(total.codeSwitchPreservation)}` +
      `   (${total.latinWords} latin words)`,
  );

  if (maxWer !== undefined && total.wer > maxWer) {
    console.error(`  ${engine}: WER ${percent(total.wer)} is above ${percent(maxWer)}`);
    failed = true;
  }
  if (
    minCsp !== undefined &&
    total.codeSwitchPreservation !== null &&
    total.codeSwitchPreservation < minCsp
  ) {
    console.error(
      `  ${engine}: code-switch preservation ${percent(total.codeSwitchPreservation)} is below ${percent(minCsp)}`,
    );
    failed = true;
  }
}

console.log(
  `\n${cases.length} case(s), ${withAudio} with audio` +
    (withAudio < cases.length
      ? ` — the rest are text-only, scoring hypotheses recorded by hand.`
      : "."),
);

if (!existsSync(AUDIO) && withAudio > 0) {
  console.log("audio/ is missing. It is gitignored; the fixtures are fetched separately.");
}

console.log(
  "\nCSP is code-switch preservation: the share of the reference's Latin-script\n" +
    "words still in Latin script. A change that lowers WER while lowering CSP is\n" +
    "a regression, not an improvement.",
);

process.exit(failed ? 1 : 0);
