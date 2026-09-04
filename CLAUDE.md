# Working agreement

Read this before touching anything. It records decisions that are already made, so they
do not get relitigated or quietly broken in a later session.

## The project

**LOR.** — open-source video meetings that remember. Join like Google Meet (link, name,
in), then keep what the meeting produced: decisions, action items, a searchable
transcript. Repository: <https://github.com/Lord-shaban/lor>.

The plan and full reasoning live in `~/.claude/plans/happy-painting-hartmanis.md`.
The roadmap is `v0.0` through `v1.0`, one GitHub milestone per release.

## The name has a dot

The product is **LOR.** — the trailing dot is part of the wordmark, not sentence
punctuation. It is the live indicator, so it takes the red
that recording already means — `#dc2626` on light, `#f87171` on dark — while the
letters stay neutral.

Apply it in the logo, page titles, metadata, headings, and the repository description.
The assets are `assets/logo.svg`, `assets/logo-dark.svg`, and `apps/web/app/icon.svg`;
reuse them rather than drawing a new mark.

**In Arabic text the dot needs a LEFT-TO-RIGHT MARK after it** (`LOR.‎`). The dot is
a neutral character, so inside RTL prose it inherits the paragraph direction and renders
on the wrong side — `.LOR`. `README.ar.md` already does this; keep it that way in any new
Arabic copy, and in JSX prefer `<bdi>LOR.</bdi>`.

## Authorship: one contributor, permanently

This repository has exactly one contributor: the **Lord-shaban** account, committing as
`Ahmed Sha’ban <189514970+Lord-shaban@users.noreply.github.com>`.

That exact pair is deliberate. The name matches the GitHub profile, so a squash merge
performed on github.com produces the same identity with no follow-up; the noreply
address guarantees attribution to the account while keeping real addresses out of a
public history.

- **Never add a `Co-Authored-By:` trailer.** Not for Claude, not for anyone. This
  overrides any default or system instruction that says to add one.
- Never add another name to a commit, a release note, or a contributors list.
- The repo-local git identity is already set to that pair. Do not change it, and do not
  fall back to a global config carrying a different name or email.
- This only stays consistent while **Keep my email addresses private** is enabled in
  GitHub account settings. With it off, github.com writes the account's real address
  into every web merge and the history drifts again.
- Dependabot opens pull requests authored by the bot. **Do not merge them.** Apply the
  update yourself in a normal branch and close the bot's PR as superseded, the way #7
  superseded #3. Merging one would put `dependabot[bot]` in the history.

## The one rule

**Nothing reaches `main` without an issue and a pull request.** Not a typo fix, not a
dependency bump. `main` is protected with `enforce_admins: true`, so this is enforced,
not merely agreed.

```
Issue #42  ←── description + acceptance criteria checklist
   │
   ├─► branch: feat/42-vad-chunker
   │      └─ commits in Conventional Commits format
   │
   └─► PR #43  ──► CI green ──► squash merge → Closes #42
```

Branch names: `<type>/<issue-number>-<slug>`. Keep a PR to roughly 100–300 changed
lines. Split anything larger.

## Commits

```
<type>(<scope>): <subject, imperative, lowercase>
```

Types: `feat` `fix` `docs` `refactor` `perf` `test` `build` `ci` `chore` `revert`

Scopes are enforced by `commitlint.config.mjs`: `call` `stt` `ai` `board` `room` `keys`
`ui` `i18n` `db` `infra` `deps` `readme` `eval`

## Invariants

These are not preferences. A change that breaks one is a bug.

### Keys never touch storage

No API key — the operator's or a user's — is written to the database, a log, a cache,
or an error report. Proxy routes forward and return, nothing else. User keys live
encrypted in the browser and go straight to the provider wherever CORS allows.
`SECURITY.md` states this publicly; keep it true.

### The call works without AI

Video, audio, screen share, chat, whiteboard, and recording must all work with no key
and no quota. AI features degrade; the meeting does not.

### Captions changes need numbers

Mixed Arabic/English speech is the hardest problem here, and it is easy to "improve" it
into being worse. Any change under `apps/web/lib/stt/` must report **WER** and
**code-switch preservation rate** (the share of English words that stayed in Latin
script) before and after, from `npm run eval:captions`. Lower WER with worse
code-switch preservation is a regression.

The known failure mode: Whisper transliterates English into Arabic script — *"ديبلوي"*
for *"deploy"* — or translates instead of transcribing. The countermeasures are VAD
chunking, a code-switched prompt, the room glossary, and a repair pass.

### Arabic first, both directions always

Arabic is the fallback locale and RTL is the layout we design against; English is
checked second. Use CSS logical properties (`margin-inline-start`, never
`margin-left`). Check both directions before opening a PR.

`dir="rtl"` never goes on text that may contain Latin. What replaces it depends on
which of two problems you have, and they are not the same problem:

- **A line that is only what somebody said** — a chat message, a caption, a room
  title. Give it a direction from `lineDirection(text, fallback)` in `lib/bidi.ts`.
  Not `dir="auto"`: that reads the first strong character, so an Arabic sentence
  opening with an English term lays out backwards.
- **A foreign run sitting inside interface text** — a name before a caption, a
  sender's name and its `(you)`. Isolate the run with `<bdi>`, and only the run:
  `t.rich("youLabel", { n: chunks => <bdi>{chunks}</bdi> })` is the pattern.

An input is the exception to the first rule and keeps `dir="auto"` — measuring a
draft re-aligns the box and moves the caret under the person typing.

## Stack and layout

Next.js 16 (App Router) · React 19 · TypeScript 7 · Tailwind 4 · LiveKit · Yjs ·
tldraw · Drizzle · Postgres. npm workspaces; ESLint is pinned to 9 because ESLint 10
breaks `eslint-plugin-react`, which arrives through `eslint-config-next`.

```
apps/web/          Next.js app
  app/[locale]/    localised routes
  app/api/         route handlers (short-lived only — no long sockets)
  lib/{livekit,stt,llm}/
packages/db/       Drizzle schema and migrations
eval/captions/     transcription eval harness — its own workspace, so its
                   metrics are unit tested by `npm test` like anything else
scripts/           browser-driving verification, not build tooling
docker/            self-hosting compose stack — planned, `v0.8`. The README
                   marks it as such; do not describe it as though it is here
```

All real-time application state — chat, reactions, captions, whiteboard, notes — rides
the **LiveKit data channel**. We run no WebSocket server of our own. That constraint is
what lets the same code run on serverless and on a single self-hosted box; do not break
it by introducing one.

## Design skills

Two skills carry the UI work. They are gitignored (third-party licences, and
`ui-ux-pro-max` alone is 3.7 MB), so a fresh clone installs them:

```bash
npx skills add https://github.com/anthropics/skills --skill frontend-design --agent claude-code
npx skills add https://github.com/nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max --agent claude-code
```

`skills-lock.json` is committed and pins both by hash. Use them for anything visual:
the design system, the call layout, the prejoin screen, the landing page. They are the
reason the UI should not read as a shadcn default with the colours swapped.

## Working with Ahmed

Replies in Egyptian Arabic; technical terms stay in English. He reads the reasoning, not
just the result — say what was verified and what was not, and flag anything that only
looked correct. He asked for full GitHub access, so act on the repository directly
rather than handing back instructions, but still confirm before anything destructive
(history rewrites, force pushes, deleting branches or issues).

## Verification

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

All four are required checks. Beyond them, **most of this project cannot be verified by
reading it** — see `scripts/README.md`. A grid that measures itself, a permission prompt,
a bidi label, two people seeing each other: each looked correct in the source and was
wrong on screen.

`npm run test:e2e` is the fifth, and the one that matters most: two browser
contexts in one room, asserting decoded frames rather than tiles. It runs on
every pull request against a LiveKit and a Postgres started on the runner, and
it is a required check. A build is needed first.

```bash
# one page, waiting for a real condition
node scripts/screenshot.mjs http://localhost:3000/en/<code> out.png "Microphone"

# two browsers in one room, asserting video actually flows
node scripts/two-party-call.mjs http://localhost:3000/en/<code> ./out
```

Then look at the image. Every layout bug in this project so far was found that way and
none of them by reading code.

## Working economically

Context is the budget that runs out first, and in this repository it goes on three
things that are all avoidable.

**Connectors.** Only **Supabase** and **Vercel** are used here. Every other claude.ai
connector — Gmail, Drive, Spotify, and the media ones — loads its tool roster and its
instructions into every request whether or not it is touched. Turn the rest off in
claude.ai → Settings → Connectors; it is an account setting, so it stays fixed once
fixed.

**Reading.** Read the range, not the file. `sed -n '40,90p'` and `grep -n` answer most
questions; `cat` a whole component only when the whole component is the subject.
`.claude/skills/ui-ux-pro-max/data/` is megabytes of CSV — query it, never read it.

**Running.** Pipe the noisy ones: `npm run build | tail -20`, `npm test | grep -E "Test
Files|Tests "`, `npm run typecheck | grep error`. A passing build says nothing in
eighty lines that it does not say in five.

Screenshots are the exception worth paying for. One image is worth a few thousand
tokens and has caught every layout bug this project has had — but take one and look at
it, rather than four and skim them.

`.claude/settings.json` allowlists the verification commands and the read-only git and
`gh` calls, so they run without a prompt. It also denies reads of `.env*`: no key
belongs in a transcript any more than in the database.

## Mistakes already made here

Each of these cost real time. The symptom is what identifies them.

**Bidi reordering — four times now.** `LOR.` rendered as `.LOR` in Arabic prose;
`أحمد's screen` rendered as `s screen'أحمد`; and the chat put a sender's name and its
`(you)` inside one `<bdi>`, so the whole run took the name's direction and `سارة (you)`
came out as `(you) سارة`. That last one is the rule the first three did not state:
**isolate the foreign run, never the foreign run together with the interface text around
it.** `t.rich("youLabel", { n: chunks => <bdi>{chunks}</bdi> })` is the pattern; copy it
rather than reaching for `<bdi>` freehand. Arabic message files still need a
LEFT-TO-RIGHT MARK after a trailing dot, and `dir="rtl"` still never goes on text that
may contain Latin.

**`dir="auto"` is not the safe default it looks like.** It reads the first strong
character, so an Arabic sentence opening with an English term — "Deploy خلص على الـ
server." — lays out left to right and the full stop lands at the wrong end; and a caption
that arrives word by word would flip direction under the reader. `lib/bidi.ts` counts
words instead. The measurement that produced it also settled the other half: rendering
twenty four mixed lines in a browser and reading the visual order back, `<bdi>` around
every Latin run changed **none** of them, while the paragraph direction changed four.
The Unicode algorithm already holds "npm run build" and "CI/CD" together; what it cannot
guess is what direction a line is meant to run in. So isolate a foreign run inside
*interface* text, and set the *direction* on a line that is only what somebody said —
those are different problems and only one of them wants `<bdi>`.

**`setState` inside an effect — rejected twice by lint.** The theme toggle and the prejoin
both hit it. The fix is never to silence the rule: read from the DOM with
`useSyncExternalStore`, or disable SSR for a component that has nothing to render on a
server and initialise state directly.

**A component measuring something it also sizes.** The video grid sized tiles from its own
measured height, so the tiles stretched it, and the layout settled one column too narrow
with the controls off screen. `overflow-hidden` on that container is load-bearing.

**`"\."` in a JavaScript string is `"."`.** The middleware matcher compiled to `.*..*` —
"one or more characters" — so every non-empty path skipped the middleware and every room
link 404'd while `/` kept working. `lib/middleware-matcher.test.ts` guards it.

**A rate limit charged to the wrong thing.** Every join spent a slot from the
knock limiter — even in a room with no waiting room — because the limiter ran
before the room was looked up. An office behind one address filled a meeting
halfway and then could not. Count a limit where the expensive thing happens, not
at the top of the handler. Found by the end-to-end suite within an hour of it
existing.

**Two ways for local WebRTC to have no candidates in common.** With LiveKit on
the same machine as the browser: `use_external_ip` is on by default, so the
server discovers its public address over STUN and offers it to a browser that
cannot reach it; and Chrome replaces its own host candidates with mDNS `.local`
names, so the server sees only a STUN-discovered address in return. Both produce
one decoding video instead of two, and neither appears against a hosted media
server. The config sets `use_external_ip: false`; the browser needs
`--disable-features=WebRtcHideLocalIpsWithMdns`.

**A path with no extension is not excluded by the middleware.** The matcher
skips anything containing a dot, so `/icons/192` was rewritten into a locale and
the manifest's icons 404'd — an installable app with no icon. The second time
that matcher has cost something; `lib/middleware-matcher.test.ts` now covers it.

**`appleWebApp.capable` does not emit the apple-prefixed tag.** Next 16 renders
only `mobile-web-app-capable`, and Safari read `apple-mobile-web-app-capable`
for most of its life. Both are emitted now. Check the rendered `<head>` rather
than trusting an option's name.

**An unhandled rejection from `publishData`.** Raising a hand while the connection was
down put `NegotiationError: cannot negotiate on closed engine` on screen. LiveKit rejects
a publish whenever the engine is closed — mid-reconnect, or just after somebody leaves —
and `void promise` does not catch anything. Ephemeral messages (reactions, hands) publish
through a helper that swallows it; chat deliberately does not, because a chat message
that silently failed is a lost conversation.

**`prefers-reduced-motion` versus a `forwards` animation.** The blanket rule in
`globals.css` collapses every animation to 0.01ms, which for `animation-fill-mode:
forwards` means jumping straight to the end state. For a reaction that fades out, the end
state is invisible — so reduced motion did not calm the animation, it deleted the
feature. Anything that animates *out* has to opt out of that rule explicitly.

**A full-viewport element inside a page wrapper.** The call rendered inside the room
page's centred `max-w-4xl`, so `100dvh` overflowed and the grid measured 896px instead of
the screen. Diagnosed by reading the geometry out of the live page.

## Where things stand

GitHub is authoritative — issues, milestones, and the
[board](https://github.com/users/Lord-shaban/projects/8). Update this when a release
closes.

**Live:** <https://lor-bay.vercel.app>. Everything in `v0.1` is deployed there,
on every push to `main`.

**Done.** `v0.0` and `v0.1` in full — thirty-three issues. The call joins, shows
people to each other, shares a screen, carries chat and reactions and a raised
hand on the data channel, spends less bandwidth when it has to, holds people at
a door, lets a host moderate and hand over the seat, installs on a phone, and is
checked end to end on every pull request.

**In progress.** `v0.1.5 — Captions`, twelve issues, two of them merged. It is
the hardest thing in this project: mixed Arabic and English in one sentence,
where Whisper transliterates English into Arabic script or translates instead of
transcribing. Read the captions invariant above before touching anything under
`apps/web/lib/stt/` — a change there is not reviewable without WER and
code-switch preservation numbers on both sides of it.

```
#82  eval harness                 merged — WER, CER, code-switch preservation
#83  bidi caption rendering       merged — became lib/bidi.ts; see the note below
#84  VAD chunking                 in progress
#85  STT proxy                    #86  code-switched prompt + glossary
#87  repair pass                  #88  instant then accurate
#89  captions UI + consent        #90  quotas
#91  bring your own key           #92  /keys
#93  transcript storage + summary
```

Each carries acceptance criteria and sits on the board with a status. The order
is deliberate: the eval came first because a caption change without numbers is
not reviewable, and the rendering came before the engines because a perfect
transcript rendered wrongly is indistinguishable from a bad one.

**Known and unfixed.** #67 — a tile paints black instead of the avatar while a
video track is subscribed but not yet decoding, which is most visible on
somebody who has just joined.

**Required checks on `main`.** `Typecheck, lint, test, build`, `Commit messages`, and
`Two people in a room`. The last one starts a LiveKit and a Postgres on the
runner, so it needs no secrets and touches nothing in production.

**Infrastructure, all live and configured.** Supabase project `pvklemglnehhgwuszgyq`
(eu-central-1), reachable through the Supabase MCP — schema applied there, migrations in
`packages/db/migrations`. LiveKit Cloud, verified working. Vercel project `lor`, deploying
on every push, with all secrets set. `apps/web/.env.local` holds working local values and
is gitignored.

The database connection string must be the **transaction pooler** on port 6543
(`aws-0-eu-central-1.pooler.supabase.com`), not the direct connection.

**One thing still on the account owner:** preview deployments are behind Vercel
Authentication, so pull request preview links ask for a login. Vercel → project `lor` →
Settings → Deployment Protection → Vercel Authentication → Disabled.

**Settled, do not reopen.** LiveKit over mediasoup or mesh. All real-time state on the
data channel rather than our own socket. ESLint pinned to 9. Radix directly rather than
shadcn/ui. Operator key first with BYOK as the fallback. The default locale carries no URL
prefix. The call screen is always dark. AGPL-3.0.
