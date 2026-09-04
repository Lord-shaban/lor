/**
 * Folding the spellings of an Arabic word that a reader does not distinguish.
 *
 * A model asked for the same word twice will not spell it the same way twice.
 * "ديبلوي" and "ديبلوى" are one word to anybody reading them, and a correction
 * somebody made once has to survive the model's next several attempts at the
 * same sound — otherwise they correct it again, and again, and turn captions
 * off.
 *
 * This is deliberately *not* the `normalise` in `eval/captions/metrics.ts`,
 * which is a longer list because it answers a different question. That one is
 * asked "are these two transcripts the same sentence?", so it also folds
 * punctuation, digits and case. This one is asked "are these two words the same
 * word?", where a full stop is not part of the word and folding it would be
 * meaningless. The letter rules below are the overlap, and each one is the claim
 * that Egyptians write both forms interchangeably.
 */

/** Combining marks: fatha through sukun, plus the superscript alef. */
const DIACRITICS = /[ً-ْٰ]/gu;

/** A stretch character with no phonetic value, typed inconsistently. */
const TATWEEL = /ـ/gu;

/**
 * Letters written both ways by everybody.
 *
 * `ى` and `ي` at the end of a word, `ة` and `ه` likewise, and the four alefs.
 * Counting any of these as a different word would mean a correction stops
 * matching the moment the model reaches for the other spelling.
 */
const LETTERS: Record<string, string> = {
  "أ": "ا", // أ
  "إ": "ا", // إ
  "آ": "ا", // آ
  "ٱ": "ا", // ٱ
  "ى": "ي", // ى
  "ة": "ه", // ة
};

/** The form two words are compared in. Never displayed. */
export function foldArabic(text: string): string {
  return [...text.normalize("NFC").replace(DIACRITICS, "").replace(TATWEEL, "")]
    .map((character) => LETTERS[character] ?? character)
    .join("")
    .toLowerCase();
}

/** Whether a word is written in Arabic script at all. */
export function isArabicScript(text: string): boolean {
  return /\p{Script_Extensions=Arabic}/u.test(text) && /\p{L}/u.test(text);
}

/** Whether a word is written in Latin script. */
export function isLatinScript(text: string): boolean {
  return /\p{Script=Latin}/u.test(text);
}
