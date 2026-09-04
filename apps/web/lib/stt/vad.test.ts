import { describe, expect, it } from "vitest";
import {
  DEFAULT_VAD,
  createVadState,
  flush,
  levelDb,
  observeFrame,
  type VadEvent,
  type VadSettings,
  type VadState,
} from "./vad";

const FRAME_MS = 20;
const ROOM = -55;
const VOICE = -25;

/**
 * Feed a script of levels and collect what came out.
 *
 * A script is a list of `[durationMs, db]`, which is how the interesting cases
 * are actually described: "a second of room, two seconds of voice, a gap the
 * length of a stop consonant, more voice".
 */
function run(
  script: readonly (readonly [number, number])[],
  settings: VadSettings = DEFAULT_VAD,
  initial: VadState = createVadState(),
): { events: VadEvent[]; state: VadState; endedAtMs: number } {
  let state = initial;
  const events: VadEvent[] = [];
  let atMs = 0;

  for (const [durationMs, db] of script) {
    for (let elapsed = 0; elapsed < durationMs; elapsed += FRAME_MS) {
      const step = observeFrame(state, { atMs, db }, settings);
      state = step.state;
      if (step.event) events.push(step.event);
      atMs += FRAME_MS;
    }
  }

  return { events, state, endedAtMs: atMs };
}

const ends = (events: VadEvent[]) =>
  events.filter((event) => event.type === "end");

describe("observeFrame", () => {
  it("decides nothing until it has heard the room", () => {
    // Five frames. A detector that fires on the first one adopts whatever was
    // happening when the page loaded as its idea of silence.
    const { events } = run([[80, VOICE]]);
    expect(events).toEqual([]);
  });

  it("finds one utterance in a sentence surrounded by silence", () => {
    const { events } = run([
      [500, ROOM],
      [1500, VOICE],
      [1500, ROOM],
    ]);

    expect(events.map((event) => event.type)).toEqual(["start", "end"]);
    const [end] = ends(events);
    expect(end.reason).toBe("silence");
  });

  it("keeps audio from before the onset", () => {
    // The frame that crosses the threshold is already inside the word. Without
    // the pre-roll every utterance loses its first consonant — which is not a
    // small transcription error, it is a different word.
    const { events } = run([
      [500, ROOM],
      [1000, VOICE],
      [1500, ROOM],
    ]);

    const start = events.find((event) => event.type === "start")!;
    expect(start.atMs).toBeLessThanOrEqual(500 - DEFAULT_VAD.prerollMs + FRAME_MS);
  });

  it("ends where the voice stopped, not where the timer expired", () => {
    // The hangover is how long we wait to be sure. It is not part of what was
    // said, and sending it is paying for silence.
    const { events } = run([
      [500, ROOM],
      [1000, VOICE],
      [2000, ROOM],
    ]);

    const [end] = ends(events);
    expect(end.toMs).toBeGreaterThanOrEqual(1500);
    expect(end.toMs).toBeLessThanOrEqual(1500 + DEFAULT_VAD.tailMs + FRAME_MS);
  });

  it("does not cut a word at a stop consonant", () => {
    // "deploy" has real silence in the middle of it. A detector that ends an
    // utterance at the first quiet frame splits the word, and a model handed
    // half a word returns a whole different one.
    const { events } = run([
      [500, ROOM],
      [700, VOICE],
      [120, ROOM], // the gap inside the word
      [700, VOICE],
      [1500, ROOM],
    ]);

    expect(ends(events)).toHaveLength(1);
  });

  it("does not chatter across the threshold mid-sentence", () => {
    // Speech is not a plateau. With one threshold instead of two, a sentence
    // that dips towards the bar becomes a dozen requests.
    const dips: (readonly [number, number])[] = [[500, ROOM]];
    for (let i = 0; i < 8; i++) {
      dips.push([200, VOICE], [60, ROOM + 6]);
    }
    dips.push([1500, ROOM]);

    expect(ends(run(dips).events)).toHaveLength(1);
  });

  it("cuts a monologue at the limit and carries on", () => {
    // Somebody presenting can talk for minutes without a gap. A caption that
    // arrives after the point has been made is not a caption.
    const { events } = run([
      [500, ROOM],
      [50_000, VOICE],
      [1500, ROOM],
    ]);

    const closed = ends(events);
    expect(closed.filter((end) => end.reason === "limit").length).toBeGreaterThanOrEqual(2);
    expect(closed.at(-1)!.reason).toBe("silence");

    // And no gaps: each cut begins where the last one ended, so nothing said
    // during a long stretch is lost between chunks.
    for (let i = 1; i < closed.length; i++) {
      expect(closed[i].fromMs).toBeLessThanOrEqual(closed[i - 1].toMs);
    }
  });

  it("drops a cough rather than paying to transcribe it", () => {
    const { events } = run([
      [500, ROOM],
      [60, VOICE],
      [1500, ROOM],
    ]);

    expect(events.map((event) => event.type)).toEqual(["start", "drop"]);
  });

  it("follows a room that is louder than the last one", () => {
    // A fixed threshold means an air conditioner streams continuously. The
    // same voice, over a floor thirty decibels up, still has to read as one
    // utterance and nothing else.
    const loudRoom = -25;
    const overIt = 5;

    const { events } = run([
      [3000, loudRoom],
      [1500, overIt],
      [1500, loudRoom],
    ]);

    expect(events.map((event) => event.type)).toEqual(["start", "end"]);
  });

  it("does not treat the room itself as speech", () => {
    const { events } = run([[10_000, ROOM]]);
    expect(events).toEqual([]);
  });

  it("recovers when it primed on somebody already talking", () => {
    // The page can load mid-sentence. The floor comes out at speech level and
    // the first utterance is missed — but the estimate falls quickly, so the
    // next one is not.
    const { events } = run([
      [200, VOICE],
      [2000, ROOM],
      [1000, VOICE],
      [1500, ROOM],
    ]);

    expect(ends(events)).toHaveLength(1);
  });
});

describe("flush", () => {
  it("keeps the last thing said before capture stopped", () => {
    // Often the thing worth keeping, and it has no trailing silence to close
    // it.
    const { state, endedAtMs } = run([
      [500, ROOM],
      [1000, VOICE],
    ]);

    const { event } = flush(state, endedAtMs);
    expect(event).toMatchObject({ type: "end", reason: "stop" });
  });

  it("does nothing when nobody was talking", () => {
    const { state, endedAtMs } = run([[2000, ROOM]]);
    expect(flush(state, endedAtMs).event).toBeNull();
  });

  it("still drops something too short to be speech", () => {
    const { state, endedAtMs } = run([
      [500, ROOM],
      [40, VOICE],
    ]);

    expect(flush(state, endedAtMs).event).toMatchObject({ type: "drop" });
  });
});

describe("levelDb", () => {
  it("reports digital silence rather than negative infinity", () => {
    expect(levelDb(new Float32Array(128))).toBe(-100);
    expect(Number.isFinite(levelDb(new Float32Array(128)))).toBe(true);
  });

  it("reports full scale as zero", () => {
    expect(levelDb(new Float32Array(64).fill(1))).toBeCloseTo(0);
  });

  it("halving the amplitude costs six decibels", () => {
    const loud = levelDb(new Float32Array(64).fill(0.5));
    const quiet = levelDb(new Float32Array(64).fill(0.25));
    expect(loud - quiet).toBeCloseTo(6.02, 1);
  });

  it("survives an empty frame", () => {
    expect(levelDb(new Float32Array(0))).toBe(-100);
  });
});
