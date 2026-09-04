import type { Provider } from "./providers";

/**
 * One utterance to a provider, one line of text back, and nothing else kept.
 *
 * This is the module the keys invariant lives or dies in, so it is written to
 * make the invariant hard to break rather than merely true today:
 *
 * - **The key is a parameter, never a module constant.** A constant outlives the
 *   request and turns up in a heap dump, a log line, or a crash report.
 * - **It goes in one place**, an `Authorization` header on one request. Not in a
 *   query string, which reaches access logs and referrers.
 * - **Nothing in here logs.** Not the key, not the audio, not the upstream body,
 *   not even on failure. A `console.error(error)` on a fetch rejection is how a
 *   request body ends up in a log aggregator.
 * - **The upstream body never comes back out.** A provider's error can quote the
 *   request it was given, so a failure is translated into one of our own words.
 *   The caller gets to know what went wrong and not what was sent.
 *
 * `fetch` is a parameter so a test can watch exactly what was sent, which is the
 * only way to assert a negative about a network call.
 */

export type TranscribeFailure =
  /** The key was refused. Ours to fix, or theirs to replace. */
  | "key"
  /** Rate limited or out of credit at the provider. */
  | "quota"
  /** The provider would not take the audio at all. */
  | "rejected"
  /** It broke, or could not be reached. */
  | "unavailable"
  /** It did not answer in time. */
  | "timeout";

export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; failure: TranscribeFailure };

export interface TranscribeInput {
  audio: Blob;
  provider: Provider;
  /** Which of the provider's models. `provider.defaultModel` unless overridden. */
  model?: string;
  key: string;
  /**
   * Primes the decoder with the shape the output should take.
   *
   * This is the field #86 exists to fill, and the single cheapest defence
   * against Whisper writing English in Arabic script.
   */
  prompt?: string;
  /**
   * The language of the audio, if it is known.
   *
   * Left unset for a code-switched room. Pinning it to Arabic is what makes a
   * model translate the English rather than transcribe it, which is the other
   * half of the failure this milestone is about.
   */
  language?: string;
  signal?: AbortSignal;
}

export async function transcribe(
  input: TranscribeInput,
  doFetch: typeof fetch = fetch,
): Promise<TranscribeResult> {
  const form = new FormData();
  form.set("file", input.audio, "utterance.wav");
  form.set("model", input.model ?? input.provider.defaultModel);
  // Just the text. `verbose_json` would carry segment timings we do not use and
  // a copy of the prompt we sent, and the less that comes back the less there
  // is to accidentally keep.
  form.set("response_format", "json");
  // Zero: this is transcription, and a model inventing a more likely sentence
  // than the one that was said is the failure mode, not the goal.
  form.set("temperature", "0");

  if (input.prompt) form.set("prompt", input.prompt);
  if (input.language) form.set("language", input.language);

  let response: Response;
  try {
    response = await doFetch(input.provider.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${input.key}` },
      body: form,
      signal: input.signal,
    });
  } catch (error) {
    // Deliberately not logged and deliberately not inspected beyond its name.
    // A fetch rejection can carry the request in its cause.
    return {
      ok: false,
      failure: isAbort(error) ? "timeout" : "unavailable",
    };
  }

  if (!response.ok) return { ok: false, failure: failureFor(response.status) };

  let text: unknown;
  try {
    ({ text } = (await response.json()) as { text?: unknown });
  } catch {
    return { ok: false, failure: "unavailable" };
  }

  if (typeof text !== "string") return { ok: false, failure: "unavailable" };
  return { ok: true, text: text.trim() };
}

function failureFor(status: number): TranscribeFailure {
  if (status === 401 || status === 403) return "key";
  if (status === 402 || status === 429) return "quota";
  // 400 and 413 mean the audio itself was refused — too long, too large, or a
  // format the provider does not take. Retrying will not help.
  if (status >= 400 && status < 500) return "rejected";
  if (status === 504) return "timeout";
  return "unavailable";
}

function isAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

/** What the client should be told, and what it can do about it. */
export const FAILURE_STATUS: Record<TranscribeFailure, number> = {
  // Not 401: nothing about *this* request was unauthorised. The operator's key
  // is wrong, or the user's is, and 502 says the problem is upstream of them.
  key: 502,
  quota: 429,
  rejected: 422,
  unavailable: 502,
  timeout: 504,
};
