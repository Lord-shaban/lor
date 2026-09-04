import { describe, expect, it } from "vitest";
import { applyHand, pruneHands, type RaisedHand } from "./hand-queue";

function raise(
  queue: readonly RaisedHand[],
  identity: string,
  at: number,
  name = identity,
) {
  return applyHand(queue, { identity, name, raised: true, at });
}

function lower(queue: readonly RaisedHand[], identity: string) {
  return applyHand(queue, { identity, name: identity, raised: false, at: 0 });
}

const order = (queue: readonly RaisedHand[]) => queue.map((h) => h.identity);

describe("applyHand", () => {
  it("keeps the order hands went up in", () => {
    let queue = raise([], "b", 200);
    queue = raise(queue, "a", 100);
    queue = raise(queue, "c", 300);
    expect(order(queue)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the queue it was given", () => {
    const before = raise([], "a", 100);
    raise(before, "b", 200);
    lower(before, "a");
    expect(order(before)).toEqual(["a"]);
  });

  it("removes a hand that goes down", () => {
    let queue = raise(raise([], "a", 100), "b", 200);
    queue = lower(queue, "a");
    expect(order(queue)).toEqual(["b"]);
  });

  it("ignores a hand going down that was never up", () => {
    const queue = lower(raise([], "a", 100), "ghost");
    expect(order(queue)).toEqual(["a"]);
  });

  it("does not move a hand that re-announces itself", () => {
    // Every raised hand announces again when somebody joins. If that moved
    // anyone, whoever had waited longest would be punished for it.
    let queue = raise(raise([], "a", 100), "b", 200);
    queue = raise(queue, "a", 999);
    expect(order(queue)).toEqual(["a", "b"]);
    expect(queue[0].at).toBe(100);
  });

  it("takes the newer name on a re-announcement", () => {
    let queue = raise([], "a", 100, "Ahmed");
    queue = raise(queue, "a", 100, "أحمد");
    expect(queue[0].name).toBe("أحمد");
  });

  it("slots a late joiner's reconstructed hand into the middle", () => {
    // Someone joins and learns that a hand went up between two it already knew
    // about. Reconstructed from a duration, so it lands where it belongs.
    let queue = raise(raise([], "a", 100), "c", 300);
    queue = raise(queue, "b", 200);
    expect(order(queue)).toEqual(["a", "b", "c"]);
  });

  it("breaks a tie the same way on every client", () => {
    // Several hands reconstructed at once can share a millisecond. Two people
    // looking at the same room must not see different orders.
    const one = raise(raise(raise([], "c", 50), "a", 50), "b", 50);
    const other = raise(raise(raise([], "a", 50), "b", 50), "c", 50);
    expect(order(one)).toEqual(order(other));
    expect(order(one)).toEqual(["a", "b", "c"]);
  });
});

describe("pruneHands", () => {
  it("drops anyone who has left", () => {
    const queue = raise(raise([], "a", 100), "b", 200);
    expect(order(pruneHands(queue, new Set(["a"])))).toEqual(["a"]);
  });

  it("keeps the order of everyone still here", () => {
    let queue = raise(raise([], "a", 100), "b", 200);
    queue = raise(queue, "c", 300);
    expect(order(pruneHands(queue, new Set(["a", "c"])))).toEqual(["a", "c"]);
  });
});
