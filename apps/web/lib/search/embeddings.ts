import "server-only";

import { SEARCH_EMBEDDING_DIMENSIONS } from "@lor/db";

export const DEFAULT_EMBEDDINGS_MODEL = "jina-embeddings-v3";
const JINA_EMBEDDINGS_ENDPOINT = "https://api.jina.ai/v1/embeddings";
const EMBEDDINGS_TIMEOUT_MS = 10_000;

export interface EmbeddingsProviderConfig {
  endpoint: string;
  key: string;
  model: typeof DEFAULT_EMBEDDINGS_MODEL;
  dimensions: typeof SEARCH_EMBEDDING_DIMENSIONS;
}

export type EmbeddingTask = "retrieval.passage" | "retrieval.query";

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/** The public result is intentionally generic: provider details stay server-side. */
export class EmbeddingsProviderError extends Error {
  constructor(readonly kind: "unavailable" | "malformed_response") {
    super(kind);
  }
}

/**
 * Jina's endpoint is OpenAI-compatible but its retrieval adapters and fixed
 * dimensions are a contract, not browser-controlled settings. A different
 * model must arrive with a reviewed database migration and a corpus rebuild.
 */
export function configuredEmbeddings(
  env: Record<string, string | undefined>,
): EmbeddingsProviderConfig | null {
  const provider = (env.LOR_EMBEDDINGS_PROVIDER ?? "jina").trim().toLowerCase();
  const model = env.LOR_EMBEDDINGS_MODEL?.trim() || DEFAULT_EMBEDDINGS_MODEL;
  const key = env.LOR_EMBEDDINGS_API_KEY?.trim();

  if (provider !== "jina" || model !== DEFAULT_EMBEDDINGS_MODEL || !key) return null;

  return {
    endpoint: JINA_EMBEDDINGS_ENDPOINT,
    key,
    model: DEFAULT_EMBEDDINGS_MODEL,
    dimensions: SEARCH_EMBEDDING_DIMENSIONS,
  };
}

function isEmbedding(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.length === SEARCH_EMBEDDING_DIMENSIONS
    && value.every((component) => typeof component === "number" && Number.isFinite(component));
}

/**
 * Embed a bounded batch. This is the sole outbound boundary for meeting text:
 * callers resolve and constrain evidence on the server before reaching here.
 */
export async function embedTexts(
  config: EmbeddingsProviderConfig,
  input: readonly string[],
  task: EmbeddingTask,
  request: FetchLike = fetch,
): Promise<number[][]> {
  if (input.length === 0) return [];

  let response: Response;
  try {
    response = await request(config.endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        input,
        task,
        dimensions: config.dimensions,
      }),
      signal: AbortSignal.timeout(EMBEDDINGS_TIMEOUT_MS),
    });
  } catch {
    throw new EmbeddingsProviderError("unavailable");
  }

  if (!response.ok) throw new EmbeddingsProviderError("unavailable");

  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.data)) {
    throw new EmbeddingsProviderError("malformed_response");
  }

  const ordered = new Array<number[]>(input.length);
  for (const item of payload.data) {
    const entry = item as { index?: unknown; embedding?: unknown };
    if (
      !item
      || typeof item !== "object"
      || typeof entry.index !== "number"
      || !Number.isInteger(entry.index)
      || entry.index < 0
      || entry.index >= input.length
      || !isEmbedding(entry.embedding)
      || ordered[entry.index]
    ) {
      throw new EmbeddingsProviderError("malformed_response");
    }
    ordered[entry.index] = entry.embedding;
  }

  for (const embedding of ordered) {
    if (!embedding) throw new EmbeddingsProviderError("malformed_response");
  }
  return ordered;
}
