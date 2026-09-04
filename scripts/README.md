# Verification scripts

Most of this project cannot be verified by reading it. A grid layout that measures itself,
a permission prompt, a bidi label, two people seeing each other — all of them look correct
in the source and fail on screen. These drive a real browser instead.

## Why not `chrome --screenshot`

It fires when its virtual time budget expires, which is before any asynchronous media
pipeline has produced a frame. Every capture of the prejoin screen came back mid
"Opening devices…". These use the DevTools protocol so they can wait for an actual
condition. Node has had a built-in `WebSocket` since 22, so there are no dependencies.

## `screenshot.mjs`

```bash
node scripts/screenshot.mjs <url> <out.png> [textToWaitFor] [light|dark]
```

Waits for the text to appear before capturing. Runs with fake media devices and the
permission prompt auto-accepted, so camera and microphone paths are exercised.

## `two-party-call.mjs`

```bash
# create a room, then:
node scripts/two-party-call.mjs http://localhost:3000/en/<code> ./out
```

Two browsers with separate profiles join the same room and each asserts it can see **two
video tracks actually decoding frames** — not merely that two tiles appeared. Exits
non-zero if either cannot, so it works as a check.

This is the manual ancestor of `apps/web/e2e/call.spec.ts`, which does the same
thing in CI on every pull request. Keep this one for poking at a single case by
hand; the Playwright suite is what has to stay green.

## Notes

- The Chrome path is hardcoded to the Windows default; change it on another platform.
- `--use-fake-device-for-media-stream` produces a green test pattern and a steady tone,
  so both participants read as speaking. That is expected.
