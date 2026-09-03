import "server-only";

/**
 * Proof that you created a room, with no account behind it.
 *
 * Two independent checks have to pass, and they exist for different reasons:
 *
 * 1. **The signature**, over the room code and the secret together. This binds
 *    a credential to one room and rejects anything malformed without touching
 *    the database, so a flood of junk cookies costs a hash rather than a query.
 * 2. **The stored hash**, compared against the database. This is what makes
 *    revocation possible: handing the room to someone else rotates the stored
 *    hash, and the previous host's cookie stops working immediately even though
 *    its signature is still perfectly valid.
 *
 * Only the hash is stored, so a database leak hands over no host rights.
 */

const SECRET_BYTES = 32;

/** Thirty days. Long enough for a recurring meeting, short enough to expire. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function requireSigningKey(): string {
  const key = process.env.LOR_HOST_COOKIE_SECRET;
  if (!key) {
    throw new Error(
      "LOR_HOST_COOKIE_SECRET is not set. Generate one with:\n" +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return key;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compare without leaking where two values first differ.
 *
 * Returning early on a length mismatch is safe here: every value compared is a
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

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(requireSigningKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
  );
}

/** SHA-256 of the secret. The only form of it that reaches the database. */
export async function hashHostSecret(secret: string): Promise<string> {
  return toHex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)),
  );
}

export interface HostCredential {
  /** Store this on the room row. The secret itself is never persisted. */
  secretHash: string;
  /** Put this in the cookie. */
  cookieValue: string;
}

/** Mint a fresh host credential for a room. */
export async function createHostCredential(
  roomCode: string,
): Promise<HostCredential> {
  const bytes = new Uint8Array(SECRET_BYTES);
  crypto.getRandomValues(bytes);
  const secret = toHex(bytes.buffer);

  const payload = `${roomCode}.${secret}`;
  const signature = await sign(payload);

  return {
    secretHash: await hashHostSecret(secret),
    cookieValue: `${payload}.${signature}`,
  };
}

/**
 * Whether this cookie proves host rights over this room.
 *
 * Every failure returns the same `false` — a caller must not be able to tell a
 * bad signature from a revoked credential from the wrong room.
 */
export async function verifyHostCookie(
  cookieValue: string | undefined,
  roomCode: string,
  storedSecretHash: string,
): Promise<boolean> {
  if (!cookieValue) return false;

  const parts = cookieValue.split(".");
  if (parts.length !== 3) return false;
  const [cookieRoomCode, secret, signature] = parts;

  // A cookie minted for another room is worthless here, and this is checked
  // before any hashing so a wrong-room cookie is cheap to reject.
  if (cookieRoomCode !== roomCode) return false;

  const expectedSignature = await sign(`${cookieRoomCode}.${secret}`);
  if (!timingSafeEqual(signature, expectedSignature)) return false;

  // The database is the authority on whether this credential is still current.
  // A handover rotates the stored hash and this is where the old cookie dies.
  return timingSafeEqual(await hashHostSecret(secret), storedSecretHash);
}

/**
 * One cookie per room, so hosting two rooms at once works.
 *
 * A single shared cookie would silently drop host rights over the first room
 * the moment you created a second.
 */
export function hostCookieName(roomCode: string): string {
  return `lor_host_${roomCode}`;
}

export function hostCookieOptions() {
  return {
    httpOnly: true,
    // Lax, not Strict: someone opening their own invitation link from a chat
    // app arrives via a cross-site navigation and should still be the host.
    sameSite: "lax" as const,
    // Off on localhost, where there is no HTTPS to attach it to.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}
