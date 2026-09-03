# Contributing to LOR.

Thanks for being here. LOR. is built in the open, one issue at a time.

## The one rule

**Nothing reaches `main` without an issue and a pull request.** Not a typo fix, not a
dependency bump. The commit history is the project's documentation, and it only works
if it is complete.

## The loop

```
Issue #42  ←── description + acceptance criteria checklist
   │
   ├─► branch: feat/42-vad-chunker
   │      ├─ commit: feat(stt): add silero vad wasm loader
   │      └─ commit: feat(stt): chunk audio on speech boundaries
   │
   └─► PR #43  ──►  CI ✅ + Vercel preview 🔗  ──►  squash merge → Closes #42
```

1. **Find or open an issue.** Look for [`good first issue`][gfi] if you are new. Say in
   the issue that you are picking it up so nobody duplicates the work.
2. **Branch from `main`** using `<type>/<issue-number>-<short-slug>`, e.g.
   `feat/42-vad-chunker`, `fix/58-reconnect-on-network-switch`.
3. **Commit** using [Conventional Commits](https://www.conventionalcommits.org).
   `commitlint` enforces this locally and in CI.
4. **Open a PR** with the template filled in. Keep it small — 100 to 300 changed lines
   is the target. A reviewer should be able to read it in ten minutes. If a change is
   genuinely larger, split it across several PRs behind an unreleased flag.
5. **Green CI + a preview link.** Every PR gets a working Vercel deploy. Use it.

[gfi]: https://github.com/Lord-shaban/lor/labels/good%20first%20issue

## Commit format

```
<type>(<scope>): <subject in the imperative, lowercase>
```

Types: `feat` `fix` `docs` `refactor` `perf` `test` `build` `ci` `chore` `revert`

Scopes: `call` `stt` `ai` `board` `room` `keys` `ui` `i18n` `db` `infra` `deps` `readme` `eval`

```
feat(captions): preserve latin script for english terms
fix(call): reconnect after switching from wifi to mobile data
docs(readme): add Arabic quick start
```

## Local setup

```bash
git clone https://github.com/Lord-shaban/lor && cd lor
cp .env.example .env.local     # fill in LiveKit and Supabase values
npm install
npm run dev
```

Before pushing:

```bash
npm run typecheck && npm run lint && npm run build
```

## Rules that are not negotiable

### Never touch a key

No API key — the user's or the operator's — may be written to the database, to a log,
to a cache, or to any error report. Proxy routes forward and return; they do not
persist. If your change touches `apps/web/lib/llm/`, `apps/web/lib/stt/`, or
`apps/web/app/api/`, expect a careful review. See [SECURITY.md](SECURITY.md).

### Captions changes need numbers

Mixed Arabic/English speech is the hardest problem in this codebase, and it is easy to
"improve" it into being worse. Any PR that touches `apps/web/lib/stt/` must include
eval results in the PR body:

```bash
npm run eval:captions
```

Report **WER** and **code-switch preservation rate** (the share of English words that
stayed in Latin script) before and after your change. A PR that lowers WER but drops
code-switch preservation is not an improvement.

Real failing examples are valuable on their own — open a
[caption accuracy issue](../../issues/new?template=captions_accuracy.yml) even if you
are not going to fix it. Good examples become eval cases.

### Both directions, always

LOR. is Arabic-first and English-second, not English with a translation bolted on. If
you change layout, check it in both. Use CSS logical properties (`margin-inline-start`,
not `margin-left`). Never hardcode `dir="rtl"` on text that may contain Latin script —
use `dir="auto"` and wrap Latin runs in `<bdi>`.

### The call works without AI

Transcription, summaries, decisions, and action items are all optional. If someone has
no API key and no quota left, the meeting itself — video, audio, screen share, chat,
whiteboard, recording — must still work perfectly.

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

Contributions are licensed under [AGPL-3.0](LICENSE), the same license as the project.
