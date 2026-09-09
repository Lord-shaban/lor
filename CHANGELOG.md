# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.8] — Canvas

The call now has a shared visual workspace that stays with the room while
keeping meeting media on each participant's device.

### Added

- Local browser recording captures the chosen call video and mixed audio, then
  downloads a playable WebM. Starting and stopping are announced to the room;
  no recording blob is sent to LOR., LiveKit data messages, or the database.
- An on-demand, MIT-licensed Excalidraw whiteboard supports shared drawing,
  mixed Arabic/English text, erasing, and undo. Camera, selection, and viewport
  remain local so one participant does not move another's workspace.
- Collaborative rich-text meeting notes use the same room Canvas as the board.
  Concurrent edits, a late join, and a reconnect converge through Yjs over the
  meeting's LiveKit data channel; LOR. still runs no socket server of its own.
- Board and notes are retained together as a versioned, room-scoped snapshot
  for up to 30 days. Writes are batched, reopening the room restores the latest
  safe state, and any participant can delete the saved Canvas early.
- The two-person browser suite now checks the complete Canvas flow: idle board
  stability, a shared drawing and note edit, a late join, reconnect recovery,
  local recording download, and lazy loading of the heavier editors.

### Fixed

- The shared board no longer disappears on a deployed HTTPS domain after the
  five-second tldraw production-license check. Earlier tldraw records are
  preserved and remain downloadable from the board, but are not automatically
  converted to Excalidraw.
- Successful Canvas saves with Vercel's weak `ETag` responses now retain the
  correct revision instead of displaying a false save-failure notice.

## [0.1.5] — Captions

Mixed Arabic/English meetings can now become a readable record without making
AI a requirement for the call.

### Added

- Live captions cut speech at utterance boundaries, show a fast provisional
  line, then replace it in place with the accurate result. A code-switched
  prompt, room glossary, reusable corrections, and word-count direction
  preserve English technical terms inside Arabic speech; the eval workspace
  reports WER, CER, and code-switch preservation.
- Captions are announced room-wide before transcription starts. Each
  participant sends only their own microphone and can keep it out of
  transcription; joining late still shows the persistent notice.
- Optional transcript keeping is a separate, separately announced choice. Only
  settled, attributed results are stored — never the provisional preview — and
  remain readable and downloadable for up to 30 days, even without a summary
  key or quota. Downloads preserve speaker, UTC time, order, and mixed-language
  text. Any participant can delete the record early, including its summary.
  Expired rows and derived summaries are cleaned up when the record is read;
  physical cleanup is not scheduled for unopened rooms.
- Summaries surface decisions, owners, and open questions while preserving
  code-switching. They are always labelled as model-generated, stay one click
  from their source transcript, and warn when newer lines make them stale.
- Operator-funded transcription has daily per-person, per-room, and server-wide
  limits measured in audio seconds, with advance warning and reset at UTC
  midnight. Exhaustion stops captions only; the meeting continues. `0`
  deliberately disables the free allowance.
- BYOK for Groq and OpenAI, plus a `/keys` guide linking only to official
  provider sources with checked dates and no affiliate links. Keys are
  ciphertext in IndexedDB under a non-extractable browser key; Groq audio goes
  directly from browser to provider, while unsupported or unmeasured direct
  paths use a stateless proxy that does not log, cache, persist, or echo the key
  or audio. BYOK bypasses operator quotas.

### Fixed

- Participant tiles keep the avatar visible until video has actually decoded a
  frame, and restore it when frames stall, instead of painting a black tile
  after join.
- Expired transcript lines no longer leave their derived summary readable.
  Transcript speaker names are separated from mixed-language speech so each
  line can keep its own direction.

## [0.1.0] — The Call

A meeting you can actually hold. Open a link, type a name, and you are in — no
account, no download, no time limit.

### Added

- **The call.** A video grid that measures itself rather than reading a
  breakpoint table, active-speaker highlighting that waits long enough to be a
  turn rather than a twitch, and screen sharing that takes the stage on its own.
- **A prejoin screen** that shows you what everybody else will see, and names
  the actual problem when a device will not open.
- **Chat, reactions and a raised-hand queue**, all on LiveKit's data channel —
  there is still no socket server of our own. The sender is never on the wire;
  attribution comes from the media server.
- **A video mode** with an audio-only option one press away, and automatic
  degradation that says so rather than quietly getting worse.
- **A waiting room.** Knock, wait, and be told which of "the host has not
  answered" and "nobody is in there" is true. A refusal is final.
- **Host moderation**: mute one or everyone, stop a screen share, remove with a
  rejoin block, lock the room, and hand the seat over. Every action is announced
  — a microphone that closes on its own is indistinguishable from one that
  broke.
- **Installable on a phone**, with a service worker that caches build-hashed
  assets and one offline page and nothing else, and a QR of the join link.
- **Arabic-first routing** with the default locale unprefixed, and a design
  system built against RTL rather than adapted to it.
- **An end-to-end check** that puts two browsers in one room against a real
  media server and asserts decoded frames, running on every pull request.

### Fixed

- Room links 404'd: `"\."` in the middleware matcher is `"."`, which excluded
  every non-empty path.
- Vercel deployments failed because husky ran during a production install.

## [0.0.0] — Foundation

### Added

- Repository foundation: workspace layout, CI, issue and PR templates, contribution
  guides, and the AGPL-3.0 license.
