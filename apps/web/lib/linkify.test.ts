import { describe, expect, it } from "vitest";
import { linkify } from "./linkify";

/** The message, rebuilt from its segments. Nothing may be lost or duplicated. */
function rejoin(text: string): string {
  return linkify(text)
    .map((segment) => segment.text)
    .join("");
}

describe("linkify", () => {
  it("returns plain text as a single segment", () => {
    expect(linkify("no links here")).toEqual([{ text: "no links here" }]);
  });

  it("finds a link between words", () => {
    expect(linkify("see https://lor.dev now")).toEqual([
      { text: "see " },
      { text: "https://lor.dev", href: "https://lor.dev/" },
      { text: " now" },
    ]);
  });

  it("finds several links in one message", () => {
    const segments = linkify("http://a.test and https://b.test");
    expect(segments.filter((s) => s.href)).toHaveLength(2);
  });

  it("never loses or duplicates a character", () => {
    for (const text of [
      "see https://lor.dev now",
      "https://lor.dev",
      "شوف اللينك ده https://lor.dev/mza-krfq-tqn وقولّي",
      "no links at all",
      "https://a.test/x https://b.test/y",
    ]) {
      expect(rejoin(text)).toBe(text);
    }
  });

  it("leaves sentence punctuation out of the link", () => {
    const segments = linkify("شوف https://lor.dev/mza-krfq-tqn.");
    expect(segments.at(-2)).toEqual({
      text: "https://lor.dev/mza-krfq-tqn",
      href: "https://lor.dev/mza-krfq-tqn",
    });
    expect(segments.at(-1)).toEqual({ text: "." });
  });

  it("leaves Arabic punctuation out of the link too", () => {
    // U+060C ARABIC COMMA and U+061F ARABIC QUESTION MARK.
    expect(linkify("https://lor.dev\u060C").at(-1)).toEqual({ text: "\u060C" });
    expect(linkify("https://lor.dev\u061F").at(-1)).toEqual({ text: "\u061F" });
  });

  it("keeps a closing bracket the link itself opened", () => {
    const [segment] = linkify("https://en.wikipedia.org/wiki/Ash(disambiguation)");
    expect(segment.text).toBe(
      "https://en.wikipedia.org/wiki/Ash(disambiguation)",
    );
  });

  it("drops a closing bracket that wraps the link", () => {
    const segments = linkify("(https://lor.dev)");
    expect(segments.map((s) => s.text)).toEqual(["(", "https://lor.dev", ")"]);
  });

  it("refuses a scheme that is not http or https", () => {
    for (const text of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "vbscript:msgbox(1)",
    ]) {
      expect(linkify(text).every((segment) => !segment.href)).toBe(true);
    }
  });

  it("does not treat a bare domain as a link", () => {
    // Deliberate: guessing a scheme for "lor.dev" also guesses one for
    // "e.g" and for the end of every sentence with no space after the dot.
    expect(linkify("go to lor.dev")).toEqual([{ text: "go to lor.dev" }]);
  });

  it("marks up nothing — a link is a segment, not markup", () => {
    const segments = linkify('https://lor.dev/<img src=x onerror="alert(1)">');
    expect(segments.every((segment) => typeof segment.text === "string")).toBe(true);
  });
});
