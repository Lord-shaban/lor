import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import { canvasSnapshots, getDb } from "@lor/db";
import { sweepTranscript } from "@/lib/transcript-retention";
import { roomSearchScope, sweepSearchRetention } from "./repository";

vi.mock("@lor/db", async (original) => ({
  ...await original<typeof import("@lor/db")>(),
  getDb: vi.fn(),
}));

vi.mock("@/lib/transcript-retention", () => ({
  sweepTranscript: vi.fn(),
}));

describe("search evidence boundaries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the room id in the shared predicate, never a global corpus", () => {
    const compiled = new PgDialect().sqlToQuery(roomSearchScope("room-a"));
    expect(compiled.sql).toContain('"search_documents"."room_id" =');
    expect(compiled.params).toEqual(["room-a"]);
    expect(compiled.params).not.toContain("room-b");
  });

  it("sweeps transcript and Canvas retention before a search can project evidence", async () => {
    const db = drizzle.mock();
    const calls: { table: unknown; sql: string; params: unknown[] }[] = [];
    vi.spyOn(db, "delete").mockImplementation((table) => ({
      where: async (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => {
        calls.push({ table, ...new PgDialect().sqlToQuery(condition) });
      },
    }) as never);
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
    const now = new Date("2026-09-13T12:00:00Z");

    await sweepSearchRetention("room-a", now);

    expect(sweepTranscript).toHaveBeenCalledWith("room-a", new Date("2026-08-14T12:00:00Z"));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.table).toBe(canvasSnapshots);
    expect(calls[0]?.sql).toContain('"canvas_snapshots"."room_id" =');
    expect(calls[0]?.sql).toContain('"canvas_snapshots"."updated_at" <');
    expect(calls[0]?.params).toEqual(["room-a", "2026-08-14T12:00:00.000Z"]);
  });
});
