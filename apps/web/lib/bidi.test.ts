import { describe, expect, it } from "vitest";
import { lineDirection } from "./bidi";

describe("lineDirection", () => {
  it("does not follow the first strong character", () => {
    // What dir="auto" gets wrong, in both directions. Each sentence opens in
    // the other language and belongs to the one it spends its words in.
    expect(lineDirection("Zoom مش شغال عندي النهاردة خالص", "ltr")).toBe("rtl");
    expect(lineDirection("خلاص, the meeting is over now", "rtl")).toBe("ltr");
  });

  it("counts words, not letters", () => {
    // Twelve Latin letters against nine Arabic ones, and still an Arabic
    // sentence. English technical terms are long; counting characters hands
    // every code-switched line to English.
    expect(lineDirection("Deploy خلص على الـ server", "ltr")).toBe("rtl");
  });

  it("takes the fallback when there is nothing to count", () => {
    expect(lineDirection("", "rtl")).toBe("rtl");
    expect(lineDirection("123 — 456", "ltr")).toBe("ltr");
  });

  it("takes the fallback on a tie", () => {
    // One word each way. Nothing to prefer, so the caller decides — the locale
    // for a finished line, the direction already on screen for one still
    // arriving.
    expect(lineDirection("ok لا", "rtl")).toBe("rtl");
    expect(lineDirection("ok لا", "ltr")).toBe("ltr");
  });

  it("counts a tatweel-stretched word once, as Arabic", () => {
    // مرحـــبا is one word however far it is stretched, and الـ is one word
    // however the article is written.
    expect(lineDirection("مرحـــبا يا deploy", "ltr")).toBe("rtl");
    expect(lineDirection("الـ deploy خلص", "ltr")).toBe("rtl");
  });

  it("does not let Arabic-Indic digits vote", () => {
    // ٣ is Script=Arabic and would otherwise make this an Arabic line.
    expect(lineDirection("٣ servers", "rtl")).toBe("ltr");
  });

  it("counts a link once, not once per word in it", () => {
    // Six Latin "words" in one URL against three Arabic ones turned an Arabic
    // message with a link in it into an English line. Found by measuring the
    // rendered order in a browser, not by reading the module.
    expect(
      lineDirection("شوف https://lor.dev/mza-krf-tqn وقولي رأيك.", "ltr"),
    ).toBe("rtl");
  });

  it("counts a parenthetical once", () => {
    // A list of names in brackets is an aside, not an argument about what
    // language the sentence is in.
    expect(
      lineDirection("الفريق (Ahmed, Sara, Omar) خلصوا الـ sprint.", "ltr"),
    ).toBe("rtl");
    // The same rule the other way round: quoted Arabic is one unit inside an
    // English sentence.
    expect(lineDirection('Ahmed said "خلاص يا جماعة" and left.', "rtl")).toBe(
      "ltr",
    );
  });

  it("settles once while a caption is still arriving", () => {
    // One utterance, in the order an engine emits it. The direction may change
    // its mind as the sentence reveals what language it is in — but once, not
    // once a word, which is what dir="auto" would do.
    const partials = [
      "Deploy",
      "Deploy خلص",
      "Deploy خلص على",
      "Deploy خلص على الـ server",
    ];

    let held: "rtl" | "ltr" = "rtl";
    const settled = partials.map((partial) => (held = lineDirection(partial, held)));

    // Held through the tie at "Deploy خلص" — that is what the fallback buys —
    // and changed once, when the sentence had said enough to be Arabic.
    expect(settled).toEqual(["ltr", "ltr", "rtl", "rtl"]);
    expect(settled.filter((d, i) => i > 0 && d !== settled[i - 1])).toHaveLength(1);
  });

  it("holds a mixed line steady rather than flipping per word", () => {
    // The same utterance one word at a time, from an Arabic locale. Whatever
    // it settles on, it must not oscillate: a caption that changes side twice
    // is unreadable even when every word in it is right.
    const words = "عملت الـ deploy على الـ server وشوفت الـ logs".split(" ");
    let held: "rtl" | "ltr" = "rtl";
    const settled = words.map((_, index) =>
      (held = lineDirection(words.slice(0, index + 1).join(" "), held)),
    );

    expect(settled.every((d) => d === "rtl")).toBe(true);
  });
});
