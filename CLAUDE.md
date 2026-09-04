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
`margin-left`). Never hardcode `dir="rtl"` on text that may contain Latin script — use
`dir="auto"` and wrap Latin runs in `<bdi>`. Check both directions before opening a PR.

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
eval/captions/     transcription eval harness
docker/            self-hosting compose stack
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

**Bidi reordering — three times now.** `LOR.` rendered as `.LOR` in Arabic prose;
`أحمد's screen` rendered as `s screen'أحمد`. A neutral character or a Latin run adjacent
to RTL text lands on the wrong side. Any label mixing scripts needs `<bdi>` around the
foreign run, and Arabic message files need a LEFT-TO-RIGHT MARK after a trailing dot.
Never `dir="rtl"` on text that may contain Latin.

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

**A full-viewport element inside a page wrapper.** The call rendered inside the room
page's centred `max-w-4xl`, so `100dvh` overflowed and the grid measured 896px instead of
the screen. Diagnosed by reading the geometry out of the live page.

## Where things stand

GitHub is authoritative — issues, milestones, and the
[board](https://github.com/users/Lord-shaban/projects/8). Update this when a release
closes.

**Live:** <https://lor-bay.vercel.app>. Creating a room, the prejoin screen, joining, the
video grid and screen sharing all work in production today.

**Done.** `v0.0` in full. In `v0.1`: #9 room codes · #10 host cookie · #11 room creation ·
#12 LiveKit tokens · #13 prejoin · #14 video grid · #15 screen share · #22 i18n · #24
database · #8 design system.

**Next, in order.** #16 chat, reactions and raise hand over the data channel · #17 low
bandwidth and connection quality · #18 waiting room · #19 host moderation · #20 PWA and QR
· #21 Playwright end-to-end.

#16 is the one to start with. The data channel is already the plan of record for every
piece of real-time state; #17, #18 and #19 all build on it.

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
