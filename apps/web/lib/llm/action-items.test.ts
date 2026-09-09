import { describe, expect, it, vi } from "vitest";
import {
  ACTION_ITEM_SYSTEM_PROMPT,
  DEFAULT_ACTION_ITEM_EXTRACTIONS_PER_USER_PER_DAY,
  MAX_ACTION_ITEM_TRANSCRIPT_CHARS,
  actionItemExtractionLimit,
  buildActionItemTranscript,
  canonicalParticipantName,
  extractActionItemCandidates,
  parseActionItemCandidates,
  resolveActionItemCandidates,
} from "./action-items";

const KEY = "gsk_action_item_secret_9999";
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const meeting = (count = 10) =>
  Array.from({ length: count }, (_, index) => ({
    seq: index,
    speaker: index % 2 === 0 ? "أحمد" : "Sara",
    text: `أحمد هيراجع الـ pull request رقم ${index} قبل 2026-09-12 ويرد على Sara.`,
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

describe("action-item transcript", () => {
  it("keeps complete, newest source sequences inside the context bound", () => {
    const lines = [
      { seq: 1, speaker: "A", text: "x".repeat(MAX_ACTION_ITEM_TRANSCRIPT_CHARS) },
      { seq: 2, speaker: "B", text: "هراجع الـ pull request" },
    ];

    const transcript = buildActionItemTranscript(lines);
    expect(transcript).toBe("[2] B: هراجع الـ pull request");
    expect(transcript.length).toBeLessThanOrEqual(MAX_ACTION_ITEM_TRANSCRIPT_CHARS);
  });

  it("keeps action-item extraction limited even when its setting is malformed", () => {
    expect(actionItemExtractionLimit({})).toBe(DEFAULT_ACTION_ITEM_EXTRACTIONS_PER_USER_PER_DAY);
    expect(actionItemExtractionLimit({ LOR_FREE_ACTION_ITEM_EXTRACTIONS_PER_USER_PER_DAY: "0" })).toBe(0);
    expect(actionItemExtractionLimit({ LOR_FREE_ACTION_ITEM_EXTRACTIONS_PER_USER_PER_DAY: "2.9" })).toBe(2);
    expect(actionItemExtractionLimit({ LOR_FREE_ACTION_ITEM_EXTRACTIONS_PER_USER_PER_DAY: "no limit" }))
      .toBe(DEFAULT_ACTION_ITEM_EXTRACTIONS_PER_USER_PER_DAY);
  });
});

describe("action-item instruction", () => {
  it("separates explicit commitments from decisions, discussion, questions, and unassigned suggestions", () => {
    expect(ACTION_ITEM_SYSTEM_PROMPT).toContain("exact shape");
    expect(ACTION_ITEM_SYSTEM_PROMPT).toContain("sourceSeq");
    expect(ACTION_ITEM_SYSTEM_PROMPT).toContain("decisions, discussion topics, questions, advice, suggestions");
    expect(ACTION_ITEM_SYSTEM_PROMPT).toContain("intentions without an owner");
    expect(ACTION_ITEM_SYSTEM_PROMPT).toContain("Egyptian Arabic");
    expect(ACTION_ITEM_SYSTEM_PROMPT).toContain("Latin technical term");
  });
});

describe("parseActionItemCandidates", () => {
  it("accepts a supported assigned commitment with a literal date", () => {
    expect(parseActionItemCandidates({
      actionItems: [{
        sourceSeq: 7,
        text: "مراجعة الـ pull request وإرسال النتيجة.",
        ownerName: "أحمد",
        dueOn: "2026-09-12",
      }],
    })).toEqual([{
      sourceSeq: 7,
      text: "مراجعة الـ pull request وإرسال النتيجة.",
      ownerName: "أحمد",
      dueOn: "2026-09-12",
    }]);
  });

  it("accepts an empty result when no assigned commitment exists", () => {
    expect(parseActionItemCandidates({ actionItems: [] })).toEqual([]);
  });

  it("rejects malformed, unknown, duplicate, and non-literal date responses", () => {
    for (const response of [
      {},
      { actionItems: [{ sourceSeq: 1, text: "مهمة", ownerName: "أحمد", dueOn: null, quote: "forged" }] },
      {
        actionItems: [
          { sourceSeq: 1, text: "مهمة", ownerName: "أحمد", dueOn: null },
          { sourceSeq: 1, text: "مهمة ثانية", ownerName: "سارة", dueOn: null },
        ],
      },
      { actionItems: [{ sourceSeq: -1, text: "مهمة", ownerName: "أحمد", dueOn: null }] },
      { actionItems: [{ sourceSeq: 1, text: "", ownerName: "أحمد", dueOn: null }] },
      { actionItems: [{ sourceSeq: 1, text: "مهمة", ownerName: "", dueOn: null }] },
      { actionItems: [{ sourceSeq: 1, text: "مهمة", ownerName: "أحمد", dueOn: "بكرة" }] },
      { actionItems: "هنراجع الـ deploy" },
    ]) {
      expect(parseActionItemCandidates(response)).toBeNull();
    }
  });
});

describe("server-side action-item resolution", () => {
  const sources = [{ id: "source-7", seq: 7, text: "أحمد هيراجع الـ pull request قبل 2026-09-12." }];

  it("resolves only the canonical identity and retains an exact source date", () => {
    const resolved = resolveActionItemCandidates([
      { sourceSeq: 7, text: "مراجعة الـ pull request.", ownerName: "  SARA  ", dueOn: "2026-09-12" },
    ], sources, [
      { seq: 1, speaker: "Sara", identity: "participant-sara", text: "أنا Sara." },
      { seq: 7, speaker: "أحمد", identity: "participant-ahmed", text: sources[0].text },
    ]);

    expect(resolved).toEqual([{
      sourceSeq: 7,
      sourceLineId: "source-7",
      text: "مراجعة الـ pull request.",
      assigneeIdentity: "participant-sara",
      dueOn: "2026-09-12",
    }]);
  });

  it("fails closed for an unknown, transliterated, or ambiguous owner", () => {
    const retained = [
      { seq: 1, speaker: "سارة", identity: "participant-sara-a", text: "أنا سارة." },
      { seq: 2, speaker: "سارة", identity: "participant-sara-b", text: "وأنا سارة كمان." },
    ];
    for (const ownerName of ["Sara", "Mina", "سارة"]) {
      expect(resolveActionItemCandidates([
        { sourceSeq: 7, text: "مهمة.", ownerName, dueOn: null },
      ], sources, retained)).toBeNull();
    }
  });

  it("drops relative or model-invented dates instead of assigning a default", () => {
    const resolved = resolveActionItemCandidates([
      { sourceSeq: 7, text: "مراجعة الـ pull request.", ownerName: "أحمد", dueOn: "2026-09-13" },
    ], sources, [
      { seq: 7, speaker: "أحمد", identity: "participant-ahmed", text: sources[0].text },
    ]);
    expect(resolved).toEqual([{
      sourceSeq: 7,
      sourceLineId: "source-7",
      text: "مراجعة الـ pull request.",
      assigneeIdentity: "participant-ahmed",
    }]);
  });

  it("documents the deliberately narrow canonical normalization", () => {
    expect(canonicalParticipantName("  SARA\u00a0 ")).toBe("sara");
    expect(canonicalParticipantName("Sara")).not.toBe(canonicalParticipantName("سارة"));
  });
});

describe("extractActionItemCandidates", () => {
  it("keeps an explicit assigned commitment separate from nearby discussion, decision, and question", async () => {
    const lines = [
      { seq: 0, speaker: "أحمد", text: "ممكن نأجل الـ deploy لو الـ CI أخد وقت أطول؟" },
      { seq: 1, speaker: "سارة", text: "هراجع الـ pull request وأبعتلكم النتيجة قبل 2026-09-12." },
      { seq: 2, speaker: "أحمد", text: "اتفقنا إن الـ deploy هيتم الخميس بعد ما الـ CI ينجح على staging." },
      { seq: 3, speaker: "Mina", text: "يمكن نحتاج حد يراجع الـ monitoring لاحقًا." },
    ];
    const candidate = {
      sourceSeq: 1,
      text: "مراجعة الـ pull request وإرسال النتيجة.",
      ownerName: "سارة",
      dueOn: "2026-09-12",
    };
    const { doFetch, calls } = spyFetch(reply(JSON.stringify({ actionItems: [candidate] })));

    await expect(extractActionItemCandidates({
      lines, endpoint: ENDPOINT, model: "model", key: KEY,
    }, doFetch)).resolves.toEqual({ ok: true, candidates: [candidate] });

    const request = JSON.parse(String(calls[0].init.body));
    expect(request.messages[1].content).toContain("[0] أحمد: ممكن نأجل الـ deploy");
    expect(request.messages[1].content).toContain("[1] سارة: هراجع الـ pull request");
    expect(request.messages[1].content).toContain("[2] أحمد: اتفقنا إن الـ deploy");
  });

  it("sends only bounded source sequences and returns validated candidates", async () => {
    const candidate = {
      sourceSeq: 4,
      text: "مراجعة الـ pull request.",
      ownerName: "أحمد",
      dueOn: "2026-09-12",
    };
    const { doFetch, calls } = spyFetch(reply(JSON.stringify({ actionItems: [candidate] })));

    await expect(extractActionItemCandidates({
      lines: meeting(), endpoint: ENDPOINT, model: "openai/gpt-oss-120b", key: KEY,
    }, doFetch)).resolves.toEqual({ ok: true, candidates: [candidate] });

    const body = JSON.parse(String(calls[0].init.body));
    expect(body.messages[0].content).toBe(ACTION_ITEM_SYSTEM_PROMPT);
    expect(body.messages[1].content).toContain("[4]");
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("puts the key only in the upstream authorization header", async () => {
    const { doFetch, calls } = spyFetch(reply(JSON.stringify({ actionItems: [] })));
    const result = await extractActionItemCandidates(
      { lines: meeting(), endpoint: ENDPOINT, model: "model", key: KEY },
      doFetch,
    );

    expect(calls[0].url).not.toContain(KEY);
    expect(String(calls[0].init.body)).not.toContain(KEY);
    expect(new Headers(calls[0].init.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  it("does not call a provider for an unusable retained transcript", async () => {
    const { doFetch, calls } = spyFetch(reply(JSON.stringify({ actionItems: [] })));
    await expect(extractActionItemCandidates({
      lines: [{ seq: 0, speaker: "A", text: "أهلاً" }], endpoint: ENDPOINT, model: "model", key: KEY,
    }, doFetch)).resolves.toEqual({ ok: false, failure: "too_short" });
    expect(calls).toHaveLength(0);
  });

  it("makes timeout and malformed provider failures explicit without exposing their response", async () => {
    const timeout = () => {
      throw new DOMException("provider waited", "TimeoutError");
    };
    const { doFetch: timeoutFetch } = spyFetch(timeout);
    await expect(extractActionItemCandidates({
      lines: meeting(), endpoint: ENDPOINT, model: "model", key: KEY,
    }, timeoutFetch)).resolves.toEqual({ ok: false, failure: "timeout" });

    for (const content of [
      "not json",
      "[]",
      JSON.stringify({ actionItems: [{ sourceSeq: 1, text: "مهمة", ownerName: "أحمد", dueOn: null, speaker: "forged" }] }),
    ]) {
      const { doFetch } = spyFetch(reply(content));
      await expect(extractActionItemCandidates({
        lines: meeting(), endpoint: ENDPOINT, model: "model", key: KEY,
      }, doFetch)).resolves.toEqual({ ok: false, failure: "invalid_response" });
    }
  });

  it("keeps provider errors explicit without exposing the key", async () => {
    for (const [status, failure] of [
      [401, "no_key"],
      [429, "quota"],
      [503, "unavailable"],
    ] as const) {
      const { doFetch } = spyFetch(new Response(`provider saw ${KEY}`, { status }));
      const result = await extractActionItemCandidates({
        lines: meeting(), endpoint: ENDPOINT, model: "model", key: KEY,
      }, doFetch);
      expect(result).toEqual({ ok: false, failure });
      expect(JSON.stringify(result)).not.toContain(KEY);
    }
  });
});
