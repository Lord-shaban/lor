import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import { decisions, getDb, summaries, transcriptLines } from "@lor/db";
import { sweepTranscript } from "./transcript-retention";

vi.mock("@lor/db", async (original) => ({
  ...await original<typeof import("@lor/db")>(),
  getDb: vi.fn(),
}));

describe("transcript retention", () => {
  beforeEach(() => vi.clearAllMocks());

  function database(failAt?: unknown) {
    const db = drizzle.mock();
    const calls: { table: unknown; sql: string; params: unknown[] }[] = [];
    const remove = vi.spyOn(db, "delete").mockImplementation((table) => ({
      where: async (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => {
        calls.push({ table, ...new PgDialect().sqlToQuery(condition) });
        if (table === failAt) throw new Error("cleanup unavailable");
      },
    }) as never);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
    return { calls, remove };
  }

  it("invalidates every derived copy before its source and scopes all deletes to the room", async () => {
    const { calls } = database();
    const cutoff = new Date("2026-08-09T12:00:00Z");
    await sweepTranscript("room-a", cutoff);
    expect(calls.map((call) => call.table)).toEqual([decisions, summaries, transcriptLines]);
    expect(calls[0].sql).toContain('"decisions"."room_id" =');
    expect(calls[0].sql).toContain("exists (select");
    expect(calls[0].sql).toContain('"transcript_lines"."created_at" <');
    expect(calls[0].params).toEqual(["room-a", "room-a", cutoff.toISOString()]);
    expect(calls[1].params).toEqual(["room-a", cutoff.toISOString(), "room-a", cutoff.toISOString()]);
    expect(calls[2].params).toEqual(["room-a", cutoff.toISOString()]);
  });

  it("leaves source rows available for retry if deleting a decision fails", async () => {
    const { remove } = database(decisions);
    await expect(sweepTranscript("room-a", new Date())).rejects.toThrow("cleanup unavailable");
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(decisions);
  });

  it("leaves transcript rows available for retry if another derived cleanup fails", async () => {
    const { remove } = database(summaries);
    await expect(sweepTranscript("room-a", new Date())).rejects.toThrow("cleanup unavailable");
    expect(remove.mock.calls.map(([table]) => table)).toEqual([decisions, summaries]);
  });
});
