import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests only. Browser-level behaviour lives in e2e/ and is run by
    // Playwright, which needs a media server and a database that vitest has no
    // business starting.
    include: ["lib/**/*.test.ts"],
    exclude: ["e2e/**"],
    environment: "node",
    alias: {
      // `server-only` throws by design when it is reached outside a server
      // bundle, which is exactly the guarantee we want in the build and exactly
      // what breaks a plain Node test run. Stubbing it here keeps the guarantee
      // where it matters without making server modules untestable.
      "server-only": new URL("./test/server-only-stub.ts", import.meta.url)
        .pathname,
      // The same `@/` that tsconfig and the bundler resolve. Without it, a
      // module is testable or not depending on which import style its author
      // happened to reach for — a distinction nobody should have to hold in
      // their head, and one that has cost two debugging rounds already.
      // `fileURLToPath` rather than `.pathname`, which on Windows yields
      // `/C:/…` and resolves to nothing.
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
