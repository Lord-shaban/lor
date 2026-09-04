# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Work towards `v0.1.5 — Captions`. Mixed Arabic and English in one sentence is the
hardest problem in this project, so the two things that make a caption change
*reviewable* landed before any engine did.

### Added

- **An eval harness** in `eval/captions/` — its own npm workspace, so its metrics
  are unit tested by `npm test` like anything else. It scores word error rate,
  character error rate, and **code-switch preservation**: the share of the
  reference's English words still in Latin script.

  The third number exists because the first one is actively misleading here. A
  hypothesis that writes every English term in Arabic script scores a *better*
  WER (33.3%) than one that translates the sentence (100%) while preserving none
  of the English — so optimising for WER alone would push this product toward
  exactly the failure it exists to prevent. Neither number is sufficient alone,
  which is why both are reported.

- **`lib/bidi.ts`**, which decides a mixed line's direction by counting its
  words. `dir="auto"` reads the first strong character, so an Arabic sentence
  opening with an English term lays out left to right with its full stop at the
  wrong end — and a caption arriving word by word would flip direction while
  somebody is reading it. A link or a bracketed aside counts once, not once per
  word inside it. Applied to chat messages; the composer keeps `dir="auto"`,
  because measuring a draft moves the caret under the person typing.

### Changed

- The isolate-every-Latin-run approach was built and then removed. Rendering
  twenty four mixed lines in a browser and reading the visual order back
  character by character: `<bdi>` around every Latin run changed **none** of
  them, while the paragraph direction changed four. `CLAUDE.md`,
  `CONTRIBUTING.md` and the README now say which of the two problems wants which
  repair.

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
