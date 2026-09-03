import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Two browsers, one room. The check that has to keep passing.
 *
 * Each gets its own profile and its own fake devices, joins with a different
 * name, and then we assert that each one can actually see the other's video
 * track flowing — not merely that a tile appeared.
 */

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const [, , url, outDir = "."] = process.argv;

if (!url) {
  console.error("usage: node scripts/two-party-call.mjs <room-url> [out-dir]");
  console.error("  create a room first:");
  console.error("    curl -s -X POST -H 'Content-Type: application/json' \\");
  console.error("      -d '{}' http://localhost:3000/api/rooms");
  process.exit(1);
}

class Browser {
  constructor(label, port) {
    this.label = label;
    this.port = port;
    this.nextId = 1;
    this.pending = new Map();
  }

  async start() {
    const profile = mkdtempSync(join(tmpdir(), `lor-${this.label}-`));
    this.process = spawn(CHROME, [
      "--headless=new",
      `--remote-debugging-port=${this.port}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--disable-gpu",
      "--window-size=1100,760",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
      "about:blank",
    ]);

    let wsUrl;
    for (let i = 0; i < 80; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${this.port}/json/version`);
        wsUrl = (await r.json()).webSocketDebuggerUrl;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    if (!wsUrl) throw new Error(`${this.label}: no debugging port`);

    this.socket = new WebSocket(wsUrl);
    await new Promise((r) => this.socket.addEventListener("open", r));
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const resolver = this.pending.get(message.id);
      if (resolver) {
        this.pending.delete(message.id);
        resolver(message.result ?? message.error);
      }
    });

    const { targetId } = await this.send("Target.createTarget", { url: "about:blank" });
    const attached = await this.send("Target.attachToTarget", { targetId, flatten: true });
    this.sessionId = attached.sessionId;
    await this.send("Page.enable", {}, this.sessionId);
    await this.send("Runtime.enable", {}, this.sessionId);
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  async evaluate(expression) {
    const result = await this.send(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
      this.sessionId,
    );
    return result?.result?.value;
  }

  async waitFor(expression, label, timeout = 30_000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if ((await this.evaluate(expression)) === true) return true;
      await new Promise((r) => setTimeout(r, 400));
    }
    console.log(`  ${this.label}: TIMED OUT waiting for ${label}`);
    return false;
  }

  async goto(target) {
    await this.send("Page.navigate", { url: target }, this.sessionId);
  }

  async join(name) {
    await this.waitFor(
      `!!document.querySelector('input[autocomplete="name"]')`,
      "the prejoin",
    );
    await this.evaluate(`
      (() => {
        const input = document.querySelector('input[autocomplete="name"]');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, ${JSON.stringify(name)});
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      })()
    `);
    await this.evaluate(`document.querySelector('button[type="submit"]').click(), true`);
  }

  /** Count video elements that are actually decoding frames, not just present. */
  playingVideos() {
    return this.evaluate(`
      Array.from(document.querySelectorAll("video"))
        .filter((v) => v.srcObject && v.videoWidth > 0 && v.readyState >= 2).length
    `);
  }

  async screenshot(path) {
    const shot = await this.send("Page.captureScreenshot", { format: "png" }, this.sessionId);
    writeFileSync(path, Buffer.from(shot.data, "base64"));
  }

  stop() {
    this.socket?.close();
    this.process?.kill();
  }
}

const alice = new Browser("alice", 9611);
const bob = new Browser("bob", 9612);

await alice.start();
await bob.start();

console.log("both browsers up");

await alice.goto(url);
await alice.join("أحمد");
console.log("alice joined");

await bob.goto(url);
await bob.join("Sarah");
console.log("bob joined");

// Two video elements each: yourself and the other person.
const aliceSees = await alice.waitFor(
  `Array.from(document.querySelectorAll("video")).filter((v) => v.srcObject && v.videoWidth > 0).length >= 2`,
  "two live videos",
);
const bobSees = await bob.waitFor(
  `Array.from(document.querySelectorAll("video")).filter((v) => v.srcObject && v.videoWidth > 0).length >= 2`,
  "two live videos",
);

await new Promise((r) => setTimeout(r, 1500));

console.log("");
console.log(`alice sees ${await alice.playingVideos()} live video(s)   ok=${aliceSees}`);
console.log(`bob   sees ${await bob.playingVideos()} live video(s)   ok=${bobSees}`);
console.log("");
console.log("alice's page:");
console.log((await alice.evaluate("document.body.innerText")).trim().slice(0, 300));
console.log("");
console.log("bob's page:");
console.log((await bob.evaluate("document.body.innerText")).trim().slice(0, 300));

await alice.screenshot(join(outDir, "call-alice.png"));
await bob.screenshot(join(outDir, "call-bob.png"));

alice.stop();
bob.stop();
process.exit(aliceSees && bobSees ? 0 : 1);
