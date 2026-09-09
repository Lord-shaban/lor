import * as Y from "yjs";

/**
 * A ProseMirror-compatible Y.XmlFragment held inside the call's one Canvas
 * document. Keeping this distinct from board maps lets both features evolve
 * without introducing a second transport or durable record.
 */
export const NOTES_FRAGMENT_KEY = "notes";

export function notesFragment(document: Y.Doc) {
  return document.getXmlFragment(NOTES_FRAGMENT_KEY);
}
