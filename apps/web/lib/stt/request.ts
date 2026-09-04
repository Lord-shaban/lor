import { DEFAULT_PROVIDER, resolveProvider, type Provider } from "./providers";

/**
 * Everything the proxy decides before it touches the network.
 *
 * Separated from the route so it can be tested, because what needs asserting
 * here is a set of negatives — the key is not in the error, the audio is not
 * accepted above the cap, an unknown provider does not fall through to a
 * default — and a negative is only worth anything if something checks it.
 *
 * The route does the two things this cannot: reads the body, and talks to the
 * database.
 */

/**
 * Eight megabytes.
 *
 * An utterance is 32 KB a second at the rate `wav.ts` writes, and `vad.ts` caps
 * one at twenty seconds — so a legitimate request is well under a megabyte and
 * this is loose by design. It is not a tuning knob, it is the point past which
 * something has gone wrong, and an unbounded proxy in front of a metered API is
 * a way to lose money quietly.
 */
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

/**
 * The prompt is a hint, not a document.
 *
 * Whisper reads roughly the last 224 tokens of it and silently drops the rest,
 * so a longer one does not prime harder — it just pushes the code-switched
 * example out of the window that is actually read, which is the opposite of
 * what #86 sends it for.
 */
export const MAX_PROMPT_LENGTH = 900;

/** The header a participant's own key arrives on. Never a query parameter. */
export const USER_KEY_HEADER = "x-lor-stt-key";

export interface SttPlan {
  ok: true;
  audio: Blob;
  code: string;
  provider: Provider;
  /** The provider's default unless `LOR_STT_MODEL` names another. */
  model: string;
  prompt?: string;
  key: string;
  /**
   * Whether the key came from the participant rather than the operator.
   *
   * #90 does not ration somebody who is paying, and the two cases have to be
   * distinguishable before there is a quota to skip.
   */
  usingOwnKey: boolean;
}

export interface SttRejection {
  ok: false;
  status: number;
  /**
   * A word, not a sentence, and never anything derived from the input.
   *
   * The client turns it into copy in the right language. An error that quotes
   * what it was given is how a key ends up in a screenshot.
   */
  error:
    | "audio_missing"
    | "audio_too_large"
    | "room_missing"
    | "provider_unknown"
    | "no_key";
}

export function planRequest(
  form: FormData,
  headers: Headers,
  env: Record<string, string | undefined>,
): SttPlan | SttRejection {
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return { ok: false, status: 400, error: "audio_missing" };
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return { ok: false, status: 413, error: "audio_too_large" };
  }

  const code = form.get("room");
  if (typeof code !== "string" || !code.trim()) {
    return { ok: false, status: 400, error: "room_missing" };
  }

  // What the request asked for, else what the operator configured, else the
  // default. Not a silent fall back at the first step: a client asking for a
  // provider it believes it has a key for, and quietly getting a different one,
  // would send that key to somebody it was not issued by.
  const requested = form.get("provider");
  const named =
    typeof requested === "string" && requested
      ? requested
      : (env.LOR_STT_PROVIDER?.trim() || null);

  const provider = resolveProvider(named);
  if (!provider) return { ok: false, status: 400, error: "provider_unknown" };

  const own = headers.get(USER_KEY_HEADER)?.trim();
  const key = own || env.LOR_STT_API_KEY?.trim();
  // Not an error the client should retry. The operator configured no key and
  // the participant supplied none, so the answer is #92's page, not a retry.
  if (!key) return { ok: false, status: 503, error: "no_key" };

  // Only when the operator's provider is the one being used. A model name
  // configured for Groq means nothing to OpenAI, and sending it produces a
  // "model not found" that looks like an outage.
  const model =
    !own && env.LOR_STT_MODEL?.trim() && provider.id === (env.LOR_STT_PROVIDER?.trim() || DEFAULT_PROVIDER)
      ? env.LOR_STT_MODEL.trim()
      : provider.defaultModel;

  const rawPrompt = form.get("prompt");
  const prompt =
    typeof rawPrompt === "string" && rawPrompt.trim()
      ? rawPrompt.trim().slice(0, MAX_PROMPT_LENGTH)
      : undefined;

  return {
    ok: true,
    audio,
    code: code.trim(),
    provider,
    model,
    prompt,
    key,
    usingOwnKey: Boolean(own),
  };
}
