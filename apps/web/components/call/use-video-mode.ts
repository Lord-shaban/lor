"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import {
  ConnectionQuality,
  RoomEvent,
  VideoQuality,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type Room,
} from "livekit-client";
import {
  NO_DEGRADATION,
  SAMPLE_INTERVAL_MS,
  observeQuality,
  type DegradationState,
} from "@/lib/degradation";
import {
  cameraForModeChange,
  effectOf,
  type VideoMode,
} from "@/lib/video-mode";

/**
 * Apply a video mode to the room, and keep applying it.
 *
 * A mode is not a one-off command: somebody who joins after you chose audio-only
 * must arrive silent too, and a camera switched on later must arrive capped. So
 * the mode is re-applied on every publication event rather than only when the
 * control is pressed.
 *
 * Two LiveKit details decide how this is written, and both are the opposite of
 * the obvious choice:
 *
 * - **Audio-only unsubscribes; it does not disable.** `setEnabled(false)` leaves
 *   the subscription in place, and once `setEnabled` has been called at all the
 *   publication stops obeying adaptive stream — `requestedDisabled` wins over
 *   visibility for the rest of the session. Using it here would buy one
 *   bandwidth saving by permanently destroying a better one.
 * - **Auto never sets a quality of its own beyond the cap.** Adaptive stream is
 *   already choosing per tile, per size, per visibility. The cap is the only
 *   thing worth saying from up here.
 */
export function useVideoMode() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const [mode, setMode] = useState<VideoMode>("auto");

  // True only while the current mode is one this code chose rather than one the
  // person did. It is what the notice is conditioned on: "we reduced this for
  // you" must never appear over a choice somebody made themselves.
  const [reducedForYou, setReducedForYou] = useState(false);

  // Whether the camera was on at the moment audio-only was entered, so leaving
  // it restores what was there rather than switching on a camera that was off.
  const cameraBeforeAudioOnlyRef = useRef(true);
  const modeRef = useRef<VideoMode>(mode);
  const degradationRef = useRef<DegradationState>(NO_DEGRADATION);

  // Re-applied on every publication event, so late arrivals inherit the mode.
  useEffect(() => {
    applyMode(room, mode);

    function reapply() {
      applyMode(room, modeRef.current);
    }

    room.on(RoomEvent.TrackSubscribed, reapply);
    room.on(RoomEvent.TrackPublished, reapply);
    room.on(RoomEvent.ParticipantConnected, reapply);
    return () => {
      room.off(RoomEvent.TrackSubscribed, reapply);
      room.off(RoomEvent.TrackPublished, reapply);
      room.off(RoomEvent.ParticipantConnected, reapply);
    };
  }, [room, mode]);

  /**
   * Sampled rather than driven by events.
   *
   * `ConnectionQualityChanged` fires on a change, so a connection that goes bad
   * and stays bad produces exactly one event — and "has it been bad for eight
   * seconds?" cannot be answered from one event. An interval is the honest
   * shape of the question.
   */
  useEffect(() => {
    const timer = setInterval(() => {
      const quality = localParticipant.connectionQuality;
      const { state, reduce } = observeQuality({
        state: degradationRef.current,
        poor:
          quality === ConnectionQuality.Poor ||
          quality === ConnectionQuality.Lost,
        automatic: modeRef.current === "auto",
        now: Date.now(),
      });
      degradationRef.current = state;

      if (reduce) {
        modeRef.current = "low";
        setMode("low");
        setReducedForYou(true);
      }
    }, SAMPLE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [localParticipant]);

  const chooseMode = useCallback(
    (next: VideoMode) => {
      // Any deliberate choice makes the current mode theirs, including one that
      // lands on the mode already in force. Pressing "Less data" while this code
      // had already reduced must not leave a notice claiming it did it.
      degradationRef.current = NO_DEGRADATION;
      setReducedForYou(false);

      const previous = modeRef.current;
      if (next === previous) return;

      if (next === "off") {
        cameraBeforeAudioOnlyRef.current = localParticipant.isCameraEnabled;
      }

      const camera = cameraForModeChange({
        next,
        previous,
        cameraBeforeAudioOnly: cameraBeforeAudioOnlyRef.current,
      });
      if (camera !== null) {
        // Rejects when the engine is closed, which is not worth an error.
        localParticipant.setCameraEnabled(camera).catch(() => {});
      }

      modeRef.current = next;
      setMode(next);
    },
    [localParticipant],
  );

  const dismissNotice = useCallback(() => setReducedForYou(false), []);

  return { mode, chooseMode, reducedForYou, dismissNotice };
}

function applyMode(room: Room, mode: VideoMode) {
  const effect = effectOf(mode);

  for (const participant of room.remoteParticipants.values()) {
    for (const publication of videoPublications(participant)) {
      // Subscription first: LiveKit refuses to change settings on a track the
      // client has said it does not want, so a quality set before re-subscribing
      // is silently dropped.
      publication.setSubscribed(effect.receiveVideo);
      if (!effect.receiveVideo) continue;

      publication.setVideoQuality(
        effect.maxLayer === "low" ? VideoQuality.LOW : VideoQuality.HIGH,
      );
    }
  }
}

/**
 * Every video a participant is sending, cameras and shared screens alike.
 *
 * A shared screen is not exempt from audio-only. It is usually the heaviest
 * thing in the room, and somebody who has just said they cannot afford video
 * has not made an exception for the largest one.
 */
function videoPublications(
  participant: RemoteParticipant,
): RemoteTrackPublication[] {
  return [...participant.videoTrackPublications.values()];
}
