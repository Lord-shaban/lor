import { describe, expect, it } from "vitest";
import { normalise, score, summarise, tokenise } from "./metrics.ts";

const MIXED = "عملت الـ deploy على الـ server وشوفت الـ logs";

describe("normalise", () => {
  it("removes diacritics", () => {
    expect(normalise("مَرْحَبًا")).toBe(normalise("مرحبا"));
  });

  it("removes tatweel", () => {
    expect(normalise("مرحـــبا")).toBe("مرحبا");
  });

  it("treats the alef variants as one letter", () => {
    for (const variant of ["أحمد", "إحمد", "آحمد", "ٱحمد"]) {
      expect(normalise(variant)).toBe("احمد");
    }
  });

  it("treats final yaa and alef maqsura as one letter", () => {
    expect(normalise("على")).toBe(normalise("علي"));
  });

  it("treats taa marbuta and haa as one letter", () => {
    // People write both, and a reader does not distinguish them. Counting it
    // as an error would penalise a transcript for matching how Egyptians type.
    expect(normalise("مدرسة")).toBe(normalise("مدرسه"));
  });

  it("counts Arabic-Indic and Latin digits as the same number", () => {
    expect(normalise("٣ ساعات")).toBe("3 ساعات");
    expect(normalise("۳ ساعات")).toBe("3 ساعات");
  });

  it("counts Arabic and Latin punctuation as the same mark", () => {
    expect(normalise("فين؟")).toBe(normalise("فين?"));
    expect(normalise("واحد، اتنين")).toBe(normalise("واحد, اتنين"));
    expect(normalise("واحد؛ اتنين")).toBe(normalise("واحد; اتنين"));
  });

  it("lowercases Latin and collapses whitespace", () => {
    expect(normalise("  The   DEPLOY  ")).toBe("the deploy");
  });

  it("leaves a mixed line intact apart from case and spacing", () => {
    expect(normalise(MIXED)).toContain("deploy");
    expect(normalise(MIXED)).toContain("server");
  });
});

describe("tokenise", () => {
  it("strips punctuation from the edges of a word", () => {
    // The definite article comes back as ال, without its tatweel: the stretch
    // character has no sound and people type it inconsistently.
    expect(tokenise("عملت الـ deploy، وخلاص.")).toEqual([
      "عملت",
      "ال",
      "deploy",
      "وخلاص",
    ]);
  });

  it("drops tokens that are only punctuation", () => {
    expect(tokenise("نعم — لا")).toEqual(["نعم", "لا"]);
  });

  it("keeps digits", () => {
    expect(tokenise("٣ ساعات")).toEqual(["3", "ساعات"]);
  });
});

describe("score", () => {
  it("is perfect on an identical line", () => {
    const result = score(MIXED, MIXED);
    expect(result.wer).toBe(0);
    expect(result.cer).toBe(0);
    expect(result.codeSwitchPreservation).toBe(1);
  });

  it("is perfect on a line that differs only in spelling variants", () => {
    const result = score("على المدرسة؟", "علي المدرسه?");
    expect(result.wer).toBe(0);
    expect(result.cer).toBe(0);
  });

  it("counts a substituted word", () => {
    const result = score("واحد اتنين تلاته", "واحد اتنين اربعه");
    expect(result.wer).toBeCloseTo(1 / 3);
  });

  it("counts an inserted word", () => {
    const result = score("واحد اتنين", "واحد اتنين تلاته");
    expect(result.wer).toBeCloseTo(1 / 2);
  });

  describe("code-switch preservation", () => {
    it("is zero when every English word was transliterated", () => {
      // The failure this whole milestone exists to prevent, and the reason WER
      // alone is the wrong instrument.
      const transliterated =
        "عملت الـ ديبلوي على الـ سيرفر وشوفت الـ لوجز";
      const result = score(MIXED, transliterated);
      expect(result.codeSwitchPreservation).toBe(0);
      expect(result.latinWords).toBe(3);
    });

    it("catches what word error rate would have rewarded", () => {
      // Two hypotheses. One keeps the English and gets an Arabic word wrong;
      // the other transliterates everything. WER prefers the second — which is
      // exactly why it cannot be the only number.
      const kept = score(MIXED, "عملتُ الـ deploy على الـ server وشوفت الـ logs");
      const transliterated = score(
        MIXED,
        "عملت الـ ديبلوي على الـ سيرفر وشوفت الـ لوجز",
      );

      expect(transliterated.wer).toBeLessThanOrEqual(kept.wer + 0.5);
      expect(kept.codeSwitchPreservation).toBe(1);
      expect(transliterated.codeSwitchPreservation).toBe(0);
    });

    it("is a share, not all or nothing", () => {
      const result = score(MIXED, "عملت الـ deploy على الـ سيرفر وشوفت الـ logs");
      expect(result.codeSwitchPreservation).toBeCloseTo(2 / 3);
    });

    it("does not care about word order", () => {
      // A term that moved is still a term that survived.
      const result = score("the deploy failed", "failed the deploy");
      expect(result.codeSwitchPreservation).toBe(1);
    });

    it("cannot be gamed by repeating one word", () => {
      // Three Latin words wanted, one of them supplied three times. Each
      // occurrence is matched once, so this scores one in three, not one.
      const result = score("deploy the server", "deploy deploy deploy");
      expect(result.codeSwitchPreservation).toBeCloseTo(1 / 3);
    });

    it("is null when the reference has no English at all", () => {
      // Not 100%. A corpus of pure Arabic must not be able to hide a model
      // that transliterates everything.
      const result = score("إزيك عامل إيه", "إزيك عامل إيه");
      expect(result.codeSwitchPreservation).toBeNull();
      expect(result.latinWords).toBe(0);
    });

    it("is unaffected by the case an English word was written in", () => {
      expect(score("the Deploy", "the DEPLOY").codeSwitchPreservation).toBe(1);
    });
  });

  it("reports total failure rather than dividing by zero", () => {
    expect(score("", "").wer).toBe(0);
    expect(score("", "شيء").wer).toBe(1);
    expect(score("شيء", "").wer).toBe(1);
  });
});

describe("summarise", () => {
  const entry = (
    wer: number,
    referenceWords: number,
    latinWords = 0,
    preservation: number | null = null,
  ) => ({
    score: {
      wer,
      cer: wer,
      codeSwitchPreservation: preservation,
      latinWords,
    },
    referenceWords,
    referenceCharacters: referenceWords * 5,
  });

  it("weights by length rather than by case", () => {
    // Otherwise a four-word utterance counts as much as a two-minute one.
    const average = summarise([entry(0, 90), entry(1, 10)]);
    expect(average.wer).toBeCloseTo(0.1);
  });

  it("weights preservation by how much English each case had", () => {
    const average = summarise([entry(0, 10, 9, 1), entry(0, 10, 1, 0)]);
    expect(average.codeSwitchPreservation).toBeCloseTo(0.9);
  });

  it("stays null when no case had any English", () => {
    expect(summarise([entry(0, 10), entry(0, 10)]).codeSwitchPreservation).toBeNull();
  });

  it("handles an empty corpus", () => {
    expect(summarise([])).toEqual({
      wer: 0,
      cer: 0,
      codeSwitchPreservation: null,
      latinWords: 0,
    });
  });
});
