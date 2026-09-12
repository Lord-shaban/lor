import { describe, expect, it } from "vitest";
import {
  MAX_TIMELINE_CHAPTER_TITLE_LENGTH,
  buildTimelineTranscript,
  candidatesReferenceOnlyTimelineLines,
  generateTimelineCandidates,
  parseTimelineCandidates,
  resolveTimelineCandidates,
  timelineGenerationLimit,
  timelineTranscriptLines,
} from "./timeline";

const lines = [
  {
    seq: 4,
    speaker: "أحمد",
    text: "هنعمل deploy على staging بعد الـ CI، ولازم نراجع الـ configuration والـ rollback plan قبل ما نبدأ.",
  },
  {
    seq: 7,
    speaker: "Sara",
    text: "هنراجع الـ pull request بكرة مع فريق الـ backend ونتأكد إن كل integration tests شغالة قبل الإطلاق.",
  },
];

function reply(content: string, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
}

describe("timeline transcript", () => {
  it("keeps complete ordered evidence lines and their original Arabic/Latin script", () => {
    const transcript = buildTimelineTranscript(timelineTranscriptLines(lines));
    expect(transcript).toBe(
      "[4] أحمد: هنعمل deploy على staging بعد الـ CI، ولازم نراجع الـ configuration والـ rollback plan قبل ما نبدأ.\n[7] Sara: هنراجع الـ pull request بكرة مع فريق الـ backend ونتأكد إن كل integration tests شغالة قبل الإطلاق.",
    );
  });

  it("has a bounded, deliberately configurable generation allowance", () => {
    expect(timelineGenerationLimit({})).toBe(3);
    expect(timelineGenerationLimit({ LOR_FREE_TIMELINE_GENERATIONS_PER_USER_PER_DAY: "0" })).toBe(0);
    expect(timelineGenerationLimit({ LOR_FREE_TIMELINE_GENERATIONS_PER_USER_PER_DAY: "2.8" })).toBe(2);
    expect(timelineGenerationLimit({ LOR_FREE_TIMELINE_GENERATIONS_PER_USER_PER_DAY: "no" })).toBe(3);
  });
});

describe("timeline candidate parsing", () => {
  it("accepts concise, ordered evidence ranges and optional automatic moments", () => {
    expect(parseTimelineCandidates({
      chapters: [{ title: "مراجعة الـ deploy على staging", startSeq: 4, endSeq: 7 }],
      moments: [{ sourceSeq: 7 }],
    })).toEqual({
      chapters: [{ title: "مراجعة الـ deploy على staging", startSeq: 4, endSeq: 7 }],
      moments: [{ sourceSeq: 7 }],
    });
  });

  it.each([
    { chapters: [{ title: "موضوع", startSeq: 7, endSeq: 4 }], moments: [] },
    { chapters: [{ title: "a", startSeq: 4, endSeq: 7 }, { title: "b", startSeq: 7, endSeq: 9 }], moments: [] },
    { chapters: [{ title: "a", startSeq: 4, endSeq: 7, at: "forged" }], moments: [] },
    { chapters: [{ title: "a", startSeq: 4, endSeq: 7, speaker: "forged" }], moments: [] },
    { chapters: [{ title: "x".repeat(MAX_TIMELINE_CHAPTER_TITLE_LENGTH + 1), startSeq: 4, endSeq: 7 }], moments: [] },
    { chapters: [], moments: [{ sourceSeq: 4 }, { sourceSeq: 4 }] },
    { chapters: [], moments: [{ sourceSeq: 4, timestamp: 1 }] },
    { chapters: [], moments: [], occurrenceId: "forged" },
  ])("rejects ungrounded or malformed output: %o", (value) => {
    expect(parseTimelineCandidates(value)).toBeNull();
  });
});

describe("timeline evidence resolution", () => {
  const candidates = {
    chapters: [{ title: "مراجعة الـ deploy", startSeq: 4, endSeq: 7 }],
    moments: [{ sourceSeq: 7 }],
  };
  const sources = [
    { id: "line-4", seq: 4, at: new Date("2026-09-12T10:00:00Z") },
    { id: "line-7", seq: 7, at: new Date("2026-09-12T10:01:00Z") },
  ];

  it("derives every navigation point from server-read sources", () => {
    expect(resolveTimelineCandidates(candidates, sources)).toEqual({
      chapters: [{
        title: "مراجعة الـ deploy",
        start: sources[0],
        end: sources[1],
      }],
      moments: [sources[1]],
    });
  });

  it("rejects missing or ambiguous evidence instead of persisting a partial result", () => {
    expect(resolveTimelineCandidates(candidates, [sources[0]])).toBeNull();
    expect(resolveTimelineCandidates(candidates, [...sources, { ...sources[1], id: "duplicate-7" }])).toBeNull();
  });
});

describe("timeline prompt grounding", () => {
  it("rejects a sequence that the bounded prompt did not disclose", () => {
    const candidates = {
      chapters: [{ title: "موضوع", startSeq: 4, endSeq: 7 }],
      moments: [{ sourceSeq: 99 }],
    };
    expect(candidatesReferenceOnlyTimelineLines(candidates, lines)).toBe(false);
    expect(candidatesReferenceOnlyTimelineLines({ ...candidates, moments: [{ sourceSeq: 7 }] }, lines)).toBe(true);
  });
});

describe("timeline generation", () => {
  it("never calls a provider for too-short evidence", async () => {
    const fetcher = async () => {
      throw new Error("should not call");
    };
    await expect(generateTimelineCandidates({
      lines: [{ seq: 1, speaker: "A", text: "short" }],
      endpoint: "https://provider.example/chat/completions",
      model: "model",
      key: "secret",
    }, fetcher as typeof fetch)).resolves.toEqual({ ok: false, failure: "too_short" });
  });

  it("keeps the key in an authorization header and original-script evidence in the request", async () => {
    const calls: RequestInit[] = [];
    const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
      calls.push(init!);
      return reply(JSON.stringify({
        chapters: [{ title: "مراجعة الـ deploy على staging", startSeq: 4, endSeq: 7 }],
        moments: [{ sourceSeq: 7 }],
      }));
    };

    await expect(generateTimelineCandidates({
      lines,
      endpoint: "https://provider.example/chat/completions",
      model: "model",
      key: "timeline-secret",
    }, fetcher as typeof fetch)).resolves.toEqual({
      ok: true,
      candidates: {
        chapters: [{ title: "مراجعة الـ deploy على staging", startSeq: 4, endSeq: 7 }],
        moments: [{ sourceSeq: 7 }],
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].headers).toMatchObject({ Authorization: "Bearer timeline-secret" });
    expect(calls[0].body).toContain("deploy على staging");
    expect(calls[0].body).not.toContain("timeline-secret");
  });

  it.each([
    [401, "no_key"],
    [429, "quota"],
    [500, "unavailable"],
  ] as const)("maps provider status %i to %s without exposing output", async (status, failure) => {
    const fetcher = async () => reply("", status);
    await expect(generateTimelineCandidates({
      lines,
      endpoint: "https://provider.example/chat/completions",
      model: "model",
      key: "secret",
    }, fetcher as typeof fetch)).resolves.toEqual({ ok: false, failure });
  });
});
