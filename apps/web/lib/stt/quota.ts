/**
 * How much free transcription there is, and who has used it.
 *
 * The operator's key is a real bill. Without a ceiling, one meeting left
 * running overnight spends it and the next person gets an error they cannot act
 * on. So there are three ceilings, because they fail in three different ways:
 *
 *   user    one person cannot spend everybody's
 *   room    one meeting is bounded, however many people are in it
 *   global  a runaway cannot spend the operator's, whatever it is
 *
 * The interesting half is not the ceiling, it is the moment it is reached.
 * "Quota exceeded" is a dead end; "captions have used today's free allowance —
 * add your own key and carry on" is the same fact with a way out. That is why
 * `remaining` comes back on every successful call and not only on the last one:
 * a room warned at eighty per cent can do something about it, and a room told
 * at a hundred cannot.
 *
 * Measured in **seconds of audio**, not requests. A twenty-second utterance and
 * a one-second one are the same request and twenty times the cost, and a
 * per-request limit prices them identically.
 *
 * Nobody using their own key is counted at all. They are paying.
 */

export type QuotaScope = "user" | "room" | "global";

export interface QuotaLimit {
  scope: QuotaScope;
  /** Seconds of audio per day. */
  seconds: number;
}

/**
 * Fifteen minutes a person, an hour a room, and five hours across the server.
 *
 * Fifteen minutes is a real meeting's worth of one person actually talking —
 * most of a call, for most people, is listening. The room ceiling is four times
 * that rather than the sum of everyone in it, because a meeting where six
 * people each talk for fifteen minutes is ninety minutes long and is not the
 * case this is sized for.
 *
 * All three are meant to be raised by an operator who is paying attention, and
 * `.env.example` documents them. The defaults are what a free tier survives.
 */
export const DEFAULT_QUOTA: Record<QuotaScope, number> = {
  user: 900,
  room: 3600,
  global: 18_000,
};

const ENV_KEY: Record<QuotaScope, string> = {
  user: "LOR_FREE_STT_SECONDS_PER_USER_PER_DAY",
  room: "LOR_FREE_STT_SECONDS_PER_ROOM_PER_DAY",
  global: "LOR_FREE_STT_SECONDS_GLOBAL_PER_DAY",
};

/**
 * The ceilings in force, in the order they should be checked.
 *
 * Narrowest first, so the message names the limit the caller can actually do
 * something about: being told the server is out when it is your own fifteen
 * minutes that ran out sends you to the wrong place.
 *
 * A value of `0` is a ceiling of nothing, not the absence of a ceiling: no free
 * transcription at that scope, so everybody brings their own key. That is what
 * `.env.example` has promised since `v0.0` — *"set to 0 to disable your key
 * entirely and require BYOK"* — and the first implementation of this file did
 * the opposite, dropping the ceiling and handing the operator's key out with no
 * limit at all. Wrong in the worst direction, and wrong exactly when somebody
 * set it deliberately.
 *
 * There is no value meaning "unlimited". An operator who does not want
 * rationing sets a large number; a second magic number is how the first one
 * went unnoticed.
 */
export function quotaLimits(
  env: Record<string, string | undefined>,
): QuotaLimit[] {
  const scopes: QuotaScope[] = ["user", "room", "global"];

  return scopes.map((scope) => ({
    scope,
    seconds: configured(env[ENV_KEY[scope]], scope),
  }));
}

function configured(value: string | undefined, scope: QuotaScope): number {
  if (value === undefined || value.trim() === "") return DEFAULT_QUOTA[scope];

  const parsed = Number(value);
  // A typo must not be read as a deliberate setting in either direction — it
  // would either remove the ceiling or refuse everybody, and both are worse
  // than the default.
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_QUOTA[scope];

  return Math.floor(parsed);
}

/** What is left, and how close that is to nothing. */
export interface QuotaState {
  scope: QuotaScope;
  limit: number;
  remaining: number;
}

/**
 * The fraction of an allowance at which a room should be told.
 *
 * Late enough not to nag, early enough that somebody can fetch a key before the
 * captions stop mid-meeting.
 */
export const WARN_AT = 0.2;

export function shouldWarn(state: QuotaState): boolean {
  return state.limit > 0 && state.remaining / state.limit <= WARN_AT;
}

/** The one to report: whatever has least left, as a share of its own ceiling. */
export function tightest(states: readonly QuotaState[]): QuotaState | null {
  if (states.length === 0) return null;

  return states.reduce((worst, state) =>
    state.remaining / state.limit < worst.remaining / worst.limit ? state : worst,
  );
}
