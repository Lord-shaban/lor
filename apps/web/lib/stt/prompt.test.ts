import { describe, expect, it } from "vitest";
import {
  MAX_GLOSSARY_TERMS,
  MAX_TERM_LENGTH,
  PROMPT_SHAPE,
  buildPrompt,
  cleanGlossary,
} from "./prompt";
import { MAX_PROMPT_LENGTH } from "./request";

describe("buildPrompt", () => {
  it("demonstrates code-switching rather than describing it", () => {
    // The prompt is prior context, decoded as though it were the audio just
    // before. An instruction primes nothing; a sentence that already does the
    // thing makes that the likely continuation.
    const prompt = buildPrompt();

    expect(prompt).toContain("deploy");
    expect(prompt).toContain("server");
    expect(prompt).toContain("logs");
    expect(prompt).toMatch(/[؀-ۿ]/); // and Arabic around them
  });

  it("has a shape even with nothing else to say", () => {
    expect(buildPrompt()).toBe(PROMPT_SHAPE);
    expect(buildPrompt([])).toBe(PROMPT_SHAPE);
  });

  it("puts the room's terms in front of the shape, not after it", () => {
    // Whisper reads the last ~224 tokens and drops the front. Whatever goes
    // last is what survives, and the thing that must survive is the shape.
    const prompt = buildPrompt(["Vercel", "Supabase"]);

    expect(prompt).toContain("Vercel");
    expect(prompt.indexOf("Vercel")).toBeLessThan(prompt.indexOf(PROMPT_SHAPE));
    expect(prompt.endsWith(PROMPT_SHAPE)).toBe(true);
  });

  it("keeps the shape when the glossary is too long to fit", () => {
    // Dropping terms, not characters: a prompt cut mid-word leaves half a term
    // as this room's example of how it writes.
    const huge = Array.from({ length: 60 }, (_, i) => `TermNumber${i}Something`);
    const prompt = buildPrompt(huge);

    expect(prompt.length).toBeLessThanOrEqual(MAX_PROMPT_LENGTH);
    expect(prompt.endsWith(PROMPT_SHAPE)).toBe(true);
    expect(prompt).not.toMatch(/TermNumber\d+Som(?:e|et|eth|ethi)?،/);
  });

  it("is within the cap for any glossary at all", () => {
    for (const size of [1, 10, MAX_GLOSSARY_TERMS, 500]) {
      const glossary = Array.from({ length: size }, () => "x".repeat(MAX_TERM_LENGTH));
      expect(buildPrompt(glossary).length).toBeLessThanOrEqual(MAX_PROMPT_LENGTH);
    }
  });
});

describe("cleanGlossary", () => {
  it("keeps the head of the list, because the caller ordered it", () => {
    const many = Array.from({ length: MAX_GLOSSARY_TERMS + 10 }, (_, i) => `t${i}`);
    const kept = cleanGlossary(many);

    expect(kept).toHaveLength(MAX_GLOSSARY_TERMS);
    expect(kept[0]).toBe("t0");
  });

  it("drops a duplicate however it was capitalised", () => {
    // "Vercel" and "vercel" are one term to a reader and two chances to crowd
    // out the shape.
    expect(cleanGlossary(["Vercel", "vercel", "VERCEL", "Supabase"])).toEqual([
      "Vercel",
      "Supabase",
    ]);
  });

  it("keeps the first spelling, not the last", () => {
    expect(cleanGlossary(["Supabase", "supabase"])).toEqual(["Supabase"]);
  });

  it("tidies whitespace without altering a term", () => {
    expect(cleanGlossary(["  next   js  "])).toEqual(["next js"]);
  });

  it("drops empty terms and sentences somebody pasted", () => {
    const essay = "a".repeat(MAX_TERM_LENGTH + 1);
    expect(cleanGlossary(["", "   ", essay, "Groq"])).toEqual(["Groq"]);
  });

  it("keeps Arabic terms, which are terms too", () => {
    // A room glossary is not an English-only list: a product name in Arabic is
    // just as likely to be misheard.
    expect(cleanGlossary(["مِنَصّة سَحَاب", "Vercel"])).toEqual([
      "مِنَصّة سَحَاب",
      "Vercel",
    ]);
  });
});
