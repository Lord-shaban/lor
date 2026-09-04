import { MAX_PROMPT_LENGTH } from "./request";

/**
 * Telling the model, before it hears anything, what kind of sentence to expect.
 *
 * Whisper's failure on Egyptian Arabic with English terms in it is not random.
 * It does one of two specific things, and both are worth naming because the
 * countermeasure is the same:
 *
 *   transliterates   "ديبلوي" for "deploy", "سيرفر" for "server"
 *   translates       an English sentence for an Arabic one, or the reverse
 *
 * The `prompt` field is not an instruction — it is prior context, decoded as
 * though it were the audio that came just before. So it works by *example*,
 * not by direction. "Keep English words in Latin script" is a sentence about
 * transcription and primes nothing; a sentence that already keeps English words
 * in Latin script makes that the likely continuation. This is the difference
 * between the two, and it is why the constant below is a piece of Egyptian
 * office speech rather than a rule.
 *
 * It is also the cheapest countermeasure available. It costs one field.
 */

/**
 * The shape, in one sentence.
 *
 * Egyptian, colloquial, and carrying the English technical vocabulary in Latin
 * script exactly as somebody would type it — because that is the output being
 * asked for. Changing this is a captions change and needs numbers.
 */
const SHAPE =
  "عملت الـ deploy على الـ staging server وشوفت الـ logs، فيه error في الـ build " +
  "بس الـ tests كلها passed.";

/** Introduces the room's own vocabulary as more of the same context. */
const GLOSSARY_LEAD = "المصطلحات المستخدمة:";

/**
 * How many terms are worth sending.
 *
 * Whisper reads roughly the last 224 tokens of the prompt and silently drops
 * the rest — from the *front*. So a glossary long enough to push `SHAPE` out of
 * the window does not prime harder, it primes less, and the thing it stops
 * priming is the one that mattered. `MAX_PROMPT_LENGTH` is the hard stop;
 * this is the point at which more terms stop helping.
 */
export const MAX_GLOSSARY_TERMS = 24;

/** A term is a word or a short phrase, not a sentence somebody pasted. */
export const MAX_TERM_LENGTH = 40;

/**
 * Build the prompt for a room.
 *
 * `glossary` arrives most-important-first — most recent, or most frequent. What
 * survives truncation is the head of that list, so the ordering the caller
 * chooses is the ordering that matters.
 */
export function buildPrompt(glossary: readonly string[] = []): string {
  const terms = cleanGlossary(glossary);
  if (terms.length === 0) return SHAPE;

  // The shape goes last. It is the closest context to the audio, and it is the
  // part that must not be the thing pushed out of the window.
  const prompt = `${GLOSSARY_LEAD} ${terms.join("، ")}. ${SHAPE}`;

  if (prompt.length <= MAX_PROMPT_LENGTH) return prompt;

  // Drop terms rather than characters. Cutting mid-prompt would leave a
  // half-written term as the model's example of how this room writes.
  return buildPrompt(terms.slice(0, -1));
}

/**
 * Keep terms that are terms.
 *
 * Duplicates are dropped case-insensitively, because "Vercel" and "vercel" are
 * one term to a reader and two chances to crowd out the shape.
 */
export function cleanGlossary(glossary: readonly string[]): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];

  for (const raw of glossary) {
    const term = raw.trim().replace(/\s+/gu, " ");
    if (!term || term.length > MAX_TERM_LENGTH) continue;

    const key = term.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    terms.push(term);
    if (terms.length === MAX_GLOSSARY_TERMS) break;
  }

  return terms;
}

/** Exported so a test can assert the shape is what is actually sent. */
export const PROMPT_SHAPE = SHAPE;
