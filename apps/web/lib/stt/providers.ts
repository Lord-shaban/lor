/**
 * The transcription services this proxy knows how to talk to.
 *
 * All of them speak the same shape — a multipart POST with a `file` and a
 * `model`, answering with `{ text }` — because OpenAI's transcription endpoint
 * became the de facto interface and everybody else implemented it. That is
 * worth relying on exactly as far as it goes: one request builder, one response
 * reader, and a table of the parts that differ.
 *
 * Adding a provider is adding a row. Anything that needs more than a row does
 * not belong in this table.
 *
 * The operator names one of these in `LOR_STT_PROVIDER` and supplies its key in
 * `LOR_STT_API_KEY` — one provider and one key, which is the contract
 * `.env.example` already described before this file existed. A key per provider
 * would be a second way to configure the same thing, and two of those disagree
 * eventually.
 */

export interface Provider {
  id: string;
  /** Shown on `/keys`, so it is the name the provider calls itself. */
  label: string;
  endpoint: string;
  /** Used unless `LOR_STT_MODEL` names another. */
  defaultModel: string;
  /** Where somebody gets their own key. Used by #92, and by the quota message. */
  keysUrl: string;
}

export const PROVIDERS: Record<string, Provider> = {
  groq: {
    id: "groq",
    label: "Groq",
    endpoint: "https://api.groq.com/openai/v1/audio/transcriptions",
    // The large Whisper checkpoint rather than the hosted `whisper-1`, which
    // matters here: the large model is markedly better at code-switched speech,
    // and this milestone is about nothing else.
    defaultModel: "whisper-large-v3",
    keysUrl: "https://console.groq.com/keys",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    endpoint: "https://api.openai.com/v1/audio/transcriptions",
    defaultModel: "whisper-1",
    keysUrl: "https://platform.openai.com/api-keys",
  },
};

/**
 * Groq, matching `.env.example`.
 *
 * It has a free tier that does not ask for a card, which is the difference
 * between "clone this and it works" and "clone this and go and sign up for
 * something first".
 */
export const DEFAULT_PROVIDER = "groq";

export function resolveProvider(id: string | null | undefined): Provider | null {
  return PROVIDERS[id ?? DEFAULT_PROVIDER] ?? null;
}
