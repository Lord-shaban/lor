import { describe, expect, it } from "vitest";
import {
  DATA_TOPIC,
  SERVER_TOPIC,
  decodeServerNotice,
  encodeServerNotice,
  MAX_CAPTION_LENGTH,
  MAX_CHAT_LENGTH,
  MAX_HAND_AGE_MS,
  PROTOCOL_VERSION,
  REACTIONS,
  decodeMessage,
  encodeMessage,
  messageId,
} from "./data-channel";

/** Narrow to the one variant that has a body. */
function chatBody(message: ReturnType<typeof decodeMessage>): string | undefined {
  return message?.type === "chat" ? message.body : undefined;
}

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
    expect(chatBody(decodeMessage(wire({ ...base, body: long })))).toHaveLength(
      MAX_CHAT_LENGTH,
    );
  });

  it("keeps emoji and mixed scripts intact", () => {
    const body = "عملت الـ deploy على الـ server 🎉";
    expect(chatBody(decodeMessage(wire({ ...base, body })))).toBe(body);
  });

  it("ignores extra fields a newer client added", () => {
    // Additive changes must not need a version bump, or every release breaks
    // the one before it.
    expect(
      decodeMessage(wire({ ...base, body: "hi", replyTo: "x", edited: true })),
    ).toEqual({ type: "chat", id: "a", body: "hi" });
  });
});

describe("a reaction from a peer", () => {
  const base = { v: PROTOCOL_VERSION, type: "reaction", id: "r1" };

  it("round-trips every reaction on the list", () => {
    for (const emoji of REACTIONS) {
      expect(decodeMessage(encodeMessage({ type: "reaction", id: "r1", emoji }))).toEqual({
        type: "reaction",
        id: "r1",
        emoji,
      });
    }
  });

  it("refuses anything not on the list", () => {
    // The overlay draws this over everybody's video. An open field would let
    // one participant write across the meeting.
    for (const emoji of ["\ud83d\udca3", "hello", "", "\ud83d\udc4d\ud83d\udc4d", 42, null, { emoji: "\ud83d\udc4d" }]) {
      expect(decodeMessage(wire({ ...base, emoji }))).toBeNull();
    }
  });

  it("refuses a missing or empty id", () => {
    expect(decodeMessage(wire({ v: PROTOCOL_VERSION, type: "reaction", emoji: REACTIONS[0] }))).toBeNull();
    expect(decodeMessage(wire({ ...base, id: "", emoji: REACTIONS[0] }))).toBeNull();
  });
});

describe("a raised hand from a peer", () => {
  const base = { v: PROTOCOL_VERSION, type: "hand" };

  it("round-trips raising and lowering", () => {
    for (const raised of [true, false]) {
      expect(decodeMessage(encodeMessage({ type: "hand", raised, sinceMs: 0 }))).toEqual({
        type: "hand",
        raised,
        sinceMs: 0,
      });
    }
  });

  it("carries an age, so a late joiner can reconstruct the order", () => {
    expect(decodeMessage(wire({ ...base, raised: true, sinceMs: 45_000 }))).toEqual({
      type: "hand",
      raised: true,
      sinceMs: 45_000,
    });
  });

  it("treats a missing age as just now", () => {
    // What a hand message meant before the field existed.
    expect(decodeMessage(wire({ ...base, raised: true }))).toEqual({
      type: "hand",
      raised: true,
      sinceMs: 0,
    });
  });

  it("clamps an age that would sort a hand before the meeting", () => {
    const decoded = decodeMessage(wire({ ...base, raised: true, sinceMs: 1e15 }));
    expect(decoded).toEqual({ type: "hand", raised: true, sinceMs: MAX_HAND_AGE_MS });
  });

  it("ignores an age that is negative, infinite, or not a number", () => {
    for (const sinceMs of [-1000, Infinity, -Infinity, NaN, "45000", null, {}]) {
      expect(decodeMessage(wire({ ...base, raised: true, sinceMs }))).toEqual({
        type: "hand",
        raised: true,
        sinceMs: 0,
      });
    }
  });

  it("refuses a raised flag that is not a boolean", () => {
    for (const raised of ["true", 1, null, undefined, {}]) {
      expect(decodeMessage(wire({ ...base, raised }))).toBeNull();
    }
  });
});

describe("a notice from our own backend", () => {
  it("round-trips", () => {
    expect(decodeServerNotice(encodeServerNotice({ type: "knock" }))).toEqual({
      type: "knock",
    });
  });

  it("travels on its own topic", () => {
    // Peer packets and server packets are trusted differently, and the
    // difference has to be checkable before the bytes are read.
    expect(SERVER_TOPIC).not.toBe(DATA_TOPIC);
  });

  it("carries nothing but the fact that something changed", () => {
    const decoded = JSON.parse(
      new TextDecoder().decode(encodeServerNotice({ type: "knock" })),
    );
    // No names, no ids, no counts. A forged one can at worst cause a fetch.
    expect(Object.keys(decoded).sort()).toEqual(["type", "v"]);
  });

  it("ignores a type it does not know", () => {
    expect(
      decodeServerNotice(wire({ v: PROTOCOL_VERSION, type: "shutdown" })),
    ).toBeNull();
  });

  it("ignores another protocol version", () => {
    expect(
      decodeServerNotice(wire({ v: PROTOCOL_VERSION + 1, type: "knock" })),
    ).toBeNull();
  });

  it("survives bytes that are not JSON", () => {
    expect(decodeServerNotice(new Uint8Array([0xff, 0x00]))).toBeNull();
    expect(decodeServerNotice(new Uint8Array())).toBeNull();
  });

  it("is not confused with a peer message of the same shape", () => {
    // A peer publishing a chat packet must not be readable as a notice.
    expect(
      decodeServerNotice(encodeMessage({ type: "chat", id: "a", body: "hi" })),
    ).toBeNull();
    expect(decodeMessage(encodeServerNotice({ type: "knock" }))).toBeNull();
  });
});

describe("messageId", () => {
  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 1000 }, messageId));
    expect(ids.size).toBe(1000);
  });
});

describe("captions", () => {
  const wire = (message: Parameters<typeof encodeMessage>[0]) =>
    decodeMessage(encodeMessage(message));

  it("carries a line and whether it is the final one", () => {
    expect(
      wire({ type: "caption", id: "u1", text: "عملت الـ deploy", final: true }),
    ).toEqual({ type: "caption", id: "u1", text: "عملت الـ deploy", final: true });
  });

  it("treats a missing final flag as provisional", () => {
    // The safe direction. A line that stays grey is worse to look at; a guess
    // shown as settled is quoted.
    const bytes = new TextEncoder().encode(
      JSON.stringify({ v: PROTOCOL_VERSION, type: "caption", id: "u1", text: "guess" }),
    );
    expect(decodeMessage(bytes)).toMatchObject({ final: false });
  });

  it("drops a line with nothing in it", () => {
    expect(wire({ type: "caption", id: "u1", text: "   ", final: true })).toBeNull();
    expect(wire({ type: "caption", id: "", text: "hi", final: true })).toBeNull();
  });

  it("caps a line a peer padded", () => {
    const long = "ا".repeat(MAX_CAPTION_LENGTH + 200);
    const decoded = wire({ type: "caption", id: "u1", text: long, final: true });
    expect(decoded).toMatchObject({ text: "ا".repeat(MAX_CAPTION_LENGTH) });
  });

  it("carries the announcement that captions are on", () => {
    expect(wire({ type: "captions", on: true })).toEqual({ type: "captions", on: true });
    expect(wire({ type: "captions", on: false })).toEqual({ type: "captions", on: false });
  });

  it("refuses an announcement that does not say which", () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ v: PROTOCOL_VERSION, type: "captions" }),
    );
    expect(decodeMessage(bytes)).toBeNull();
  });
});
