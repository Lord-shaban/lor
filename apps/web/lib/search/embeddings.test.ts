import { describe, expect, it, vi } from "vitest";
import { SEARCH_EMBEDDING_DIMENSIONS } from "@lor/db";
import {
  DEFAULT_EMBEDDINGS_MODEL,
  EmbeddingsProviderError,
  configuredEmbeddings,
  embedTexts,
} from "./embeddings";

const vector = () => Array.from({ length: SEARCH_EMBEDDING_DIMENSIONS }, (_, index) => index / 10);

describe("Jina embeddings provider", () => {
  it("accepts only the documented Jina model and keeps its dimension fixed", () => {
    expect(configuredEmbeddings({ LOR_EMBEDDINGS_API_KEY: "secret" })).toMatchObject({
      model: DEFAULT_EMBEDDINGS_MODEL,
      dimensions: SEARCH_EMBEDDING_DIMENSIONS,
      endpoint: "https://api.jina.ai/v1/embeddings",
    });
    expect(configuredEmbeddings({ LOR_EMBEDDINGS_API_KEY: "secret", LOR_EMBEDDINGS_MODEL: "other" }))
      .toBeNull();
    expect(configuredEmbeddings({ LOR_EMBEDDINGS_PROVIDER: "groq", LOR_EMBEDDINGS_API_KEY: "secret" }))
      .toBeNull();
  });

  it("does not make an outbound request for an empty eligible batch", async () => {
    const request = vi.fn();
    const config = configuredEmbeddings({ LOR_EMBEDDINGS_API_KEY: "secret" });
    if (!config) throw new Error("test setup");

    await expect(embedTexts(config, [], "retrieval.passage", request)).resolves.toEqual([]);
    expect(request).not.toHaveBeenCalled();
  });

  it("orders a valid provider response by its explicit indexes", async () => {
    const config = configuredEmbeddings({ LOR_EMBEDDINGS_API_KEY: "secret" });
    if (!config) throw new Error("test setup");
    const first = vector();
    const second = vector().map((component) => component + 1);
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [
        { index: 1, embedding: second },
        { index: 0, embedding: first },
      ],
    }), { status: 200 }));

    await expect(embedTexts(config, ["الأول", "second"], "retrieval.query", request))
      .resolves.toEqual([first, second]);
  });

  it("maps provider outages and malformed vectors to non-leaking failures", async () => {
    const config = configuredEmbeddings({ LOR_EMBEDDINGS_API_KEY: "secret" });
    if (!config) throw new Error("test setup");

    await expect(embedTexts(config, ["text"], "retrieval.query", vi.fn().mockRejectedValue(new Error())))
      .rejects.toMatchObject<Partial<EmbeddingsProviderError>>({ kind: "unavailable" });
    await expect(embedTexts(
      config,
      ["text"],
      "retrieval.query",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ index: 0, embedding: [1, 2] }] }))),
    )).rejects.toMatchObject<Partial<EmbeddingsProviderError>>({ kind: "malformed_response" });
  });
});
