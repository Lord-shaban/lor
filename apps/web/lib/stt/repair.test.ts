import { describe, expect, it } from "vitest";
import {
  MAX_REPAIRS,
  MAX_REPAIR_LENGTH,
  applyRepairs,
  cleanRepairs,
  readRepairs,
} from "./repair";

const DEPLOY = { from: "ديبلوي", to: "deploy" };
const VERCEL = { from: "فيرسل", to: "Vercel" };

describe("applyRepairs", () => {
  it("puts back the English the model wrote in Arabic letters", () => {
    expect(applyRepairs("عملت الـ ديبلوي على السيرفر", [DEPLOY])).toBe(
      "عملت الـ deploy على السيرفر",
    );
  });

  it("matches a spelling the model reached for the second time", () => {
    // A model asked for the same word twice does not spell it the same way
    // twice. If the correction only matches the exact form it was made against,
    // somebody corrects the same word all meeting and then turns captions off.
    for (const variant of ["ديبلوى", "دِيبلوي", "ديبلـوي"]) {
      expect(applyRepairs(`عملت الـ ${variant} خلاص`, [DEPLOY])).toBe(
        "عملت الـ deploy خلاص",
      );
    }
  });

  it("replaces whole words and nothing inside one", () => {
    // A substring rule would rewrite the middle of an unrelated word, and a
    // silent corruption of a line somebody is reading aloud is worse than the
    // transliteration it was fixing.
    const inside = { from: "بلو", to: "blue" };
    expect(applyRepairs("عملت الـ ديبلوي", [inside])).toBe("عملت الـ ديبلوي");
    expect(applyRepairs("لون بلو", [inside])).toBe("لون blue");
  });

  it("leaves punctuation and spacing exactly as it found them", () => {
    // The line goes back on screen as it arrived apart from the words that
    // changed. A pass that also renormalises spacing is one nobody can debug.
    expect(applyRepairs("خلص الـ ديبلوي، تمام؟", [DEPLOY])).toBe(
      "خلص الـ deploy، تمام؟",
    );
    expect(applyRepairs("  ديبلوي  ديبلوي  ", [DEPLOY])).toBe("  deploy  deploy  ");
  });

  it("applies several corrections in one line", () => {
    expect(applyRepairs("الـ ديبلوي على فيرسل", [DEPLOY, VERCEL])).toBe(
      "الـ deploy على Vercel",
    );
  });

  it("does nothing when it has nothing to do", () => {
    expect(applyRepairs("عملت الـ deploy", [])).toBe("عملت الـ deploy");
    expect(applyRepairs("", [DEPLOY])).toBe("");
    expect(applyRepairs("مفيش حاجة هنا", [DEPLOY])).toBe("مفيش حاجة هنا");
  });

  it("does not touch the English that is already right", () => {
    expect(applyRepairs("عملت الـ deploy على Vercel", [DEPLOY, VERCEL])).toBe(
      "عملت الـ deploy على Vercel",
    );
  });
});

describe("cleanRepairs", () => {
  it("keeps a correction that undoes transliteration", () => {
    expect(cleanRepairs([DEPLOY, VERCEL])).toEqual([DEPLOY, VERCEL]);
  });

  it("refuses a rule pointing the other way", () => {
    // The pass exists to undo transliteration, not to invent it. One rule
    // pointing Latin at Arabic would transliterate the rest of the meeting.
    expect(cleanRepairs([{ from: "deploy", to: "ديبلوي" }])).toEqual([]);
    expect(cleanRepairs([{ from: "deploy", to: "ship" }])).toEqual([]);
  });

  it("refuses a rule that would rewrite its own output", () => {
    expect(cleanRepairs([{ from: "ديبلوي", to: "ديبلوى" }])).toEqual([]);
  });

  it("refuses a multi-word source that would never match", () => {
    // The matcher works word by word, so this would be stored and then never
    // fire. A rule that silently does nothing is worse than one that is refused.
    expect(cleanRepairs([{ from: "بول ريكوست", to: "pull request" }])).toEqual([]);
  });

  it("refuses an essay in the wrong box", () => {
    const long = "ا".repeat(MAX_REPAIR_LENGTH + 1);
    expect(cleanRepairs([{ from: long, to: "deploy" }])).toEqual([]);
    expect(cleanRepairs([{ from: "ديبلوي", to: "d".repeat(MAX_REPAIR_LENGTH + 1) }])).toEqual([]);
  });

  it("refuses empty halves", () => {
    expect(
      cleanRepairs([
        { from: "", to: "deploy" },
        { from: "ديبلوي", to: "   " },
      ]),
    ).toEqual([]);
  });

  it("keeps the first rule for a word, not the last", () => {
    const kept = cleanRepairs([
      DEPLOY,
      { from: "ديبلوى", to: "Deployment" },
    ]);
    expect(kept).toEqual([DEPLOY]);
  });

  it("stops at the cap", () => {
    const many = Array.from({ length: MAX_REPAIRS + 10 }, (_, i) => ({
      from: `كلمه${i}`,
      to: `word${i}`,
    }));
    expect(cleanRepairs(many)).toHaveLength(MAX_REPAIRS);
  });

  it("tidies whitespace", () => {
    expect(cleanRepairs([{ from: "  ديبلوي  ", to: "  deploy  " }])).toEqual([
      DEPLOY,
    ]);
  });
});

describe("readRepairs", () => {
  it("reads a room's corrections", () => {
    expect(readRepairs({ repairs: [DEPLOY] })).toEqual([DEPLOY]);
  });

  it("survives whatever is actually in the jsonb", () => {
    // Written by this version of the code, or a previous one, or by hand in a
    // console at three in the morning.
    for (const settings of [
      null,
      undefined,
      "repairs",
      42,
      {},
      { repairs: null },
      { repairs: "deploy" },
      { repairs: [null, 7, "x", {}, { from: "ديبلوي" }] },
    ]) {
      expect(readRepairs(settings)).toEqual([]);
    }
  });

  it("cleans what it finds rather than trusting it", () => {
    expect(
      readRepairs({ repairs: [{ from: "deploy", to: "ديبلوي" }, DEPLOY] }),
    ).toEqual([DEPLOY]);
  });
});
