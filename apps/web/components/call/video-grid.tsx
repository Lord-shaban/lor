"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useParticipants,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { RoomEvent, Track, type Participant } from "livekit-client";
import { ParticipantTile } from "@/components/call/participant-tile";
import {
  computeGridLayout,
  resolveActiveSpeaker,
} from "@/lib/grid-layout";

const GAP = 12;

/**
 * Everyone in the room.
 *
 * The layout is measured rather than tabulated: for each possible column count
 * it works out how big a 16:9 tile could be, and keeps the best. Two people on
 * a wide monitor sit side by side; the same two on a phone in portrait stack.
 * A breakpoint table gets one of those wrong.
 */
export function VideoGrid() {
  const t = useTranslations("call");
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [pinned, setPinned] = useState<string | null>(null);

  // Measure rather than guess. ResizeObserver also covers the phone rotating
  // and the browser chrome appearing, which a window listener misses.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox((current) =>
        // Sub-pixel churn from the observer would re-render on every frame.
        Math.abs(current.width - width) < 1 &&
        Math.abs(current.height - height) < 1
          ? current
          : { width, height },
      );
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const activeSpeaker = useActiveSpeaker(room);

  // Someone sharing their screen is what everyone is looking at, so it takes
  // the stage without anybody having to pin it.
  const sharing = participants.find((participant) =>
    participant.getTrackPublication(Track.Source.ScreenShare)?.isSubscribed,
  );

  // A screen share wins over a pin: whoever is sharing is what the room is
  // looking at, and a stale pin from earlier should not hide it.
  const focused = sharing
    ? sharing
    : (participants.find((participant) => participant.identity === pinned) ??
      null);

  // The sharer stays in the filmstrip as well, so their face is still visible
  // beside their screen rather than replaced by it.
  const others = focused
    ? sharing
      ? participants
      : participants.filter((p) => p.identity !== focused.identity)
    : participants;

  const layout = computeGridLayout({
    count: focused ? 1 : participants.length,
    width: box.width,
    // With a filmstrip, the stage gets what is left after it.
    height: focused ? box.height - FILMSTRIP_HEIGHT - GAP : box.height,
    gap: GAP,
  });

  function togglePin(identity: string) {
    setPinned((current) => (current === identity ? null : identity));
  }

  return (
    // overflow-hidden is load-bearing, not cosmetic. The tiles are sized from
    // this element's measured height, so if they were allowed to stretch it the
    // measurement would grow, the tiles would grow, and the layout would settle
    // one column too narrow with the controls pushed off screen.
    <div
      ref={containerRef}
      className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden"
    >
      {participants.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[#a1a1aa]">
          {t("aloneInRoom")}
        </div>
      ) : focused ? (
        <>
          <div className="min-h-0 flex-1">
            <ParticipantTile
              participant={focused}
              source={sharing ? Track.Source.ScreenShare : Track.Source.Camera}
              isActiveSpeaker={activeSpeaker === focused.identity}
              isLocal={focused.identity === localParticipant.identity}
              isPinned={pinned === focused.identity}
              onTogglePin={() => togglePin(focused.identity)}
              className="h-full w-full"
            />
          </div>

          {others.length > 0 && (
            // Horizontal scroll on the strip only. The page itself must never
            // scroll sideways.
            <div
              className="flex shrink-0 gap-3 overflow-x-auto"
              style={{ height: FILMSTRIP_HEIGHT }}
            >
              {others.map((participant) => (
                <ParticipantTile
                  key={participant.identity}
                  participant={participant}
                  isActiveSpeaker={activeSpeaker === participant.identity}
                  isLocal={participant.identity === localParticipant.identity}
                  isPinned={false}
                  onTogglePin={() => togglePin(participant.identity)}
                  className="aspect-video h-full shrink-0"
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div
          className="flex min-h-0 flex-1 flex-wrap content-center justify-center overflow-hidden"
          style={{ gap: GAP }}
        >
          {participants.map((participant) => (
            <ParticipantTile
              key={participant.identity}
              participant={participant}
              isActiveSpeaker={activeSpeaker === participant.identity}
              isLocal={participant.identity === localParticipant.identity}
              isPinned={false}
              onTogglePin={() => togglePin(participant.identity)}
              style={{
                width: layout.tileWidth,
                height: layout.tileHeight,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const FILMSTRIP_HEIGHT = 108;

/**
 * Who to highlight, with the flicker taken out.
 *
 * LiveKit already smooths its speaking flag, but a cough still flips it. The
 * hold in `resolveActiveSpeaker` keeps the highlight in place long enough that
 * a change reads as a turn taken rather than a twitch.
 */
function useActiveSpeaker(room: ReturnType<typeof useRoomContext>) {
  const [state, setState] = useState<{ identity: string | null; since: number }>(
    { identity: null, since: 0 },
  );

  useEffect(() => {
    function onSpeakersChanged(speakers: Participant[]) {
      setState((previous) =>
        resolveActiveSpeaker({
          speaking: speakers.map((speaker) => speaker.identity),
          previous: previous.identity,
          previousSince: previous.since,
          now: Date.now(),
        }),
      );
    }

    room.on(RoomEvent.ActiveSpeakersChanged, onSpeakersChanged);
    return () => {
      room.off(RoomEvent.ActiveSpeakersChanged, onSpeakersChanged);
    };
  }, [room]);

  return state.identity;
}
