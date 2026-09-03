import { describe, expect, it } from "vitest";
import {
  MAX_CHAT_ENTRIES,
  appendEntry,
  unreadCount,
  type ChatEntry,
} from "./chat-log";

function entry(n: number): ChatEntry {
  return {
    key: `p_a:${n}`,
    identity: "p_a",
    name: "أحمد",
    body: `message ${n}`,
    at: n,
    mine: false,
  };
}

describe("appendEntry", () => {
  it("keeps arrival order", () => {
    const log = [1, 2, 3].reduce<ChatEntry[]>(
      (acc, n) => appendEntry(acc, entry(n)),
      [],
    );
    expect(log.map((e) => e.at)).toEqual([1, 2, 3]);
  });

  it("does not mutate the log it was given", () => {
    const before: ChatEntry[] = [entry(1)];
    appendEntry(before, entry(2));
    expect(before).toHaveLength(1);
  });

  it("drops the oldest once it is full", () => {
    let log: ChatEntry[] = [];
    for (let n = 1; n <= 5; n++) log = appendEntry(log, entry(n), 3);
    expect(log.map((e) => e.at)).toEqual([3, 4, 5]);
  });

  it("caps at a sane default", () => {
    expect(MAX_CHAT_ENTRIES).toBeGreaterThan(50);
  });
});

describe("unreadCount", () => {
  it("counts what arrived since the panel was last closed", () => {
    expect(unreadCount({ received: 7, read: 4, open: false })).toBe(3);
  });

  it("is zero while the panel is open", () => {
    expect(unreadCount({ received: 7, read: 0, open: true })).toBe(0);
  });

  it("is zero when everything has been read", () => {
    expect(unreadCount({ received: 4, read: 4, open: false })).toBe(0);
  });

  it("never goes negative when the log has been trimmed", () => {
    // `read` is a running total taken at close; a trimmed log must not make it
    // exceed what the badge thinks arrived.
    expect(unreadCount({ received: 3, read: 9, open: false })).toBe(0);
  });
});
