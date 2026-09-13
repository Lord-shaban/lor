# Open-source contribution map

LOR. is an Arabic-first, open-source video-meeting product: a person joins from a
link with no account, then keeps the useful result of the meeting — a retained
transcript and grounded decisions that return to their source evidence. The public
demo is [live](https://lor-bay.vercel.app); the code, discussions, and issues live in
the [repository](https://github.com/Lord-shaban/lor).

This page makes the next work legible without pretending that it is already shipped.
Read [CONTRIBUTING.md](../CONTRIBUTING.md) for the workflow and the
[Arabic guide](open-source.ar.md) for the same starting points in Arabic.

## Start here

- **New to LOR.?** Choose a labelled
  [`good first issue`](https://github.com/Lord-shaban/lor/labels/good%20first%20issue),
  such as [#222](https://github.com/Lord-shaban/lor/issues/222), comment before starting,
  and keep the resulting PR small.
- **Want the public story?** Start with [#212](https://github.com/Lord-shaban/lor/issues/212).
  It supplies the approved copy and media brief before a landing page is built.
- **Want to improve the product?** [#215](https://github.com/Lord-shaban/lor/issues/215)
  gathers evidence from the complete meeting journey before [#216](https://github.com/Lord-shaban/lor/issues/216)
  changes it.
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

This phase prepares an open-source project people can understand, try, and help improve.
It deliberately separates the **public landing page** from the **product home screen**:
the former explains and demonstrates LOR.; the latter gets someone into a meeting in two
clear actions. The release is planned, not shipped.

### Work sequence

1. [#212](https://github.com/Lord-shaban/lor/issues/212) establishes truthful English and
   Arabic copy plus an approved, privacy-safe media inventory.
2. [#213](https://github.com/Lord-shaban/lor/issues/213) builds the accessible, localised
   public landing page from that brief.
3. [#214](https://github.com/Lord-shaban/lor/issues/214) makes the existing home screen a
   product entry point instead of a release list.
4. [#215](https://github.com/Lord-shaban/lor/issues/215) audits the journey; then
   [#216](https://github.com/Lord-shaban/lor/issues/216) implements only its
   high-confidence fixes.
5. [#220](https://github.com/Lord-shaban/lor/issues/220) is a small, supervised media
   contribution after the inventory is approved.

### Landing-page brief

The landing page should lead with the concrete promise, then let the visitor verify it:

1. A concise hero and two distinct actions: **try the live app** and **view the source**.
2. A real product screenshot or short, controlled demo with an image/poster and text
   alternative.
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
