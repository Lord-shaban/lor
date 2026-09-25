# Open-source contribution map

LOR. is an Arabic-first, open-source video-meeting product: a person joins from a
link with no account, then keeps the useful result of the meeting — a retained
transcript and grounded decisions that return to their source evidence. The public
demo is [live](https://lor-bay.vercel.app); the localized project story and setup are
available in the local [/docs](/docs) hub; the code, discussions, and issues live in
the [repository](https://github.com/Lord-shaban/lor).

The v0.7 product and documentation work is shipped. The later release briefs below
remain plans, not implemented integrations or hosting features.
Read [CONTRIBUTING.md](../CONTRIBUTING.md) for the workflow and the
[Arabic guide](open-source.ar.md) for the same starting points in Arabic.

## Start here

- **New to LOR.?** Check the [open issues](https://github.com/Lord-shaban/lor/issues)
  and their labels and dependencies; comment before starting and keep the PR small.
- **Want to understand the public story?** Read the current [/about](/about) page and
  [landing brief](landing-brief.md). The brief records the original constraints;
  the page reflects the later v0.7 revisions.
- **Want to improve the product?** Start from the completed
  [journey audit](product-ux-audit.md) and open a scoped issue with current evidence.
- **Want a later technical area?** The integration, self-hosting, and plugin boundary
  briefs are [#217](https://github.com/Lord-shaban/lor/issues/217),
  [#218](https://github.com/Lord-shaban/lor/issues/218), and
  [#219](https://github.com/Lord-shaban/lor/issues/219).

Every issue has scope, dependencies, and acceptance criteria. `blocked` means the
linked prerequisite must be resolved first; it is not an invitation to implement around
an undecided product or security boundary.

## Architecture and non-negotiables

| Area | Where it lives | Contribution boundary |
|---|---|---|
| App and routes | `apps/web/` | Next.js App Router; short-lived API handlers only |
| Real-time meeting state | LiveKit data channel + Yjs | No separate application WebSocket server |
| Retained data | `packages/db/` + Postgres | Room scoped, subject to retention and deletion |
| Captions quality | `apps/web/lib/stt/`, `eval/captions/` | Report WER and code-switch preservation before and after |
| Browser verification | `scripts/` | Two real browser contexts must decode media |

The following are release blockers, not suggestions:

- **Keys never reach storage, logs, caches, or error reports.**
- **A call works without AI, a key, or remaining quota.**
- **Arabic RTL is the first layout pass; English LTR is the second.** Use logical CSS,
  `lineDirection()` for user-authored lines, and `<bdi>` only around a foreign run in UI
  text. The Arabic form of the wordmark is `LOR.‎`.
- **Red means live or consequential.** It is not a decorative brand accent.
- **Privacy follows evidence.** Retention and deletion must remove derived data; public
  media may never reveal real meeting content, room codes, identities, or keys.

## v0.7 — Open-source launch and product experience

This phase made the open-source project easier to understand, try, and improve.
It deliberately separates the **public landing page** from the **product home screen**:
the former explains and demonstrates LOR.; the latter gets someone into a meeting in two
clear actions. v0.7 is shipped; provider integrations remain planned for v0.8.

### Work sequence

1. [#215](https://github.com/Lord-shaban/lor/issues/215) audited the journey and fixed the
   shared [product experience contract](product-ux-audit.md).
2. [#216](https://github.com/Lord-shaban/lor/issues/216) applied the validated meeting
   workspace fixes and its focused follow-ups; then
   [#214](https://github.com/Lord-shaban/lor/issues/214) made the existing home screen a
   product entry point instead of a release list.
3. [#212](https://github.com/Lord-shaban/lor/issues/212) established truthful English and
   Arabic landing copy plus a media inventory from the merged product design.
4. [#213](https://github.com/Lord-shaban/lor/issues/213) built the accessible, localised
   public landing page from that brief.
5. [#236](https://github.com/Lord-shaban/lor/issues/236) refined the public showcase
   and shipped the first localized docs hub. [#264](https://github.com/Lord-shaban/lor/issues/264)
   then rewrote and reorganized both public pages, added local resource pages, and
   replaced the retired captures with a responsive product illustration.
6. [#220](https://github.com/Lord-shaban/lor/issues/220) added one privacy-reviewed
   launcher capture to the media inventory; [#222](https://github.com/Lord-shaban/lor/issues/222)
   added the local documentation-link check.

### Landing-page brief

The implementation contract is kept in the bilingual [landing brief](landing-brief.md)
and [Arabic landing brief](landing-brief.ar.md). It records the approved section order,
claim ledger, canonical destinations, media ownership, privacy review, and accessibility
floor used to build the public page without inventing product claims. Current copy
and layout are governed by the page and locale messages after #264.

The landing page should lead with the concrete promise, then let the visitor verify it:

1. A concise hero and two distinct actions: **try the live app** and **read the local docs**;
   source/community links remain available but secondary.
2. A localized product illustration and text alternative, with a separate optional
   privacy-reviewed launcher capture in the media inventory.
3. A small feature story: join simply, collaborate live, and retain evidence responsibly.
4. A transparent open-source section: AGPL-3.0, contribution path, and current roadmap.
5. A final, repeated path to start a meeting or contribute.

Do not add unverified metrics, testimonials, partner logos, integrations, or AI claims.
Every video needs captions/transcript, visible playback controls, a static fallback, and
no autoplay. Use `next/image` for images; lazy-load noncritical media and pause video
when it is no longer visible. Preserve the existing neutral palette, Geist + IBM Plex
Sans Arabic stack, restrained 150–200ms motion, visible focus, and reduced-motion mode.

### Product-experience brief

The home screen's job is not marketing: it is to create or join a room. Roadmap and
source information remain available but become secondary. Any UX change must show the
task it improves, its loading/error/retry states, and evidence at 375, 768, 1024, and
1440px in both directions. Controls need keyboard access, a visible focus ring, 44px
touch targets, semantic headings, and meaning that does not depend on colour alone.

## Contributor-ready later releases

| Release | Open-source starting point | What it deliberately does not promise yet |
|---|---|---|
| `v0.8` Integrations | [#217](https://github.com/Lord-shaban/lor/issues/217): safe contract for signed, scoped providers | A provider implementation or a public API before its security boundary |
| `v0.9` Hardening and self-hosting | [#218](https://github.com/Lord-shaban/lor/issues/218): reference deployment and verification contract; [#221](https://github.com/Lord-shaban/lor/issues/221): reproducible local E2E | End-to-end encryption before a reviewed design and implementation |
| `v1.0` Plugin ecosystem | [#219](https://github.com/Lord-shaban/lor/issues/219): permission and threat-model boundary | A marketplace or runtime that can bypass consent, retention, or room scope |

## Definition of a good contribution

Open or claim one issue, branch from `main` as `<type>/<issue-number>-<slug>`, use a
Conventional Commit, and open a PR that closes the issue. Run the required checks;
for UI work include Arabic RTL and English LTR screenshots or a recording, and for
caption work include the evaluation numbers. A change is ready only when a reviewer can
reproduce its result without private context or private data.
