# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
