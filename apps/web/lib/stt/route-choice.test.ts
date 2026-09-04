import { describe, expect, it } from "vitest";
import { PROVIDERS } from "./providers";
import { chooseRoute } from "./route-choice";

const GROQ = { provider: "groq", key: "gsk_theirs" };
const OPENAI = { provider: "openai", key: "sk-theirs" };

describe("chooseRoute", () => {
  it("goes straight to the provider when it can", () => {
    // The only route where neither the key nor the audio reaches our server.
    expect(chooseRoute([GROQ])).toEqual({
      kind: "direct",
      provider: PROVIDERS.groq,
      key: "gsk_theirs",
    });
  });

  it("prefers direct even when another key is listed first", () => {
    expect(chooseRoute([OPENAI, GROQ])).toMatchObject({ kind: "direct" });
  });

  it("uses the proxy for a provider a browser cannot reach", () => {
    // Their key still, and still never stored — it travels as a header on the
    // one request that uses it.
    expect(chooseRoute([OPENAI])).toEqual({ kind: "proxy", key: "sk-theirs" });
  });

  it("falls back to the operator's key when nobody brought one", () => {
    expect(chooseRoute([])).toEqual({ kind: "proxy" });
  });

  it("ignores a provider this build does not know", () => {
    // A key stored by a newer version, or by hand. Sending it to whichever
    // provider happened to be configured would hand somebody's key to a
    // company it was not issued by.
    expect(chooseRoute([{ provider: "acme", key: "k" }])).toEqual({ kind: "proxy" });
    expect(chooseRoute([{ provider: "acme", key: "k" }, GROQ])).toMatchObject({
      kind: "direct",
      provider: PROVIDERS.groq,
    });
  });

  it("ignores an entry with nothing in it", () => {
    expect(chooseRoute([{ provider: "groq", key: "   " }])).toEqual({ kind: "proxy" });
  });

  it("trims what it hands on", () => {
    expect(chooseRoute([{ provider: "groq", key: "  gsk_x  " }])).toMatchObject({
      key: "gsk_x",
    });
  });
});
