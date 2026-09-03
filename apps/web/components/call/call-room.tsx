"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  LiveKitRoom,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { RoomEvent, Track, type RoomOptions } from "livekit-client";
import { VideoGrid } from "@/components/call/video-grid";
import { CallControls } from "@/components/call/call-controls";
import type { JoinDetails } from "@/components/prejoin/prejoin";

export interface Connection {
  token: string;
  serverUrl: string;
  identity: string;
  canPublish: boolean;
  isHost: boolean;
}

/**
 * The call.
 *
 * Always dark, regardless of the theme. Video is bright, and an hour of a light
 * surround around a bright rectangle is tiring — which is why every tool people
 * actually use for long calls does the same.
 */
export function CallRoom({
  connection,
  details,
  onLeave,
}: {
  connection: Connection;
  details: JoinDetails;
  onLeave: () => void;
}) {
  const t = useTranslations("call");
  const [error, setError] = useState<string | null>(null);

  const options: RoomOptions = {
    // Only send what someone is actually looking at. On a phone showing a grid
    // of thumbnails, publishing full resolution to each is the fastest way to
    // burn a data plan and a battery.
    adaptiveStream: true,
    dynacast: true,
    publishDefaults: {
      // Three layers, so the server can hand a large tile a good stream and a
      // thumbnail a cheap one without the sender encoding twice.
      simulcast: true,

      // A shared screen is mostly still text. Resolution is what makes it
      // readable and frame rate is what does not, so the bitrate goes into
      // pixels: 1080p at 5fps rather than 720p at 30. Encoding a screen like a
      // face is the usual reason shared code is unreadable.
      screenShareEncoding: {
        maxBitrate: 2_500_000,
        maxFramerate: 5,
        priority: "high",
      },
      // One layer. Simulcasting a screen share halves the bitrate available to
      // the layer people are actually reading.
      screenShareSimulcastLayers: [],
    },
    videoCaptureDefaults: {
      deviceId: details.videoDeviceId,
    },
    audioCaptureDefaults: {
      deviceId: details.audioDeviceId,
    },
  };

  return (
    <div
      // Scoped rather than global: the rest of the product follows the system
      // theme, and only this screen is pinned dark.
      data-theme="dark"
      className="flex h-[100dvh] flex-col overflow-hidden bg-[#0a0a0b] text-[#f4f4f5]"
    >
      <LiveKitRoom
        token={connection.token}
        serverUrl={connection.serverUrl}
        connect
        video={!details.cameraOff && connection.canPublish}
        audio={!details.micOff && connection.canPublish}
        options={options}
        onError={(caught) => setError(caught.message)}
        onDisconnected={onLeave}
        // The library ships its own stylesheet; we do not load it, so this
        // element is styled entirely by the design system.
        className="flex min-h-0 flex-1 flex-col"
      >
        <SharingBanner />

        <main className="min-h-0 flex-1 overflow-hidden p-3">
          <VideoGrid />
        </main>

        <CallControls
          canPublish={connection.canPublish}
          startMicOff={details.micOff}
          startCameraOff={details.cameraOff}
          onLeave={onLeave}
        />

        <ConnectionWatcher />
      </LiveKitRoom>

      {error && (
        <p role="alert" className="px-4 pb-3 text-sm text-[#f87171]">
          {t("errors.connection", { message: error })}
        </p>
      )}
    </div>
  );
}

/**
 * Say when the connection is in trouble.
 *
 * A frozen frame with no explanation is the single most frustrating thing a
 * call can do — people cannot tell whether the problem is theirs, and start
 * talking into a void. Reconnection is normal on mobile data, so it gets stated
 * rather than hidden.
 */
function ConnectionWatcher() {
  const t = useTranslations("call");
  const [reconnecting, setReconnecting] = useState(false);

  // This component sits inside LiveKitRoom, which is what makes the context
  // available — the room cannot be reached from the component that renders it.
  const room = useRoomContext();

  useEffect(() => {
    const onReconnecting = () => setReconnecting(true);
    const onReconnected = () => setReconnecting(false);

    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    return () => {
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
    };
  }, [room]);

  if (!reconnecting) return null;

  return (
    <p
      role="status"
      className="bg-[#1e1e21] px-4 py-2 text-center text-sm text-[#f4f4f5]"
    >
      {t("reconnecting")}
    </p>
  );
}

/**
 * A standing reminder that your screen is on other people's monitors.
 *
 * Forgetting is the expensive mistake in a video call — the one that puts a
 * password manager or a private message in front of a room. The browser shows
 * its own bar, but it is easy to miss behind a maximised window, so this says
 * it inside the call and offers the stop button right there.
 *
 * It also covers the reverse case: when someone stops from the browser's own
 * bar, LiveKit ends the track and this disappears without any extra wiring,
 * because it reads the publication rather than a flag we set ourselves.
 */
function SharingBanner() {
  const t = useTranslations("call");
  const { localParticipant } = useLocalParticipant();

  const publication = localParticipant.getTrackPublication(
    Track.Source.ScreenShare,
  );
  if (!publication) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 bg-[#f87171] px-4 py-2 text-sm text-[#0a0a0b]"
    >
      <span>{t("youAreSharing")}</span>
      <button
        type="button"
        onClick={() => localParticipant.setScreenShareEnabled(false)}
        className="rounded-md bg-[#0a0a0b] px-3 py-1 text-xs font-medium text-[#f4f4f5]"
      >
        {t("stopSharing")}
      </button>
    </div>
  );
}
