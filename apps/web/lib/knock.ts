/**
 * What a knock means when somebody knocks again.
 *
 * The rule that carries the weight is the last one: a refusal is final for that
 * person in that room. Anything else and "deny" is a speed bump — reload, knock
 * again, and the host is asked a second time until they tire of it.
 *
 * Pure, so the state machine can be read and tested without a database, a room,
 * or a host who has to keep saying no.
 */

export type KnockStatus = "pending" | "admitted" | "denied";

export type KnockOutcome =
  /** No knock existed. One was created and the host is being asked. */
  | "created"
  /** A knock was already pending. The host has not answered yet. */
  | "waiting"
  /** Already let in. The caller should stop knocking and ask for a token. */
  | "admitted"
  /** Already refused. Knocking again changes nothing. */
  | "denied";

export interface KnockResolution {
  outcome: KnockOutcome;
  /**
   * Whether to issue a fresh claim secret with this response.
   *
   * Only while the answer is still open. Somebody who has been let in has no
   * use for one, and handing a new claim to somebody who was refused would let
   * them keep a live handle on a decision that is already made.
   */
  issueClaim: boolean;
  /** Whether the host's waiting list needs to be told about this. */
  notifyHost: boolean;
}

export function resolveKnock(existing: KnockStatus | null): KnockResolution {
  switch (existing) {
    case null:
      return { outcome: "created", issueClaim: true, notifyHost: true };

    case "pending":
      // The same person asking again — a reload, or a tab that lost its claim.
      // Their identity is derived from a secret only their browser holds, so
      // re-issuing is safe, and telling the host again keeps a knock that was
      // missed from being stuck behind a notification nobody saw.
      return { outcome: "waiting", issueClaim: true, notifyHost: true };

    case "admitted":
      return { outcome: "admitted", issueClaim: false, notifyHost: false };

    case "denied":
      // Never reopened. This is the acceptance criterion, and it is the whole
      // reason the status is stored rather than inferred from a token.
      return { outcome: "denied", issueClaim: false, notifyHost: false };
  }
}

/** Whether this outcome means the caller should keep polling. */
export function shouldKeepWaiting(outcome: KnockOutcome): boolean {
  return outcome === "created" || outcome === "waiting";
}
