/**
 * Where a key comes from, and what it costs.
 *
 * This is the page's whole value, so it is data rather than prose: the same
 * facts render in both languages, and updating one of them is editing one line
 * rather than hunting through two translations for a number that moved.
 *
 * **Every field here was read from the provider's own documentation on the date
 * in `checkedOn`, not recalled.** Free tiers change more often than anything
 * else in this file, and a page that confidently states a limit which was true
 * last year is worse than no page — somebody plans a meeting around it.
 *
 * When a number is not in the provider's docs, the field says so rather than
 * guessing. "Not stated" is a useful answer; an invented one is not.
 *
 * No affiliate or referral links, ever. The moment a recommendation pays us it
 * stops being a recommendation, and this page exists to be trusted.
 */

export interface Allowance {
  /** Seconds of audio, or `null` when the provider documents no free tier. */
  secondsPerDay: number | null;
  /** The tighter constraint during a long meeting, when it is published. */
  secondsPerHour: number | null;
  requestsPerMinute: number | null;
}

export type CardRequirement =
  /** Documented as not needed to sign up and use the free tier. */
  | "no"
  /** Documented as needed before the API can be used at all. */
  | "yes"
  /** The provider's documentation does not say. We are not guessing. */
  | "unstated";

export interface ProviderGuide {
  id: string;
  free: Allowance | null;
  card: CardRequirement;
  /** What it costs once the free tier is gone, in the provider's own units. */
  paidPerMinuteUsd: number | null;
  /** Deep link into their console, not a marketing page. */
  keysUrl: string;
  /** The page the numbers came from, so anybody can check them. */
  sourceUrl: string;
  /** ISO date the numbers above were read from that page. */
  checkedOn: string;
  /**
   * Whether anybody has actually tried calling this provider from a browser.
   *
   * Separate from `browserDirect` on the provider, which is a boolean and
   * therefore cannot tell "measured, and it refuses" from "nobody has looked".
   * The page says which, because telling somebody a company refuses browser
   * requests when that was never tested is a claim about them we cannot make.
   */
  directTested: boolean;
}

export const GUIDE: ProviderGuide[] = [
  {
    id: "groq",
    free: {
      // 28,800 audio-seconds a day is eight hours; 7,200 an hour is two. The
      // hourly figure is the one a long meeting meets first.
      secondsPerDay: 28_800,
      secondsPerHour: 7_200,
      requestsPerMinute: 20,
    },
    card: "no",
    paidPerMinuteUsd: null,
    keysUrl: "https://console.groq.com/keys",
    sourceUrl: "https://console.groq.com/docs/rate-limits",
    checkedOn: "2026-09-05",
    // A real transcription POST from an unrelated page origin, answered 200.
    directTested: true,
  },
  {
    id: "openai",
    // Their pricing documentation lists no free tier for the API. Not "we could
    // not find one" — it lists paid rates only.
    free: null,
    card: "unstated",
    paidPerMinuteUsd: 0.006,
    keysUrl: "https://platform.openai.com/api-keys",
    sourceUrl: "https://developers.openai.com/api/docs/pricing",
    checkedOn: "2026-09-05",
    // No OpenAI key here to try it with. The proxy path works regardless.
    directTested: false,
  },
];

/** Whole hours when it divides evenly, so the page can say "8 hours". */
export function hours(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10;
}
