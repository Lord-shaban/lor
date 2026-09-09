/**
 * The provider configuration shared by every server-side LLM action.
 * `openai/gpt-oss-120b` is the current supported Groq default; an explicit
 * environment model remains the operator's override when providers change.
 */
export const DEFAULT_LLM_MODEL = "openai/gpt-oss-120b";

const CHAT_ENDPOINT: Record<string, string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
};

export interface LlmProviderConfig {
  endpoint: string;
  model: string;
  key: string;
}

/**
 * A self-hosted provider's base URL conventionally ends at `/v1`; accept an
 * already-complete chat URL too. Invalid values fail closed before any quota
 * or outbound request can occur.
 */
function customEndpoint(value: string | undefined): string | null {
  const base = value?.trim();
  if (!base) return null;

  try {
    const url = new URL(base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const normalized = url.toString().replace(/\/$/, "");
    return normalized.endsWith("/chat/completions")
      ? normalized
      : `${normalized}/chat/completions`;
  } catch {
    return null;
  }
}

/**
 * There is intentionally no client input here. The configured server key
 * leaves this boundary only in the Authorization header built by the caller.
 */
export function configuredLlm(
  env: Record<string, string | undefined>,
): LlmProviderConfig | null {
  const configuredBaseUrl = env.LOR_LLM_BASE_URL?.trim();
  const endpoint = configuredBaseUrl
    ? customEndpoint(configuredBaseUrl)
    : CHAT_ENDPOINT[(env.LOR_LLM_PROVIDER ?? "groq").trim()];
  const key = env.LOR_LLM_API_KEY?.trim() || env.LOR_STT_API_KEY?.trim();
  if (!endpoint || !key) return null;

  return {
    endpoint,
    key,
    model: env.LOR_LLM_MODEL?.trim() || DEFAULT_LLM_MODEL,
  };
}
