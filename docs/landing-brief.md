# LOR. public landing brief

Status: approved content and media contract for issue [#213](https://github.com/Lord-shaban/lor/issues/213), extended for the showcase pass in [#234](https://github.com/Lord-shaban/lor/issues/234), and refined with the public docs hub in [#236](https://github.com/Lord-shaban/lor/issues/236).
This brief is the source for the public project page; it does not change the product
launcher at `/[locale]`.
The live copy and section layout were subsequently revised in [#264](https://github.com/Lord-shaban/lor/issues/264);
the current page and locale messages govern those details. The media privacy and
accessibility rules below remain the contribution contract.

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
| 1 | Hero | “Meetings that remember what matters.” Explain open-source, Arabic-first video meetings in one sentence. | `اجتماعات بتفتكر اللي يهم.` Explain the same promise in plain Egyptian Arabic, with `LOR.‎` isolated in UI text. | README “What LOR. is”; no invented outcome or metric. |
| 2 | Proof surface | Show a static, privacy-safe product view before asking for trust. | Same visual and equivalent text alternative; the image never carries meaning alone. | Shipped capabilities only; synthetic labels and no room data. |
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
capability comparison → privacy and control → open source → FAQ → final actions**.
The current comparison names Zoom and Google Meet, qualifies plan-dependent features,
and links to official product documentation.

Issue #236 makes the identity explicit with the official LOR. geometry, a short
“Live Open Rooms” lockup, and a local docs CTA. GitHub remains a deliberately quieter
source/community path instead of being repeated as the page's primary action. The page
also includes a first-class localized docs hub at `/docs` and `/en/docs`: quick start,
workflow, shipped-versus-planned boundaries, architecture, contribution steps, and FAQ.

The quick-start panel mirrors the repository's current `#quick-start` commands and has a
copy button plus the visible code block as its fallback. FAQ answers are native
`details` disclosures so they remain keyboard and screen-reader accessible without
client-side navigation. The hero now uses a localized HTML/CSS illustration of a
meeting and its evidence workspace. The approved launcher capture below is a separate
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

The showcase currently uses a responsive illustration. This inventory records the
new optional capture and future media contributions. A video is an enhancement,
not a dependency for understanding the page.

| Asset | Owner | Purpose | Target format / dimensions | Text alternative | Privacy and licence | Status |
|---|---|---|---|---|---|---|
| `landing/product-launcher-ar.webp` | LOR. maintainers | Show the current Arabic launcher and its two entry paths without meeting data. | WebP, 732×918 at 2×; reserve this aspect ratio and display at up to 366 CSS px wide. | “واجهة بدء اجتماع LOR.‎ تعرض إنشاء اجتماع جديد وحقل إدخال رابط الدعوة وزر الانضمام.” EN: “The Arabic LOR. meeting launcher shows a new-meeting action, an empty invitation field, and a join action.” | [Capture and privacy review](landing-media.md); project-owned screenshot, AGPL-3.0-only. | Delivered for #220; available as an optional static product capture. |
| `landing/product-screenshot.webp` | LOR. maintainers | Optional future replacement for the vector when a wider real shipped screen is captured. | WebP, 1600×1000 source, responsive derivatives. | Same semantic description as the captured state. | Capture from a local synthetic room only; review before publishing; no private data. | Follow-up capture, not required for #236. |
| `landing/walkthrough.webm` + `landing/walkthrough.vtt` | Future contributor | Demonstrate one short path from link → call → retained evidence. | WebM, ≤45s, 1280×720; VTT captions and a poster. | Full transcript supplied beside the player; captions are not the only source. | Silent or captioned synthetic demo; no autoplay; pause when hidden; contributor credits and licence recorded with the asset. | Optional future contribution; do not invent a placeholder video. |

The hero now uses a localized HTML/CSS illustration rather than the retired SVG and
PNG captures from #213 and #236. The screenshot above is one new, independent media
entry; adding it to this inventory does not replace that illustration on the page.

The implementation must use `next/image` for raster images, reserve media dimensions to
avoid layout shift, lazy-load noncritical media, and provide a readable static fallback.
If a video is added later, it must have visible native controls, a poster, captions,
transcript, keyboard operation, and a reduced-motion poster state.

## Canonical destinations

| Label | URL | Use |
|---|---|---|
| Try the live app | `https://lor-bay.vercel.app` | Primary CTA; opens the product launcher. |
| Product docs | `/docs` and `/en/docs` | Localized setup, workflow, boundaries, architecture, and contribution guide. |
| View the source | `https://github.com/Lord-shaban/lor` | Secondary source/community path; repository, issues, and discussions. |
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
