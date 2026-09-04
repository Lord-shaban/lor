import { describe, expect, it, vi } from "vitest";
import {
  MAX_TRANSCRIPT_CHARS,
  SYSTEM_PROMPT,
  buildTranscript,
  estimatedTokens,
  summarise,
} from "./summarise";

const KEY = "gsk_summary_secret_9999";
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const meeting = (count = 20) =>
  Array.from({ length: count }, (_, i) => ({
    speaker: i % 2 ? "سارة" : "Ahmed",
    text: `عملنا الـ deploy رقم ${i} على الـ staging server وكله تمام خالص`,
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

const reply = (content: string, status = 200) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("buildTranscript", () => {
  it("names who said what", () => {
    expect(buildTranscript([{ speaker: "Ahmed", text: "خلاص" }])).toBe("Ahmed: خلاص");
  });

  it("keeps the end when it has to cut", () => {
    // Decisions and actions land late. A summary of the first twenty minutes of
    // a two-hour call is worse than useless, because it looks complete.
    const long = [
      { speaker: "A", text: "x".repeat(MAX_TRANSCRIPT_CHARS) },
      { speaker: "B", text: "the last thing anybody said" },
    ];

    const built = buildTranscript(long);
    expect(built.length).toBeLessThanOrEqual(MAX_TRANSCRIPT_CHARS);
    expect(built).toContain("the last thing anybody said");
  });

  it("estimates a cost before spending one", () => {
    expect(estimatedTokens("x".repeat(400))).toBe(100);
  });
});

describe("the instruction", () => {
  it("asks for what was decided, not what was discussed", () => {
    expect(SYSTEM_PROMPT).toContain("Decisions");
    expect(SYSTEM_PROMPT).toContain("not what was discussed");
    expect(SYSTEM_PROMPT).toContain("Next");
    expect(SYSTEM_PROMPT).toContain("Open");
  });

  it("states the code-switching rule as a rule and as an example", () => {
    // Saying it once was not enough in the captions prompt either. This is the
    // same failure one layer up, and worse here: a summary gets pasted to
    // somebody else.
    expect(SYSTEM_PROMPT).toContain("script it was said in");
    expect(SYSTEM_PROMPT).toContain("deploy");
    expect(SYSTEM_PROMPT).toContain("النشر");
    expect(SYSTEM_PROMPT).toMatch(/Egyptian Arabic, not Modern Standard/);
  });

  it("forbids inventing anything", () => {
    expect(SYSTEM_PROMPT).toContain("Say nothing the transcript does not support");
  });
});

describe("summarise", () => {
  it("sends the transcript and returns the summary", async () => {
    const { doFetch, calls } = spyFetch(reply("Decisions\n- اتعمل deploy"));
    const result = await summarise(
      { lines: meeting(), endpoint: ENDPOINT, model: "llama", key: KEY },
      doFetch,
    );

    expect(result).toEqual({ ok: true, text: "Decisions\n- اتعمل deploy" });
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.model).toBe("llama");
    expect(body.messages[0].content).toBe(SYSTEM_PROMPT);
  });

  it("puts the key in one header and nowhere else", async () => {
    const { doFetch, calls } = spyFetch(reply("ok ok ok"));
    await summarise(
      { lines: meeting(), endpoint: ENDPOINT, model: "llama", key: KEY },
      doFetch,
    );

    expect(calls[0].url).not.toContain(KEY);
    expect(new Headers(calls[0].init.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    expect(String(calls[0].init.body)).not.toContain(KEY);
  });

  it("refuses to summarise two sentences", async () => {
    // Three confident headings over nothing is worse than saying there is not
    // enough — and it costs money to produce.
    const { doFetch, calls } = spyFetch(reply("should not be reached"));
    const result = await summarise(
      { lines: [{ speaker: "A", text: "أهلاً" }], endpoint: ENDPOINT, model: "l", key: KEY },
      doFetch,
    );

    expect(result).toEqual({ ok: false, failure: "too_short" });
    expect(calls).toHaveLength(0);
  });

  it("never returns the provider's own words", async () => {
    const leaky = reply("x", 401);
    const { doFetch } = spyFetch(
      new Response(JSON.stringify({ error: `bad key ${KEY}` }), { status: 401 }),
    );
    void leaky;

    const result = await summarise(
      { lines: meeting(), endpoint: ENDPOINT, model: "l", key: KEY },
      doFetch,
    );

    expect(result).toEqual({ ok: false, failure: "no_key" });
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  it("tells a quota apart from an outage", async () => {
    for (const [status, failure] of [
      [402, "quota"],
      [429, "quota"],
      [500, "unavailable"],
      [503, "unavailable"],
    ] as const) {
      const { doFetch } = spyFetch(new Response("{}", { status }));
      expect(
        await summarise(
          { lines: meeting(), endpoint: ENDPOINT, model: "l", key: KEY },
          doFetch,
        ),
      ).toEqual({ ok: false, failure });
    }
  });

  it("does not trust the shape of what came back", async () => {
    for (const body of ["{}", '{"choices":[]}', '{"choices":[{"message":{}}]}', "not json"]) {
      const { doFetch } = spyFetch(new Response(body, { status: 200 }));
      expect(
        await summarise(
          { lines: meeting(), endpoint: ENDPOINT, model: "l", key: KEY },
          doFetch,
        ),
      ).toEqual({ ok: false, failure: "unavailable" });
    }
  });

  it("survives the network being gone", async () => {
    const { doFetch } = spyFetch(() => {
      throw new TypeError("fetch failed");
    });
    expect(
      await summarise(
        { lines: meeting(), endpoint: ENDPOINT, model: "l", key: KEY },
        doFetch,
      ),
    ).toEqual({ ok: false, failure: "unavailable" });
  });
});
