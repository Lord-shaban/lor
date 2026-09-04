import "server-only";

/**
 * A handle on one knock, held only by the person who made it.
 *
 * Without it, polling would be "tell me the status of knock #42", and a room
 * full of people waiting could read — and by extension watch the host decide on
 * — each other's requests. The claim is what makes a knock private to the
 * person who knocked.
 *
 * Same shape as the host cookie for the same reason: only the hash reaches the
 * database, so a leaked dump hands over nothing usable.
 */

const SECRET_BYTES = 32;

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compare without leaking where two values first differ.
 *
 * Returning early on a length mismatch is safe: every value compared here is a
 * fixed-length hex digest, so the length carries no secret.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

/** SHA-256 of the secret. The only form of it that is stored. */
export async function hashClaimSecret(secret: string): Promise<string> {
  return toHex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)),
  );
}

export interface KnockClaim {
  /** Store this on the knock row. */
  secretHash: string;
  /** Give this to the visitor. It is never persisted. */
  claim: string;
}

export async function createKnockClaim(): Promise<KnockClaim> {
  const bytes = new Uint8Array(SECRET_BYTES);
  crypto.getRandomValues(bytes);
  const secret = toHex(bytes.buffer);
  return { secretHash: await hashClaimSecret(secret), claim: secret };
}

/**
 * Whether this claim belongs to this knock.
 *
 * A missing claim and a wrong one are the same answer. A caller must not be
 * able to tell "no such knock" from "not yours" — the difference would say
 * whether somebody else is waiting in a room they were refused from.
 */
export async function verifyKnockClaim(
  claim: string | undefined,
  storedSecretHash: string,
): Promise<boolean> {
  if (!claim || typeof claim !== "string") return false;
  return timingSafeEqual(await hashClaimSecret(claim), storedSecretHash);
}
