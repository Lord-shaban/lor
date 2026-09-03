import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests only for now. Browser-level behaviour is covered by the
    // Playwright suite that arrives with #21.
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
