import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests only for now. Browser-level behaviour is covered by the
    // Playwright suite that arrives with #21.
    include: ["lib/**/*.test.ts"],
    environment: "node",
    alias: {
      // `server-only` throws by design when it is reached outside a server
      // bundle, which is exactly the guarantee we want in the build and exactly
      // what breaks a plain Node test run. Stubbing it here keeps the guarantee
      // where it matters without making server modules untestable.
      "server-only": new URL("./test/server-only-stub.ts", import.meta.url)
        .pathname,
    },
  },
});
