/**
 * A meeting, for somebody who was not in it.
 *
 * The test that matters is not "does this list the topics". It is whether a
 * person who missed the call can act on it afterwards — so the prompt asks for
 * three things and nothing else: **what was decided, whose job something now
 * is, and what is still open.** A summary that says "the team discussed the
 * deployment" has told nobody anything.
 *
 * The second requirement is the one this whole milestone is about: **the
 * summary must code-switch the way the meeting did.** A model handed Egyptian
 * Arabic with English technical terms in it will happily produce fluent
 * Modern Standard Arabic with the terms translated — *"النشر"* for *"deploy"*.
 * That is the same failure the captions fight, one layer up, and it is worse
 * here because the summary is what gets pasted into a message to somebody else.
 */

export interface SummaryLine {
  speaker: string;
  text: string;
}

/** Roughly four characters to a token; a cheap bound, not a tokeniser. */
const CHARS_PER_TOKEN = 4;

/**
 * How much transcript to send.
 *
 * A long meeting is a lot of tokens and this runs on somebody's quota. Twelve
 * thousand characters is around three thousand tokens — a substantial meeting —
 * and beyond it the *end* is kept rather than the beginning: decisions and
 * actions land late, and a summary of the first twenty minutes of a two-hour
 * call is worse than useless because it looks complete.
 */
export const MAX_TRANSCRIPT_CHARS = 12_000;

export function buildTranscript(lines: readonly SummaryLine[]): string {
  const rendered = lines
    .map((line) => `${line.speaker}: ${line.text}`)
    .join("\n");

  if (rendered.length <= MAX_TRANSCRIPT_CHARS) return rendered;
  return rendered.slice(rendered.length - MAX_TRANSCRIPT_CHARS);
}

/** A rough cost, so a caller can refuse before spending anything. */
export function estimatedTokens(transcript: string): number {
  return Math.ceil(transcript.length / CHARS_PER_TOKEN);
}

/**
 * The instruction.
 *
 * Written in English because it is an instruction to the model rather than
 * something a participant reads, and stating the code-switching rule twice —
 * once as a rule, once as an example — because saying it once was not enough
 * in the captions prompt either.
 */
export const SYSTEM_PROMPT = [
  "You summarise meetings for somebody who was not there.",
  "",
  "Write exactly three sections, in this order, and omit a section entirely if it is empty:",
  "Decisions — what was settled, not what was discussed.",
  "Next — what somebody now has to do, and who.",
  "Open — what was raised and not resolved.",
  "",
  "Rules:",
  "- Write in the language the meeting was held in. If it was Egyptian Arabic, write Egyptian Arabic, not Modern Standard.",
  "- Keep every technical term in the script it was said in. If somebody said 'deploy', write 'deploy', never 'النشر' or 'ديبلوي'.",
  "  A line like 'عملنا الـ deploy على الـ staging server' summarises as 'اتعمل deploy على الـ staging server'.",
  "- Name people as the transcript names them.",
  "- Say nothing the transcript does not support. No advice, no framing, no closing sentence.",
  "- If there is not enough to summarise, say so in one line rather than inventing structure.",
].join("\n");

export interface SummaryResult {
  ok: boolean;
  text?: string;
  failure?: "no_key" | "quota" | "unavailable" | "too_short";
}

/**
 * Ask for the summary.
 *
 * `fetch` is a parameter for the same reason as in `stt/transcribe.ts`: the
 * only way to assert that a key went into exactly one header and nowhere else
 * is to watch the call. Nothing here logs, and the upstream body never comes
 * back out — a provider error can quote the request it was given.
 */
export async function summarise(
  input: {
    lines: readonly SummaryLine[];
    endpoint: string;
    model: string;
    key: string;
    signal?: AbortSignal;
  },
  doFetch: typeof fetch = fetch,
): Promise<SummaryResult> {
  const transcript = buildTranscript(input.lines);

  // Two exchanges is not a meeting. Better to say so than to produce three
  // confident headings over nothing.
  if (transcript.trim().length < 120) {
    return { ok: false, failure: "too_short" };
  }

  let response: Response;
  try {
    response = await doFetch(input.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        // Low, not zero: a summary is prose and zero makes it repetitive. Not
        // high either — this must describe the meeting, not improve on it.
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: transcript },
        ],
      }),
      signal: input.signal,
    });
  } catch {
    return { ok: false, failure: "unavailable" };
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return { ok: false, failure: "no_key" };
    }
    if (response.status === 402 || response.status === 429) {
      return { ok: false, failure: "quota" };
    }
    return { ok: false, failure: "unavailable" };
  }

  let text: unknown;
  try {
    const body = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    text = body.choices?.[0]?.message?.content;
  } catch {
    return { ok: false, failure: "unavailable" };
  }

  if (typeof text !== "string" || !text.trim()) {
    return { ok: false, failure: "unavailable" };
  }

  return { ok: true, text: text.trim() };
}
