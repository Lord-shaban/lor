import { defineConfig, devices } from "@playwright/test";

/**
 * The check that has to stay green for the rest of the project.
 *
 * Everything else in CI can pass while two people cannot see each other. This
 * suite is the only thing that would notice, so it runs against a real media
 * server with real tracks — a mocked one would keep passing through exactly the
 * regression it exists to catch.
 */

const PORT = Number(process.env.E2E_PORT ?? 3210);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",

  // Media takes a while to negotiate and the assertions wait on frames rather
  // than on elements, so the default five seconds is far too tight. The media
  // assertions raise their own timeout further still.
  timeout: 120_000,
  expect: { timeout: 25_000 },

  // Serial. Two browser contexts joining one room is the whole point, and
  // parallel workers would contend for the same fake camera on the runner.
  workers: 1,
  fullyParallel: false,

  // A flaky media test is worse than none: it teaches people to press retry.
  // Zero retries so flakiness is visible rather than absorbed.
  retries: 0,
  forbidOnly: !!process.env.CI,

  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            // A green test pattern and a steady tone, so there is something to
            // decode without a camera on the runner.
            "--use-fake-device-for-media-stream",
            // Grants the permission prompt, which no test can click.
            "--use-fake-ui-for-media-stream",
            "--autoplay-policy=no-user-gesture-required",
          ],
        },
      },
    },
  ],

  // Started by the runner unless something is already listening, so the same
  // command works locally against a dev server that is already up.
  webServer: {
    // Started from this package rather than through the workspace root:
    // Playwright runs it with the config file's own directory as cwd.
    command: `npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
