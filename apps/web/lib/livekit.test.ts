import { beforeEach, describe, expect, it } from "vitest";
import { createAccessToken, participantIdentity } from "./livekit";

const ROOM = "lor_mza-krfq-tqn";
const OTHER_ROOM = "lor_bcd-efgh-jkm";

beforeEach(() => {
  process.env.LIVEKIT_API_KEY = "APItestkey";
  process.env.LIVEKIT_API_SECRET = "test-secret-not-a-real-one-abcdefghij";
});

/** Read the claims without verifying — enough to assert what was granted. */
function claims(jwt: string): Record<string, unknown> {
  const payload = jwt.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

describe("participantIdentity", () => {
  it("is stable for the same session in the same room", async () => {
    const a = await participantIdentity(ROOM, "session-abcdef123456");
    const b = await participantIdentity(ROOM, "session-abcdef123456");
    expect(a).toBe(b);
  });

  it("differs between tabs, so a second tab does not evict the first", async () => {
    // LiveKit disconnects an existing participant when another joins with the
    // same identity. Two tabs must not collide.
    const a = await participantIdentity(ROOM, "session-aaaaaaaaaaaa");
    const b = await participantIdentity(ROOM, "session-bbbbbbbbbbbb");
    expect(a).not.toBe(b);
  });

  it("differs between rooms for the same session", async () => {
    const a = await participantIdentity(ROOM, "session-abcdef123456");
    const b = await participantIdentity(OTHER_ROOM, "session-abcdef123456");
    expect(a).not.toBe(b);
  });

  it("cannot be derived without the server secret", async () => {
    // A guessable identity is a way to kick someone out of a meeting, so the
    // derivation is salted with a secret the client never sees.
    const withOneSecret = await participantIdentity(ROOM, "session-abcdef123456");
    process.env.LIVEKIT_API_SECRET = "a-completely-different-secret-value";
    const withAnother = await participantIdentity(ROOM, "session-abcdef123456");
    expect(withOneSecret).not.toBe(withAnother);
  });

  it("does not leak the session id", async () => {
    const identity = await participantIdentity(ROOM, "session-abcdef123456");
    expect(identity).not.toContain("session-abcdef123456");
    expect(identity).toMatch(/^p_[0-9a-f]{24}$/);
  });
});

describe("createAccessToken", () => {
  const base = {
    livekitRoom: ROOM,
    identity: "p_abc123",
    displayName: "أحمد",
    canPublish: true,
    isHost: false,
  };

  it("scopes the grant to one room", async () => {
    const video = claims(await createAccessToken(base)).video as Record<
      string,
      unknown
    >;
    expect(video.room).toBe(ROOM);
    expect(video.roomJoin).toBe(true);
    // A token for one room carries no grant for another, so it cannot be
    // replayed there.
    expect(video.room).not.toBe(OTHER_ROOM);
  });

  it("carries a display name that survives non-Latin script", async () => {
    expect(claims(await createAccessToken(base)).name).toBe("أحمد");
  });

  it("withholds publish rights from someone still waiting", async () => {
    const video = claims(
      await createAccessToken({ ...base, canPublish: false }),
    ).video as Record<string, unknown>;

    expect(video.canPublish).toBe(false);
    // They still need to subscribe and to send data: that is how they knock and
    // how they are told they were admitted.
    expect(video.canSubscribe).toBe(true);
    expect(video.canPublishData).toBe(true);
  });

  it("grants room admin only to a host", async () => {
    const guest = claims(await createAccessToken(base)).video as Record<
      string,
      unknown
    >;
    expect(guest.roomAdmin).toBeFalsy();

    const host = claims(await createAccessToken({ ...base, isHost: true }))
      .video as Record<string, unknown>;
    expect(host.roomAdmin).toBe(true);
  });

  it("expires", async () => {
    const payload = claims(await createAccessToken(base));
    const ttl = (payload.exp as number) - (payload.nbf as number);
    expect(ttl).toBeGreaterThan(0);
    // An hour: long enough to survive a reconnect, short enough to bound a
    // leaked token.
    expect(ttl).toBeLessThanOrEqual(60 * 60);
  });

  it("refuses to mint without credentials", async () => {
    delete process.env.LIVEKIT_API_SECRET;
    await expect(createAccessToken(base)).rejects.toThrow(/LIVEKIT_API/);
  });
});
