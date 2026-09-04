import { describe, expect, it, vi } from "vitest";
import { PROVIDERS } from "./providers";
import { FAILURE_STATUS, transcribe } from "./transcribe";

const KEY = "sk-secret-do-not-leak-0123456789";
const audio = () => new Blob([new Uint8Array(64)], { type: "audio/wav" });

/** A fetch that records what it was given and answers however the test says. */
function spyFetch(answer: Response | (() => never)) {
  const calls: { url: string; init: RequestInit }[] = [];
  const doFetch = vi.fn(async (url: unknown, init: unknown) => {
    calls.push({ url: String(url), init: init as RequestInit });
    if (typeof answer === "function") return answer();
    return answer.clone();
  });
  return { doFetch: doFetch as unknown as typeof fetch, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const sent = (init: RequestInit) => init.body as FormData;

describe("transcribe", () => {
  it("sends the audio and the provider's model", async () => {
    const { doFetch, calls } = spyFetch(json({ text: "خلص الـ deploy" }));

    const result = await transcribe(
      { audio: audio(), provider: PROVIDERS.openai, key: KEY },
      doFetch,
    );

    expect(result).toEqual({ ok: true, text: "خلص الـ deploy" });
    expect(calls[0].url).toBe(PROVIDERS.openai.endpoint);
    expect(sent(calls[0].init).get("model")).toBe(PROVIDERS.openai.defaultModel);
    expect(sent(calls[0].init).get("file")).toBeInstanceOf(Blob);
  });

  it("puts the key in one header and nowhere else", async () => {
    // The invariant, asserted rather than intended. A key in a query string
    // reaches access logs, referrers and browser history; a key in a form field
    // reaches whatever the provider logs about its own requests.
    const { doFetch, calls } = spyFetch(json({ text: "ok" }));

    await transcribe(
      { audio: audio(), provider: PROVIDERS.openai, key: KEY, prompt: "الـ deploy" },
      doFetch,
    );

    const { url, init } = calls[0];
    expect(url).not.toContain(KEY);

    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${KEY}`);

    for (const [, value] of sent(init).entries()) {
      if (typeof value === "string") expect(value).not.toContain(KEY);
    }
  });

  it("asks for nothing it does not need", async () => {
    // verbose_json returns segment timings we do not use and a copy of the
    // prompt we sent. The less that comes back, the less there is to keep by
    // accident.
    const { doFetch, calls } = spyFetch(json({ text: "ok" }));
    await transcribe({ audio: audio(), provider: PROVIDERS.groq, key: KEY }, doFetch);

    expect(sent(calls[0].init).get("response_format")).toBe("json");
    expect(sent(calls[0].init).get("temperature")).toBe("0");
  });

  it("sends a model the caller chose over the provider's default", () => {
    const { doFetch, calls } = spyFetch(json({ text: "ok" }));
    return transcribe(
      {
        audio: audio(),
        provider: PROVIDERS.groq,
        model: "whisper-large-v3-turbo",
        key: KEY,
      },
      doFetch,
    ).then(() => {
      expect(sent(calls[0].init).get("model")).toBe("whisper-large-v3-turbo");
    });
  });

  it("sends a prompt and a language only when it has them", async () => {
    const bare = spyFetch(json({ text: "ok" }));
    await transcribe({ audio: audio(), provider: PROVIDERS.openai, key: KEY }, bare.doFetch);
    expect(sent(bare.calls[0].init).has("prompt")).toBe(false);
    // Unset on purpose for a code-switched room: pinning the language is what
    // makes a model translate the English instead of transcribing it.
    expect(sent(bare.calls[0].init).has("language")).toBe(false);

    const full = spyFetch(json({ text: "ok" }));
    await transcribe(
      {
        audio: audio(),
        provider: PROVIDERS.openai,
        key: KEY,
        prompt: "عملت الـ deploy",
        language: "ar",
      },
      full.doFetch,
    );
    expect(sent(full.calls[0].init).get("prompt")).toBe("عملت الـ deploy");
    expect(sent(full.calls[0].init).get("language")).toBe("ar");
  });

  it("never returns the provider's own words", async () => {
    // A provider's error body can quote the request it was given — including,
    // on a bad day, the key it was given. What comes back from here is one of
    // our own words and nothing else.
    const leaky = json(
      { error: { message: `Incorrect API key provided: ${KEY}` } },
      401,
    );
    const { doFetch } = spyFetch(leaky);

    const result = await transcribe(
      { audio: audio(), provider: PROVIDERS.openai, key: KEY },
      doFetch,
    );

    expect(result).toEqual({ ok: false, failure: "key" });
    expect(JSON.stringify(result)).not.toContain(KEY);
    expect(JSON.stringify(result)).not.toContain("Incorrect API key");
  });

  it("maps a status onto something the caller can act on", async () => {
    const cases: [number, string][] = [
      [401, "key"],
      [403, "key"],
      [402, "quota"],
      [429, "quota"],
      [400, "rejected"],
      [413, "rejected"],
      [500, "unavailable"],
      [503, "unavailable"],
      [504, "timeout"],
    ];

    for (const [status, failure] of cases) {
      const { doFetch } = spyFetch(json({ error: "…" }, status));
      const result = await transcribe(
        { audio: audio(), provider: PROVIDERS.openai, key: KEY },
        doFetch,
      );
      expect(result, `status ${status}`).toEqual({ ok: false, failure });
    }
  });

  it("tells a timeout apart from a failure", async () => {
    // They need different answers: one is worth retrying with the same audio,
    // the other is not.
    const abort = spyFetch(() => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    });
    expect(
      await transcribe(
        { audio: audio(), provider: PROVIDERS.openai, key: KEY },
        abort.doFetch,
      ),
    ).toEqual({ ok: false, failure: "timeout" });

    const dead = spyFetch(() => {
      throw new TypeError("fetch failed");
    });
    expect(
      await transcribe(
        { audio: audio(), provider: PROVIDERS.openai, key: KEY },
        dead.doFetch,
      ),
    ).toEqual({ ok: false, failure: "unavailable" });
  });

  it("does not trust the shape of what came back", async () => {
    for (const body of [{}, { text: 42 }, { text: null }]) {
      const { doFetch } = spyFetch(json(body));
      expect(
        await transcribe(
          { audio: audio(), provider: PROVIDERS.openai, key: KEY },
          doFetch,
        ),
      ).toEqual({ ok: false, failure: "unavailable" });
    }

    const notJson = spyFetch(new Response("<html>502</html>", { status: 200 }));
    expect(
      await transcribe(
        { audio: audio(), provider: PROVIDERS.openai, key: KEY },
        notJson.doFetch,
      ),
    ).toEqual({ ok: false, failure: "unavailable" });
  });

  it("trims what it returns", async () => {
    const { doFetch } = spyFetch(json({ text: "  خلص الـ deploy \n" }));
    expect(
      await transcribe(
        { audio: audio(), provider: PROVIDERS.openai, key: KEY },
        doFetch,
      ),
    ).toEqual({ ok: true, text: "خلص الـ deploy" });
  });

  it("has a status for every failure it can report", async () => {
    // Not 401 for a bad key: nothing about the caller's request was
    // unauthorised, and telling a participant "unauthorised" for the operator's
    // expired key sends them looking in the wrong place.
    expect(FAILURE_STATUS.key).toBe(502);
    expect(FAILURE_STATUS.quota).toBe(429);
    expect(Object.values(FAILURE_STATUS).every((s) => s >= 400)).toBe(true);
  });
});
