import { describe, expect, it } from "vitest";
import {
  DATA_TOPIC,
  MAX_CHAT_LENGTH,
  PROTOCOL_VERSION,
  decodeMessage,
  encodeMessage,
  messageId,
} from "./data-channel";

/** What a peer would actually put on the channel, without going through us. */
function wire(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

describe("the envelope", () => {
  it("round-trips a chat message", () => {
    const message = { type: "chat", id: "abc", body: "مرحبا" } as const;
    expect(decodeMessage(encodeMessage(message))).toEqual(message);
  });

  it("carries the protocol version", () => {
    const bytes = encodeMessage({ type: "chat", id: "abc", body: "hi" });
    expect(JSON.parse(new TextDecoder().decode(bytes))).toMatchObject({
      v: PROTOCOL_VERSION,
    });
  });

  it("names no sender", () => {
    // Attribution comes from the participant the media server hands us. A
    // sender field on the wire would be a name anyone could forge.
    const decoded = JSON.parse(
      new TextDecoder().decode(
        encodeMessage({ type: "chat", id: "abc", body: "hi" }),
      ),
    );
    expect(Object.keys(decoded).sort()).toEqual(["body", "id", "type", "v"]);
  });

  it("has a topic to publish under", () => {
    expect(DATA_TOPIC).toBeTruthy();
  });
});

describe("decoding something we do not understand", () => {
  it("ignores a type from a future client rather than throwing", () => {
    expect(
      decodeMessage(wire({ v: PROTOCOL_VERSION, type: "hologram", pose: 3 })),
    ).toBeNull();
  });

  it("ignores a newer protocol version", () => {
    expect(
      decodeMessage(wire({ v: PROTOCOL_VERSION + 1, type: "chat", id: "a", body: "hi" })),
    ).toBeNull();
  });

  it("ignores an older protocol version", () => {
    expect(
      decodeMessage(wire({ v: 0, type: "chat", id: "a", body: "hi" })),
    ).toBeNull();
  });

  it("survives bytes that are not JSON at all", () => {
    expect(decodeMessage(new Uint8Array([0xff, 0x00, 0x7b]))).toBeNull();
  });

  it("survives JSON that is not an object", () => {
    for (const value of [null, 42, "chat", [1, 2, 3], true]) {
      expect(decodeMessage(wire(value))).toBeNull();
    }
  });

  it("survives an empty packet", () => {
    expect(decodeMessage(new Uint8Array())).toBeNull();
  });
});

describe("a chat message from a peer", () => {
  const base = { v: PROTOCOL_VERSION, type: "chat", id: "a" };

  it("rejects a body that is not a string", () => {
    for (const body of [42, null, { text: "hi" }, ["hi"], undefined]) {
      expect(decodeMessage(wire({ ...base, body }))).toBeNull();
    }
  });

  it("rejects a missing or non-string id", () => {
    expect(decodeMessage(wire({ v: PROTOCOL_VERSION, type: "chat", body: "hi" }))).toBeNull();
    expect(decodeMessage(wire({ ...base, id: 7, body: "hi" }))).toBeNull();
    expect(decodeMessage(wire({ ...base, id: "", body: "hi" }))).toBeNull();
  });

  it("drops a body that is only whitespace", () => {
    expect(decodeMessage(wire({ ...base, body: "   \n\t  " }))).toBeNull();
  });

  it("trims before it truncates, so padding buys no extra length", () => {
    const padded = " ".repeat(5000) + "hi" + " ".repeat(5000);
    expect(decodeMessage(wire({ ...base, body: padded }))).toEqual({
      type: "chat",
      id: "a",
      body: "hi",
    });
  });

  it("truncates a body past the limit instead of dropping it", () => {
    const long = "ا".repeat(MAX_CHAT_LENGTH + 500);
    const decoded = decodeMessage(wire({ ...base, body: long }));
    expect(decoded?.body).toHaveLength(MAX_CHAT_LENGTH);
  });

  it("keeps emoji and mixed scripts intact", () => {
    const body = "عملت الـ deploy على الـ server 🎉";
    expect(decodeMessage(wire({ ...base, body }))?.body).toBe(body);
  });

  it("ignores extra fields a newer client added", () => {
    // Additive changes must not need a version bump, or every release breaks
    // the one before it.
    expect(
      decodeMessage(wire({ ...base, body: "hi", replyTo: "x", edited: true })),
    ).toEqual({ type: "chat", id: "a", body: "hi" });
  });
});

describe("messageId", () => {
  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 1000 }, messageId));
    expect(ids.size).toBe(1000);
  });
});
