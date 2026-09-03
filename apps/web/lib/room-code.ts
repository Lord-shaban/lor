/**
 * Room codes.
 *
 * A code gets read aloud over a bad phone line and typed with a thumb on a
 * phone keyboard. That constrains the alphabet far more than randomness does,
 * which is why this is not just `nanoid()`.
 */

/**
 * Lowercase letters with the shapes that get misread removed: `i` and `l` are
 * a vertical stroke in most sans faces, and `o` is a zero. Digits are excluded
 * entirely rather than filtered — mixing them back in reintroduces exactly the
 * confusions this alphabet exists to avoid.
 *
 * 23 letters over 10 positions is about 4.1 × 10¹³ codes, so collisions are
 * rare enough that a single retry is generous.
 */
export const ALPHABET = "abcdefghjkmnpqrstuvwxyz";

/** Letters per dash-separated group, e.g. `mza-krfq-tqn`. */
const GROUPS = [3, 4, 3] as const;

export const CODE_LENGTH = GROUPS.reduce((sum, n) => sum + n, 0);

/** Matches a fully normalised code and nothing else. */
export const CODE_PATTERN = new RegExp(
  `^[${ALPHABET}]{${GROUPS[0]}}-[${ALPHABET}]{${GROUPS[1]}}-[${ALPHABET}]{${GROUPS[2]}}$`,
);

/** Insert the dashes into a bare run of letters. */
function group(letters: string): string {
  const parts: string[] = [];
  let offset = 0;
  for (const size of GROUPS) {
    parts.push(letters.slice(offset, offset + size));
    offset += size;
  }
  return parts.join("-");
}

/**
 * A fresh code. Uses the platform CSPRNG rather than `Math.random`: a guessable
 * code is a way into somebody else's meeting.
 *
 * Rejection sampling keeps the distribution flat. `% ALPHABET.length` would
 * favour the first few letters, because 256 is not a multiple of 23.
 */
export function generateRoomCode(): string {
  const letters: string[] = [];
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;

  while (letters.length < CODE_LENGTH) {
    const bytes = new Uint8Array(CODE_LENGTH);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= limit) continue;
      letters.push(ALPHABET[byte % ALPHABET.length]);
      if (letters.length === CODE_LENGTH) break;
    }
  }

  return group(letters.join(""));
}

/**
 * Turn whatever someone actually pasted into a canonical code, or `null` if it
 * cannot be one.
 *
 * People paste the whole invitation URL, type without dashes, use a mobile
 * keyboard that capitalises the first letter, and copy a trailing space. All of
 * those are the same room, and rejecting them would be a self-inflicted support
 * problem.
 */
export function normalizeRoomCode(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;

  // A pasted link: take the last non-empty path segment. Done before stripping
  // punctuation so a query string or hash cannot leak letters into the code.
  if (value.includes("/")) {
    const withoutQuery = value.split(/[?#]/, 1)[0];
    const segments = withoutQuery.split("/").filter(Boolean);
    value = segments.at(-1) ?? "";
  }

  // Drop every separator, then regroup. This accepts "mzakrfqtqn",
  // "mza krfq tqn" and "mza–krfq–tqn" with an en dash.
  const letters = value.replace(/[^a-z]/g, "");
  if (letters.length !== CODE_LENGTH) return null;

  // A letter outside the alphabet means a misread, not a valid code: silently
  // mapping `l` to `1` or `o` to `0` would send someone to the wrong room.
  for (const letter of letters) {
    if (!ALPHABET.includes(letter)) return null;
  }

  return group(letters);
}

/** Whether a string is already a canonical code. */
export function isRoomCode(value: string): boolean {
  return CODE_PATTERN.test(value);
}

/**
 * A code that is not already taken.
 *
 * Uniqueness cannot be decided here — it depends on the database — so the
 * caller passes the check. That keeps this file free of any data layer and
 * makes the retry behaviour testable without one.
 *
 * At 23¹⁰ codes a collision is vanishingly unlikely, so the retries exist to
 * survive a freak coincidence, not as a routine path. Exhausting them means
 * something else is wrong — a broken check, or a table far larger than the
 * keyspace — and that deserves a loud failure rather than a duplicate code.
 */
export async function generateUniqueRoomCode(
  isTaken: (code: string) => Promise<boolean>,
  attempts = 5,
): Promise<string> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const code = generateRoomCode();
    if (!(await isTaken(code))) return code;
  }

  throw new Error(
    `Could not find an unused room code in ${attempts} attempts. ` +
      "With a 23^10 keyspace this should be impossible; check that the " +
      "collision lookup is working.",
  );
}
