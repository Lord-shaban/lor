# Security Policy

## Reporting a vulnerability

Please report security issues privately through
[GitHub Security Advisories](https://github.com/Lord-shaban/lor/security/advisories/new)
rather than opening a public issue.

We aim to acknowledge a report within 72 hours and to ship a fix or a mitigation
before any public disclosure.

## What we consider high severity

LOR handles live audio, meeting transcripts, and third-party API keys. Anything that
exposes those is treated as high severity:

- An API key reaching our server logs, our database, or another user
- A participant reading a room they were never admitted to
- A transcript or recording leaking outside the meeting it belongs to
- Bypassing host controls (waiting room, room lock, removal)
- Token forgery that grants publish rights in another room

## Our key-handling guarantees

These are invariants, not preferences. A change that breaks one is a bug:

1. **No API key is ever written to the database.** Not the user's, not the operator's.
2. **User-supplied keys stay in the browser.** They are stored encrypted in
   `localStorage` and sent directly to the provider whenever CORS allows it.
3. **The proxy routes are stateless.** When a request must pass through our server
   (because the operator's key is used, or the provider blocks browser calls), that
   route forwards and returns. It does not log, cache, or persist the audio, the
   transcript, or the key.
4. **Transcription is opt-in and announced.** Participants are told in the room when
   transcription starts, and any room can disable it entirely.

## Supported versions

Until `v1.0`, only the latest release receives security fixes.
