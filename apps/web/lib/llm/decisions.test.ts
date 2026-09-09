import { describe, expect, it, vi } from "vitest";
import {
  DECISION_SYSTEM_PROMPT,
  DEFAULT_DECISION_EXTRACTIONS_PER_USER_PER_DAY,
  MAX_DECISION_TRANSCRIPT_CHARS,
  buildDecisionTranscript,
  decisionExtractionLimit,
  extractDecisionCandidates,
  parseDecisionCandidates,
} from "./decisions";

const KEY = "gsk_decision_secret_9999";
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const meeting = (count = 10) =>
  Array.from({ length: count }, (_, index) => ({
    seq: index,
    speaker: index % 2 === 0 ? "أحمد" : "Sara",
    text: `اتفقنا نعمل deploy على الـ staging server النهارده بعد مراجعة الـ CI رقم ${index}.`,
  }));

function spyFetch(answer: Response | (() => never)) {
  const calls: { url: string; init: RequestInit }[] = [];
  const doFetch = vi.fn(async (url: unknown, init: unknown) => {
    calls.push({ url: String(url), init: init as RequestInit });
    if (typeof answer === "function") return answer();
    return answer.clone();
  });
  return { doFetch: doFetch as unknown as typeof fetch, calls };
}

function reply(content: string, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("decision transcript", () => {
  it("keeps complete, newest source sequences inside the context bound", () => {
    const lines = [
      { seq: 1, speaker: "A", text: "x".repeat(MAX_DECISION_TRANSCRIPT_CHARS) },
      { seq: 2, speaker: "B", text: "قررنا نعمل deploy" },
    ];

    const transcript = buildDecisionTranscript(lines);
    expect(transcript).toBe("[2] B: قررنا نعمل deploy");
    expect(transcript.length).toBeLessThanOrEqual(MAX_DECISION_TRANSCRIPT_CHARS);
  });

  it("keeps decision extraction limited even when its setting is malformed", () => {
    expect(decisionExtractionLimit({})).toBe(DEFAULT_DECISION_EXTRACTIONS_PER_USER_PER_DAY);
    expect(decisionExtractionLimit({ LOR_FREE_DECISION_EXTRACTIONS_PER_USER_PER_DAY: "0" })).toBe(0);
    expect(decisionExtractionLimit({ LOR_FREE_DECISION_EXTRACTIONS_PER_USER_PER_DAY: "2.9" })).toBe(2);
    expect(decisionExtractionLimit({ LOR_FREE_DECISION_EXTRACTIONS_PER_USER_PER_DAY: "no limit" }))
      .toBe(DEFAULT_DECISION_EXTRACTIONS_PER_USER_PER_DAY);
  });
});

describe("decision instruction", () => {
  it("requires grounded JSON decisions and rejects discussion or action-item prose", () => {
    expect(DECISION_SYSTEM_PROMPT).toContain("exact shape");
    expect(DECISION_SYSTEM_PROMPT).toContain("sourceSeq");
    expect(DECISION_SYSTEM_PROMPT).toContain("questions, action items");
    expect(DECISION_SYSTEM_PROMPT).toContain("Egyptian Arabic");
    expect(DECISION_SYSTEM_PROMPT).toContain("Latin technical term");
  });
});

describe("parseDecisionCandidates", () => {
  it("accepts a supported settled decision", () => {
    expect(parseDecisionCandidates({
      decisions: [{ sourceSeq: 7, text: "هيتم deploy على الـ staging server النهارده." }],
    })).toEqual([{ sourceSeq: 7, text: "هيتم deploy على الـ staging server النهارده." }]);
  });

  it("accepts an empty result for a discussion or action item", () => {
    expect(parseDecisionCandidates({ decisions: [] })).toEqual([]);
  });

  it("rejects malformed, unknown, duplicate, or unsupported response shapes", () => {
    for (const response of [
      {},
      { decisions: [{ sourceSeq: 1, text: "قرار", quote: "forged" }] },
      { decisions: [{ sourceSeq: 1, text: "قرار" }, { sourceSeq: 1, text: "قرار تاني" }] },
      { decisions: [{ sourceSeq: -1, text: "قرار" }] },
      { decisions: [{ sourceSeq: 1, text: "" }] },
      { decisions: "ناقشنا الـ deploy" },
    ]) {
      expect(parseDecisionCandidates(response)).toBeNull();
    }
  });
});

describe("extractDecisionCandidates", () => {
  it("sends only bounded source sequences and returns validated candidates", async () => {
    const { doFetch, calls } = spyFetch(reply(JSON.stringify({
      decisions: [{ sourceSeq: 4, text: "هيتم deploy على الـ staging server." }],
    })));

    await expect(extractDecisionCandidates({
      lines: meeting(), endpoint: ENDPOINT, model: "openai/gpt-oss-120b", key: KEY,
    }, doFetch)).resolves.toEqual({
      ok: true,
      candidates: [{ sourceSeq: 4, text: "هيتم deploy على الـ staging server." }],
    });

    const body = JSON.parse(String(calls[0].init.body));
    expect(body.messages[0].content).toBe(DECISION_SYSTEM_PROMPT);
    expect(body.messages[1].content).toContain("[4]");
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("puts the key only in the upstream authorization header", async () => {
    const { doFetch, calls } = spyFetch(reply(JSON.stringify({ decisions: [] })));
    const result = await extractDecisionCandidates(
      { lines: meeting(), endpoint: ENDPOINT, model: "model", key: KEY },
      doFetch,
    );

    expect(calls[0].url).not.toContain(KEY);
    expect(String(calls[0].init.body)).not.toContain(KEY);
    expect(new Headers(calls[0].init.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  it("does not call a provider for an unusable retained transcript", async () => {
    const { doFetch, calls } = spyFetch(reply(JSON.stringify({ decisions: [] })));
    await expect(extractDecisionCandidates({
      lines: [{ seq: 0, speaker: "A", text: "أهلاً" }], endpoint: ENDPOINT, model: "model", key: KEY,
    }, doFetch)).resolves.toEqual({ ok: false, failure: "too_short" });
    expect(calls).toHaveLength(0);
  });

  it("rejects malformed provider content without returning it", async () => {
    for (const content of ["not json", "[]", JSON.stringify({ decisions: [{ sourceSeq: 1, text: "قرار", speaker: "forged" }] })]) {
      const { doFetch } = spyFetch(reply(content));
      await expect(extractDecisionCandidates({
        lines: meeting(), endpoint: ENDPOINT, model: "model", key: KEY,
      }, doFetch)).resolves.toEqual({ ok: false, failure: "invalid_response" });
    }
  });

  it("makes provider failures explicit without exposing their response", async () => {
    for (const [status, failure] of [
      [401, "no_key"],
      [429, "quota"],
      [503, "unavailable"],
    ] as const) {
      const { doFetch } = spyFetch(new Response(`provider saw ${KEY}`, { status }));
      const result = await extractDecisionCandidates({
        lines: meeting(), endpoint: ENDPOINT, model: "model", key: KEY,
      }, doFetch);
      expect(result).toEqual({ ok: false, failure });
      expect(JSON.stringify(result)).not.toContain(KEY);
    }
  });
});
