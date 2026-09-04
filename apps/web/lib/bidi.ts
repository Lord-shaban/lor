/**
 * Which way a line of mixed Arabic and English should be laid out.
 *
 * This started as the fifth `<bdi>` fix in this repository — an isolate around
 * every Latin run in a caption — and the measurement said that was the wrong
 * repair. Rendered in a browser and read back character by character, twenty
 * four mixed lines came out identically with and without the isolates. What
 * changed four of them was the paragraph's direction:
 *
 *   direction changed 4 of 24;  isolates changed a further 0
 *
 * Which makes sense in hindsight. The Unicode algorithm already resolves a
 * neutral between two Latin words to Latin, so "npm run build" and "CI/CD" hold
 * together on their own. What it cannot do is know what a line is *for*. It is
 * told the paragraph direction, and everything else follows from that.
 *
 * `dir="auto"` takes the paragraph direction from the first strong character,
 * which is wrong here twice over. An Arabic sentence that opens with an English
 * term — "Deploy خلص على الـ server." — lays out left to right and puts the
 * full stop at the wrong end. And a caption arrives a few words at a time, so
 * the first strong character is whatever the engine emitted first: the line
 * would flip direction under the reader's eyes, mid-sentence, while they are
 * also listening.
 *
 * So the direction is counted instead, and the caller says what to do with a
 * tie. Isolates are still right for a foreign run sitting inside *interface*
 * text — a speaker's name in front of a caption, `(you)` after a sender — but
 * that is a different rule, stated in CLAUDE.md, and it does not apply to a
 * line that is nothing but what somebody said.
 */

export type Direction = "ltr" | "rtl";

/** A letter, of any script. Only letters carry a direction of their own. */
const LETTER = /\p{L}/u;

/**
 * Of those, the ones written right to left.
 *
 * `Script_Extensions` rather than `Script`. The tatweel — the stretch character
 * in "الـ" — is `Script=Common`, because it is shared by every Arabic-script
 * language rather than owned by Arabic, and the narrower property therefore
 * classifies it as a left-to-right letter. Counting by word hides that here,
 * since a word takes the script of its first letter, but the classification is
 * wrong either way and anything else reading it would inherit the mistake.
 */
const RTL_SCRIPT =
  /[\p{Script_Extensions=Arabic}\p{Script_Extensions=Hebrew}\p{Script_Extensions=Syriac}\p{Script_Extensions=Thaana}]/u;

type Class = "ltr" | "rtl" | "neutral";

/**
 * Letters first, deliberately.
 *
 * An Arabic-Indic digit — ٣ — is `Script=Arabic`, but a digit is weak in the
 * bidi algorithm and takes its direction from what surrounds it. Testing the
 * script before the category would make "٣ servers" look like an Arabic line
 * with one English word in it, which is the opposite of what it is.
 */
function classify(character: string): Class {
  if (!LETTER.test(character)) return "neutral";
  return RTL_SCRIPT.test(character) ? "rtl" : "ltr";
}

/**
 * Things that are one unit even though they contain several words.
 *
 * A link is not six English words, and a list of names in brackets is not an
 * argument about what language the sentence around it is in. Both were counting
 * as several votes each and both turned an Arabic message into an English one —
 * found by measuring the rendered order, not by reading this file:
 *
 *   شوف https://lor.dev/mza-krf-tqn وقولي رأيك.      counted 6 English, 3 Arabic
 *   الفريق (Ahmed, Sara, Omar) خلصوا الـ sprint.     counted 4 English, 3 Arabic
 *
 * A citation counts once, in whatever script it is mostly written.
 */
const CITATION = /https?:\/\/\S+|\([^)]*\)|\[[^\]]*\]|«[^»]*»|"[^"]*"|“[^”]*”/gu;

/** How many whole words of each script a stretch of text holds. */
function countWords(text: string): { rtl: number; ltr: number } {
  let rtl = 0;
  let ltr = 0;

  // A word is a run of letters; the script of its first letter names it. A word
  // mixing scripts is a transliteration artefact, not a word in two languages.
  let current: Class = "neutral";
  for (const character of text) {
    const kind = classify(character);
    if (kind === "neutral") {
      current = "neutral";
      continue;
    }
    if (current === "neutral") {
      if (kind === "rtl") rtl++;
      else ltr++;
      current = kind;
    }
  }

  return { rtl, ltr };
}

/**
 * Which way to lay a line out.
 *
 * Whichever script most of its *words* are in, with `fallback` breaking a tie.
 *
 * Words rather than letters, because letters answer a different question.
 * "Deploy خلص على الـ server" has twelve Latin letters and nine Arabic ones and
 * is plainly an Arabic sentence — English technical terms are long and the
 * Arabic around them is short, so counting characters quietly hands every
 * code-switched line to English.
 *
 * Pass the locale's direction as the fallback for a line that is finished. For
 * a caption still being spoken, pass the direction the line already had: a tie
 * is where a half-arrived sentence spends much of its life, and holding it
 * there is what stops the line settling twice.
 */
export function lineDirection(text: string, fallback: Direction): Direction {
  let rtl = 0;
  let ltr = 0;

  const rest = text.replace(CITATION, (span) => {
    const inner = countWords(span);
    if (inner.rtl > inner.ltr) rtl++;
    else if (inner.ltr > inner.rtl) ltr++;
    // A space, so the words either side of the citation stay separate.
    return " ";
  });

  const outer = countWords(rest);
  rtl += outer.rtl;
  ltr += outer.ltr;

  if (rtl > ltr) return "rtl";
  if (ltr > rtl) return "ltr";
  return fallback;
}
