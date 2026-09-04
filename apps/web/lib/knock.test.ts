import { describe, expect, it } from "vitest";
import { resolveKnock, shouldKeepWaiting, type KnockStatus } from "./knock";

describe("resolveKnock", () => {
  it("creates a knock when there is none", () => {
    expect(resolveKnock(null)).toEqual({
      outcome: "created",
      issueClaim: true,
      notifyHost: true,
    });
  });

  it("keeps a pending knock pending and re-issues its claim", () => {
    // A reload, or a tab that lost its claim. The identity is derived from a
    // secret only that browser holds, so re-issuing is safe.
    expect(resolveKnock("pending")).toEqual({
      outcome: "waiting",
      issueClaim: true,
      notifyHost: true,
    });
  });

  it("never reopens a refusal", () => {
    // The acceptance criterion, and the reason status is stored rather than
    // inferred from whether a token was ever issued. Anything else makes deny
    // a speed bump: reload, knock again, ask the host until they give in.
    expect(resolveKnock("denied")).toEqual({
      outcome: "denied",
      issueClaim: false,
      notifyHost: false,
    });
  });

  it("hands a refused visitor no new claim", () => {
    // A live claim is a handle on a decision that is already made.
    expect(resolveKnock("denied").issueClaim).toBe(false);
  });

  it("does not pester the host about somebody already refused or admitted", () => {
    expect(resolveKnock("denied").notifyHost).toBe(false);
    expect(resolveKnock("admitted").notifyHost).toBe(false);
  });

  it("tells an admitted visitor to stop knocking", () => {
    expect(resolveKnock("admitted")).toEqual({
      outcome: "admitted",
      issueClaim: false,
      notifyHost: false,
    });
  });

  it("answers every status", () => {
    const statuses: Array<KnockStatus | null> = [
      null,
      "pending",
      "admitted",
      "denied",
    ];
    for (const status of statuses) {
      expect(resolveKnock(status).outcome).toBeTruthy();
    }
  });

  it("only ever issues a claim while the answer is still open", () => {
    for (const status of [null, "pending"] as const) {
      expect(resolveKnock(status).issueClaim).toBe(true);
    }
    for (const status of ["admitted", "denied"] as const) {
      expect(resolveKnock(status).issueClaim).toBe(false);
    }
  });
});

describe("shouldKeepWaiting", () => {
  it("keeps polling only while the host has not answered", () => {
    expect(shouldKeepWaiting("created")).toBe(true);
    expect(shouldKeepWaiting("waiting")).toBe(true);
    expect(shouldKeepWaiting("admitted")).toBe(false);
    expect(shouldKeepWaiting("denied")).toBe(false);
  });
});
