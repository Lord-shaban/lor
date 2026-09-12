import { createHash, randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { readFile, stat } from "node:fs/promises";
import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { RoomServiceClient } from "livekit-server-sdk";
import {
  actionItems,
  decisions,
  getDb,
  meetingOccurrences,
  rooms,
  timelineGeneratedMoments,
  transcriptLines,
} from "@lor/db";
import * as Y from "yjs";
import { CANVAS_SNAPSHOT_CONTENT_TYPE } from "../lib/canvas-snapshot-protocol";

/**
 * Two people, one room, and the two things that have to keep working.
 *
 * Everything else in CI can be green while nobody can see anybody. So the
 * assertions here are about frames and about a message arriving, not about
 * elements existing: a tile renders perfectly well with no video in it, and
 * that is exactly the regression worth catching.
 *
 * Each participant gets its own context. Two pages in one context share
 * `sessionStorage`, and the session id in there is what the server hashes into
 * a LiveKit identity — so they would join as the same participant and one would
 * evict the other.
 */

/**
 * How long to wait for frames.
 *
 * Longer than the default assertion timeout, and deliberately: negotiating
 * media is not rendering an element. On a loaded runner, or a cold region, the
 * first decoded frame can be twenty seconds behind the tile that will show it —
 * and a suite that calls that a failure teaches people to press retry, which is
 * the one thing a required check must never do.
 */
const MEDIA_TIMEOUT = 45_000;

/**
 * Mirrors the server-only token helper without importing its LiveKit SDK
 * dependency into Playwright's browser-facing test runtime.
 */
function participantIdentity(livekitRoom: string, sessionId: string): string {
  const salt = process.env.LIVEKIT_API_SECRET ?? "";
  const digest = createHash("sha256")
    .update(`${livekitRoom}:${salt}:${sessionId}`)
    .digest("hex");
  return `p_${digest.slice(0, 24)}`;
}

// The production proxy rewrites this header with the actual caller address.
// Playwright talks to Next directly, so each test room gets a private address:
// an expanding suite must not consume one real ten-rooms-per-hour test bucket.

/** Inspect painted document pixels, not just a mounted canvas element. */
async function boardInk(page: Page) {
  return page.locator("canvas.excalidraw__canvas.static").evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const context = canvas.getContext("2d")!;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let ink = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (Math.abs(pixels[i] - pixels[0]) + Math.abs(pixels[i + 1] - pixels[1]) + Math.abs(pixels[i + 2] - pixels[2]) > 60) ink++;
    }
    return ink;
  });
}

function addNoteParagraph(document: Y.Doc, value: string) {
  const paragraph = new Y.XmlElement("paragraph");
  const text = new Y.XmlText();
  text.insert(0, value);
  paragraph.insert(0, [text]);
  const notes = document.getXmlFragment("notes");
  notes.insert(notes.length, [paragraph]);
}

async function persistedNotes(page: Page, code: string) {
  const response = await page.request.get(`/api/rooms/${code}/canvas`);
  if (response.status() !== 200) return "";
  const saved = new Y.Doc();
  Y.applyUpdate(saved, new Uint8Array(await response.body()));
  const notes = saved.getXmlFragment("notes").toString();
  saved.destroy();
  return notes;
}

/** Resources fetched after a deliberate user action, excluding initial call UI. */
async function resourcesSince(page: Page, before: Set<string>) {
  return page.evaluate((known) =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry as PerformanceResourceTiming)
      .filter((entry) => !known.includes(entry.name))
      .map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        transferSize: entry.transferSize,
      })),
  Array.from(before));
}

async function loadedResourceNames(page: Page) {
  return new Set(
    await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => entry.name),
    ),
  );
}

/** Videos on this page that are decoding frames, not merely present. */
async function playingVideos(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      Array.from(document.querySelectorAll("video")).filter(
        (video) =>
          video.srcObject instanceof MediaStream &&
          video.srcObject.getVideoTracks().length > 0 &&
          video.videoWidth > 0 &&
          video.readyState >= 2,
      ).length,
  );
}

async function createRoom(page: Page): Promise<string> {
  const response = await page.request.post("/api/rooms", {
    data: {},
    headers: { "x-forwarded-for": `playwright-${randomUUID()}` },
  });
  expect(response.ok()).toBe(true);
  const { code } = await response.json();
  expect(typeof code).toBe("string");
  return code as string;
}

async function join(page: Page, code: string, name: string, locale = "en") {
  await page.goto(`/${locale}/${code}`);

  const nameField = page.locator('input[autocomplete="name"]');
  await expect(nameField).toBeVisible();
  await nameField.fill(name);

  await page.locator('button[type="submit"]').click();

  // In the call, not merely past the prejoin.
  await expect(page.getByRole("button", { name: locale === "ar" ? "اخرج" : "Leave", exact: true })).toBeVisible();
}

/** Wait for the same LiveKit presence fact the token route uses for recurrence. */
async function waitForEmptyLiveKitRoom(livekitRoom: string) {
  const service = new RoomServiceClient(
    "http://127.0.0.1:7880",
    process.env.LIVEKIT_API_KEY ?? "devkey",
    process.env.LIVEKIT_API_SECRET ?? "",
  );
  await expect.poll(
    async () => (await service.listParticipants(livekitRoom)).length,
    { message: "the media room should be empty before the next occurrence starts" },
  ).toBe(0);
}

test.describe("a call between two people", () => {
  let alice: BrowserContext;
  let bob: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    alice = await browser.newContext();
    bob = await browser.newContext();
  });

  test.afterEach(async () => {
    await alice.close();
    await bob.close();
  });

  test("video flows both ways and chat crosses between them", async () => {
    const first = await alice.newPage();
    const second = await bob.newPage();

    const code = await createRoom(first);

    await join(first, code, "Ahmed");
    await join(second, code, "سارة");

    // The assertion this suite exists for. Two decoding videos means each side
    // is receiving the other's camera as well as showing its own — a tile that
    // appeared but never got a frame does not count.
    await expect
      .poll(() => playingVideos(first), {
        message: "Ahmed should see two videos actually decoding frames",
        timeout: MEDIA_TIMEOUT,
      })
      .toBeGreaterThanOrEqual(2);

    await expect
      .poll(() => playingVideos(second), {
        message: "سارة should see two videos actually decoding frames",
        timeout: MEDIA_TIMEOUT,
      })
      .toBeGreaterThanOrEqual(2);

    // And the data channel, which everything else in the meeting rides on.
    // Anchored to the start of the label: the same control reads "Open chat,
    // 1 unread" once a message is waiting.
    await first.getByRole("button", { name: /^Open chat/ }).click();
    const composer = first.getByRole("textbox", { name: "Write a message" });
    await expect(composer).toBeVisible();

    // Code-switched on purpose: mixed Arabic and English is the hard case in
    // this product, and a message that survives the round trip intact is worth
    // more than "hello".
    const message = "عملت الـ deploy على الـ server 🎉";
    await composer.fill(message);
    // Exact, because a role name matches as a substring by default and
    // "Send a reaction" is also on this screen.
    await first.getByRole("button", { name: "Send", exact: true }).click();

    await second.getByRole("button", { name: /^Open chat/ }).click();
    await expect(second.getByText(message)).toBeVisible();
    // Attributed to the sender, which comes from the media server rather than
    // from anything in the message.
    await expect(second.getByText("Ahmed").first()).toBeVisible();
  });

  test("a second person joining does not evict the first", async () => {
    // The identity is derived from a per-tab secret. If that ever collapses to
    // one value, LiveKit disconnects the earlier participant and the symptom is
    // a call that works alone and empties the moment somebody arrives.
    const first = await alice.newPage();
    const second = await bob.newPage();

    const code = await createRoom(first);
    await join(first, code, "Ahmed");
    await join(second, code, "سارة");

    await expect
      .poll(() => playingVideos(first), { timeout: MEDIA_TIMEOUT })
      .toBeGreaterThanOrEqual(2);

    // Still there a moment later, rather than dropped once the second
    // connection settled.
    await first.waitForTimeout(3000);
    await expect(first.getByRole("button", { name: "Leave" })).toBeVisible();
    await expect
      .poll(() => playingVideos(first), { timeout: MEDIA_TIMEOUT })
      .toBeGreaterThanOrEqual(2);
  });

  test("shared rich-text notes merge, paste, and restore for a late participant", async () => {
    const first = await alice.newPage();
    const second = await bob.newPage();
    const code = await createRoom(first);
    const decision = "قرار: deploy الخميس";
    const followUp = "Follow up with the design team";
    const saraNote = "سارة هتراجع الـ PR";

    await join(first, code, "Ahmed");
    await first.getByRole("button", { name: "Open shared notes" }).click();
    const firstNotes = first.getByTestId("shared-notes");
    const firstEditor = firstNotes.locator(".ProseMirror");
    await expect(firstEditor).toBeVisible();

    // Real editor input and its Ctrl+B shortcut prove the rich-text surface is
    // not a plain textarea with an optimistic preview.
    await firstEditor.focus();
    await first.keyboard.press("Control+b");
    await first.keyboard.insertText(decision);
    await first.keyboard.press("Control+b");
    await first.keyboard.press("Enter");

    // Native paste matters for meeting notes copied from tickets and docs.
    await first.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await first.evaluate((value) => navigator.clipboard.writeText(value), followUp);
    await first.keyboard.press("Control+v");
    await expect(firstNotes.locator(".ProseMirror strong")).toContainText(decision);

    // Sara joins after the first note exists. Her Yjs state-vector request must
    // get the existing fragment without either person reloading the call.
    await join(second, code, "سارة");
    await second.getByRole("button", { name: "Open shared notes" }).click();
    const secondNotes = second.getByTestId("shared-notes");
    await expect(secondNotes.locator(".ProseMirror")).toContainText(decision);
    await expect(secondNotes.locator(".ProseMirror")).toContainText(followUp);
    await expect(secondNotes.locator(".ProseMirror strong")).toContainText(decision);

    const secondEditor = secondNotes.locator(".ProseMirror");
    await secondEditor.focus();
    await second.keyboard.press("Control+End");
    await second.keyboard.press("Enter");
    await second.keyboard.insertText(saraNote);
    await expect(firstNotes.locator(".ProseMirror")).toContainText(saraNote);

    // The durable snapshot is shared by notes and the board, but contains only
    // the room Yjs document — no media, transcript, keys, or a second service.
    await expect.poll(() => persistedNotes(first, code)).toContain(decision);
    await expect.poll(() => persistedNotes(first, code)).toContain(followUp);
    await expect.poll(() => persistedNotes(first, code)).toContain(saraNote);

    await firstNotes.getByRole("button", { name: "Close shared notes" }).click();
    await first.getByRole("button", { name: "Leave", exact: true }).click();
    await second.getByRole("button", { name: "Leave", exact: true }).click();
    await join(first, code, "Ahmed");
    await first.getByRole("button", { name: "Open shared notes" }).click();
    await expect(first.getByTestId("shared-notes").locator(".ProseMirror")).toContainText(decision);
    await expect(first.getByTestId("shared-notes").locator(".ProseMirror")).toContainText(saraNote);
  });

  test("Canvas catches up after a LiveKit reconnect", async () => {
    const first = await alice.newPage();
    const second = await bob.newPage();
    const code = await createRoom(first);
    const beforeReconnect = "قرار قبل انقطاع الاتصال";
    const duringReconnect = "Follow up after reconnect";

    // Playwright's offline mode blocks new requests but leaves an already-open
    // WebSocket alive. Track the browser's real LiveKit signaling socket so
    // closing it drives the same reconnect path a dropped connection does.
    await second.addInitScript(() => {
      const NativeWebSocket = window.WebSocket;
      const sockets: WebSocket[] = [];
      class TrackingWebSocket extends NativeWebSocket {
        constructor(...args: ConstructorParameters<typeof WebSocket>) {
          super(...args);
          sockets.push(this);
        }
      }
      window.WebSocket = TrackingWebSocket;
      (window as Window & { __lorTestWebSockets?: WebSocket[] }).__lorTestWebSockets = sockets;
    });

    await join(first, code, "Ahmed");
    await join(second, code, "سارة");
    await first.getByRole("button", { name: "Open shared notes" }).click();
    await second.getByRole("button", { name: "Open shared notes" }).click();

    const firstEditor = first.getByTestId("shared-notes").locator(".ProseMirror");
    const secondEditor = second.getByTestId("shared-notes").locator(".ProseMirror");
    await firstEditor.focus();
    await first.keyboard.insertText(beforeReconnect);
    await expect(secondEditor).toContainText(beforeReconnect);

    // This is a real network drop from LiveKit's point of view. The provider
    // and data channel stay unmocked; only the browser transport is closed.
    await expect.poll(() => second.evaluate(
      () => (window as Window & { __lorTestWebSockets?: WebSocket[] }).__lorTestWebSockets?.length ?? 0,
    )).toBeGreaterThan(0);
    const socketCountBeforeReconnect = await second.evaluate(
      () => (window as Window & { __lorTestWebSockets?: WebSocket[] }).__lorTestWebSockets?.length ?? 0,
    );
    await second.evaluate(() => {
      const sockets = (window as Window & { __lorTestWebSockets?: WebSocket[] }).__lorTestWebSockets ?? [];
      for (const socket of sockets) {
        if (socket.readyState === WebSocket.OPEN) socket.close(4000, "test reconnect");
      }
    });

    await firstEditor.focus();
    await first.keyboard.press("Control+End");
    await first.keyboard.press("Enter");
    await first.keyboard.insertText(duringReconnect);

    // A new signaling socket is an observable LiveKit reconnect. Signal-only
    // recovery is normally too quick to show the media-loss banner, but it
    // must still request the missing Yjs state and apply the delayed edit.
    await expect.poll(() => second.evaluate(
      () => (window as Window & { __lorTestWebSockets?: WebSocket[] }).__lorTestWebSockets?.length ?? 0,
    ), {
      timeout: 30_000,
    }).toBeGreaterThan(socketCountBeforeReconnect);
    await expect(secondEditor).toContainText(duringReconnect, { timeout: 30_000 });
  });

  test("keeps Canvas editors out of the initial call load", async () => {
    const first = await alice.newPage();
    const code = await createRoom(first);

    await join(first, code, "Ahmed");
    const beforeCanvas = await loadedResourceNames(first);

    await first.getByRole("button", { name: "Open shared whiteboard" }).click();
    await expect(first.locator("canvas.excalidraw__canvas.interactive")).toBeVisible();
    const boardResources = await resourcesSince(first, beforeCanvas);

    // Excalidraw is the intentionally heavy editor chunk. It must be absent
    // until its control opens it; a dynamically imported script then proves
    // the call shell did not pre-load the board just in case. `transferSize`
    // cannot be the assertion: a production asset can legitimately be served
    // from the browser cache and report zero transferred bytes.
    expect(boardResources.filter((resource) => resource.initiatorType === "script")).not.toHaveLength(0);

    const beforeNotes = await loadedResourceNames(first);
    await first
      .getByRole("region", { name: "Board" })
      .getByRole("button", { name: "Close shared whiteboard", exact: true })
      .click();
    await first.getByRole("button", { name: "Open shared notes" }).click();
    await expect(first.getByTestId("shared-notes").locator(".ProseMirror")).toBeVisible();
    const notesResources = await resourcesSince(first, beforeNotes);

    // Tiptap likewise arrives only when the notes control is activated.
    expect(notesResources.filter((resource) => resource.initiatorType === "script")).not.toHaveLength(0);
  });

  test("shared notes stay readable and operable in Arabic on a phone", async () => {
    const first = await alice.newPage();
    await first.setViewportSize({ width: 375, height: 667 });
    const code = await createRoom(first);

    await join(first, code, "أحمد", "ar");
    await first.getByRole("button", { name: "افتح النوتس المشتركة" }).click();
    const notes = first.getByRole("region", { name: "النوتس" });
    const editor = notes.locator(".ProseMirror");
    await expect(editor).toBeVisible();
    await expect(editor).toHaveAttribute("dir", "auto");
    await editor.focus();
    await first.keyboard.insertText("قرار: deploy الخميس");
    await expect(editor).toContainText("قرار: deploy الخميس");

    const close = notes.getByRole("button", { name: "اقفل النوتس المشتركة" });
    const closeBox = await close.boundingBox();
    expect(closeBox?.width).toBeGreaterThanOrEqual(44);
    expect(closeBox?.height).toBeGreaterThanOrEqual(44);

    await first.setViewportSize({ width: 667, height: 375 });
    await expect(close).toBeVisible();
    await expect(editor).toBeVisible();
  });

  test("a shared whiteboard carries drawing and bilingual text to another participant", async () => {
    const first = await alice.newPage();
    const second = await bob.newPage();
    const code = await createRoom(first);

    await join(first, code, "Ahmed");
    await join(second, code, "سارة");

    await first.getByRole("button", { name: "Open shared whiteboard" }).click();
    await expect(first.getByRole("heading", { name: "Board" })).toBeVisible();
    const firstCanvas = first.locator("canvas.excalidraw__canvas.interactive");
    await expect(firstCanvas).toBeVisible();
    await second.getByRole("button", { name: "Open shared whiteboard" }).click();
    await expect(second.locator("canvas.excalidraw__canvas.interactive")).toBeVisible();

    // Do not interact yet. The original report reproduces after the Canvas
    // persistence lifecycle settles, even if the participant only waits.
    await first.waitForTimeout(12_000);
    await expect(firstCanvas).toBeVisible();

    // The drawing shortcut is a deliberate stroke, not a synthetic store
    // update: this covers the Excalidraw UI, its record listener, Yjs, and the
    // existing LiveKit data channel together.
    const canvasBox = await firstCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) throw new Error("The whiteboard canvas has no visible box");
    await first.keyboard.press("p");
    await first.mouse.move(canvasBox.x + 320, canvasBox.y + 180);
    await first.mouse.down();
    await first.mouse.move(canvasBox.x + 460, canvasBox.y + 240, { steps: 8 });
    await first.mouse.up();
    await expect.poll(() => boardInk(first)).toBeGreaterThan(100);
    await expect.poll(() => boardInk(second)).toBeGreaterThan(100);

    // Panning is session state. It must remain local while the shared board
    // stays rendered after the background persistence cycle has settled.
    await first.keyboard.press("h");
    await first.mouse.move(canvasBox.x + 420, canvasBox.y + 300);
    await first.mouse.down();
    await first.mouse.move(canvasBox.x + 460, canvasBox.y + 340, { steps: 4 });
    await first.mouse.up();
    await first.waitForTimeout(8_000);
    await expect(firstCanvas).toBeVisible();
    await expect(first.getByRole("heading", { name: "Board" })).toBeVisible();

    // Undo/redo and an ordinary selection-delete all become document records;
    // checking them across pages prevents the board from being "shared" only
    // for newly-created strokes.
    await first.keyboard.press("Control+z");
    await expect.poll(() => boardInk(first)).toBe(0);
    await expect.poll(() => boardInk(second)).toBe(0);
    await first.keyboard.press("Control+Shift+z");
    await expect.poll(() => boardInk(second)).toBeGreaterThan(100);
    await first.keyboard.press("v");
    await first.keyboard.press("Control+a");
    await first.keyboard.press("Delete");
    await expect.poll(() => boardInk(first)).toBe(0);
    await expect.poll(() => boardInk(second)).toBe(0);

    const sharedText = "قرار: deploy الخميس";
    await first.keyboard.press("t");
    await first.mouse.click(canvasBox.x + 300, canvasBox.y + 220);
    await first.locator("textarea.excalidraw-wysiwyg").fill(sharedText);
    await first.keyboard.press("Escape");
    await expect.poll(() => boardInk(second)).toBeGreaterThan(100);
    await expect.poll(async () => {
      const response = await first.request.get(`/api/rooms/${code}/canvas`);
      if (response.status() !== 200) return [];
      const saved = new Y.Doc();
      Y.applyUpdate(saved, new Uint8Array(await response.body()));
      const texts = Array.from(saved.getMap<{ text?: string }>("excalidraw-elements").values()).map(e => e.text);
      saved.destroy();
      return texts;
    }).toContain(sharedText);
    // Reload discards live state: the actual persisted drawing must repaint.
    await first.getByRole("button", { name: "Leave", exact: true }).click();
    await second.getByRole("button", { name: "Leave", exact: true }).click();
    await join(first, code, "Ahmed");
    await first.getByRole("button", { name: "Open shared whiteboard" }).click();
    await expect.poll(() => boardInk(first)).toBeGreaterThan(100);
  });

  test("the board survives a failed save, retries, and accepts proxy-weakened ETags", async () => {
    const first = await alice.newPage();
    const code = await createRoom(first);
    let attempts = 0;
    let saved = 0;
    await first.route(`**/api/rooms/${code}/canvas`, async route => {
      if (route.request().method() !== "PUT") return route.continue();
      attempts++;
      if (attempts === 1) return route.fulfill({ status: 503, body: "Temporary outage" });
      const response = await route.fetch();
      const headers = response.headers();
      if (response.ok() && headers.etag) {
        saved++;
        headers.etag = `W/${headers.etag.replace(/^W\//, "")}`;
      }
      await route.fulfill({ response, headers });
    });
    await join(first, code, "Ahmed");
    await first.getByRole("button", { name: "Open shared whiteboard" }).click();
    const canvas = first.locator("canvas.excalidraw__canvas.interactive");
    await expect(canvas).toBeVisible();
    const box = (await canvas.boundingBox())!;
    async function stroke(offset: number) {
      await first.keyboard.press("p");
      await first.mouse.move(box.x + 320, box.y + 180 + offset);
      await first.mouse.down();
      await first.mouse.move(box.x + 480, box.y + 230 + offset, { steps: 6 });
      await first.mouse.up();
    }
    await stroke(0);
    await expect.poll(() => attempts).toBe(1);
    await expect(first.getByText(/The shared Canvas could not be saved/)).toBeVisible();
    await expect.poll(() => boardInk(first)).toBeGreaterThan(100);
    await expect.poll(() => saved, { timeout: 20_000 }).toBe(1);
    await expect(first.getByText(/Shared board and notes are kept/)).toBeVisible();
    await stroke(80);
    await expect.poll(() => saved).toBe(2);
    await expect(first.getByText(/The shared Canvas could not be saved/)).toHaveCount(0);
    await expect.poll(() => boardInk(first)).toBeGreaterThan(100);
  });

  test("the shared whiteboard stays usable on a phone and in landscape", async () => {
    const first = await alice.newPage();
    await first.setViewportSize({ width: 375, height: 667 });
    const code = await createRoom(first);

    await join(first, code, "Ahmed");
    await first.getByRole("button", { name: "Open shared whiteboard" }).click();
    const board = first.getByRole("region", { name: "Board" });
    await expect(board.locator("canvas.excalidraw__canvas.interactive")).toBeVisible();
    const close = board.getByRole("button", { name: "Close shared whiteboard" });
    await expect(close).toBeVisible();

    const closeBox = await close.boundingBox();
    expect(closeBox?.width).toBeGreaterThanOrEqual(44);
    expect(closeBox?.height).toBeGreaterThanOrEqual(44);

    // The same call bar and board have to remain reachable when a phone turns,
    // rather than leaving the close control beyond the short viewport.
    await first.setViewportSize({ width: 667, height: 375 });
    await expect(close).toBeVisible();
    await expect(board.locator("canvas.excalidraw__canvas.interactive")).toBeVisible();
  });

  test("a Canvas snapshot restores from Postgres and deletes board and notes together", async () => {
    const first = await alice.newPage();
    const code = await createRoom(first);
    const source = new Y.Doc();
    source.getMap("board").set("shape", "rectangle");
    addNoteParagraph(source, "قرار: deploy يوم الخميس");
    const update = Y.encodeStateAsUpdate(source);
    const canvasPath = `/api/rooms/${code}/canvas`;

    // This is the actual Postgres-backed route used by the call, not a mocked
    // repository. Its table only exists if the migration was applied first.
    const written = await first.request.put(canvasPath, {
      headers: {
        "Content-Type": CANVAS_SNAPSHOT_CONTENT_TYPE,
        "If-Match": "\"0\"",
      },
      data: Buffer.from(update),
    });
    expect(written.status()).toBe(201);
    expect(written.headers().etag).toBe("\"1\"");

    // A stale writer cannot put its complete-but-older document over this one.
    const stale = await first.request.put(canvasPath, {
      headers: {
        "Content-Type": CANVAS_SNAPSHOT_CONTENT_TYPE,
        "If-Match": "\"0\"",
      },
      data: Buffer.from(update),
    });
    expect(stale.status()).toBe(409);

    const loaded = await first.request.get(canvasPath);
    expect(loaded.ok()).toBe(true);
    const restored = new Y.Doc();
    Y.applyUpdate(restored, new Uint8Array(await loaded.body()));
    expect(restored.getMap("board").get("shape")).toBe("rectangle");
    expect(restored.getXmlFragment("notes").toString()).toContain("قرار: deploy يوم الخميس");

    // Rendering the status verifies that a re-opened call both reads storage
    // and tells the meeting how long the joint board-and-notes record lives.
    await join(first, code, "Ahmed");
    await expect(
      first.getByText("Shared board and notes are kept for 30 days.", { exact: false }),
    ).toBeVisible();

    const deleted = await first.request.delete(canvasPath);
    expect(deleted.ok()).toBe(true);
    const afterDelete = await first.request.get(canvasPath);
    expect(afterDelete.status()).toBe(204);

    source.destroy();
    restored.destroy();
  });

  test("a decision keeps server-derived evidence, host-only proposals, and the transcript deletion path", async () => {
    const host = await alice.newPage();
    const guest = await bob.newPage();
    const code = await createRoom(host);
    const transcriptPath = `/api/rooms/${code}/transcript`;
    const decisionsPath = `/api/rooms/${code}/decisions`;
    const extractPath = `${decisionsPath}/extract`;
    const quote = "هنعتمد التصميم بعد مراجعة سارة.";

    // These calls pass through the actual route handlers and the CI Postgres
    // service. No test helper inserts a decision directly into the database.
    const line = await host.request.post(transcriptPath, {
      data: { text: quote, speaker: "أحمد", identity: "host-evidence" },
    });
    expect(line.status()).toBe(201);
    const storedTranscript = await host.request.get(transcriptPath);
    const sourceSeq = (await storedTranscript.json() as {
      lines: Array<{ seq: number; text: string }>;
    }).lines.find((stored) => stored.text === quote)?.seq;
    if (typeof sourceSeq !== "number") throw new Error("The decision source was not retained");
    expect(sourceSeq).toBeGreaterThanOrEqual(0);

    const hostBeforeProposal = await host.request.get(decisionsPath);
    await expect(hostBeforeProposal.json()).resolves.toMatchObject({
      canReview: true,
      decisions: [],
    });

    // A visitor can never see a pending decision, nor use the source sequence
    // to create one. Both behaviours exercise the current host cookie check.
    const guestBeforeConfirmation = await guest.request.get(decisionsPath);
    expect(guestBeforeConfirmation.ok()).toBe(true);
    await expect(guestBeforeConfirmation.json()).resolves.toMatchObject({
      canReview: false,
      decisions: [],
    });
    const guestProposal = await guest.request.post(decisionsPath, {
      data: { sourceSeq, text: "قرار مزيف" },
    });
    expect(guestProposal.status()).toBe(404);
    const guestExtraction = await guest.request.post(extractPath);
    expect(guestExtraction.status()).toBe(404);

    // Extraction needs enough retained evidence before it can charge a quota
    // or call a provider. This one short line is intentionally not enough.
    const shortExtraction = await host.request.post(extractPath);
    expect(shortExtraction.status()).toBe(422);

    // Deliberately send forged evidence. The route accepts only the sequence;
    // the resulting quote, speaker, and time must come from transcript_lines.
    const proposalResponse = await host.request.post(decisionsPath, {
      data: {
        sourceSeq,
        text: "اعتماد التصميم بعد مراجعة سارة",
        quote: "اقتباس لم يقله أحد",
        speaker: "نموذج",
        at: "1999-01-01T00:00:00.000Z",
      },
    });
    const proposalBody = await proposalResponse.text();
    expect(proposalResponse.status(), proposalBody).toBe(201);
    const proposal = JSON.parse(proposalBody) as { id: string; status: string };
    expect(proposal.status).toBe("proposed");

    const hostProposals = await host.request.get(decisionsPath);
    const hostRecord = (await hostProposals.json() as {
      decisions: Array<{ id: string; status: string; origin: string; source: { quote: string; speaker: string; at: string; seq: number } }>;
    }).decisions;
    expect(hostRecord).toHaveLength(1);
    expect(hostRecord[0]).toMatchObject({
      id: proposal.id,
      status: "proposed",
      origin: "manual",
      source: { seq: sourceSeq, quote, speaker: "أحمد" },
    });
    expect(hostRecord[0].source.at).not.toBe("1999-01-01T00:00:00.000Z");

    // Bad IDs, a guest, and a host of another room get no existence oracle.
    const malformed = await host.request.patch(decisionsPath, {
      data: { id: "not-a-uuid", action: "confirm" },
    });
    expect(malformed.status()).toBe(404);
    const guestEdit = await guest.request.patch(decisionsPath, {
      data: { id: proposal.id, action: "edit", text: "لا" },
    });
    expect(guestEdit.status()).toBe(404);
    const wrongCookieCode = await createRoom(guest);
    const wrongCookieEdit = await guest.request.patch(decisionsPath, {
      data: { id: proposal.id, action: "edit", text: "لا" },
    });
    expect(wrongCookieEdit.status()).toBe(404);
    expect(wrongCookieCode).not.toBe(code);
    const otherCode = await createRoom(host);
    const crossRoom = await host.request.patch(`/api/rooms/${otherCode}/decisions`, {
      data: { id: proposal.id, action: "confirm" },
    });
    expect(crossRoom.status()).toBe(404);

    // Editing changes the decision wording only. Extra source-shaped values
    // are ignored, preserving the canonical transcript evidence above.
    const edited = await host.request.patch(decisionsPath, {
      data: {
        id: proposal.id,
        action: "edit",
        text: "اعتماد التصميم بعد مراجعة سارة النهائية",
        sourceSeq: 999,
        quote: "محاولة تغيير الدليل",
      },
    });
    expect(edited.ok()).toBe(true);
    const confirmed = await host.request.patch(decisionsPath, {
      data: { id: proposal.id, action: "confirm" },
    });
    expect(confirmed.ok()).toBe(true);
    await expect(confirmed.json()).resolves.toMatchObject({
      id: proposal.id,
      status: "confirmed",
    });

    const visibleToGuest = await guest.request.get(decisionsPath);
    const guestRecord = (await visibleToGuest.json() as {
      decisions: Array<{ id: string; status: string; text: string; source: { quote: string; speaker: string } }>;
    }).decisions;
    expect(guestRecord).toEqual([expect.objectContaining({
      id: proposal.id,
      status: "confirmed",
      text: "اعتماد التصميم بعد مراجعة سارة النهائية",
      source: expect.objectContaining({ quote, speaker: "أحمد" }),
    })]);

    // Record deletion never deletes its evidence.
    const erasedDecision = await host.request.delete(decisionsPath, { data: { id: proposal.id } });
    expect(erasedDecision.ok()).toBe(true);
    const transcriptAfterDecisionDelete = await host.request.get(transcriptPath);
    await expect(transcriptAfterDecisionDelete.json()).resolves.toMatchObject({
      lines: [expect.objectContaining({ text: quote })],
    });

    // Create a second record, then remove its transcript. The route's derived-
    // first cleanup must leave neither a proposed decision nor its quotation.
    const secondProposal = await host.request.post(decisionsPath, {
      data: { sourceSeq, text: "قرار سيُحذف مع المصدر" },
    });
    expect(secondProposal.status()).toBe(201);
    const deletedTranscript = await host.request.delete(transcriptPath);
    expect(deletedTranscript.ok()).toBe(true);
    const afterTranscriptDelete = await host.request.get(decisionsPath);
    await expect(afterTranscriptDelete.json()).resolves.toMatchObject({ decisions: [] });

    // A host handover rotates this database hash. The old browser retains its
    // signed cookie but must lose the ability to create records immediately.
    const revokedCode = await createRoom(host);
    const revokedLine = await host.request.post(`/api/rooms/${revokedCode}/transcript`, {
      data: { text: "قرار بعد تسليم الغرفة", speaker: "أحمد", identity: "revoked-host" },
    });
    expect(revokedLine.status()).toBe(201);
    const db = getDb();
    await db
      .update(rooms)
      .set({ hostSecretHash: "0".repeat(64) })
      .where(eq(rooms.code, revokedCode));
    const revokedMutation = await host.request.post(`/api/rooms/${revokedCode}/decisions`, {
      data: { sourceSeq: 0, text: "لا ينبغي أن يُحفظ" },
    });
    expect(revokedMutation.status()).toBe(404);

    // The CI server has no LLM key. A useful transcript must fail explicitly
    // without reaching an upstream provider or consuming an extraction slot.
    const noKeyCode = await createRoom(host);
    const noKeyTranscriptPath = `/api/rooms/${noKeyCode}/transcript`;
    for (const text of [
      "اتفقنا إن deploy يحصل بعد ما الـ CI ينجح على staging server.",
      "سارة قالت إن مراجعة الـ security خلصت ومفيش blocker.",
      "خلاص القرار النهائي: هننشر الإصدار النهارده بعد الظهر.",
    ]) {
      const retained = await host.request.post(noKeyTranscriptPath, {
        data: { text, speaker: "أحمد", identity: `no-key-${randomUUID()}` },
      });
      expect(retained.status()).toBe(201);
    }
    const noKeyExtraction = await host.request.post(`/api/rooms/${noKeyCode}/decisions/extract`);
    expect(noKeyExtraction.status()).toBe(503);
    await expect(noKeyExtraction.json()).resolves.toEqual({ error: "no_key" });
  });

  test("a host reviews a model proposal beside its evidence while guests only read confirmed decisions", async () => {
    const host = await alice.newPage();
    const guest = await bob.newPage();
    const code = await createRoom(host);
    const db = getDb();
    const sourceQuote = "اتفقنا إن deploy يحصل بعد ما الـ CI ينجح على staging.";
    const otherQuote = "We will publish after the security review.";

    // Retain real source lines through the route, then seed two candidates as
    // the extraction route would. The browser is exercising the review UI;
    // generation itself is covered without an external key in the API test.
    for (const [text, speaker, identity] of [
      [sourceQuote, "أحمد", "decision-ui-ar"],
      [otherQuote, "Sarah", "decision-ui-en"],
      [
        "The team recorded enough surrounding context for the review service to distinguish a decision from a passing mention.",
        "Mina",
        "decision-ui-context",
      ],
    ] as const) {
      const stored = await host.request.post(`/api/rooms/${code}/transcript`, {
        data: { text, speaker, identity },
      });
      expect(stored.status()).toBe(201);
    }

    const [room] = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.code, code))
      .limit(1);
    if (!room) throw new Error("The decision-review room was not stored");
    const sources = await db
      .select({
        id: transcriptLines.id,
        seq: transcriptLines.seq,
        speaker: transcriptLines.speakerName,
        text: transcriptLines.text,
        createdAt: transcriptLines.createdAt,
      })
      .from(transcriptLines)
      .where(eq(transcriptLines.roomId, room.id));
    const source = sources.find((line) => line.text === sourceQuote);
    const otherSource = sources.find((line) => line.text === otherQuote);
    if (!source || !otherSource) throw new Error("The decision-review evidence was not retained");

    const [proposal] = await db
      .insert(decisions)
      .values({
        roomId: room.id,
        sourceLineId: source.id,
        sourceSeq: source.seq,
        sourceSpeaker: source.speaker,
        sourceQuote: source.text,
        sourceCreatedAt: source.createdAt,
        text: "اعتماد الـ release بعد نجاح الـ CI.",
        origin: "llm",
      })
      .returning({ id: decisions.id });
    await db.insert(decisions).values({
      roomId: room.id,
      sourceLineId: otherSource.id,
      sourceSeq: otherSource.seq,
      sourceSpeaker: otherSource.speaker,
      sourceQuote: otherSource.text,
      sourceCreatedAt: otherSource.createdAt,
      text: "Publish after the security review.",
    });
    if (!proposal) throw new Error("The model proposal was not stored");

    await join(host, code, "Ahmed");
    await join(guest, code, "Sarah");
    await host.setViewportSize({ width: 375, height: 667 });

    // The link is next to the existing meeting record, not squeezed into the
    // media controls. Turning captions on reveals both record destinations.
    await host.getByRole("button", { name: "Turn on captions", exact: true }).click();
    await expect(host.getByRole("button", { name: "Decisions", exact: true })).toBeVisible();
    await host.getByRole("button", { name: "Decisions", exact: true }).click();
    const panel = host.getByTestId("decision-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveCSS("background-color", "rgb(17, 17, 19)");
    await expect(host.getByText("Written by a model — review before confirming.", { exact: true })).toBeVisible();
    await expect(panel.getByText(sourceQuote, { exact: true })).toBeVisible();
    await expect(panel.locator("[data-decision-text]").first()).toHaveAttribute("dir", "rtl");
    await expect(panel.locator("[data-decision-text]").last()).toHaveAttribute("dir", "ltr");
    expect(await host.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // A configured key is deliberately absent in CI. The control must say why
    // it cannot extract, rather than leaving the host with a silent no-op.
    await host.getByRole("button", { name: "Find decisions", exact: true }).click();
    await expect(host.getByText("No decision-review key is set up on this server. The record is still kept.", { exact: true })).toBeVisible();

    const proposalCard = host.locator(`[data-decision-id="${proposal.id}"]`);
    await proposalCard.getByRole("button", { name: "Edit wording", exact: true }).click();
    await host.getByLabel("Decision wording", { exact: true }).fill("اعتماد الـ release بعد نجاح الـ CI النهائي.");
    await host.getByRole("button", { name: "Save wording", exact: true }).click();
    await expect(proposalCard.getByText("اعتماد الـ release بعد نجاح الـ CI النهائي.", { exact: true })).toBeVisible();
    await expect(proposalCard.getByText(sourceQuote, { exact: true })).toBeVisible();
    await proposalCard.getByRole("button", { name: "Confirm decision", exact: true }).click();
    await expect(host.getByText("Decision confirmed.", { exact: true })).toBeVisible();

    // The source path is fully usable by keyboard and transfers focus to the
    // immutable transcript line it highlights.
    const sourceButton = proposalCard.getByRole("button", { name: "Show source line", exact: true });
    await sourceButton.focus();
    await host.keyboard.press("Enter");
    const transcriptSource = host.locator(`[data-transcript-line="${source.seq}"]`);
    await expect(transcriptSource).toBeVisible();
    await expect(transcriptSource).toBeFocused();

    // Captions are a room-level switch. The host's toggle already reached this
    // guest over LiveKit, so the guest must observe the active state rather
    // than toggle it back off just to open the shared record.
    await expect(guest.getByRole("button", { name: "Turn off captions", exact: true })).toBeVisible();
    await guest.getByRole("button", { name: "Decisions", exact: true }).click();
    await expect(guest.getByText("اعتماد الـ release بعد نجاح الـ CI النهائي.", { exact: true })).toBeVisible();
    await expect(guest.getByText("Publish after the security review.", { exact: true })).toHaveCount(0);
    await expect(guest.getByRole("button", { name: "Edit wording", exact: true })).toHaveCount(0);
    await expect(guest.getByRole("button", { name: "Confirm decision", exact: true })).toHaveCount(0);
    await expect(guest.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);

    // The UI asks the server again after a failed mutation. An old host cookie
    // must not keep review controls after the seat is handed over.
    await host.getByRole("button", { name: "Decisions", exact: true }).click();
    await expect(proposalCard.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
    await db
      .update(rooms)
      .set({ hostSecretHash: "0".repeat(64) })
      .where(eq(rooms.id, room.id));
    await proposalCard.getByRole("button", { name: "Delete", exact: true }).click();
    await host.getByRole("button", { name: "Delete decision", exact: true }).click();
    await expect(host.getByText("You are no longer the meeting host, so the review controls were removed.", { exact: true })).toBeVisible();
    await expect(host.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
  });

  test("action items keep host review separate from anonymous-owner completion", async () => {
    const host = await alice.newPage();
    const owner = await bob.newPage();
    const code = await createRoom(host);
    const actionItemsPath = `/api/rooms/${code}/action-items`;

    await join(host, code, "Ahmed");
    await join(owner, code, "Sarah");
    const ownerSession = await owner.evaluate(() => sessionStorage.getItem("lor-session-id"));
    if (!ownerSession) throw new Error("The assigned browser session was not created");

    const db = getDb();
    const [room] = await db
      .select({ id: rooms.id, livekitRoom: rooms.livekitRoom })
      .from(rooms)
      .where(eq(rooms.code, code))
      .limit(1);
    if (!room) throw new Error("The action-item room was not stored");
    const ownerIdentity = participantIdentity(room.livekitRoom, ownerSession);
    const quote = "Sarah هتراجع الـ pull request قبل 2026-09-12.";

    const storedSource = await host.request.post(`/api/rooms/${code}/transcript`, {
      data: { text: quote, speaker: "Ahmed", identity: "action-source" },
    });
    expect(storedSource.status()).toBe(201);
    const storedOwner = await host.request.post(`/api/rooms/${code}/transcript`, {
      data: { text: "I am available for the review.", speaker: "Sarah", identity: ownerIdentity },
    });
    expect(storedOwner.status()).toBe(201);

    const [source] = await db
      .select({
        id: transcriptLines.id,
        seq: transcriptLines.seq,
        speaker: transcriptLines.speakerName,
        text: transcriptLines.text,
        createdAt: transcriptLines.createdAt,
      })
      .from(transcriptLines)
      .where(eq(transcriptLines.roomId, room.id))
      .orderBy(transcriptLines.seq)
      .limit(1);
    if (!source) throw new Error("Action-item evidence was not retained");

    const [proposal] = await db
      .insert(actionItems)
      .values({
        roomId: room.id,
        sourceLineId: source.id,
        sourceSeq: source.seq,
        sourceSpeaker: source.speaker,
        sourceQuote: source.text,
        sourceCreatedAt: source.createdAt,
        assigneeIdentity: ownerIdentity,
        dueOn: "2026-09-12",
        text: "Review the pull request.",
        origin: "llm",
      })
      .returning({ id: actionItems.id });
    if (!proposal) throw new Error("Action-item proposal was not stored");

    const hostReview = await host.request.get(actionItemsPath);
    const hostReviewData = await hostReview.json();
    expect(hostReviewData.canReview).toBe(true);
    expect(hostReviewData.participants).toEqual(
      expect.arrayContaining([expect.objectContaining({ identity: ownerIdentity, name: "Sarah" })]),
    );
    expect(hostReviewData.actionItems).toEqual(expect.arrayContaining([expect.objectContaining({
      id: proposal.id,
      status: "proposed",
      assigneeName: "Sarah",
      source: expect.objectContaining({ quote, speaker: "Ahmed" }),
    })]));

    // A guest cannot see a proposal, skip its lifecycle, or submit somebody
    // else's identity: completion derives one from the caller's session secret.
    const guestProposal = await owner.request.get(actionItemsPath, {
      headers: { "x-lor-session-id": ownerSession },
    });
    await expect(guestProposal.json()).resolves.toMatchObject({ canReview: false, actionItems: [] });
    const premature = await owner.request.patch(actionItemsPath, {
      headers: { "x-lor-session-id": ownerSession },
      data: { id: proposal.id, action: "complete", assigneeIdentity: "forged" },
    });
    expect(premature.status()).toBe(404);

    const opened = await host.request.patch(actionItemsPath, {
      data: {
        id: proposal.id,
        action: "open",
        text: "Review the pull request and share the result.",
        assigneeIdentity: ownerIdentity,
        dueOn: "2026-09-12",
        sourceQuote: "forged evidence",
      },
    });
    expect(opened.ok()).toBe(true);
    await expect(opened.json()).resolves.toMatchObject({ id: proposal.id, status: "open" });

    const ownerOpen = await owner.request.get(actionItemsPath, {
      headers: { "x-lor-session-id": ownerSession },
    });
    const ownerOpenData = await ownerOpen.json();
    expect(ownerOpenData.canReview).toBe(false);
    expect(ownerOpenData.actionItems).toEqual(expect.arrayContaining([expect.objectContaining({
      id: proposal.id,
      status: "open",
      canComplete: true,
      assigneeName: "Sarah",
    })]));

    const notOwner = await owner.request.patch(actionItemsPath, {
      headers: { "x-lor-session-id": "a".repeat(32) },
      data: { id: proposal.id, action: "complete" },
    });
    expect(notOwner.status()).toBe(404);

    const completed = await owner.request.patch(actionItemsPath, {
      headers: { "x-lor-session-id": ownerSession },
      data: { id: proposal.id, action: "complete" },
    });
    expect(completed.ok()).toBe(true);
    await expect(completed.json()).resolves.toMatchObject({ id: proposal.id, status: "completed" });

    const reopened = await host.request.patch(actionItemsPath, {
      data: { id: proposal.id, action: "reopen" },
    });
    expect(reopened.ok()).toBe(true);
    const afterReopen = await host.request.get(actionItemsPath);
    const afterReopenData = await afterReopen.json();
    expect(afterReopenData.actionItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: proposal.id, status: "open", completedAt: null }),
    ]));

    // Handover revocation happens at the same host-cookie check as every other
    // host route, so a former host cannot force a later lifecycle transition.
    await db
      .update(rooms)
      .set({ hostSecretHash: "0".repeat(64) })
      .where(eq(rooms.id, room.id));
    const revoked = await host.request.patch(actionItemsPath, {
      data: { id: proposal.id, action: "complete" },
    });
    expect(revoked.status()).toBe(404);
  });

  test("a host reviews an action item beside evidence while its owner completes it", async () => {
    const host = await alice.newPage();
    const owner = await bob.newPage();
    const code = await createRoom(host);
    const db = getDb();
    const sourceQuote = "سارة هتراجع الـ pull request قبل 2026-09-12.";

    await join(host, code, "Ahmed");
    await join(owner, code, "Sarah");
    const ownerSession = await owner.evaluate(() => sessionStorage.getItem("lor-session-id"));
    if (!ownerSession) throw new Error("The owner session was not created");
    const [room] = await db
      .select({ id: rooms.id, livekitRoom: rooms.livekitRoom })
      .from(rooms)
      .where(eq(rooms.code, code))
      .limit(1);
    if (!room) throw new Error("The action-item UI room was not stored");
    const ownerIdentity = participantIdentity(room.livekitRoom, ownerSession);

    for (const [text, speaker, identity] of [
      [sourceQuote, "Ahmed", "action-ui-source"],
      ["I am Sarah and I will send the review result to the team.", "Sarah", ownerIdentity],
      ["The retained record has enough surrounding context for review, including the agreed owner and the explicit calendar date.", "Mina", "action-ui-context"],
    ] as const) {
      const stored = await host.request.post(`/api/rooms/${code}/transcript`, {
        data: { text, speaker, identity },
      });
      expect(stored.status()).toBe(201);
    }
    const [source] = await db
      .select({
        id: transcriptLines.id,
        seq: transcriptLines.seq,
        speaker: transcriptLines.speakerName,
        text: transcriptLines.text,
        createdAt: transcriptLines.createdAt,
      })
      .from(transcriptLines)
      .where(and(eq(transcriptLines.roomId, room.id), eq(transcriptLines.text, sourceQuote)))
      .limit(1);
    if (!source) throw new Error("The action-item UI source was not retained");
    const [proposal] = await db
      .insert(actionItems)
      .values({
        roomId: room.id,
        sourceLineId: source.id,
        sourceSeq: source.seq,
        sourceSpeaker: source.speaker,
        sourceQuote: source.text,
        sourceCreatedAt: source.createdAt,
        assigneeIdentity: ownerIdentity,
        dueOn: "2026-09-12",
        text: "مراجعة الـ pull request وإرسال النتيجة.",
        origin: "llm",
      })
      .returning({ id: actionItems.id });
    if (!proposal) throw new Error("The action-item UI proposal was not stored");

    await host.setViewportSize({ width: 375, height: 667 });
    await host.getByRole("button", { name: "Turn on captions", exact: true }).click();
    await expect(host.getByRole("button", { name: "Action items", exact: true })).toBeVisible();
    const beforeOpen = await loadedResourceNames(host);
    expect([...beforeOpen].some((name) => new URL(name).pathname.endsWith("/action-items"))).toBe(false);

    await host.getByRole("button", { name: "Action items", exact: true }).click();
    const panel = host.getByTestId("action-item-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveCSS("background-color", "rgb(17, 17, 19)");
    await expect(panel.getByText(sourceQuote, { exact: true })).toBeVisible();
    const proposalCard = host.locator(`[data-action-item-id="${proposal.id}"]`);
    await expect(proposalCard.locator("[data-action-item-text]")).toHaveAttribute("dir", "rtl");
    await expect(proposalCard.getByText("Ahmed", { exact: true })).toBeVisible();
    await expect(proposalCard.getByText("Sarah", { exact: true })).toBeVisible();
    await expect(proposalCard.locator('time[datetime="2026-09-12"]')).toBeVisible();
    await expect(proposalCard.locator(`time[datetime="${source.createdAt.toISOString()}"]`)).toBeVisible();
    expect(await host.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // No configured key is an explained recovery state, not a no-op.
    await host.getByRole("button", { name: "Find action items", exact: true }).click();
    await expect(host.getByText("No action-item review key is set up on this server. The record is still kept.", { exact: true })).toBeVisible();

    // The quota response is equally explicit and does not make a failed
    // request look like an empty review result.
    await host.route(`**/api/rooms/${code}/action-items/extract`, async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "quota" }),
      });
    });
    await host.getByRole("button", { name: "Find action items", exact: true }).click();
    await expect(host.getByText("That is enough action-item reviews for this meeting today.", { exact: true })).toBeVisible();
    await host.unroute(`**/api/rooms/${code}/action-items/extract`);

    // Keyboard activation keeps the source card in visual/tab order. The
    // form exposes a labelled native date input and a server-validated owner.
    await proposalCard.getByRole("button", { name: "Review proposal", exact: true }).focus();
    await host.keyboard.press("Enter");
    const wording = host.getByLabel("Task wording", { exact: true });
    const ownerField = host.getByLabel("Owner", { exact: true });
    await wording.fill("مراجعة الـ pull request وإرسال النتيجة النهائية.");
    await host.keyboard.press("Tab");
    await expect(ownerField).toBeFocused();
    await ownerField.selectOption(ownerIdentity);
    const due = host.getByLabel("Due date", { exact: true });
    await expect(due).toHaveAttribute("type", "date");
    await host.keyboard.press("Tab");
    await expect(due).toBeFocused();
    await due.fill("2026-09-12");
    const openingResponse = host.waitForResponse((response) => (
      new URL(response.url()).pathname.endsWith(`/rooms/${code}/action-items`)
      && response.request().method() === "PATCH"
    ));
    let mutationRequests = 0;
    let releaseMutation: (() => void) | undefined;
    const mutationStarted = new Promise<void>((resolve) => {
      releaseMutation = resolve;
    });
    await host.route(`**/api/rooms/${code}/action-items`, async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }
      mutationRequests += 1;
      await mutationStarted;
      await route.continue();
    });
    const openTask = host.getByRole("button", { name: "Open task", exact: true });
    const opening = openTask.click();
    await expect.poll(() => mutationRequests).toBe(1);
    await expect(openTask).toBeDisabled();
    releaseMutation?.();
    await opening;
    expect((await openingResponse).status()).toBe(200);
    expect(mutationRequests).toBe(1);
    await host.unroute(`**/api/rooms/${code}/action-items`);
    await expect(host.getByText("Action item opened.", { exact: true })).toBeVisible();
    await expect(proposalCard.getByText("مراجعة الـ pull request وإرسال النتيجة النهائية.", { exact: true })).toBeVisible();

    // The evidence link is fully keyboard-usable and lands on the immutable
    // transcript line rather than trying to scroll a hidden background panel.
    const sourceButton = proposalCard.getByRole("button", { name: "Show source line", exact: true });
    await sourceButton.focus();
    await host.keyboard.press("Enter");
    const transcriptSource = host.locator(`[data-transcript-line="${source.seq}"]`);
    await expect(transcriptSource).toBeVisible();
    await expect(transcriptSource).toBeFocused();

    await expect(owner.getByRole("button", { name: "Turn off captions", exact: true })).toBeVisible();
    await owner.getByRole("button", { name: "Action items", exact: true }).click();
    const ownerPanel = owner.getByTestId("action-item-panel");
    await expect(ownerPanel.getByText("مراجعة الـ pull request وإرسال النتيجة النهائية.", { exact: true })).toBeVisible();
    await expect(ownerPanel.getByRole("button", { name: "Review proposal", exact: true })).toHaveCount(0);
    await expect(ownerPanel.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
    await ownerPanel.getByRole("button", { name: "Mark completed", exact: true }).click();
    await expect(owner.getByText("Action item completed.", { exact: true })).toBeVisible();
  });

  test("open work resurfaces only when the recurring room starts a later occurrence", async () => {
    const host = await alice.newPage();
    const owner = await bob.newPage();
    const code = await createRoom(host);
    const actionItemsPath = `/api/rooms/${code}/action-items`;
    const db = getDb();

    await join(host, code, "Ahmed");
    await join(owner, code, "سارة", "ar");
    const ownerSession = await owner.evaluate(() => sessionStorage.getItem("lor-session-id"));
    if (!ownerSession) throw new Error("The recurring owner session was not created");

    const [room] = await db
      .select({ id: rooms.id, livekitRoom: rooms.livekitRoom })
      .from(rooms)
      .where(eq(rooms.code, code))
      .limit(1);
    if (!room) throw new Error("The recurring action-item room was not stored");

    const ownerIdentity = participantIdentity(room.livekitRoom, ownerSession);
    const sources = [
      ["سارة هتراجع الـ pull request قبل يوم الجمعة.", "المراجعة المفتوحة من الاجتماع الأول."],
      ["سارة هتحدّث ملف التصميم قبل يوم الخميس.", "اقتراح لا يتجاوز المراجعة."],
      ["سارة هتشارك نتيجة الاختبار قبل يوم الأربعاء.", "مهمة اكتملت في الاجتماع الأول."],
    ] as const;
    for (const [text] of sources) {
      const stored = await host.request.post(`/api/rooms/${code}/transcript`, {
        data: { text, speaker: "سارة", identity: ownerIdentity },
      });
      expect(stored.status()).toBe(201);
    }

    const evidence = await db
      .select({
        id: transcriptLines.id,
        seq: transcriptLines.seq,
        speaker: transcriptLines.speakerName,
        text: transcriptLines.text,
        createdAt: transcriptLines.createdAt,
      })
      .from(transcriptLines)
      .where(eq(transcriptLines.roomId, room.id));

    async function createProposal(sourceText: string, text: string) {
      const source = evidence.find((line) => line.text === sourceText);
      if (!source) throw new Error("Recurring action-item evidence was not retained");
      const [proposal] = await db
        .insert(actionItems)
        .values({
          roomId: room.id,
          sourceLineId: source.id,
          sourceSeq: source.seq,
          sourceSpeaker: source.speaker,
          sourceQuote: source.text,
          sourceCreatedAt: source.createdAt,
          assigneeIdentity: ownerIdentity,
          dueOn: "2026-09-12",
          text,
          origin: "manual",
        })
        .returning({ id: actionItems.id });
      if (!proposal) throw new Error("Recurring action-item proposal was not stored");
      return proposal;
    }

    const openProposal = await createProposal(...sources[0]);
    const proposedOnly = await createProposal(...sources[1]);
    const completedProposal = await createProposal(...sources[2]);

    for (const proposal of [openProposal, completedProposal]) {
      const opened = await host.request.patch(actionItemsPath, {
        data: {
          id: proposal.id,
          action: "open",
          text: proposal === openProposal
            ? sources[0][1]
            : sources[2][1],
          assigneeIdentity: ownerIdentity,
          dueOn: "2026-09-12",
        },
      });
      expect(opened.status()).toBe(200);
    }
    const completed = await host.request.patch(actionItemsPath, {
      data: { id: completedProposal.id, action: "complete" },
    });
    expect(completed.status()).toBe(200);

    const [firstOccurrence] = await db
      .select({ id: meetingOccurrences.id, endedAt: meetingOccurrences.endedAt })
      .from(meetingOccurrences)
      .where(eq(meetingOccurrences.roomId, room.id));
    if (!firstOccurrence) throw new Error("The first occurrence was not stored");
    expect(firstOccurrence.endedAt).toBeNull();

    // Rejoining while someone remains connected gets the same occurrence. The
    // current meeting's newly-opened work must not be labelled as prior work.
    await host.getByRole("button", { name: "Leave", exact: true }).click();
    await expect(host.locator('input[autocomplete="name"]')).toBeVisible();
    const sameOccurrenceCarry = host.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith(`/rooms/${code}/action-items/carry-over`),
    );
    await join(host, code, "Ahmed");
    const sameOccurrenceResponse = await sameOccurrenceCarry;
    expect(sameOccurrenceResponse.status()).toBe(200);
    await expect(sameOccurrenceResponse.json()).resolves.toEqual({ count: 0 });
    await expect(host.getByTestId("carry-over-notice")).toHaveCount(0);
    const afterReconnect = await db
      .select({ id: meetingOccurrences.id, endedAt: meetingOccurrences.endedAt })
      .from(meetingOccurrences)
      .where(eq(meetingOccurrences.roomId, room.id));
    expect(afterReconnect).toHaveLength(1);
    expect(afterReconnect[0]).toMatchObject({ id: firstOccurrence.id, endedAt: null });

    await host.getByRole("button", { name: "Leave", exact: true }).click();
    await owner.getByRole("button", { name: "اخرج", exact: true }).click();
    await waitForEmptyLiveKitRoom(room.livekitRoom);

    // The next first join makes a new server occurrence. Only the one still
    // open item predates it; the proposed and completed records stay absent.
    const nextOccurrenceCarry = host.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith(`/rooms/${code}/action-items/carry-over`),
    );
    await join(host, code, "Ahmed");
    const nextOccurrenceResponse = await nextOccurrenceCarry;
    expect(nextOccurrenceResponse.status()).toBe(200);
    await expect(nextOccurrenceResponse.json()).resolves.toEqual({ count: 1 });
    const carryOverNotice = host.getByTestId("carry-over-notice");
    await expect(carryOverNotice.getByText("1 open task from a previous meeting", { exact: true })).toBeVisible();
    await carryOverNotice.getByRole("button", { name: "Open action items", exact: true }).click();
    const hostPanel = host.getByTestId("action-item-panel");
    await expect(hostPanel.getByText(sources[0][1], { exact: true })).toBeVisible();
    await expect(hostPanel.getByText(sources[2][1], { exact: true })).toBeVisible();
    await hostPanel.getByRole("button", { name: "Close", exact: true }).click();

    const occurrences = await db
      .select({ id: meetingOccurrences.id, endedAt: meetingOccurrences.endedAt })
      .from(meetingOccurrences)
      .where(eq(meetingOccurrences.roomId, room.id));
    expect(occurrences).toHaveLength(2);
    expect(occurrences.find((occurrence) => occurrence.id === firstOccurrence.id)?.endedAt).not.toBeNull();
    expect(occurrences.filter((occurrence) => occurrence.endedAt === null)).toHaveLength(1);

    await owner.setViewportSize({ width: 375, height: 667 });
    const ownerCarry = owner.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith(`/rooms/${code}/action-items/carry-over`),
    );
    await join(owner, code, "سارة", "ar");
    await expect((await ownerCarry).json()).resolves.toEqual({ count: 1 });
    const ownerNotice = owner.getByTestId("carry-over-notice");
    await expect(ownerNotice.getByText("في مهمة مفتوحة من اجتماع سابق", { exact: true })).toBeVisible();
    expect(await owner.evaluate(() => document.documentElement.dir)).toBe("rtl");
    expect(await owner.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await ownerNotice.getByRole("button", { name: "افتح المهام", exact: true }).click();
    const ownerPanel = owner.getByTestId("action-item-panel");
    await ownerPanel.getByRole("button", { name: "علّمها خلصت", exact: true }).click();
    await expect(owner.getByText("المهمة اتعلّمت خلصت.", { exact: true })).toBeVisible();

    // The host can reopen later work after refreshing its record, and the call
    // controls remain usable while both participants see the reminder.
    await host.getByRole("button", { name: "Turn on captions", exact: true }).click();
    await host.getByRole("button", { name: "Action items", exact: true }).click();
    await host
      .locator(`[data-action-item-id="${completedProposal.id}"]`)
      .getByRole("button", { name: "Reopen task", exact: true })
      .click();
    await expect(host.getByText("Action item reopened.", { exact: true })).toBeVisible();
    await host.getByRole("button", { name: /^Open chat/ }).click();
    await expect(host.getByRole("textbox", { name: "Write a message" })).toBeVisible();

    // Keep this identifier exercised so a future refactor cannot quietly turn
    // the proposed record into carry-over by only asserting a total count.
    expect(proposedOnly.id).not.toBe(openProposal.id);
  });

  test("a failed carry-over check stays non-blocking and can be retried", async () => {
    const host = await alice.newPage();
    const code = await createRoom(host);
    let attempts = 0;

    await host.route(`**/api/rooms/${code}/action-items/carry-over?*`, async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "unavailable" }),
        });
        return;
      }
      await route.continue();
    });

    await join(host, code, "Ahmed");
    const notice = host.getByTestId("carry-over-notice");
    await expect(notice.getByText(
      "Couldn’t check open tasks from a previous meeting. Your call is still running.",
      { exact: true },
    )).toBeVisible();
    await host.getByRole("button", { name: "Mute", exact: true }).click();
    await expect(host.getByRole("button", { name: "Unmute", exact: true })).toBeVisible();
    await notice.getByRole("button", { name: "Try again", exact: true }).click();
    await expect.poll(() => attempts).toBeGreaterThanOrEqual(2);
    await expect(notice).toHaveCount(0);
  });

  test("exports only retained confirmed decisions with their transcript evidence", async () => {
    const host = await alice.newPage();
    const db = getDb();
    const code = await createRoom(host);
    const exportPath = `/api/rooms/${code}/decisions/export`;
    const proposedText = "اقتراح موديل لا يظهر في الملف.";
    const arabicText = "اعتماد الـ release بعد نجاح الـ CI.";
    const arabicQuote = "اتفقنا إن الـ release هيطلع بعد نجاح الـ CI.";
    const englishText = "Publish after the security review.";
    const englishQuote = "We will publish after the security review.";

    for (const [text, speaker, identity] of [
      [proposedText, "Mina", "export-proposal"],
      [arabicQuote, "أحمد", "export-arabic"],
      [englishQuote, "Sarah", "export-english"],
    ] as const) {
      const stored = await host.request.post(`/api/rooms/${code}/transcript`, {
        data: { text, speaker, identity },
      });
      expect(stored.status()).toBe(201);
    }

    const [room] = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.code, code))
      .limit(1);
    if (!room) throw new Error("The export room was not stored");
    const sources = await db
      .select({
        id: transcriptLines.id,
        seq: transcriptLines.seq,
        speaker: transcriptLines.speakerName,
        text: transcriptLines.text,
        createdAt: transcriptLines.createdAt,
      })
      .from(transcriptLines)
      .where(eq(transcriptLines.roomId, room.id));

    async function insertRecord(sourceText: string, text: string, status: "proposed" | "confirmed") {
      const source = sources.find((line) => line.text === sourceText);
      if (!source) throw new Error("The export source was not stored");
      await db.insert(decisions).values({
        roomId: room.id,
        sourceLineId: source.id,
        sourceSeq: source.seq,
        sourceSpeaker: source.speaker,
        sourceQuote: source.text,
        sourceCreatedAt: source.createdAt,
        text,
        origin: status === "proposed" ? "llm" : "manual",
        status,
        ...(status === "confirmed" ? { confirmedAt: new Date() } : {}),
      });
      return source;
    }

    await insertRecord(proposedText, proposedText, "proposed");
    const arabicSource = await insertRecord(arabicQuote, arabicText, "confirmed");
    const englishSource = await insertRecord(englishQuote, englishText, "confirmed");

    const response = await host.request.get(exportPath);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toBe("text/plain; charset=utf-8");
    expect(response.headers()["content-disposition"]).toBe(`attachment; filename="lor-${code}-decisions.txt"`);
    expect(response.headers()["cache-control"]).toBe("no-store");
    const expected =
      `[${arabicSource.createdAt.toISOString()}] أحمد\n` +
      `Decision: ${arabicText}\n` +
      `Evidence: ${arabicQuote}\n\n` +
      `[${englishSource.createdAt.toISOString()}] Sarah\n` +
      `Decision: ${englishText}\n` +
      `Evidence: ${englishQuote}`;
    const exportedText = await response.text();
    expect(exportedText).toBe(expected);
    expect(exportedText).not.toContain(proposedText);

    // The request is room scoped; another meeting does not become an export
    // oracle or receive the confirmed record above.
    const otherCode = await createRoom(host);
    const otherResponse = await host.request.get(`/api/rooms/${otherCode}/decisions/export`);
    expect(otherResponse.status()).toBe(204);

    // Download works as a real, keyboard-accessible browser action. It remains
    // a link rather than a scripted click so browsers retain their download
    // affordance on both desktop and touch devices.
    await join(host, code, "Ahmed");
    await host.setViewportSize({ width: 375, height: 667 });
    await host.getByRole("button", { name: "Turn on captions", exact: true }).click();
    await host.getByRole("button", { name: "Decisions", exact: true }).click();
    const exportLink = host.getByRole("link", { name: "Download confirmed decisions", exact: true });
    await expect(exportLink).toBeVisible();
    await exportLink.focus();
    await expect(exportLink).toBeFocused();
    const downloadPromise = host.waitForEvent("download");
    await host.keyboard.press("Enter");
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`lor-${code}-decisions.txt`);
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    await expect(readFile(downloadPath!, "utf8")).resolves.toBe(expected);
    expect(await host.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // A room with no confirmed record exposes a disabled native control. Even
    // an explicit click event cannot turn it into a request or empty download.
    const emptyCode = await createRoom(host);
    await join(host, emptyCode, "Ahmed");
    await host.getByRole("button", { name: "Turn on captions", exact: true }).click();
    await host.getByRole("button", { name: "Decisions", exact: true }).click();
    const disabledExport = host.getByRole("button", { name: "Download confirmed decisions", exact: true });
    await expect(disabledExport).toBeDisabled();
    await expect(host.getByText("Confirm a decision before there is anything to download.", { exact: true })).toBeVisible();
    let emptyExportRequests = 0;
    host.on("request", (request) => {
      if (request.url().includes(`/api/rooms/${emptyCode}/decisions/export`)) emptyExportRequests++;
    });
    await disabledExport.dispatchEvent("click");
    expect(emptyExportRequests).toBe(0);

    // Retention and deletion are run again by the download route itself, not
    // trusted to the panel's earlier GET. Deleting the transcript clears the
    // export immediately, including decisions that were already confirmed.
    const deleted = await host.request.delete(`/api/rooms/${code}/transcript`);
    expect(deleted.ok()).toBe(true);
    expect((await host.request.get(exportPath)).status()).toBe(204);

    const expiredCode = await createRoom(host);
    const expiredLine = await host.request.post(`/api/rooms/${expiredCode}/transcript`, {
      data: { text: "قرار انتهت مدة حفظ دليله", speaker: "أحمد", identity: "export-expired" },
    });
    expect(expiredLine.status()).toBe(201);
    const [expiredRoom] = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.code, expiredCode))
      .limit(1);
    if (!expiredRoom) throw new Error("The expiry room was not stored");
    const [expiredSource] = await db
      .select({ id: transcriptLines.id, seq: transcriptLines.seq, createdAt: transcriptLines.createdAt })
      .from(transcriptLines)
      .where(eq(transcriptLines.roomId, expiredRoom.id))
      .limit(1);
    if (!expiredSource) throw new Error("The expiry source was not stored");
    const [expiredDecision] = await db
      .insert(decisions)
      .values({
        roomId: expiredRoom.id,
        sourceLineId: expiredSource.id,
        sourceSeq: expiredSource.seq,
        sourceSpeaker: "أحمد",
        sourceQuote: "قرار انتهت مدة حفظ دليله",
        sourceCreatedAt: expiredSource.createdAt,
        text: "قرار قديم",
        status: "confirmed",
        confirmedAt: new Date(),
      })
      .returning({ id: decisions.id });
    if (!expiredDecision) throw new Error("The expiry decision was not stored");
    await db
      .update(transcriptLines)
      .set({ createdAt: new Date("2000-01-01T00:00:00Z") })
      .where(eq(transcriptLines.id, expiredSource.id));
    expect((await host.request.get(`/api/rooms/${expiredCode}/decisions/export`)).status()).toBe(204);
    const afterExpiry = await db
      .select({ id: decisions.id })
      .from(decisions)
      .where(eq(decisions.id, expiredDecision.id));
    expect(afterExpiry).toHaveLength(0);
  });

  test("keeps Decisions lazy, recoverable, and non-disruptive to a live two-person call", async () => {
    const host = await alice.newPage();
    const guest = await bob.newPage();
    const code = await createRoom(host);
    const sourceQuote = "اتفقنا إن الـ deploy هيتم الخميس بعد نجاح الـ CI على staging.";
    const editedDecision = "الـ deploy هيتم الخميس بعد ما الـ CI ينجح على staging.";

    // The discussion and action item are retained too, but the selected
    // proposal stays anchored to the explicit settlement rather than either.
    for (const [text, speaker, identity] of [
      ["ممكن نأجل الـ deploy لو الـ CI اتأخر؟", "أحمد", "flow-discussion"],
      ["سارة هتراجع الـ pull request وتبعت تحديث.", "سارة", "flow-action"],
      [sourceQuote, "أحمد", "flow-decision"],
    ] as const) {
      const stored = await host.request.post(`/api/rooms/${code}/transcript`, {
        data: { text, speaker, identity },
      });
      expect(stored.status()).toBe(201);
    }
    const proposed = await host.request.post(`/api/rooms/${code}/decisions`, {
      data: { sourceSeq: 2, text: "الـ deploy هيتم الخميس." },
    });
    expect(proposed.status()).toBe(201);
    const proposal = await proposed.json() as { id: string };

    const decisionRequests: string[] = [];
    host.on("request", (request) => {
      if (new URL(request.url()).pathname === `/api/rooms/${code}/decisions`) {
        decisionRequests.push(request.method());
      }
    });

    await join(host, code, "Ahmed");
    await join(guest, code, "سارة");
    await host.waitForTimeout(250);
    expect(decisionRequests).toEqual([]);
    await expect(host.getByTestId("decision-panel")).toHaveCount(0);
    await expect
      .poll(() => playingVideos(host), { timeout: MEDIA_TIMEOUT })
      .toBeGreaterThanOrEqual(2);

    // A real failure has a visible retry path. Only this opening request is
    // intercepted; retry returns the server's authoritative review queue.
    let failFirstDecisionLoad = true;
    await host.route(`**/api/rooms/${code}/decisions`, async (route) => {
      if (route.request().method() === "GET" && failFirstDecisionLoad) {
        failFirstDecisionLoad = false;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "unavailable" }),
        });
        return;
      }
      await route.continue();
    });

    await host.getByRole("button", { name: "Turn on captions", exact: true }).click();
    await host.getByRole("button", { name: "Decisions", exact: true }).click();
    const panel = host.getByTestId("decision-panel");
    await expect(panel.getByText("Decisions could not be reached. The meeting and record continue; try again.", { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "Try again", exact: true }).click();
    const proposalCard = panel.locator(`[data-decision-id="${proposal.id}"]`);
    await expect(proposalCard.getByText(sourceQuote, { exact: true })).toBeVisible();
    expect(decisionRequests).toEqual(["GET", "GET"]);

    await proposalCard.getByRole("button", { name: "Edit wording", exact: true }).click();
    await host.getByLabel("Decision wording", { exact: true }).fill(editedDecision);
    await proposalCard.getByRole("button", { name: "Save wording", exact: true }).click();
    await proposalCard.getByRole("button", { name: "Confirm decision", exact: true }).click();
    await expect(proposalCard.getByText(editedDecision, { exact: true })).toBeVisible();
    await expect(proposalCard.getByText(sourceQuote, { exact: true })).toBeVisible();
    await expect(panel.getByRole("link", { name: "Download confirmed decisions", exact: true })).toHaveAttribute(
      "href",
      `/api/rooms/${code}/decisions/export`,
    );

    // Confirmation broadcasts through the room state, but only the meeting
    // host sees its review controls. The other participant gets the settled
    // record and its immutable evidence.
    await expect(guest.getByRole("button", { name: "Turn off captions", exact: true })).toBeVisible();
    await guest.getByRole("button", { name: "Decisions", exact: true }).click();
    const guestPanel = guest.getByTestId("decision-panel");
    await expect(guestPanel.getByText(editedDecision, { exact: true })).toBeVisible();
    await expect(guestPanel.getByText(sourceQuote, { exact: true })).toBeVisible();
    await expect(guestPanel.getByRole("button", { name: "Edit wording", exact: true })).toHaveCount(0);
    await expect(guestPanel.getByRole("button", { name: "Confirm decision", exact: true })).toHaveCount(0);

    // Closing the record is strictly an overlay concern. Call data, shared
    // workspaces, captions, and a local recording continue to operate.
    await panel.getByRole("button", { name: "Close", exact: true }).click();
    await expect(panel).toHaveCount(0);
    await expect
      .poll(() => playingVideos(host), { timeout: MEDIA_TIMEOUT })
      .toBeGreaterThanOrEqual(2);
    await host.getByRole("button", { name: "Turn off captions", exact: true }).click();
    await expect(host.getByRole("button", { name: "Turn on captions", exact: true })).toBeVisible();

    await host.getByRole("button", { name: /^Open chat/ }).click();
    await host.getByRole("textbox", { name: "Write a message" }).fill("Decision record is closed and chat still works.");
    await host.getByRole("button", { name: "Send", exact: true }).click();
    await guest.getByRole("button", { name: /^Open chat/ }).click();
    await expect(guest.getByText("Decision record is closed and chat still works.", { exact: true })).toBeVisible();

    await host.getByRole("button", { name: "Open shared whiteboard", exact: true }).click();
    const board = host.getByRole("region", { name: "Board" });
    await expect(board.locator("canvas.excalidraw__canvas.interactive")).toBeVisible();
    await board.getByRole("button", { name: "Close shared whiteboard", exact: true }).click();

    await host.getByRole("button", { name: "Open shared notes", exact: true }).click();
    const notes = host.getByTestId("shared-notes");
    const editor = notes.locator(".ProseMirror");
    await editor.focus();
    await host.keyboard.insertText("قرار محفوظ بعد إغلاق لوحة القرارات");
    await expect(editor).toContainText("قرار محفوظ بعد إغلاق لوحة القرارات");
    await notes.getByRole("button", { name: "Close shared notes", exact: true }).click();

    const record = host.getByRole("button", { name: "Start local recording", exact: true });
    await expect(record).toBeEnabled();
    await record.click();
    await expect(host.getByText(/^Recording locally \(00:0[1-9]\)$/)).toBeVisible({ timeout: 10_000 });
    await host.getByRole("button", { name: "Stop local recording", exact: true }).click();
    await expect(host.getByText("Your WebM is ready in this tab. It will not be sent anywhere.", { exact: true })).toBeVisible();
  });

  test("decision foreign keys remove evidence records when a source or room is erased", async () => {
    const host = await alice.newPage();
    const db = getDb();

    async function createSourceRoom(text: string) {
      const code = await createRoom(host);
      const stored = await host.request.post(`/api/rooms/${code}/transcript`, {
        data: { text, speaker: "أحمد", identity: `source-${randomUUID()}` },
      });
      expect(stored.status()).toBe(201);
      const [room] = await db
        .select({ id: rooms.id, code: rooms.code })
        .from(rooms)
        .where(eq(rooms.code, code))
        .limit(1);
      if (!room) throw new Error("The room created for the database check was not stored");
      const [source] = await db
        .select({
          id: transcriptLines.id,
          seq: transcriptLines.seq,
          speaker: transcriptLines.speakerName,
          text: transcriptLines.text,
          createdAt: transcriptLines.createdAt,
        })
        .from(transcriptLines)
        .where(eq(transcriptLines.roomId, room.id))
        .limit(1);
      if (!source) throw new Error("The transcript source created for the database check was not stored");
      return { room, source };
    }

    async function insertDecision(roomId: string, source: {
      id: string;
      seq: number;
      speaker: string;
      text: string;
      createdAt: Date;
    }, origin?: "llm") {
      const [decision] = await db
        .insert(decisions)
        .values({
          roomId,
          sourceLineId: source.id,
          sourceSeq: source.seq,
          sourceSpeaker: source.speaker,
          sourceQuote: source.text,
          sourceCreatedAt: source.createdAt,
          text: "قرار اختبار",
          ...(origin ? { origin } : {}),
        })
        .returning({ id: decisions.id });
      if (!decision) throw new Error("The decision created for the database check was not stored");
      return decision;
    }

    // The model provenance reaches the review API, while the database rejects
    // a second record for the same utterance even if two requests race.
    const generatedCase = await createSourceRoom("قرار متولد من مصدر واحد");
    const generatedDecision = await insertDecision(generatedCase.room.id, generatedCase.source, "llm");
    const generatedView = await host.request.get(`/api/rooms/${generatedCase.room.code}/decisions`);
    expect(generatedView.ok()).toBe(true);
    await expect(generatedView.json()).resolves.toMatchObject({
      decisions: [expect.objectContaining({ id: generatedDecision.id, origin: "llm" })],
    });
    await expect(insertDecision(generatedCase.room.id, generatedCase.source, "llm"))
      .rejects.toMatchObject({ cause: expect.objectContaining({ code: "23505" }) });

    // Source cascade is the safeguard behind retention: a line cannot vanish
    // while a decision preserves its quotation elsewhere.
    const sourceCase = await createSourceRoom("قرار يختفي مع السطر المصدر");
    const sourceDecision = await insertDecision(sourceCase.room.id, sourceCase.source);
    await db.delete(transcriptLines).where(eq(transcriptLines.id, sourceCase.source.id));
    const afterSourceDelete = await db
      .select({ id: decisions.id })
      .from(decisions)
      .where(eq(decisions.id, sourceDecision.id));
    expect(afterSourceDelete).toHaveLength(0);

    // Room cascade is a distinct path: deleting a room removes every record
    // below it even if no transcript-retention sweep has run first.
    const roomCase = await createSourceRoom("قرار يختفي مع الغرفة");
    const roomDecision = await insertDecision(roomCase.room.id, roomCase.source);
    await db.delete(rooms).where(eq(rooms.id, roomCase.room.id));
    const afterRoomDelete = await db
      .select({ id: decisions.id })
      .from(decisions)
      .where(eq(decisions.id, roomDecision.id));
    expect(afterRoomDelete).toHaveLength(0);
  });

  test("action-item database rules preserve evidence, lifecycle, retention, and room isolation", async () => {
    const page = await alice.newPage();
    const db = getDb();
    const code = await createRoom(page);
    const [room] = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.code, code))
      .limit(1);
    if (!room) throw new Error("The action-item test room was not stored");

    const now = new Date("2026-09-09T10:00:00.000Z");
    const [source, owner] = await db
      .insert(transcriptLines)
      .values([
        {
          roomId: room.id,
          speakerIdentity: "p_ahmed",
          speakerName: "أحمد",
          text: "سارة هتراجع الـ pull request قبل الجمعة.",
          seq: 4,
          createdAt: now,
        },
        {
          roomId: room.id,
          speakerIdentity: "p_sara",
          speakerName: "سارة",
          text: "أنا هتابع الـ PR.",
          seq: 5,
          createdAt: new Date("2026-09-09T10:00:01.000Z"),
        },
      ])
      .returning({
        id: transcriptLines.id,
        seq: transcriptLines.seq,
        speaker: transcriptLines.speakerName,
        text: transcriptLines.text,
        createdAt: transcriptLines.createdAt,
      });
    if (!source || !owner) throw new Error("Action-item transcript evidence was not stored");

    // These forged values prove that the trigger takes evidence and an owner
    // display name from retained transcript rows, not the database caller.
    const [proposal] = await db
      .insert(actionItems)
      .values({
        roomId: room.id,
        sourceLineId: source.id,
        sourceSeq: 999,
        sourceSpeaker: "forged speaker",
        sourceQuote: "forged quote",
        sourceCreatedAt: new Date(0),
        assigneeIdentity: "p_sara",
        assigneeName: "forged assignee",
        text: "راجع الـ pull request.",
      })
      .returning({
        id: actionItems.id,
        status: actionItems.status,
        sourceSeq: actionItems.sourceSeq,
        sourceSpeaker: actionItems.sourceSpeaker,
        sourceQuote: actionItems.sourceQuote,
        sourceCreatedAt: actionItems.sourceCreatedAt,
        assigneeName: actionItems.assigneeName,
      });
    if (!proposal) throw new Error("Action-item proposal was not stored");
    expect(proposal).toMatchObject({
      status: "proposed",
      sourceSeq: source.seq,
      sourceSpeaker: source.speaker,
      sourceQuote: source.text,
      sourceCreatedAt: source.createdAt,
      assigneeName: owner.speaker,
    });

    await expect(
      db
        .update(actionItems)
        .set({ sourceQuote: "changed evidence" })
        .where(eq(actionItems.id, proposal.id)),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ code: "23514" }) });
    await expect(
      db
        .update(actionItems)
        .set({ status: "completed" })
        .where(eq(actionItems.id, proposal.id)),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ code: "23514" }) });
    await expect(
      db
        .update(actionItems)
        .set({ status: "open", assigneeIdentity: "p_missing", dueOn: "2026-09-12" })
        .where(eq(actionItems.id, proposal.id)),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ code: "23514" }) });
    await expect(
      db
        .update(actionItems)
        .set({ status: "open", assigneeIdentity: "p_sara" })
        .where(eq(actionItems.id, proposal.id)),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ code: "23514" }) });

    const [opened] = await db
      .update(actionItems)
      .set({ status: "open", assigneeIdentity: "p_sara", dueOn: "2026-09-12" })
      .where(eq(actionItems.id, proposal.id))
      .returning({
        status: actionItems.status,
        assigneeName: actionItems.assigneeName,
        openedAt: actionItems.openedAt,
      });
    expect(opened).toMatchObject({ status: "open", assigneeName: owner.speaker });
    expect(opened?.openedAt).toBeInstanceOf(Date);

    const [completed] = await db
      .update(actionItems)
      .set({ status: "completed" })
      .where(eq(actionItems.id, proposal.id))
      .returning({ status: actionItems.status, completedAt: actionItems.completedAt });
    expect(completed).toMatchObject({ status: "completed" });
    expect(completed?.completedAt).toBeInstanceOf(Date);

    // Reopening is the one reversible lifecycle action: it preserves the
    // original opening and evidence while clearing only the terminal clock.
    const [reopened] = await db
      .update(actionItems)
      .set({ status: "open" })
      .where(eq(actionItems.id, proposal.id))
      .returning({
        status: actionItems.status,
        openedAt: actionItems.openedAt,
        completedAt: actionItems.completedAt,
      });
    expect(reopened).toMatchObject({ status: "open", completedAt: null });
    expect(reopened?.openedAt).toBeInstanceOf(Date);

    await expect(
      db.insert(actionItems).values({
        roomId: room.id,
        sourceLineId: source.id,
        sourceSeq: 0,
        sourceSpeaker: "ignored",
        sourceQuote: "ignored",
        sourceCreatedAt: new Date(0),
        text: "راجع الـ pull request.",
      }),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ code: "23505" }) });

    const otherCode = await createRoom(page);
    const [otherRoom] = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.code, otherCode))
      .limit(1);
    if (!otherRoom) throw new Error("The isolation test room was not stored");
    await expect(
      db.insert(actionItems).values({
        roomId: otherRoom.id,
        sourceLineId: source.id,
        sourceSeq: 0,
        sourceSpeaker: "ignored",
        sourceQuote: "ignored",
        sourceCreatedAt: new Date(0),
        text: "Cross-room action item",
      }),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ code: "23503" }) });

    const [occurrence] = await db
      .insert(meetingOccurrences)
      .values({ roomId: room.id })
      .returning({ id: meetingOccurrences.id });
    if (!occurrence) throw new Error("Meeting occurrence was not stored");
    await expect(
      db.insert(meetingOccurrences).values({ roomId: room.id }),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ code: "23505" }) });

    // Source cascade removes the evidence-backed action item, and a separate
    // room cascade removes occurrence lifecycle metadata with its room.
    await db.delete(transcriptLines).where(eq(transcriptLines.id, source.id));
    await expect(
      db.select({ id: actionItems.id }).from(actionItems).where(eq(actionItems.id, proposal.id)),
    ).resolves.toHaveLength(0);
    await db.delete(rooms).where(eq(rooms.id, room.id));
    await expect(
      db.select({ id: meetingOccurrences.id })
        .from(meetingOccurrences)
        .where(eq(meetingOccurrences.id, occurrence.id)),
    ).resolves.toHaveLength(0);
  });

  test("a tile that is not painting yet shows the avatar, not a black rectangle", async () => {
    // #67 is normally a moment, so hold it open instead of trusting timing.
    const first = await alice.newPage();
    const second = await bob.newPage();

    const code = await createRoom(first);
    await join(first, code, "Ahmed");

    // Install before arrival: subscribed, but deterministically undecoded.
    await first.evaluate(() => {
      const holdUndecoded = () => {
        const video = document.querySelector<HTMLVideoElement>(
          '[data-identity][data-local="false"] video',
        );
        if (!video || video.dataset.heldUndecoded) return;

        video.dataset.heldUndecoded = "true";
        Object.defineProperties(video, {
          videoWidth: { configurable: true, get: () => 0 },
          readyState: { configurable: true, get: () => 0 },
        });
      };

      const observer = new MutationObserver(holdUndecoded);
      observer.observe(document.body, { childList: true, subtree: true });
      (
        window as unknown as { heldUndecodedObserver?: MutationObserver }
      ).heldUndecodedObserver = observer;
      holdUndecoded();
    });

    await join(second, code, "سارة");
    const remoteTile = first.locator('[data-identity][data-local="false"]');
    const remoteVideo = remoteTile.locator("video");
    const remoteAvatar = remoteTile.locator("[data-avatar]");

    await expect(remoteTile).toBeVisible();
    await expect(remoteAvatar).toBeVisible();
    // A stale frame must not remain visible behind the avatar.
    await expect(remoteAvatar).toHaveCSS("background-color", "rgb(20, 20, 22)");

    // Release the frame and move straight from fallback to picture.
    await remoteVideo.evaluate((node) => {
      const video = node as HTMLVideoElement;
      (
        window as unknown as { heldUndecodedObserver?: MutationObserver }
      ).heldUndecodedObserver?.disconnect();
      Reflect.deleteProperty(video, "videoWidth");
      Reflect.deleteProperty(video, "readyState");
      video.dispatchEvent(new Event("loadeddata"));
    });

    await expect
      .poll(() => playingVideos(first), { timeout: MEDIA_TIMEOUT })
      .toBeGreaterThanOrEqual(2);
    await expect(remoteAvatar).toHaveCount(0);

    // Freeze presented frames while the MediaStream timeline keeps advancing.
    // This is the observable shape of an RTP stall at the video element.
    const timeBeforeStall = await remoteVideo.evaluate(
      (node) => (node as HTMLVideoElement).currentTime,
    );
    await remoteVideo.evaluate((node) => {
      const video = node as HTMLVideoElement;
      const frozenFrames = video.getVideoPlaybackQuality().totalVideoFrames;
      Object.defineProperty(video, "getVideoPlaybackQuality", {
        configurable: true,
        value: () => ({ totalVideoFrames: frozenFrames }),
      });
    });

    await expect(remoteAvatar).toBeVisible({ timeout: 15_000 });
    expect(
      await remoteVideo.evaluate((node) => (node as HTMLVideoElement).currentTime),
    ).toBeGreaterThan(timeBeforeStall);
    await expect(remoteAvatar).toHaveCSS("background-color", "rgb(20, 20, 22)");
  });

  test("records a fake-device call into a non-empty local WebM download", async () => {
    const first = await alice.newPage();
    const second = await bob.newPage();

    const code = await createRoom(first);
    await join(first, code, "Ahmed");
    await join(second, code, "سارة");

    // A recording that starts before the fake camera is actually painting can
    // produce a mounted recorder with no usable data. Wait for real media, the
    // same condition this suite uses for the rest of the call.
    await expect
      .poll(() => playingVideos(first), { timeout: MEDIA_TIMEOUT })
      .toBeGreaterThanOrEqual(2);

    const start = first.getByRole("button", {
      name: "Start local recording",
      exact: true,
    });
    await expect(start).toBeEnabled();
    await start.click();

    await expect(first.getByText("You started a local recording.", { exact: true })).toBeVisible();
    await expect(second.getByText("Ahmed started a local recording.", { exact: true })).toBeVisible();
    await expect(first.getByText(/^Recording locally \(00:0[1-9]\)$/)).toBeVisible({
      timeout: 10_000,
    });

    // Put one grounded Timeline point inside this actual local recording. The
    // browser and the database share the runner clock, so the source timestamp
    // is a real seek target rather than a mocked video position.
    const db = getDb();
    const [room] = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.code, code))
      .limit(1);
    if (!room) throw new Error("The recording test room was not stored");
    await expect.poll(async () => {
      const rows = await db
        .select({ id: meetingOccurrences.id })
        .from(meetingOccurrences)
        .where(eq(meetingOccurrences.roomId, room.id));
      return rows.length;
    }).toBe(1);
    const [occurrence] = await db
      .select({ id: meetingOccurrences.id })
      .from(meetingOccurrences)
      .where(eq(meetingOccurrences.roomId, room.id))
      .limit(1);
    if (!occurrence) throw new Error("The recording test occurrence was not created");

    await first.waitForTimeout(1_250);
    const sourceAt = new Date();
    const [source] = await db
      .insert(transcriptLines)
      .values({
        roomId: room.id,
        occurrenceId: occurrence.id,
        durationMs: 1_000,
        speakerIdentity: "p_recording_test",
        speakerName: "Ahmed",
        text: "Review the local recording from this source line.",
        seq: 701,
        createdAt: sourceAt,
      })
      .returning({ id: transcriptLines.id, seq: transcriptLines.seq });
    if (!source) throw new Error("The recording Timeline source was not stored");
    await db.insert(timelineGeneratedMoments).values({
      roomId: room.id,
      occurrenceId: occurrence.id,
      sourceLineId: source.id,
      sourceSeq: source.seq,
      sourceAt,
    });

    await first.getByRole("button", { name: "Stop local recording", exact: true }).click();
    await expect(second.getByText("Ahmed stopped a local recording.", { exact: true })).toBeVisible();
    await expect(first.getByText("Your WebM is ready in this tab. It will not be sent anywhere.", { exact: true })).toBeVisible();

    await first.getByRole("button", { name: "Turn on captions", exact: true }).click();
    await first.getByRole("button", { name: "Timeline", exact: true }).click();
    const timeline = first.getByTestId("timeline-panel");
    await expect(timeline).toBeVisible();
    const localRecording = timeline.getByRole("button", { name: "Open local recording", exact: true });
    await expect(localRecording).toBeVisible();

    // Track URLs only in this browser test. It proves that the player releases
    // the transient local URL on both player close and panel unmount.
    await first.evaluate(() => {
      const storageKey = "__lor_recording_urls";
      const created = URL.createObjectURL.bind(URL);
      const revoked = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (value) => {
        const url = created(value);
        const state = JSON.parse(sessionStorage.getItem(storageKey) ?? '{"created":[],"revoked":[]}');
        state.created.push(url);
        sessionStorage.setItem(storageKey, JSON.stringify(state));
        return url;
      };
      URL.revokeObjectURL = (url) => {
        const state = JSON.parse(sessionStorage.getItem(storageKey) ?? '{"created":[],"revoked":[]}');
        state.revoked.push(url);
        sessionStorage.setItem(storageKey, JSON.stringify(state));
        revoked(url);
      };
    });

    await localRecording.click();
    const player = first.getByTestId("timeline-local-recording");
    const playerVideo = player.locator("video");
    await expect(player).toBeVisible();
    await first.setViewportSize({ width: 375, height: 667 });
    expect(await first.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    const playerClose = player.getByRole("button", { name: "Close player", exact: true });
    const playerCloseBox = await playerClose.boundingBox();
    expect(playerCloseBox?.width).toBeGreaterThanOrEqual(44);
    expect(playerCloseBox?.height).toBeGreaterThanOrEqual(44);
    await first.setViewportSize({ width: 667, height: 375 });
    await expect(player).toBeVisible();
    await expect.poll(
      () => playerVideo.evaluate((node) => (node as HTMLVideoElement).currentTime),
      { timeout: 15_000 },
    ).toBeGreaterThan(0);
    await expect(playerVideo).toHaveJSProperty("paused", true);
    await expect(player.getByText(/^Positioned at \+/)).toBeVisible();

    await playerClose.click();
    await expect(player).toHaveCount(0);
    await expect.poll(() => first.evaluate(() => {
      const state = JSON.parse(sessionStorage.getItem("__lor_recording_urls") ?? '{"created":[],"revoked":[]}');
      return state.created.length === 1 && state.revoked.includes(state.created[0]);
    })).toBe(true);

    await localRecording.click();
    await expect(player).toBeVisible();
    await timeline.getByRole("button", { name: "Close", exact: true }).click();
    await expect(timeline).toHaveCount(0);
    await expect.poll(() => first.evaluate(() => {
      const state = JSON.parse(sessionStorage.getItem("__lor_recording_urls") ?? '{"created":[],"revoked":[]}');
      return state.created.length === 2 && state.revoked.includes(state.created[1]);
    })).toBe(true);

    const downloadPromise = first.waitForEvent("download");
    await first.getByRole("button", { name: "Download WebM", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^lor-recording-.+\.webm$/);
    const path = await download.path();
    expect(path).not.toBeNull();
    expect((await stat(path!)).size).toBeGreaterThan(0);

    // A completed Blob lives only in the old document. After a reload, this
    // browser can still navigate to retained evidence but must not promise a
    // cloud replay or reopen that former local file.
    await first.reload();
    await join(first, code, "Ahmed");
    await first.getByRole("button", { name: "Turn on captions", exact: true }).click();
    await first.getByRole("button", { name: "Timeline", exact: true }).click();
    const reloadedTimeline = first.getByTestId("timeline-panel");
    const unavailablePlayer = reloadedTimeline.getByRole("button", { name: "Open local recording", exact: true });
    await expect(unavailablePlayer).toBeVisible();
    await unavailablePlayer.click();
    await expect(reloadedTimeline.getByText(
      "No completed local recording is available in this browser tab. You can still open the kept record.",
      { exact: true },
    )).toBeVisible();
    await reloadedTimeline.getByRole("button", { name: "Show source line", exact: true }).click();
    const sourceLine = first.locator(`[data-transcript-line="${source.seq}"]`);
    await expect(sourceLine).toBeVisible();
    await expect(sourceLine).toBeFocused();
  });
});
