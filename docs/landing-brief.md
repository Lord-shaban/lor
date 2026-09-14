# LOR. public landing brief

Status: approved content and media contract for issue [#213](https://github.com/Lord-shaban/lor/issues/213), extended for the showcase pass in [#234](https://github.com/Lord-shaban/lor/issues/234).
This brief is the source for the public project page; it does not change the product
launcher at `/[locale]`.

## What the page must do

The page introduces LOR. to a developer or meeting organiser who has never seen it.
Within the first viewport they should understand the promise, see that the product is
real, and choose one of two honest next steps:

- **Try the live app** at [lor-bay.vercel.app](https://lor-bay.vercel.app).
- **View the source** at [github.com/Lord-shaban/lor](https://github.com/Lord-shaban/lor).

The public routes are `/about` for the Arabic default locale and `/en/about` for English
(`/ar/about` remains an explicit locale alias). The default locale may also be reached
through the locale-aware link from the product home; the product route remains the
shortest path for starting or joining a meeting.

## Information architecture and copy intent

| Order | Section | English intent | Arabic-first intent | Evidence boundary |
|---|---|---|---|---|
| 1 | Hero | “Meetings that remember what matters.” Explain open-source, Arabic-first video meetings in one sentence. | `اجتماعات بتفتكر اللي يهم.` Explain the same promise in plain Egyptian Arabic, with `LOR.‎` isolated in UI text. | README “What LOR. is”; no invented outcome or metric. |
| 2 | Proof surface | Show a static, privacy-safe product view before asking for trust. | Same visual and equivalent text alternative; the image never carries meaning alone. | Shipped v0.6 UI only; synthetic labels and no room data. |
| 3 | Three proof chapters | Join simply; collaborate live; keep evidence responsibly. Each chapter names one user task and one shipped capability. | `ادخل بسهولة؛ اشتغلوا سوا؛ احتفظ بالدليل.` Keep technical terms in their familiar Latin form where used in the product. | v0.1, v0.1.8, and v0.2–v0.6 README sections. |
| 4 | Open source | Explain AGPL-3.0, the contributor path, and where the roadmap lives. | Explain the same contribution path without promising that planned milestones are shipped. | LICENSE, CONTRIBUTING.md, and GitHub milestones. |
| 5 | Final actions | Repeat “Try the live app” and “View the source”; add “Read the setup guide” as a quieter path. | Repeat equivalent Arabic actions with the same order and hierarchy. | Canonical links below. |

The page uses headings in order (`h1`, then one `h2` per section), sentence case, and a
reading order that remains complete when CSS, media, or motion is unavailable. There is
no testimonial, social-proof count, partner logo, pricing claim, integration claim, or
unverified AI promise.

## Showcase extension

The polished project showcase keeps the approved first-viewport contract and expands the
story in this order: **hero → why LOR. → one simple path → shipped capabilities →
capability comparison → privacy and control → open source and quick start → FAQ →
final actions**. The comparison uses a generic “conventional room” baseline rather than
naming competitors; every LOR. cell maps to a shipped README or release capability.

The quick-start panel mirrors the repository's current `#quick-start` commands and has a
copy button plus the visible code block as its fallback. FAQ answers are native
`details` disclosures so they remain keyboard and screen-reader accessible without
client-side navigation. The existing synthetic preview remains the only media until a
privacy-safe contribution satisfies [#220](https://github.com/Lord-shaban/lor/issues/220).

## Approved copy vocabulary

| Concept | English | Arabic-first |
|---|---|---|
| Product descriptor | Open-source video meetings that remember. | اجتماعات فيديو مفتوحة المصدر بتفتكر اللي يهم. |
| Join | Open a link, type your name, and join. | افتح اللينك، اكتب اسمك، وادخل. |
| Collaboration | Work together on a shared board and notes in the call. | اشتغلوا سوا على السبورة والنوتس جوّه المكالمة. |
| Evidence | Keep transcript-backed decisions and clear commitments. | احتفظ بقرارات ومهام راجعة لدليلها في الـtranscript. |
| Privacy | No account, no upload for local recordings, and retention/deletion boundaries are explicit. | من غير حساب، التسجيل المحلي ما بيترفعش، وحدود الحفظ والمسح واضحة. |
| Open source | AGPL-3.0; read the guide, pick an issue, and open a small PR. | AGPL-3.0؛ اقرأ الدليل، اختار issue، وافتح PR صغيرة. |

The page may say that the call works without AI or a key. It must not imply that AI
features are required, always available, or free from provider limits.

## Media inventory

The first implementation ships one static product visual and its text alternative. A
video is an optional enhancement, not a dependency for understanding the page.

| Asset | Owner | Purpose | Target format / dimensions | Text alternative | Privacy and licence | Status |
|---|---|---|---|---|---|---|
| `landing/product-preview.svg` | LOR. maintainers | Show the shipped launcher and evidence workspace language in the hero proof surface. | SVG, viewBox 1440×900; rendered responsively with `next/image` or inline fallback. | EN: “A synthetic LOR. meeting view shows the call stage beside a retained transcript and a host-reviewed decision.” AR: equivalent sentence, with all Latin runs isolated. | Project-authored vector; synthetic labels only; no room code, name, transcript, device label, key, or self-view. AGPL-3.0 repository asset. | Approved for #213; static fallback. |
| `landing/product-screenshot.webp` | LOR. maintainers | Optional replacement for the vector when a real shipped screen is captured. | WebP, 1600×1000 source, responsive derivatives. | Same semantic description as the vector, updated to match the captured state. | Capture from a local synthetic room only; review before publishing; no private data. | Follow-up capture, not required to block #213. |
| `landing/walkthrough.webm` + `landing/walkthrough.vtt` | Community contributor via [#220](https://github.com/Lord-shaban/lor/issues/220) | Demonstrate one short path from link → call → retained evidence. | WebM, ≤45s, 1280×720; VTT captions and a poster. | Full transcript supplied beside the player; captions are not the only source. | Silent or captioned synthetic demo; no autoplay; pause when hidden; contributor credits and licence recorded with the asset. | Optional; do not invent a placeholder video. |

The implementation must use `next/image` for raster images, reserve media dimensions to
avoid layout shift, lazy-load noncritical media, and provide a readable static fallback.
If a video is added later, it must have visible native controls, a poster, captions,
transcript, keyboard operation, and a reduced-motion poster state.

## Canonical destinations

| Label | URL | Use |
|---|---|---|
| Try the live app | `https://lor-bay.vercel.app` | Primary CTA; opens the product launcher. |
| View the source | `https://github.com/Lord-shaban/lor` | Primary CTA; repository, issues, and discussions. |
| Setup guide | `https://github.com/Lord-shaban/lor#quick-start` | Contributor/developer onboarding. |
| Contributing | `https://github.com/Lord-shaban/lor/blob/main/CONTRIBUTING.md` | Workflow, checks, and PR contract. |
| Security | `https://github.com/Lord-shaban/lor/blob/main/SECURITY.md` | Privacy and disclosure boundary. |
| Roadmap | `https://github.com/Lord-shaban/lor/milestones` | Current shipped and planned milestones. |

External links are explicit, keyboard reachable, and never hidden behind a hover-only
interaction. The live app and source actions are visually distinct but use the existing
neutral design tokens; red remains reserved for live or consequential state.

## Accessibility and verification contract

- Arabic RTL is the first pass, then English LTR, with equivalent section order, links,
  headings, and media alternatives.
- Use logical CSS properties and `<bdi>` only for isolated Latin runs inside Arabic UI.
- Every interactive target is at least 44×44px with a visible focus ring; keyboard order
  follows reading order and no focused control is obscured by sticky UI.
- Check contrast in light and dark themes, reduced motion, 200% zoom, and 375, 768,
  1024, and 1440px viewports without horizontal scroll.
- Media is decorative only when its adjacent text already explains the same idea. Alt
  text and the transcript carry the product claim; colour and motion never do.
- Visual evidence uses synthetic content and is reviewed for room codes, names,
  transcripts, device labels, keys, and self-view before it enters the PR.

## Claim ledger

Every product statement on the page must map to the shipped README sections: v0.1
meeting, v0.1.5 captions, v0.1.8 local recording/board/notes, v0.2 decisions, v0.3
action items, v0.4 Timeline, v0.5 Memory, or v0.6 semantic search. Integrations,
self-hosting, plugin APIs, end-to-end encryption, user accounts, and future milestones
are planned and stay out of the page's “available now” language.
