# Security Policy

## Reporting a vulnerability

Please report security issues privately through
[GitHub Security Advisories](https://github.com/Lord-shaban/lor/security/advisories/new)
rather than opening a public issue.

We aim to acknowledge a report within 72 hours and to ship a fix or a mitigation
before any public disclosure.

## What we consider high severity

LOR. handles live audio, meeting transcripts, and third-party API keys. Anything that
exposes those is treated as high severity:

- An API key reaching our server logs, our database, or another user
- A participant reading a room they were never admitted to
- A transcript or recording leaking outside the meeting it belongs to
- Bypassing host controls (waiting room, room lock, removal)
- Token forgery that grants publish rights in another room

## Our key-handling guarantees

These are invariants, not preferences. A change that breaks one is a bug:

1. **No API key is ever written to the database.** Not the user's, not the operator's.
2. **User-supplied keys stay in the browser.** They are stored encrypted there and sent
   directly to the provider whenever CORS allows it — measured per provider, not
   assumed. On that path neither the key nor the audio reaches our server at all.

   Be precise about what that encryption buys, because overstating it is its own
   vulnerability. The key material is encrypted under a **non-extractable**
   `CryptoKey` held in the same IndexedDB, so dumping the database — a backup, a
   copied profile, a sync, an extension enumerating storage — yields ciphertext and a
   key object that cannot be exported. It does **not** defend against script running
   in the page's own origin, because nothing can: such script can ask for the key the
   same way the captions do.
3. **The proxy routes are stateless.** When a request must pass through our server
   (because the operator's key is used, or the provider blocks browser calls), that
   route forwards and returns. It does not log, cache, or persist the audio, the
   transcript, or the key.
4. **Transcription is opt-in and announced.** Participants are told in the room when
   transcription starts, and any room can disable it entirely.
5. **Keeping a record is a second decision, announced separately.** Agreeing that words
   may appear on a screen for a few seconds is not agreeing that they are written down
   and readable next month, so the record announces itself with its own message and can
   be off while captions are on. Only the accurate pass is stored — never the browser's
   provisional guess.
6. **A transcript is kept for 30 days and then removed**, and anybody in the meeting can
   delete it sooner. Deleting takes the summary with it, because a summary is a copy of
   what was deleted. The period is stated in the room itself, not only here; the number
   lives in one place in the code, so this file and the interface cannot drift apart.
   An operator may shorten it and deliberately cannot lengthen it — that would quietly
   break a promise made to people in the room.

> **What is enforced today.** All four hold in the shipped code as of
> [#91](https://github.com/Lord-shaban/lor/issues/91). This note remains only to say
> that it was once not the case: numbers 2 and 4 were written here before they were
> built, and were labelled as such rather than left to read as fact. A security policy
> that quietly describes unbuilt features is not a policy.

## Supported versions

Until `v1.0`, only the latest release receives security fixes.
