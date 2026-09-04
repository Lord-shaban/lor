import { expect, test, type Page, type BrowserContext } from "@playwright/test";

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
  const response = await page.request.post("/api/rooms", { data: {} });
  expect(response.ok()).toBe(true);
  const { code } = await response.json();
  expect(typeof code).toBe("string");
  return code as string;
}

async function join(page: Page, code: string, name: string) {
  await page.goto(`/en/${code}`);

  const nameField = page.locator('input[autocomplete="name"]');
  await expect(nameField).toBeVisible();
  await nameField.fill(name);

  await page.locator('button[type="submit"]').click();

  // In the call, not merely past the prejoin.
  await expect(page.getByRole("button", { name: "Leave" })).toBeVisible();
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
});
