import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { expect, test, type Page, type BrowserContext } from "@playwright/test";
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

// The production proxy rewrites this header with the actual caller address.
// Playwright talks to Next directly, so repeated local runs would otherwise
// share `127.0.0.1` and consume the real ten-rooms-per-hour test bucket.
const E2E_CALLER_ADDRESS = `playwright-${randomUUID()}`;

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
    headers: { "x-forwarded-for": E2E_CALLER_ADDRESS },
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
});
