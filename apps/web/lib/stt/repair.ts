import { foldArabic, isArabicScript, isLatinScript } from "./arabic";

/**
 * Putting back the English a model wrote in Arabic letters.
 *
 * The prompt reduces transliteration; it does not end it. What is left is a
 * small set of terms the model gets wrong the same way every time — *ديبلوي*
 * for *deploy*, *فيرسل* for *Vercel* — and somebody watching the captions can
 * see it happening.
 *
 * Making them correct it once and then watch it happen forty more times is the
 * difference between a feature people use and one they switch off. Their
 * correction is also the best glossary entry available: a real term, from this
 * room, confirmed by somebody who was there.
 *
 * Three rules make this safe enough to run on every line:
 *
 * - **Whole words only.** A substring rule would rewrite the inside of an
 *   unrelated word, and a silent corruption of text somebody is reading aloud
 *   is worse than the transliteration it was fixing.
 * - **One direction only.** Arabic script is replaced by the Latin somebody
 *   typed, never the reverse. The pass exists to undo transliteration, not to
 *   invent it, and a rule pointing the other way would let one correction
 *   translate a whole meeting.
 * - **Spelling-insensitive matching.** A model asked for the same word twice
 *   does not spell it the same way twice, so `ديبلوي` and `ديبلوى` are one key.
 */

export interface Repair {
  /** What the model wrote. Arabic script. */
  from: string;
  /** What it should have been. Latin script. */
  to: string;
}

/** How many a room may keep. Long enough for a project's vocabulary. */
export const MAX_REPAIRS = 40;

/** A term, not a sentence somebody pasted into the wrong box. */
export const MAX_REPAIR_LENGTH = 40;

/**
 * Split a line into words and the punctuation and spacing between them.
 *
 * Kept rather than discarded, because the line is going back on screen exactly
 * as it arrived apart from the words that changed. A repair pass that also
 * quietly renormalises spacing is a repair pass nobody can debug.
 */
const WORDS = /(\p{L}[\p{L}\p{M}\p{N}]*)/gu;

export function applyRepairs(text: string, repairs: readonly Repair[]): string {
  if (!text || repairs.length === 0) return text;

  const table = new Map<string, string>();
  for (const repair of repairs) {
    table.set(foldArabic(repair.from), repair.to);
  }

  return text.replace(WORDS, (word) => table.get(foldArabic(word)) ?? word);
}

/**
 * Keep the corrections that are corrections.
 *
 * Everything here is a reason a stored rule would make captions worse rather
 * than better, so each rejection is cheaper than the bug it prevents.
 */
export function cleanRepairs(repairs: readonly Repair[]): Repair[] {
  const seen = new Set<string>();
  const kept: Repair[] = [];

  for (const raw of repairs) {
    const from = raw?.from?.trim().replace(/\s+/gu, " ");
    const to = raw?.to?.trim().replace(/\s+/gu, " ");
    if (!from || !to) continue;
    if (from.length > MAX_REPAIR_LENGTH || to.length > MAX_REPAIR_LENGTH) continue;

    // One direction. Arabic in, Latin out — a rule the other way round would
    // let a single correction transliterate the rest of the meeting.
    if (!isArabicScript(from) || !isLatinScript(to)) continue;

    // A rule that fires on the word it produces would rewrite its own output on
    // the next line, and there is no reading of that which is wanted.
    if (foldArabic(from) === foldArabic(to)) continue;

    // Only single words. The matcher works word by word, so a two-word `from`
    // would be stored and then never match anything — a rule that silently does
    // nothing is worse than one that is refused.
    if (/\s/u.test(from)) continue;

    const key = foldArabic(from);
    if (seen.has(key)) continue;

    seen.add(key);
    kept.push({ from, to });
    if (kept.length === MAX_REPAIRS) break;
  }

  return kept;
}

/**
 * Read a room's corrections back out of its settings.
 *
 * `jsonb` returns whatever was put in, by this version of the code or another,
 * so everything that reads it has to survive finding a string where it expected
 * an array without taking the room down.
 */
export function readRepairs(settings: unknown): Repair[] {
  if (!settings || typeof settings !== "object") return [];

  const value = (settings as Record<string, unknown>).repairs;
  if (!Array.isArray(value)) return [];

  return cleanRepairs(
    value.filter(
      (entry): entry is Repair =>
        Boolean(entry) &&
        typeof entry === "object" &&
        typeof (entry as Repair).from === "string" &&
        typeof (entry as Repair).to === "string",
    ),
  );
}
