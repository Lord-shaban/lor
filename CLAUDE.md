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
punctuation. It is the live indicator, which is why it carries the accent colour
(`#6366f1`) while the letters stay neutral.

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

## Verification

```bash
npm run typecheck && npm run lint && npm run build
```

For anything touching the call, open the room in two browser profiles (one normal, one
incognito) with different names. Throttle to Slow 3G in DevTools to check the
low-bandwidth path.

## Working with Ahmed

Replies in Egyptian Arabic; technical terms stay in English. He reads the reasoning, not
just the result — say what was verified and what was not, and flag anything that only
looked correct. He asked for full GitHub access, so act on the repository directly
rather than handing back instructions, but still confirm before anything destructive
(history rewrites, force pushes, deleting branches or issues).
