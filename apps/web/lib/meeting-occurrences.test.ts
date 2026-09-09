import { describe, expect, it, vi } from "vitest";
import {
  recordMeetingOccurrenceIfPresent,
  resolveMeetingBoundary,
  type ActiveMeetingOccurrence,
  type MeetingOccurrenceStore,
} from "./meeting-occurrences";

function memoryStore(
  initial?: ActiveMeetingOccurrence,
  startsAt: Date[] = [new Date("2026-09-09T10:00:05.000Z")],
) {
  let active = initial;
  const closed: string[] = [];
  let starts = 0;
  let tail = Promise.resolve();

  const store: MeetingOccurrenceStore = {
    async withRoomLock(_roomId, operation) {
      let release!: () => void;
      const next = new Promise<void>((resolve) => { release = resolve; });
      const previous = tail;
      tail = next;
      await previous;
      try {
        return await operation({
          async active() {
            return active;
          },
          async close(id) {
            if (active?.id === id) active = undefined;
            closed.push(id);
          },
          async start() {
            const occurrence = {
              id: `meeting-${++starts}`,
              startedAt: startsAt[starts - 1] ?? startsAt.at(-1)!,
            };
            active = occurrence;
            return occurrence;
          },
        });
      } finally {
        release();
      }
    },
  };

  return {
    store,
    active: () => active,
    closed,
    starts: () => starts,
  };
}

describe("meeting occurrence boundary", () => {
  it("does not create or close an occurrence when LiveKit presence is unavailable", async () => {
    const unavailable = new Error("LiveKit service unavailable");
    const record = vi.fn();

    await expect(recordMeetingOccurrenceIfPresent({
      roomId: "room-a",
      livekitRoom: "lor_room-a",
      observeRoomEmpty: async () => { throw unavailable; },
      record,
      now: () => new Date("2026-09-09T10:00:00.000Z"),
    })).resolves.toEqual({ status: "presence_unavailable", cause: unavailable });

    expect(record).not.toHaveBeenCalled();
  });

  it("records a boundary from the LiveKit observation when presence is available", async () => {
    const observedAt = new Date("2026-09-09T10:00:00.000Z");
    const occurrence = {
      id: "meeting-1",
      startedAt: new Date("2026-09-09T10:00:01.000Z"),
    };
    const record = vi.fn().mockResolvedValue(occurrence);

    await expect(recordMeetingOccurrenceIfPresent({
      roomId: "room-a",
      livekitRoom: "lor_room-a",
      observeRoomEmpty: async () => true,
      record,
      now: () => observedAt,
    })).resolves.toEqual({ status: "recorded", occurrence });

    expect(record).toHaveBeenCalledWith({
      roomId: "room-a",
      observedAt,
      roomWasEmpty: true,
    });
  });

  it("starts only one occurrence for concurrent first joins that both observed an empty room", async () => {
    const memory = memoryStore(undefined, [new Date("2026-09-09T10:00:03.000Z")]);

    const [first, second] = await Promise.all([
      resolveMeetingBoundary(memory.store, {
        roomId: "room-a",
        observedAt: new Date("2026-09-09T10:00:00.000Z"),
        roomWasEmpty: true,
      }),
      resolveMeetingBoundary(memory.store, {
        roomId: "room-a",
        observedAt: new Date("2026-09-09T10:00:01.000Z"),
        roomWasEmpty: true,
      }),
    ]);

    expect(first.id).toBe(second.id);
    expect(memory.starts()).toBe(1);
    expect(memory.closed).toEqual([]);
  });

  it("does not restart an active occurrence for a reconnect while LiveKit has participants", async () => {
    const existing = {
      id: "meeting-existing",
      startedAt: new Date("2026-09-09T09:00:00.000Z"),
    };
    const memory = memoryStore(existing);

    await expect(resolveMeetingBoundary(memory.store, {
      roomId: "room-a",
      observedAt: new Date("2026-09-09T10:00:00.000Z"),
      roomWasEmpty: false,
    })).resolves.toEqual(existing);

    expect(memory.starts()).toBe(0);
    expect(memory.closed).toEqual([]);
  });

  it("closes the previous occurrence and starts the next only after LiveKit reports empty", async () => {
    const memory = memoryStore(
      { id: "meeting-previous", startedAt: new Date("2026-09-09T09:00:00.000Z") },
      [new Date("2026-09-09T10:00:01.000Z")],
    );

    await expect(resolveMeetingBoundary(memory.store, {
      roomId: "room-a",
      observedAt: new Date("2026-09-09T10:00:00.000Z"),
      roomWasEmpty: true,
    })).resolves.toMatchObject({ id: "meeting-1" });

    expect(memory.closed).toEqual(["meeting-previous"]);
    expect(memory.active()).toMatchObject({ id: "meeting-1" });
  });
});
