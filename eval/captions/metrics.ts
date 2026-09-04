/**
 * How a caption is judged.
 *
 * Word error rate on its own is the wrong instrument for this problem, and
 * quietly so. A model that writes every English word in Arabic script —
 * "ديبلوي" for "deploy" — can score a *better* WER than one that keeps them in
 * Latin, because Arabic morphology is forgiving and the transliteration is
 * often one edit away from something plausible. Optimising for WER alone would
 * therefore drive this product towards exactly the failure it exists to avoid.
 *
 * So there are three numbers, and the third is the one that decides:
 *
 *   WER   how much of the sentence is wrong
 *   CER   the same, forgiving of morphology
 *   CSP   how much of the English survived as English
 *
 * A change that lowers WER while lowering CSP is a regression.
 */

/** Combining marks: fatha through sukun, plus the superscript alef. */
const DIACRITICS = /[ً-ْٰ]/g;

/** A stretch character with no phonetic value. */
const TATWEEL = /ـ/g;

const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;

/**
 * Punctuation with an Arabic form and a Latin one that mean the same thing.
 *
 * A transcript that ends in `؟` and a reference that ends in `?` are the same
 * sentence, and counting that as an error would bury real ones.
 */
const PUNCTUATION: Record<string, string> = {
  "؟": "?", // ARABIC QUESTION MARK
  "،": ",", // ARABIC COMMA
  "؛": ";", // ARABIC SEMICOLON
  "٪": "%", // ARABIC PERCENT SIGN
  "٫": ".", // ARABIC DECIMAL SEPARATOR
  "‐": "-",
  "–": "-",
  "—": "-",
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "«": '"',
  "»": '"',
};

/**
 * Letters a reader does not distinguish, written inconsistently by everybody.
 *
 * Egyptian writing uses `ى` and `ي` interchangeably at the end of a word, and
 * `ة` and `ه` likewise. Counting those as errors would mean a transcript is
 * penalised for matching how people actually write, which tells us nothing
 * about the engine.
 */
const LETTERS: Record<string, string> = {
  "أ": "ا", // أ
  "إ": "ا", // إ
  "آ": "ا", // آ
  "ٱ": "ا", // ٱ
  "ى": "ي", // ى
  "ة": "ه", // ة
};

/**
 * Put a line into the form both sides are compared in.
 *
 * Every rule here is a claim that two spellings mean the same thing to a
 * reader. That is why they are listed rather than folded into a regular
 * expression — each one is arguable, and each one has a test.
 */
export function normalise(text: string): string {
  let out = text.normalize("NFC");

  out = out.replace(DIACRITICS, "").replace(TATWEEL, "");

  out = [...out]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;

      // Digits are digits. A transcript that writes ٣ where the reference
      // writes 3 has not made a mistake.
      if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
        return String(code - ARABIC_INDIC_ZERO);
      }
      if (
        code >= EXTENDED_ARABIC_INDIC_ZERO &&
        code <= EXTENDED_ARABIC_INDIC_ZERO + 9
      ) {
        return String(code - EXTENDED_ARABIC_INDIC_ZERO);
      }

      return PUNCTUATION[character] ?? LETTERS[character] ?? character;
    })
    .join("");

  // Case matters in neither script, and only one of them has it.
  return out.toLowerCase().replace(/\s+/gu, " ").trim();
}

/** Punctuation is not a word. Compared separately, never as a token. */
const PUNCTUATION_ONLY = /^[^\p{L}\p{N}]+$/u;

export function tokenise(text: string): string[] {
  return normalise(text)
    .split(" ")
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((token) => token.length > 0 && !PUNCTUATION_ONLY.test(token));
}

/** Levenshtein distance, over anything comparable by identity. */
function editDistance<T>(a: readonly T[], b: readonly T[]): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // One row at a time: these are sentences, but a long meeting is many of them
  // and the full matrix buys nothing.
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1, // deletion
        current[j - 1] + 1, // insertion
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), // substitution
      );
    }
    previous = current;
  }

  return previous[b.length];
}

export interface Score {
  /** Word error rate. 0 is perfect; above 1 is possible with many insertions. */
  wer: number;
  /** Character error rate. More forgiving of Arabic morphology. */
  cer: number;
  /**
   * Code-switch preservation: the share of the reference's Latin-script words
   * that are still in Latin script in the hypothesis.
   *
   * `null` when the reference has no Latin words at all. Reporting 100% there
   * would let a corpus of pure Arabic hide a model that transliterates
   * everything.
   */
  codeSwitchPreservation: number | null;
  /** How many Latin words the reference had, so a rate can be weighed. */
  latinWords: number;
}

/** Whether a token is English-as-written rather than English-as-heard. */
function isLatin(token: string): boolean {
  return /\p{Script=Latin}/u.test(token);
}

export function score(reference: string, hypothesis: string): Score {
  const referenceWords = tokenise(reference);
  const hypothesisWords = tokenise(hypothesis);

  const wer =
    referenceWords.length === 0
      ? hypothesisWords.length === 0
        ? 0
        : 1
      : editDistance(referenceWords, hypothesisWords) / referenceWords.length;

  const referenceCharacters = [...normalise(reference)];
  const hypothesisCharacters = [...normalise(hypothesis)];

  const cer =
    referenceCharacters.length === 0
      ? hypothesisCharacters.length === 0
        ? 0
        : 1
      : editDistance(referenceCharacters, hypothesisCharacters) /
        referenceCharacters.length;

  return {
    wer,
    cer,
    ...codeSwitch(referenceWords, hypothesisWords),
  };
}

/**
 * Count how many of the reference's Latin words survived.
 *
 * Matched as a multiset rather than by position: word order changes for all
 * sorts of innocent reasons, and the question being asked is only whether the
 * term is still there in the script it was said in. Each occurrence is matched
 * once, so a hypothesis cannot score by repeating one word.
 */
function codeSwitch(
  reference: readonly string[],
  hypothesis: readonly string[],
): Pick<Score, "codeSwitchPreservation" | "latinWords"> {
  const wanted = reference.filter(isLatin);
  if (wanted.length === 0) {
    return { codeSwitchPreservation: null, latinWords: 0 };
  }

  const available = new Map<string, number>();
  for (const token of hypothesis.filter(isLatin)) {
    available.set(token, (available.get(token) ?? 0) + 1);
  }

  let kept = 0;
  for (const token of wanted) {
    const remaining = available.get(token) ?? 0;
    if (remaining > 0) {
      available.set(token, remaining - 1);
      kept++;
    }
  }

  return {
    codeSwitchPreservation: kept / wanted.length,
    latinWords: wanted.length,
  };
}

/**
 * Average a set of scores.
 *
 * WER and CER are weighted by reference length, and preservation by how many
 * Latin words a case had. A corpus averaged per case would let one four-word
 * utterance count as much as a two-minute one.
 */
export function summarise(
  scores: readonly { score: Score; referenceWords: number; referenceCharacters: number }[],
): Score {
  const totals = scores.reduce(
    (acc, entry) => ({
      werWeight: acc.werWeight + entry.referenceWords,
      wer: acc.wer + entry.score.wer * entry.referenceWords,
      cerWeight: acc.cerWeight + entry.referenceCharacters,
      cer: acc.cer + entry.score.cer * entry.referenceCharacters,
      latin: acc.latin + entry.score.latinWords,
      kept:
        acc.kept +
        (entry.score.codeSwitchPreservation ?? 0) * entry.score.latinWords,
    }),
    { werWeight: 0, wer: 0, cerWeight: 0, cer: 0, latin: 0, kept: 0 },
  );

  return {
    wer: totals.werWeight === 0 ? 0 : totals.wer / totals.werWeight,
    cer: totals.cerWeight === 0 ? 0 : totals.cer / totals.cerWeight,
    codeSwitchPreservation:
      totals.latin === 0 ? null : totals.kept / totals.latin,
    latinWords: totals.latin,
  };
}
