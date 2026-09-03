import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Migration SQL is reviewed in the pull request like any other change, so it
  // must be readable rather than minimal.
  verbose: true,
  strict: true,
});
