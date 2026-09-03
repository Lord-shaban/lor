import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Screenshot a page after it has actually settled.
 *
 * `chrome --screenshot` fires when its virtual time budget runs out, which is
 * before an async media pipeline has produced a frame — so a prejoin screen is
 * always captured mid-"Opening devices…". Driving the DevTools protocol lets us
 * wait for a real condition instead of guessing a duration.
 *
 * Node has had a built-in WebSocket since 22, so this needs no dependencies.
 */

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const [, , url, out, waitForText, colorScheme = "dark"] = process.argv;

if (!url || !out) {
  console.error(
    "usage: node scripts/screenshot.mjs <url> <out.png> [waitForText] [light|dark]",
  );
  process.exit(1);
}

const profile = mkdtempSync(join(tmpdir(), "lor-chrome-"));
const port = 9500 + Math.floor(Math.random() * 400);

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--disable-gpu",
  "--window-size=1280,900",
  // A real getUserMedia stream and a real audio signal, with the permission
  // prompt auto-accepted, so the preview and the level meter both exercise the
  // same code paths they would with hardware.
  "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream",
  "--autoplay-policy=no-user-gesture-required",
  `--blink-settings=preferredColorScheme=${colorScheme === "light" ? 1 : 2}`,
  "about:blank",
]);

chrome.on("error", (error) => {
  console.error("chrome failed to start:", error.message);
  process.exit(1);
});

async function endpoint() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      return (await response.json()).webSocketDebuggerUrl;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("Chrome never opened its debugging port");
}

const socket = new WebSocket(await endpoint());
await new Promise((resolve) => socket.addEventListener("open", resolve));

let nextId = 1;
const pending = new Map();

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const resolver = pending.get(message.id);
  if (resolver) {
    pending.delete(message.id);
    resolver(message.result ?? message.error);
  }
});

function send(method, params = {}, sessionId) {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", {
  targetId,
  flatten: true,
});

await send("Page.enable", {}, sessionId);
await send("Runtime.enable", {}, sessionId);
await send("Page.navigate", { url }, sessionId);

// Poll for the condition rather than sleeping a fixed time: the point is to
// capture the settled state, whenever that happens to be.
const deadline = Date.now() + 25_000;
let ready = false;

while (Date.now() < deadline) {
  const result = await send(
    "Runtime.evaluate",
    {
      expression: waitForText
        ? `document.body?.innerText?.includes(${JSON.stringify(waitForText)}) ?? false`
        : "document.readyState === 'complete'",
      returnByValue: true,
    },
    sessionId,
  );

  if (result?.result?.value === true) {
    ready = true;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
}

// Let one more frame paint after the condition is met.
await new Promise((resolve) => setTimeout(resolve, 900));

const shot = await send(
  "Page.captureScreenshot",
  { format: "png", captureBeyondViewport: true },
  sessionId,
);

writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log(`${ready ? "settled" : "TIMED OUT waiting"} → ${out}`);

socket.close();
chrome.kill();
process.exit(0);
