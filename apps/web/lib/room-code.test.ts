import { describe, expect, it } from "vitest";
import {
  ALPHABET,
  CODE_LENGTH,
  generateRoomCode,
  generateUniqueRoomCode,
  isRoomCode,
  normalizeRoomCode,
} from "./room-code";

describe("the alphabet", () => {
  it("excludes the letters that get misread", () => {
    // `i` and `l` are a vertical stroke in most sans faces; `o` is a zero.
    for (const letter of ["i", "l", "o"]) {
      expect(ALPHABET).not.toContain(letter);
    }
  });

  it("contains no digits or uppercase", () => {
    expect(ALPHABET).toMatch(/^[a-z]+$/);
  });
});

describe("generateRoomCode", () => {
  it("always produces a code that validates and round-trips", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateRoomCode();
      expect(isRoomCode(code)).toBe(true);
      expect(normalizeRoomCode(code)).toBe(code);
    }
  });

  it("never emits a letter outside the alphabet", () => {
    for (let i = 0; i < 500; i++) {
      for (const letter of generateRoomCode().replace(/-/g, "")) {
        expect(ALPHABET).toContain(letter);
      }
    }
  });

  it("does not repeat itself over a large sample", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateRoomCode());
    expect(seen.size).toBe(5000);
  });

  it("distributes letters evenly enough that rejection sampling is working", () => {
    // Taking a random byte modulo 23 would favour the first few letters,
    // because 256 is not a multiple of 23. With 46,000 letters over 23
    // positions the expected count is 2,000 each; a modulo bias would push the
    // first nine letters roughly 8% above the rest, far outside this bound.
    const counts = new Map<string, number>();
    for (let i = 0; i < 4600; i++) {
      for (const letter of generateRoomCode().replace(/-/g, "")) {
        counts.set(letter, (counts.get(letter) ?? 0) + 1);
      }
    }

    expect(counts.size).toBe(ALPHABET.length);
    const expected = (4600 * CODE_LENGTH) / ALPHABET.length;
    for (const [letter, count] of counts) {
      expect(
        Math.abs(count - expected) / expected,
        `letter "${letter}" appeared ${count} times, expected about ${expected}`,
      ).toBeLessThan(0.15);
    }
  });
});

describe("normalizeRoomCode", () => {
  const canonical = "mza-krfq-tqn";

  it.each([
    ["already canonical", "mza-krfq-tqn"],
    ["no dashes", "mzakrfqtqn"],
    ["surrounding whitespace", "  mza-krfq-tqn  "],
    ["uppercase from a phone keyboard", "MZA-KRFQ-TQN"],
    ["mixed case", "Mza-Krfq-Tqn"],
    ["spaces instead of dashes", "mza krfq tqn"],
    ["an en dash pasted from a document", "mza–krfq–tqn"],
    ["dashes in the wrong places", "m-z-a-k-r-f-q-t-q-n"],
  ])("accepts %s", (_label, input) => {
    expect(normalizeRoomCode(input)).toBe(canonical);
  });

  it.each([
    ["a full https URL", "https://lor.dev/mza-krfq-tqn"],
    ["a URL with the English locale", "https://lor.dev/en/mza-krfq-tqn"],
    ["a URL with a trailing slash", "https://lor.dev/mza-krfq-tqn/"],
    ["a URL with a query string", "https://lor.dev/mza-krfq-tqn?from=email"],
    ["a URL with a hash", "https://lor.dev/mza-krfq-tqn#top"],
    ["a bare host and path", "lor.dev/mza-krfq-tqn"],
  ])("extracts the code from %s", (_label, input) => {
    expect(normalizeRoomCode(input)).toBe(canonical);
  });

  it("does not let a query string leak letters into the code", () => {
    // Stripping punctuation before splitting would turn this into a 13-letter
    // run and then silently truncate it to a different room.
    expect(normalizeRoomCode("https://lor.dev/mza-krfq?ref=abc")).toBeNull();
  });

  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
    ["too short", "mza-krfq-tq"],
    ["too long", "mza-krfq-tqnn"],
    ["contains a digit", "mza-krf1-tqn"],
    ["contains an excluded letter", "mza-krfi-tqn"],
    ["contains Arabic", "mza-كرفق-tqn"],
    ["only punctuation", "---"],
  ])("rejects %s", (_label, input) => {
    expect(normalizeRoomCode(input)).toBeNull();
  });

  it("rejects an excluded letter rather than guessing what was meant", () => {
    // Mapping `l` to `1` or `o` to `0` would send someone to the wrong room,
    // which is worse than asking them to retype it.
    expect(normalizeRoomCode("mzo-krfq-tqn")).toBeNull();
    expect(normalizeRoomCode("mzl-krfq-tqn")).toBeNull();
  });
});

describe("isRoomCode", () => {
  it("accepts only the canonical shape", () => {
    expect(isRoomCode("mza-krfq-tqn")).toBe(true);
    expect(isRoomCode("mzakrfqtqn")).toBe(false);
    expect(isRoomCode("MZA-KRFQ-TQN")).toBe(false);
    expect(isRoomCode("mza-krfq-tq")).toBe(false);
  });
});

describe("generateUniqueRoomCode", () => {
  it("returns the first code when nothing is taken", async () => {
    const code = await generateUniqueRoomCode(async () => false);
    expect(isRoomCode(code)).toBe(true);
  });

  it("retries past a collision", async () => {
    let calls = 0;
    const code = await generateUniqueRoomCode(async () => ++calls <= 2);
    expect(calls).toBe(3);
    expect(isRoomCode(code)).toBe(true);
  });

  it("throws rather than returning a duplicate when every attempt collides", async () => {
    // Exhausting five attempts against a 23^10 keyspace means the lookup is
    // broken. Failing loudly beats handing back a code that is already in use.
    await expect(generateUniqueRoomCode(async () => true)).rejects.toThrow(
      /collision lookup/,
    );
  });

  it("makes exactly as many attempts as it is given", async () => {
    let calls = 0;
    await expect(
      generateUniqueRoomCode(async () => {
        calls++;
        return true;
      }, 3),
    ).rejects.toThrow();
    expect(calls).toBe(3);
  });
});
