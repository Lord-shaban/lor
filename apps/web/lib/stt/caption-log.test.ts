import { describe, expect, it } from "vitest";
import {
  MAX_LINES,
  abandon,
  createCaptionLog,
  provisional,
  settle,
  type CaptionLog,
} from "./caption-log";

const AHMED = { id: "u1", speaker: "ahmed", atMs: 1000 };
const SARA = { id: "u2", speaker: "sara", atMs: 2000 };

const texts = (log: CaptionLog) => log.lines.map((line) => line.text);
const states = (log: CaptionLog) => log.lines.map((line) => line.state);

describe("the two passes", () => {
  it("shows a guess while somebody is still talking", () => {
    const log = provisional(createCaptionLog(), AHMED, "عملت الـ", "rtl");

    expect(texts(log)).toEqual(["عملت الـ"]);
    expect(states(log)).toEqual(["provisional"]);
  });

  it("replaces the guess in place rather than adding a line", () => {
    // A strip showing the same sentence twice, differently, is worse than one
    // that is slow.
    let log = provisional(createCaptionLog(), AHMED, "عملت الديبلوي", "rtl");
    log = settle(log, AHMED, "عملت الـ deploy", "rtl");

    expect(log.lines).toHaveLength(1);
    expect(texts(log)).toEqual(["عملت الـ deploy"]);
    expect(states(log)).toEqual(["settled"]);
  });

  it("lets the accurate pass win even when it wins first", () => {
    // The fast pass is fast, not early. Its last interim result routinely
    // arrives after the request that overtook it has already come back.
    let log = settle(createCaptionLog(), AHMED, "عملت الـ deploy", "rtl");
    log = provisional(log, AHMED, "عملت الديبلوي على السيرفر", "rtl");

    expect(texts(log)).toEqual(["عملت الـ deploy"]);
    expect(states(log)).toEqual(["settled"]);
  });

  it("does not let a settled line be reopened after it scrolls away", () => {
    // The line is gone from `lines` but not from `settled`, which is why that
    // is a set and not a flag on the line.
    let log = settle(createCaptionLog(), AHMED, "خلاص", "rtl");
    for (let i = 0; i < MAX_LINES + 5; i++) {
      log = settle(log, { id: `x${i}`, speaker: "sara", atMs: 3000 + i }, `line ${i}`, "rtl");
    }

    log = provisional(log, AHMED, "a late guess", "rtl");
    expect(texts(log)).not.toContain("a late guess");
  });

  it("takes the line away when the accurate pass heard nothing", () => {
    // A cough that got past the detector. Leaving a guess on screen that
    // nothing will ever correct is worse than never having shown it.
    let log = provisional(createCaptionLog(), AHMED, "اه", "rtl");
    log = settle(log, AHMED, "   ", "rtl");

    expect(log.lines).toHaveLength(0);
  });

  it("ignores an empty guess rather than blanking a line", () => {
    let log = provisional(createCaptionLog(), AHMED, "عملت", "rtl");
    log = provisional(log, AHMED, "", "rtl");

    expect(texts(log)).toEqual(["عملت"]);
  });
});

describe("ordering", () => {
  it("orders by when the utterance began, not when its text arrived", () => {
    // Two people talking over each other produce results out of order. A strip
    // that reorders itself as they land is unreadable.
    let log = createCaptionLog();
    log = settle(log, SARA, "أنا خلصت", "rtl");
    log = settle(log, AHMED, "أنا لسه", "rtl");

    expect(texts(log)).toEqual(["أنا لسه", "أنا خلصت"]);
  });

  it("does not move a line when its text is replaced", () => {
    let log = createCaptionLog();
    log = provisional(log, AHMED, "أنا", "rtl");
    log = provisional(log, SARA, "وأنا", "rtl");
    log = settle(log, AHMED, "أنا لسه بشتغل", "rtl");

    expect(texts(log)).toEqual(["أنا لسه بشتغل", "وأنا"]);
  });

  it("keeps only the most recent lines", () => {
    // A caption strip is not a transcript. Keeping an hour of meeting to show
    // three lines of it is how a long call slows down.
    let log = createCaptionLog();
    for (let i = 0; i < MAX_LINES + 20; i++) {
      log = settle(log, { id: `u${i}`, speaker: "ahmed", atMs: i }, `line ${i}`, "rtl");
    }

    expect(log.lines).toHaveLength(MAX_LINES);
    expect(log.lines[0].text).toBe(`line ${20}`);
    expect(log.lines.at(-1)!.text).toBe(`line ${MAX_LINES + 19}`);
  });
});

describe("direction", () => {
  it("settles once as a line arrives word by word", () => {
    // The case lib/bidi.ts was built for. A caption that changes side twice is
    // unreadable even when every word in it is right.
    const words = ["Deploy", "Deploy خلص", "Deploy خلص على", "Deploy خلص على الـ server"];

    let log = createCaptionLog();
    const seen: string[] = [];
    for (const partial of words) {
      log = provisional(log, AHMED, partial, "rtl");
      seen.push(log.lines[0].direction);
    }

    const flips = seen.filter((d, i) => i > 0 && d !== seen[i - 1]);
    expect(flips).toHaveLength(1);
    expect(seen.at(-1)).toBe("rtl");
  });

  it("takes the locale for a line with nothing to go on yet", () => {
    expect(provisional(createCaptionLog(), AHMED, "123", "rtl").lines[0].direction).toBe("rtl");
    expect(provisional(createCaptionLog(), AHMED, "123", "ltr").lines[0].direction).toBe("ltr");
  });

  it("does not flip when the accurate pass replaces the guess", () => {
    let log = provisional(createCaptionLog(), AHMED, "عملت الديبلوي", "rtl");
    const before = log.lines[0].direction;
    log = settle(log, AHMED, "عملت الـ deploy", "rtl");

    expect(log.lines[0].direction).toBe(before);
  });
});

describe("abandon", () => {
  it("removes a line nothing is coming for", () => {
    let log = provisional(createCaptionLog(), AHMED, "اه", "rtl");
    log = abandon(log, AHMED.id);

    expect(log.lines).toHaveLength(0);
  });

  it("leaves everything else alone", () => {
    let log = provisional(createCaptionLog(), AHMED, "أنا", "rtl");
    log = provisional(log, SARA, "وأنا", "rtl");
    log = abandon(log, AHMED.id);

    expect(texts(log)).toEqual(["وأنا"]);
  });

  it("does nothing for an utterance it never had", () => {
    const log = provisional(createCaptionLog(), AHMED, "أنا", "rtl");
    expect(abandon(log, "nobody").lines).toHaveLength(1);
  });
});

describe("attribution", () => {
  it("keeps each line with the person who said it", () => {
    let log = provisional(createCaptionLog(), AHMED, "أنا", "rtl");
    log = settle(log, SARA, "وأنا", "rtl");

    expect(log.lines.map((l) => l.speaker)).toEqual(["ahmed", "sara"]);
  });
});
