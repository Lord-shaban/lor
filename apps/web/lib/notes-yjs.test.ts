import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { NOTES_FRAGMENT_KEY, notesFragment } from "./notes-yjs";

function addParagraph(document: Y.Doc, value: string) {
  const paragraph = new Y.XmlElement("paragraph");
  const text = new Y.XmlText();
  text.insert(0, value);
  paragraph.insert(0, [text]);
  notesFragment(document).insert(notesFragment(document).length, [paragraph]);
}

function noteMarkup(document: Y.Doc) {
  return notesFragment(document).toString();
}

function exchange(first: Y.Doc, second: Y.Doc) {
  Y.applyUpdate(second, Y.encodeStateAsUpdate(first));
  Y.applyUpdate(first, Y.encodeStateAsUpdate(second));
}

describe("collaborative meeting notes", () => {
  it("merges concurrent Arabic and English edits made while peers are apart", () => {
    const first = new Y.Doc();
    const second = new Y.Doc();
    exchange(first, second);

    addParagraph(first, "قرار: deploy الخميس");
    addParagraph(second, "Follow up with the design team");

    exchange(first, second);

    expect(noteMarkup(first)).toContain("قرار: deploy الخميس");
    expect(noteMarkup(first)).toContain("Follow up with the design team");
    expect(noteMarkup(second)).toBe(noteMarkup(first));
  });

  it("keeps rich-text XML in the one named Canvas fragment for a late join", () => {
    const source = new Y.Doc();
    addParagraph(source, "مراجعة الـ PR قبل النشر");
    const late = new Y.Doc();

    Y.applyUpdate(late, Y.encodeStateAsUpdate(source));

    expect(notesFragment(late).toString()).toContain("مراجعة الـ PR قبل النشر");
    expect(late.share.get(NOTES_FRAGMENT_KEY)).toBeInstanceOf(Y.XmlFragment);
  });
});
