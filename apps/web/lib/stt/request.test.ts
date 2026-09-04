import { describe, expect, it } from "vitest";
import {
  MAX_AUDIO_BYTES,
  MAX_PROMPT_LENGTH,
  USER_KEY_HEADER,
  planRequest,
} from "./request";
import { DEFAULT_PROVIDER, PROVIDERS } from "./providers";

const OPERATOR_KEY = "sk-operator-9999999999";
const USER_KEY = "sk-participant-1111111111";

const ENV = { LOR_STT_API_KEY: OPERATOR_KEY, LOR_STT_PROVIDER: "groq" };

const form = (fields: Record<string, string | Blob> = {}) => {
  const data = new FormData();
  data.set("audio", new Blob([new Uint8Array(1024)], { type: "audio/wav" }));
  data.set("room", "mza-krf-tqn");
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

const headers = (values: Record<string, string> = {}) => new Headers(values);

describe("planRequest", () => {
  it("plans a request with the operator's key", () => {
    const plan = planRequest(form(), headers(), ENV);

    expect(plan).toMatchObject({
      ok: true,
      code: "mza-krf-tqn",
      key: OPERATOR_KEY,
      usingOwnKey: false,
    });
    expect(plan.ok && plan.provider).toBe(PROVIDERS.groq);
    expect(plan.ok && plan.model).toBe(PROVIDERS.groq.defaultModel);
  });

  it("prefers a key the participant brought", () => {
    const plan = planRequest(
      form(),
      headers({ [USER_KEY_HEADER]: USER_KEY }),
      ENV,
    );

    expect(plan).toMatchObject({ ok: true, key: USER_KEY, usingOwnKey: true });
  });

  it("lets a request name a provider, and the operator set the default", () => {
    const named = planRequest(form({ provider: "openai" }), headers(), ENV);
    expect(named.ok && named.provider.id).toBe("openai");

    // Nothing named anywhere falls back to the documented default rather than
    // failing: a fresh clone with a key and no other configuration works.
    const bare = planRequest(form(), headers(), { LOR_STT_API_KEY: OPERATOR_KEY });
    expect(bare.ok && bare.provider.id).toBe(DEFAULT_PROVIDER);
  });

  it("takes the operator's model, but only for the operator's provider", () => {
    const configured = { ...ENV, LOR_STT_MODEL: "whisper-large-v3-turbo" };

    const matching = planRequest(form(), headers(), configured);
    expect(matching.ok && matching.model).toBe("whisper-large-v3-turbo");

    // A model name configured for Groq means nothing to OpenAI, and sending it
    // produces a "model not found" that reads like an outage.
    const other = planRequest(form({ provider: "openai" }), headers(), configured);
    expect(other.ok && other.model).toBe(PROVIDERS.openai.defaultModel);

    // And somebody using their own key gets the provider's default, not a model
    // chosen for a different account's quota.
    const own = planRequest(
      form(),
      headers({ [USER_KEY_HEADER]: USER_KEY }),
      configured,
    );
    expect(own.ok && own.model).toBe(PROVIDERS.groq.defaultModel);
  });

  it("refuses a provider it does not know", () => {
    // Not a silent fall back to the default. A client that believes it is
    // talking to Groq, and is quietly given OpenAI, has just sent a Groq key to
    // OpenAI.
    expect(planRequest(form({ provider: "acme" }), headers(), ENV)).toEqual({
      ok: false,
      status: 400,
      error: "provider_unknown",
    });
  });

  it("says so when there is no key anywhere", () => {
    // Not a retry, and not an error the participant caused. The answer is the
    // page that explains how to get one.
    expect(planRequest(form(), headers(), {})).toEqual({
      ok: false,
      status: 503,
      error: "no_key",
    });
  });

  it("refuses audio above the cap", () => {
    const oversized = form({
      audio: new Blob([new Uint8Array(MAX_AUDIO_BYTES + 1)]),
    });
    expect(planRequest(oversized, headers(), ENV)).toEqual({
      ok: false,
      status: 413,
      error: "audio_too_large",
    });
  });

  it("refuses a request with no audio in it", () => {
    const empty = new FormData();
    empty.set("room", "mza-krf-tqn");
    expect(planRequest(empty, headers(), ENV)).toMatchObject({
      error: "audio_missing",
    });

    const zero = form({ audio: new Blob([]) });
    expect(planRequest(zero, headers(), ENV)).toMatchObject({
      error: "audio_missing",
    });
  });

  it("refuses a request with no room", () => {
    const nameless = form();
    nameless.set("room", "   ");
    expect(planRequest(nameless, headers(), ENV)).toMatchObject({
      error: "room_missing",
    });
  });

  it("truncates a prompt rather than sending a document", () => {
    // Whisper reads roughly the last 224 tokens and drops the rest, so a long
    // prompt does not prime harder — it pushes the code-switched example out of
    // the window that is read.
    const long = "الـ deploy على الـ server ".repeat(200);
    const plan = planRequest(form({ prompt: long }), headers(), ENV);

    expect(plan.ok && plan.prompt!.length).toBe(MAX_PROMPT_LENGTH);
  });

  it("has no prompt when none was sent", () => {
    expect(planRequest(form(), headers(), ENV)).toMatchObject({
      prompt: undefined,
    });
    expect(planRequest(form({ prompt: "  " }), headers(), ENV)).toMatchObject({
      prompt: undefined,
    });
  });

  it("never puts a key in a rejection", () => {
    // Every way this can refuse, checked against both keys. An error is the
    // most-copied text in any product; a key in one is a key in a support
    // thread.
    const rejections = [
      planRequest(form({ provider: "acme" }), headers({ [USER_KEY_HEADER]: USER_KEY }), ENV),
      planRequest(form({ audio: new Blob([new Uint8Array(MAX_AUDIO_BYTES + 1)]) }), headers({ [USER_KEY_HEADER]: USER_KEY }), ENV),
      planRequest(new FormData(), headers({ [USER_KEY_HEADER]: USER_KEY }), ENV),
      planRequest(form(), headers(), {}),
    ];

    for (const rejection of rejections) {
      const serialised = JSON.stringify(rejection);
      expect(serialised).not.toContain(USER_KEY);
      expect(serialised).not.toContain(OPERATOR_KEY);
      // And the word it does carry is a word, not something built from input.
      expect(rejection.ok).toBe(false);
      expect(!rejection.ok && rejection.error).toMatch(/^[a-z_]+$/);
    }
  });

  it("ignores an empty key header rather than treating it as a key", () => {
    const plan = planRequest(form(), headers({ [USER_KEY_HEADER]: "   " }), ENV);
    expect(plan).toMatchObject({ ok: true, key: OPERATOR_KEY, usingOwnKey: false });
  });
});
