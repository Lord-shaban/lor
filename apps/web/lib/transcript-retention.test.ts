import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import { getDb, summaries, transcriptLines } from "@lor/db";
import { sweepTranscript } from "./transcript-retention";

vi.mock("@lor/db", async (original) => ({
  ...await original<typeof import("@lor/db")>(),
  getDb: vi.fn(),
}));

describe("transcript retention", () => {
  beforeEach(() => vi.clearAllMocks());

  function database(failSummary = false) {
    const db = drizzle.mock();
    const calls: { table: unknown; sql: string; params: unknown[] }[] = [];
    const remove = vi.spyOn(db, "delete").mockImplementation((table) => ({
      where: async (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => {
        calls.push({ table, ...new PgDialect().sqlToQuery(condition) });
        if (failSummary) throw new Error("cleanup unavailable");
      },
    }) as never);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
    return { calls, remove };
  }

  it("invalidates derived copies before their source and scopes both deletes to the room", async () => {
    const { calls } = database();
    const cutoff = new Date("2026-08-09T12:00:00Z");
    await sweepTranscript("room-a", cutoff);
    expect(calls.map((call) => call.table)).toEqual([summaries, transcriptLines]);
    expect(calls[0].sql).toContain('"summaries"."room_id" =');
    expect(calls[0].sql).toContain("exists (select");
    expect(calls[0].sql).toContain('"transcript_lines"."created_at" <');
    expect(calls[0].params).toEqual(["room-a", cutoff.toISOString(), "room-a", cutoff.toISOString()]);
    expect(calls[1].params).toEqual(["room-a", cutoff.toISOString()]);
  });

  it("leaves source rows available for retry if deleting the summary fails", async () => {
    const { remove } = database(true);
    await expect(sweepTranscript("room-a", new Date())).rejects.toThrow("cleanup unavailable");
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(summaries);
  });
});
