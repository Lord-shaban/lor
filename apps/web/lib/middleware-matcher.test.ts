import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * A regression guard for a one-character bug that silently disabled every room
 * link.
 *
 * Next requires `config.matcher` to be a literal so it can be read at build
 * time, so it cannot be imported from a module and unit-tested directly. This
 * reads it out of the source instead — ugly, but it catches the exact mistake
 * that shipped: writing `"\."` instead of `"\\."`.
 *
 * In a JavaScript string `"\."` is just `"."`, which turns the guard into
 * `.*..*` — "one or more characters" — so every non-empty path is excluded from
 * the middleware. The symptom is that `/` keeps working while `/mza-krfq-tqn`
 * returns 404, which looks like a routing problem rather than an escaping one.
 */

function matcherRegex(): RegExp {
  const source = readFileSync(
    new URL("../middleware.ts", import.meta.url),
    "utf8",
  );

  const match = source.match(/matcher:\s*"([^"]+)"/);
  if (!match) throw new Error("Could not find config.matcher in middleware.ts");

  // The captured text is the source form, with the escaping still doubled. This
  // is what a JavaScript string literal would evaluate to.
  const evaluated = JSON.parse(`"${match[1]}"`);
  return new RegExp(`^${evaluated}$`);
}

describe("the middleware matcher", () => {
  const pattern = matcherRegex();

  it.each([
    ["the home page", "/"],
    ["a room link", "/mza-krfq-tqn"],
    ["a room link under a locale", "/en/mza-krfq-tqn"],
    ["a locale root", "/ar"],
    ["a nested path", "/en/settings/keys"],
  ])("runs on %s", (_label, path) => {
    expect(pattern.test(path)).toBe(true);
  });

  it.each([
    ["API routes", "/api/rooms"],
    ["Next internals", "/_next/static/chunk.js"],
    ["Vercel internals", "/_vercel/insights"],
    ["a file with an extension", "/icon.svg"],
    ["a favicon", "/favicon.ico"],
    // No extension to be caught by the rule above, so it is named explicitly.
    // Without it the manifest's icons were rewritten into a locale and 404'd.
    ["a generated icon", "/icons/192"],
    ["the maskable icon", "/icons/maskable"],
  ])("skips %s", (_label, path) => {
    expect(pattern.test(path)).toBe(false);
  });

  it("is not the broken form that only lets the home page through", () => {
    // The bug this file exists for. `.*..*` matches any single character, so
    // the lookahead rejected every path except "/".
    const broken = new RegExp("^/((?!api|_next|_vercel|.*..*).*)$");
    expect(broken.test("/")).toBe(true);
    expect(broken.test("/mza-krfq-tqn")).toBe(false);

    // The real matcher must not behave that way.
    expect(pattern.test("/mza-krfq-tqn")).toBe(true);
  });
});
