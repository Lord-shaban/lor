import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb, meetingOccurrences, rooms } from "@lor/db";

export interface MeetingOccurrenceBoundary {
  roomId: string;
  /** Server time immediately before asking LiveKit about participant presence. */
  observedAt: Date;
  /** The LiveKit service API result, never a browser-provided claim. */
  roomWasEmpty: boolean;
}

export interface ActiveMeetingOccurrence {
  id: string;
  startedAt: Date;
}

interface LockedOccurrenceStore {
  active(): Promise<ActiveMeetingOccurrence | undefined>;
  close(id: string): Promise<void>;
  start(): Promise<ActiveMeetingOccurrence>;
}

export interface MeetingOccurrenceStore {
  withRoomLock<T>(
    roomId: string,
    operation: (store: LockedOccurrenceStore) => Promise<T>,
  ): Promise<T>;
}

/**
 * Decide inside an exclusive room lock whether the LiveKit observation begins a
 * new occurrence. A current occurrence that started after this request checked
 * LiveKit is a concurrent first join, not a meeting to close again.
 */
export async function resolveMeetingBoundary(
  store: MeetingOccurrenceStore,
  boundary: MeetingOccurrenceBoundary,
) {
  return store.withRoomLock(boundary.roomId, async (locked) => {
    const active = await locked.active();

    if (!boundary.roomWasEmpty) {
      return active ?? locked.start();
    }

    if (!active || active.startedAt >= boundary.observedAt) {
      return active ?? locked.start();
    }

    await locked.close(active.id);
    return locked.start();
  });
}

function databaseOccurrenceStore(): MeetingOccurrenceStore {
  const db = getDb();

  return {
    async withRoomLock(roomId, operation) {
      return db.transaction(async (tx) => {
        // A room row already exists because the token route found it. Lock only
        // after the external LiveKit request; HTTP can take seconds, while this
        // transaction should take milliseconds.
        await tx.execute(
          sql`select 1 from ${rooms} where ${rooms.id} = ${roomId} for update`,
        );

        return operation({
          async active() {
            const [active] = await tx
              .select({
                id: meetingOccurrences.id,
                startedAt: meetingOccurrences.startedAt,
              })
              .from(meetingOccurrences)
              .where(
                and(
                  eq(meetingOccurrences.roomId, roomId),
                  isNull(meetingOccurrences.endedAt),
                ),
              )
              .limit(1);
            return active;
          },
          async close(id) {
            await tx
              .update(meetingOccurrences)
              .set({ endedAt: sql`clock_timestamp()` })
              .where(
                and(
                  eq(meetingOccurrences.id, id),
                  eq(meetingOccurrences.roomId, roomId),
                  isNull(meetingOccurrences.endedAt),
                ),
              );
          },
          async start() {
            const [occurrence] = await tx
              .insert(meetingOccurrences)
              .values({ roomId })
              .returning({
                id: meetingOccurrences.id,
                startedAt: meetingOccurrences.startedAt,
              });
            if (!occurrence) throw new Error("Could not start meeting occurrence");
            return occurrence;
          },
        });
      });
    },
  };
}

/** Persist the server-defined meeting boundary for one successful token request. */
export function recordMeetingOccurrence(boundary: MeetingOccurrenceBoundary) {
  return resolveMeetingBoundary(databaseOccurrenceStore(), boundary);
}
