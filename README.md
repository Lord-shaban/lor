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
> **Status: Meeting memory is live.** `v0.0`, `v0.1`, `v0.1.5`, `v0.1.8`, `v0.2`, `v0.3`, `v0.4`, and `v0.5` have
> shipped and are deployed at [lor-bay.vercel.app](https://lor-bay.vercel.app): open a
> link, type a name, hold a real meeting with mixed Arabic/English captions, record
> locally, work together on a shared board or note, confirm decisions against their
> exact transcript evidence, and turn clear commitments into assigned work that returns
> at the start of the next meeting. Retained captions also become an on-demand Timeline
> with evidence-backed chapters, moments, and talk time — and a bounded Memory of
> confirmed decisions, open work, vocabulary, and repeated caption labels from past
> completed meetings.
> Follow the [milestones](https://github.com/Lord-shaban/lor/milestones) to track progress.

## What LOR. is

Most video tools treat a meeting as something that happens and then disappears. You get
a recording nobody watches and a chat log nobody reads. LOR. treats the meeting as the
beginning: the retained transcript keeps what was said, and host-confirmed decisions
stay attached to their exact evidence.

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
| Grounded decision proposals | yes | no | paid | no |
| Action items | yes | no | paid | no |
| Memory across meetings | yes, bounded | no | no | no |
| Semantic search of past meetings | not yet | no | paid | no |
| Plugin API | not yet | no | yes | no |
| Self-hostable | not yet | no | no | yes |
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
- **Correct bidirectional rendering.** A line's direction is measured from the words in
  it, not taken from its first character — an Arabic sentence that opens with an English
  term is still an Arabic sentence, and `dir="auto"` lays it out backwards.
- **A measured eval set** in [`eval/captions/`](eval/captions) that scores word error
  rate *and* code-switch preservation. Every change to the transcription code has to
  show its numbers.

### Recording, whiteboard, notes — `v0.1.8`

Record locally in the browser and download the file — no paid tier, no upload. A shared
whiteboard and collaborative notes sync live over the meeting's own data channel.

### Decisions with evidence — `v0.2`

A host can ask LOR. to propose decisions from a retained transcript, but a proposal is
never presented as a settled fact. Its original quote, speaker, and UTC time stay fixed
as evidence; only the host can edit the final wording, confirm it, or delete it.
Everyone can read confirmed decisions, and the confirmed record downloads as portable
text with the same evidence. Deleting or expiring the transcript removes its decisions
too.

### Action items that return — `v0.3`

LOR. can propose only clear, participant-owned commitments from the kept meeting
record. A proposal remains a proposal until the host reviews its wording, picks the
known owner, and confirms the agreed due date. The exact source quote, speaker, and UTC
time remain alongside the task; only that participant's browser session can complete it.

Open work resurfaces when a recurring room genuinely starts its next meeting. It does
not appear again on a reconnect to the same meeting, and deleting or expiring its source
removes the task with it.

### Timeline anchored in captions — `v0.4`

Timeline opens on demand for the confirmed active meeting occurrence. Its talk time is
the sum of voice-activity durations on **retained captions** — not attendance,
microphone-open time, or an estimate of every word someone spoke. Anyone in the meeting
can flag a current-occurrence moment; a host can request generated chapters and
highlights that point only to server-resolved retained transcript lines. Every card
returns to its source evidence.

If a completed local WebM is still held in this same browser tab, a Timeline moment can
seek within it. That file is never uploaded, shared, or kept by LOR.; after a reload,
from another participant or device, or outside the recording window, Timeline links to
the retained transcript instead. Deleting or expiring that transcript removes its
Timeline derivatives too.

### Meeting memory anchored in evidence — `v0.5`

Meeting memory opens on demand in a recurring room and reads only
server-confirmed, completed occurrences. It brings forward confirmed decisions,
open action items, and the room glossary when each has retained caption evidence;
every fact returns to its exact quote, speaker label, and UTC time in the
transcript.

Memory can also show an exact display name repeated in retained captions from at
least two completed occurrences. That label is not attendance, verified identity,
or a people directory. The current occurrence, proposals, completed tasks,
expired or deleted captions, unscoped legacy records, and another room's data do
not enter memory. Deleting or expiring a source removes its derived fact too.

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
| `LOR_FREE_STT_SECONDS_PER_USER_PER_DAY` | no | Free transcription per person per day, in seconds of audio. Default 900 |
| `LOR_FREE_STT_SECONDS_PER_ROOM_PER_DAY` | no | The same, per meeting. Default 3600 |
| `LOR_FREE_STT_SECONDS_GLOBAL_PER_DAY` | no | Server-wide, so a runaway cannot spend the operator's key. Default 18000 |
| `LOR_FREE_LLM_TOKENS_PER_USER_PER_DAY` | no | Per-user daily LLM quota |
| `LOR_FREE_DECISION_EXTRACTIONS_PER_USER_PER_DAY` | no | Host-triggered decision extractions per requester and meeting per day. Default 3; `0` disables the operator-backed extractor |
| `LOR_FREE_ACTION_ITEM_EXTRACTIONS_PER_USER_PER_DAY` | no | Host-triggered action-item extractions per requester and meeting per day. Default 3; `0` disables the operator-backed extractor |
| `LOR_FREE_TIMELINE_GENERATIONS_PER_USER_PER_DAY` | no | Host-triggered Timeline generations per requester and meeting per day. Default 3; `0` disables the operator-backed generator |
| `LOR_CANVAS_RETENTION_DAYS` | no | Shared board and notes retention, 30 days maximum |

See [`.env.example`](.env.example) for the full list.

Participants can bring their own key instead, and `/keys` on any running
instance says where one comes from — free tier, limits, whether a card is
needed, and where in each provider's console the key is.

Transcription quotas are counted in **seconds of audio**, not requests — a
twenty-second utterance and a one-second one are the same request and twenty
times the cost. All three reset at UTC midnight, and a participant using their
own key is never counted against any of them.

Setting one to `0` means **no free transcription at that scope**: everybody
brings their own key. That is the way to run LOR. without lending your own key
at all. There is no setting meaning "unlimited" — an operator who does not want
rationing sets a large number.

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

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind 4 · LiveKit · Yjs · Excalidraw ·
Drizzle · Postgres.

## Roadmap

| Release | Name | Status |
|---|---|---|
| `v0.0` | Foundation | **shipped** |
| `v0.1` | The Call | **shipped** — [live](https://lor-bay.vercel.app) |
| `v0.1.5` | Captions | **shipped** — [live](https://lor-bay.vercel.app) |
| `v0.1.8` | Canvas | **shipped** — [live](https://lor-bay.vercel.app) |
| `v0.2` | Decisions | **shipped** — [live](https://lor-bay.vercel.app) |
| `v0.3` | Action items | **shipped** — [live](https://lor-bay.vercel.app) |
| `v0.4` | Meeting timeline | **shipped** — [live](https://lor-bay.vercel.app) |
| `v0.5` | Meeting memory | **shipped** — [live](https://lor-bay.vercel.app) |
| `v0.6` | Semantic search | planned |
| `v0.7` | Integrations | planned |
| `v0.8` | Hardening and self-hosting | planned |
| `v1.0` | Plugin ecosystem | planned |

Tracked in [milestones](https://github.com/Lord-shaban/lor/milestones) and on the
[board](https://github.com/users/Lord-shaban/projects/8). Every open issue carries
acceptance criteria, so anything on the board can be picked up without asking what
it means. [`CHANGELOG.md`](CHANGELOG.md) records what each release actually
contained.

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
[Excalidraw](https://github.com/excalidraw/excalidraw), and [Whisper](https://github.com/openai/whisper).
