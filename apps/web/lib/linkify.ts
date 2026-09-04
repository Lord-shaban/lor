/**
 * Find the links in a chat message without letting one become markup.
 *
 * People paste links into meetings constantly, and a link you have to select
 * and copy by hand is barely a link. The message body is still rendered as
 * text — this only says which runs of it should be anchors, so nothing a
 * participant types can ever reach the DOM as HTML.
 */

export interface Segment {
  text: string;
  /** Present when this run is a link. Always http or https. */
  href?: string;
}

/**
 * Deliberately loose, because the check that matters happens afterwards.
 *
 * Matching greedily and then handing the result to `URL` is more reliable than
 * trying to express what a URL is in one regular expression — and it means a
 * scheme we do not want, `javascript:` above all, is rejected by the parser
 * rather than by an exclusion we remembered to write.
 */
const CANDIDATE = /https?:\/\/[^\s]+/gi;

/**
 * Punctuation that ends a sentence rather than a URL.
 *
 * A link at the end of "شوف https://lor.dev/mza-krfq-tqn." should not swallow
 * the full stop. Arabic comma, semicolon and question mark are here for the
 * same reason as their Latin counterparts.
 */
const TRAILING = /[.,;:!?'"«»)\]}\u060C\u061B\u061F]+$/;

export function linkify(text: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(CANDIDATE)) {
    const start = match.index;
    let candidate = match[0];

    // A closing bracket only belongs to the URL if the URL opened one.
    const trimmed = candidate.replace(TRAILING, "");
    if (balanced(trimmed) || !hasOpener(trimmed)) candidate = trimmed;

    const href = safeUrl(candidate);
    if (!href) continue;

    if (start > cursor) segments.push({ text: text.slice(cursor, start) });
    segments.push({ text: candidate, href });
    cursor = start + candidate.length;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

function safeUrl(candidate: string): string | undefined {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return undefined;
  }
  // The regex already required a scheme, but this is the check that has to hold
  // if the regex is ever loosened.
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  return url.href;
}

function hasOpener(value: string): boolean {
  return value.includes("(");
}

function balanced(value: string): boolean {
  let depth = 0;
  for (const character of value) {
    if (character === "(") depth++;
    else if (character === ")") depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}
