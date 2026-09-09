import { describe, expect, it } from "vitest";
import { DEFAULT_LLM_MODEL, configuredLlm } from "./provider";

describe("configuredLlm", () => {
  it("uses the documented Groq endpoint and current default model", () => {
    expect(configuredLlm({ LOR_LLM_API_KEY: "operator-key" })).toEqual({
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      key: "operator-key",
      model: DEFAULT_LLM_MODEL,
    });
  });

  it("uses a validated custom OpenAI-compatible base URL", () => {
    expect(configuredLlm({
      LOR_LLM_BASE_URL: "http://localhost:11434/v1/",
      LOR_LLM_API_KEY: "local-key",
      LOR_LLM_MODEL: "qwen3",
    })).toEqual({
      endpoint: "http://localhost:11434/v1/chat/completions",
      key: "local-key",
      model: "qwen3",
    });
  });

  it("fails closed without a key, supported provider, or safe endpoint", () => {
    expect(configuredLlm({})).toBeNull();
    expect(configuredLlm({ LOR_LLM_PROVIDER: "unknown", LOR_LLM_API_KEY: "key" })).toBeNull();
    expect(configuredLlm({ LOR_LLM_BASE_URL: "file:///not-a-provider", LOR_LLM_API_KEY: "key" }))
      .toBeNull();
  });
});
