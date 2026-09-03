<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.svg">
  <img src="assets/logo.svg" alt="LOR." width="200">
</picture>

**Live Open Rooms** — open-source video meetings that remember.

No account. No time limit. No download.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![CI](https://github.com/Lord-shaban/lor/actions/workflows/ci.yml/badge.svg)](https://github.com/Lord-shaban/lor/actions/workflows/ci.yml)
[![Roadmap](https://img.shields.io/badge/roadmap-v0.0%20%E2%86%92%20v1.0-6366f1)](https://github.com/Lord-shaban/lor/milestones)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)

[العربية](README.ar.md) · [Roadmap](#roadmap) · [Self-hosting](#self-hosting) · [Contributing](CONTRIBUTING.md)

</div>

---

> [!NOTE]
> **Status: `v0.0` — foundation.** The repository scaffold, CI, and contribution
> workflow are in place. The meeting itself lands in `v0.1`. Every feature below is
> tagged with the release it ships in, so nothing here claims to work before it does.
> Follow the [milestones](https://github.com/Lord-shaban/lor/milestones) to track progress.

## What LOR. is

Most video tools treat a meeting as something that happens and then disappears. You get
a recording nobody watches and a chat log nobody reads. LOR. treats the meeting as the
beginning: what was decided, who owes what, and what was said stay searchable
afterwards.

It is built to be as easy to join as Google Meet — open a link, type a name, you are in
— and to do the things Meet either cannot do or puts behind a paid plan.

It is also built for people who speak two languages in one sentence. **"عملت الـ deploy
على الـ server"** is how a lot of the world actually talks, and almost every
transcription tool mangles it. Getting that right is a first-class goal here, not an
afterthought.

## Why LOR.

|  | LOR. | Google Meet (free) | Zoom (free) | Jitsi |
|---|:---:|:---:|:---:|:---:|
| Time limit | none | 60 min for 3+ | 40 min | none |
| Account required | no | host needs one | host needs one | no |
| Recording | local, free | paid plan | local | yes |
| **Mixed Arabic/English captions** | **yes** | no | no | no |
| Automatic decisions and action items | yes | no | paid | no |
| Memory across meetings | yes | no | no | no |
| Semantic search of past meetings | yes | no | paid | no |
| Plugin API | yes | no | yes | no |
| Self-hostable | yes | no | no | yes |
| Arabic RTL interface | first-class | partial | partial | partial |
| Bring your own AI key | yes | n/a | n/a | n/a |

## Features

### The meeting — `v0.1`

- **Join in two clicks.** `lor.dev/mza-krf-tqn` → type a name → you are in. No account,
  no install, no browser extension.
- **A prejoin screen that respects you.** Test your camera and microphone, pick your
  devices, see your own audio level before anyone hears you.
- **QR code** to move a meeting to your phone mid-call. Installable as a PWA.
- **Built for bad networks.** Adaptive quality, an honest per-participant connection
  indicator, and a prominent audio-only mode that keeps a call usable on mobile data.
- **Host controls.** Waiting room, mute one or all, remove, lock the room, hand over
  host. The host is identified by a signed cookie — still no account.

### Captions that survive code-switching — `v0.1.5`

Standard speech recognition fails on bilingual speech in a specific, documented way:
it transliterates English into Arabic script — *"ديبلوي"* instead of *"deploy"* — or
quietly translates instead of transcribing. LOR. addresses this in layers:

- **Voice-activity chunking**, so audio is split on sentence boundaries rather than
  arbitrary five-second windows. Cutting mid-word is the single biggest cause of
  garbled output.
- **A code-switched prompt** that primes the model to keep Latin script for Latin words.
- **A room glossary** — add your team's names and technical terms once and they stop
  being guessed at.
- **Correct bidirectional rendering** with `dir="auto"` and `<bdi>` isolation, so mixed
  text does not scramble its own word order.
- **A measured eval set** in [`eval/captions/`](eval/captions) that scores word error
  rate *and* code-switch preservation. Every change to the transcription code has to
  show its numbers.

### Recording, whiteboard, notes — `v0.1.8`

Record locally in the browser and download the file — no paid tier, no upload. A shared
whiteboard and collaborative notes sync live over the meeting's own data channel.

### Meeting memory — `v0.2` to `v0.6`

| Release | What it adds |
|---|---|
| `v0.2` | **Decisions** — extracted with timestamp, speaker, and the exact quote |
| `v0.3` | **Action items** — owner and due date; open tasks resurface at the start of the next meeting |
| `v0.4` | **Timeline** — topic chapters, per-person talk time, flagged moments you can jump to |
| `v0.5` | **Memory** — a recurring room remembers its decisions, open tasks, and vocabulary |
| `v0.6` | **Semantic search** — *"when did we talk about pricing?"* across every meeting |

### Integrations and plugins — `v0.7`, `v1.0`

Signed outgoing webhooks, calendar and note-taking integrations, task export, and a
documented plugin API with a permission model so the community can extend LOR. without
forking it.

## AI keys

AI features work out of the box on the hosted demo using the operator's key, with a
fair per-user daily quota. When that quota runs out, LOR. points you at a free key of
your own and shows you how to get one — it takes about two minutes.

Your own key is stored encrypted in your browser and sent **directly to the provider**
wherever CORS permits, so it never reaches our servers at all. When a request must be
proxied, the route forwards and returns without logging, caching, or storing anything.
**No API key is ever written to the database.** See [SECURITY.md](SECURITY.md).

Supported providers: Groq, Google Gemini, OpenAI, OpenRouter, Anthropic, Deepgram,
ElevenLabs, and any OpenAI-compatible endpoint — including a local Ollama or LM Studio.

The meeting itself never depends on any of this. With no key and no quota, video,
audio, screen share, chat, whiteboard, and recording all still work.

## Quick start

```bash
git clone https://github.com/Lord-shaban/lor && cd lor
cp .env.example .env.local     # add your LiveKit and Supabase values
npm install && npm run dev
```

Open <http://localhost:3000>.

You need a [LiveKit Cloud](https://cloud.livekit.io) project (the free tier is enough
for development) and a [Supabase](https://supabase.com) project. Both take a few minutes
and neither requires a card.

## Self-hosting

> Ships in `v0.8`.

```bash
docker compose -f docker/docker-compose.yml up -d
```

Brings up the web app, a LiveKit SFU, a TURN server, and Postgres. A single small VPS
handles a real team. Self-hosting is a first-class path, not an afterthought — the
hosted demo runs the same code.

## Configuration

| Variable | Required | Description |
|---|:---:|---|
| `NEXT_PUBLIC_LIVEKIT_URL` | yes | LiveKit server URL, e.g. `wss://your.livekit.cloud` |
| `LIVEKIT_API_KEY` | yes | LiveKit API key |
| `LIVEKIT_API_SECRET` | yes | LiveKit API secret |
| `DATABASE_URL` | yes | Postgres connection string |
| `LOR_HOST_COOKIE_SECRET` | yes | Secret used to sign host cookies |
| `LOR_STT_API_KEY` | no | Operator's speech-to-text key. Omitted means users bring their own |
| `LOR_LLM_API_KEY` | no | Operator's LLM key. Omitted means users bring their own |
| `LOR_FREE_STT_SECONDS_PER_USER_PER_DAY` | no | Per-user daily transcription quota |
| `LOR_FREE_LLM_TOKENS_PER_USER_PER_DAY` | no | Per-user daily LLM quota |
| `LOR_FREE_STT_SECONDS_GLOBAL_PER_DAY` | no | Server-wide safety cap |

See [`.env.example`](.env.example) for the full list.

## Architecture

Media and all real-time application state travel over LiveKit. The server does short
request/response work only — no long-lived socket of our own — which is what lets the
same codebase run on serverless and on a single self-hosted box.

```
┌─────────────┐         media (WebRTC)        ┌──────────────────┐
│   Browser   │ ◄───────────────────────────► │     LiveKit      │
│  (Next.js)  │ ◄───── data channel ────────► │  cloud or self   │
└──────┬──────┘   chat · reactions · captions └────────┬─────────┘
       │          whiteboard · notes · knock           │
       │ REST (short-lived)                            │ webhooks
       ▼                                               ▼
┌────────────────────────────────────────────────────────────┐
│  Next.js route handlers                                    │
│  tokens · rooms · admission · STT proxy · AI · quotas      │
└──────────────────────────┬─────────────────────────────────┘
                           ▼
              ┌───────────────────────────────┐
              │  Postgres (+ pgvector)        │
              │  rooms · transcripts          │
              │  decisions · tasks · usage    │
              └───────────────────────────────┘
```

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind 4 · LiveKit · Yjs · tldraw ·
Drizzle · Postgres.

## Roadmap

| Release | Name | Status |
|---|---|---|
| `v0.0` | Foundation | in progress |
| `v0.1` | The Call | planned |
| `v0.1.5` | Captions | planned |
| `v0.1.8` | Canvas | planned |
| `v0.2` | Decisions | planned |
| `v0.3` | Action items | planned |
| `v0.4` | Meeting timeline | planned |
| `v0.5` | Meeting memory | planned |
| `v0.6` | Semantic search | planned |
| `v0.7` | Integrations | planned |
| `v0.8` | Hardening and self-hosting | planned |
| `v1.0` | Plugin ecosystem | planned |

Tracked in [milestones](https://github.com/Lord-shaban/lor/milestones).

## Contributing

Every change goes through an issue and a pull request — including small ones. Start with
[`good first issue`](https://github.com/Lord-shaban/lor/labels/good%20first%20issue), and
read [CONTRIBUTING.md](CONTRIBUTING.md) first.

Bilingual speech examples that LOR. gets wrong are genuinely useful even without a fix.
Open a [caption accuracy issue](https://github.com/Lord-shaban/lor/issues/new?template=captions_accuracy.yml)
and it becomes an eval case.

## License

[AGPL-3.0](LICENSE). You may run, modify, and self-host LOR. freely. If you offer a
modified version as a network service, you must publish your changes.

Built on [LiveKit](https://livekit.io), [Yjs](https://yjs.dev),
[tldraw](https://tldraw.dev), and [Whisper](https://github.com/openai/whisper).
