import { beforeEach, describe, expect, it } from "vitest";
import {
  createHostCredential,
  hashHostSecret,
  hostCookieName,
  hostCookieOptions,
  verifyHostCookie,
} from "./host-cookie";

const ROOM = "mza-krfq-tqn";
const OTHER_ROOM = "bcd-efgh-jkm";

beforeEach(() => {
  process.env.LOR_HOST_COOKIE_SECRET = "test-signing-key-not-a-real-secret";
});

describe("createHostCredential", () => {
  it("returns a cookie that verifies against its own hash", async () => {
    const { cookieValue, secretHash } = await createHostCredential(ROOM);
    expect(await verifyHostCookie(cookieValue, ROOM, secretHash)).toBe(true);
  });

  it("never puts the secret in the stored hash", async () => {
    const { cookieValue, secretHash } = await createHostCredential(ROOM);
    const secret = cookieValue.split(".")[1];
    expect(secretHash).not.toBe(secret);
    expect(secretHash).toBe(await hashHostSecret(secret));
  });

  it("mints a different credential every time", async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add((await createHostCredential(ROOM)).cookieValue);
    }
    expect(seen.size).toBe(200);
  });

  it("refuses to run without a signing key", async () => {
    delete process.env.LOR_HOST_COOKIE_SECRET;
    await expect(createHostCredential(ROOM)).rejects.toThrow(
      /LOR_HOST_COOKIE_SECRET/,
    );
  });
});

describe("verifyHostCookie", () => {
  it("rejects a cookie minted for another room", async () => {
    const { cookieValue } = await createHostCredential(OTHER_ROOM);
    const { secretHash } = await createHostCredential(ROOM);
    expect(await verifyHostCookie(cookieValue, ROOM, secretHash)).toBe(false);
  });

  it("rejects a cookie whose room code was swapped by hand", async () => {
    // The signature covers the room code, so relabelling the credential
    // invalidates it even though the secret is genuine.
    const { cookieValue, secretHash } = await createHostCredential(OTHER_ROOM);
    const [, secret, signature] = cookieValue.split(".");
    const forged = `${ROOM}.${secret}.${signature}`;
    expect(await verifyHostCookie(forged, ROOM, secretHash)).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const { cookieValue, secretHash } = await createHostCredential(ROOM);
    const [code, secret, signature] = cookieValue.split(".");
    const flipped = signature.slice(0, -1) + (signature.at(-1) === "a" ? "b" : "a");
    expect(
      await verifyHostCookie(`${code}.${secret}.${flipped}`, ROOM, secretHash),
    ).toBe(false);
  });

  it("rejects a truncated cookie", async () => {
    const { cookieValue, secretHash } = await createHostCredential(ROOM);
    expect(
      await verifyHostCookie(cookieValue.slice(0, -8), ROOM, secretHash),
    ).toBe(false);
  });

  it.each([
    ["undefined", undefined],
    ["empty", ""],
    ["no separators", "garbage"],
    ["too few parts", "mza-krfq-tqn.abc"],
    ["too many parts", "mza-krfq-tqn.abc.def.ghi"],
  ])("rejects a malformed cookie: %s", async (_label, value) => {
    const { secretHash } = await createHostCredential(ROOM);
    expect(await verifyHostCookie(value, ROOM, secretHash)).toBe(false);
  });

  it("rejects a valid cookie once the stored hash is rotated", async () => {
    // This is host handover. The old cookie's signature is still perfectly
    // valid; the database is what revokes it.
    const original = await createHostCredential(ROOM);
    expect(
      await verifyHostCookie(original.cookieValue, ROOM, original.secretHash),
    ).toBe(true);

    const handedOver = await createHostCredential(ROOM);
    expect(
      await verifyHostCookie(original.cookieValue, ROOM, handedOver.secretHash),
    ).toBe(false);
    // ...while the new host's cookie works.
    expect(
      await verifyHostCookie(handedOver.cookieValue, ROOM, handedOver.secretHash),
    ).toBe(true);
  });

  it("rejects a cookie signed with a different signing key", async () => {
    const { cookieValue, secretHash } = await createHostCredential(ROOM);
    process.env.LOR_HOST_COOKIE_SECRET = "a-completely-different-key";
    expect(await verifyHostCookie(cookieValue, ROOM, secretHash)).toBe(false);
  });
});

describe("cookie shape", () => {
  it("names one cookie per room so two rooms can be hosted at once", () => {
    expect(hostCookieName(ROOM)).toBe(`lor_host_${ROOM}`);
    expect(hostCookieName(ROOM)).not.toBe(hostCookieName(OTHER_ROOM));
  });

  it("is httpOnly and SameSite=Lax", () => {
    const options = hostCookieOptions();
    expect(options.httpOnly).toBe(true);
    // Lax rather than Strict: opening your own invitation link from a chat app
    // is a cross-site navigation, and you should still be the host.
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.maxAge).toBeGreaterThan(0);
  });
});
