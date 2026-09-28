# LOR. public landing brief

Status: approved content and media contract for issue [#213](https://github.com/Lord-shaban/lor/issues/213), extended for the showcase pass in [#234](https://github.com/Lord-shaban/lor/issues/234), and refined with the public docs hub in [#236](https://github.com/Lord-shaban/lor/issues/236).
This brief is the source for the public project page; it does not change the product
launcher at `/[locale]`.
The live copy and section layout were subsequently revised in [#264](https://github.com/Lord-shaban/lor/issues/264);
the current page and locale messages govern those details. The September 2026 refresh
uses a shared official wordmark, real product captures with synthetic content, a focused
competitor analysis, and one documentation shell for the guide and resource pages.
The media privacy and accessibility rules below remain the contribution contract.

## What the page must do

The page introduces LOR. to a developer or meeting organiser who has never seen it.
Within the first viewport they should understand the promise, see that the product is
real, and choose one of two honest next steps:

- **Try the live app** at [lor-bay.vercel.app](https://lor-bay.vercel.app).
- **Read the product docs** at the local [`/docs`](/docs) hub.

The public routes are `/about` for the Arabic default locale and `/en/about` for English
(`/ar/about` remains an explicit locale alias). The default locale may also be reached
through the locale-aware link from the product home; the product route remains the
shortest path for starting or joining a meeting.

## Information architecture and copy intent

| Order | Section | English intent | Arabic-first intent | Evidence boundary |
|---|---|---|---|---|
| 1 | Hero | Explain the open-source meeting workspace and the reviewed results it retains in one clear sentence. | Explain the same promise in formal Arabic, with `LOR.‎` isolated in UI text. | README “What LOR. is”; no invented outcome or metric. |
| 2 | Proof surface | Show a static, privacy-safe product view before asking for trust. | Same visual and equivalent text alternative; the image never carries meaning alone. | Shipped capabilities only; synthetic labels and no room data. |
| 3 | Three proof chapters | Join simply; collaborate live; keep evidence responsibly. Each chapter names one user task and one shipped capability. | Describe joining, live collaboration, and reviewing retained evidence in formal Arabic. Keep technical terms in their familiar Latin form where used in the product. | v0.1, v0.1.8, and v0.2–v0.6 README sections. |
| 4 | Open source | Explain AGPL-3.0, the contributor path, and where the roadmap lives. | Explain the same contribution path without promising that planned milestones are shipped. | LICENSE, CONTRIBUTING.md, and GitHub milestones. |
| 5 | Final actions | Repeat “Try the live app” and “View the source”; add “Read the setup guide” as a quieter path. | Repeat equivalent Arabic actions with the same order and hierarchy. | Canonical links below. |

The page uses headings in order (`h1`, then one `h2` per section), sentence case, and a
reading order that remains complete when CSS, media, or motion is unavailable. There is
no testimonial, social-proof count, partner logo, pricing claim, integration claim, or
unverified AI promise.

## Showcase extension

The polished project showcase keeps the approved first-viewport contract and expands the
story in this order: **hero → why LOR. → one simple path → shipped capabilities →
capability comparison → privacy and control → open source → FAQ → final actions**.
The current comparison names Zoom and Google Meet, qualifies plan-dependent features,
and links to official product documentation.

The current identity uses the official LOR. geometry and a local documentation CTA.
Product screenshots demonstrate actual shipped screens; any illustrative meeting scene
is labelled as an example and must not be presented as a real customer meeting. GitHub remains a deliberately quieter
source/community path instead of being repeated as the page's primary action. The page
also includes a localized documentation shell at `/docs` and `/en/docs`: grouped project
navigation, page anchors, workflow, capabilities and limits, architecture, local setup,
contribution steps, and FAQ. Security, contribution, roadmap, license, support, and source
guides are first-class local pages under `/resources/[topic]`. Mobile navigation uses
native disclosures and desktop navigation remains visible beside the article.

The quick-start panel mirrors the repository's current `#quick-start` commands and has a
copy button plus the visible code block as its fallback. FAQ answers are native
`details` disclosures so they remain keyboard and screen-reader accessible without
client-side navigation. Product captures are placed in restrained responsive frames
with descriptive captions. The approved launcher capture below remains a separate
media contribution under [#220](https://github.com/Lord-shaban/lor/issues/220).

## Historical copy vocabulary (#213)

This table records the original brief. Current Arabic and English public copy is in
the locale messages after #264.

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

The hero uses a real localized meeting-interface capture with clearly disclosed
synthetic data. The story uses the real localized home screen. Both appear in
original responsive frames with reserved image dimensions, descriptive captions,
and full-size inspection links. Neither is a customer meeting or live-service proof.

| Asset | Purpose | Format / dimensions | Text alternative and provenance |
|---|---|---|---|
| `landing/product-call-ar.webp` and `product-call-en.webp` | Show actual meeting controls and confirmed decisions with their source evidence. | WebP, 1440×900; preserve aspect ratio. | Localized description and explicit demo caption; [capture review](landing-media.md). |
| `landing/product-home-ar.webp` and `product-home-en.webp` | Show the official identity and two real meeting-entry paths. | WebP, 1440×900; preserve aspect ratio. | Localized home-screen description; [capture review](landing-media.md). |
| `landing/product-launcher-ar.webp` | Historical launcher capture from #220, no longer displayed. | WebP, 732×918. | [Earlier capture and current inventory](landing-media.md). |

Assets are project-owned and licensed AGPL-3.0-only. No imagery was copied from
reference projects. The temporary offline capture fixture is not shipped.
Use `next/image`: preload the hero, lazy load secondary media, and retain the
text description. No autoplay video or decorative motion is required.

## Canonical destinations

| Label | URL | Use |
|---|---|---|
| Try the live app | `https://lor-bay.vercel.app` | Primary CTA; opens the product launcher. |
| Product docs | `/docs` and `/en/docs` | Localized setup, workflow, boundaries, architecture, and contribution guide. |
| Source guide | `/resources/source` | Local code map, with an explicit onward action to the repository. |
| Setup guide | `/docs#quick-start` | Local development commands and configuration boundaries. |
| Contributing | `/resources/contributing` | Workflow, checks, and the onward issue/PR path. |
| Security | `/resources/security` | Privacy boundaries and explicit private-reporting action. |
| Roadmap | `/resources/roadmap` | Current release and planned milestones, with an onward tracking link. |
| License | `/resources/license` | License summary and link to the governing legal text. |
| Help | `/resources/help` | Troubleshooting and guidance for a useful issue report. |

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
are not shipped guarantees and stay out of the page's “available now” language.
The product experience and public docs shipped in v0.7; official Docker self-hosting
is v0.9 work. Cross-room search and indexing the live occurrence are deliberate limits,
not promised future capabilities. Comparison claims name their plans or conditions and
link to primary product documentation; no blanket claim that competitors lack AI,
action items, recording, or browser participation is acceptable.
