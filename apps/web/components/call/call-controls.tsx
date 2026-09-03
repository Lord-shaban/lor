"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { cn } from "@/lib/cn";

/**
 * Whether this device can share a screen at all.
 *
 * getDisplayMedia does not exist on iOS Safari or on most Android browsers.
 * Showing a button that can only fail is worse than not showing it: viewers can
 * still see somebody else's share perfectly well.
 */
function canShareScreen(): boolean {
  return typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function";
}

/**
 * The bar everyone reaches for.
 *
 * Mute is the most-pressed control in any meeting, so it is first and it is
 * large. Leave is last and visually separated, because pressing it by accident
 * costs more than any other button here.
 */
export function CallControls({
  canPublish,
  onLeave,
}: {
  canPublish: boolean;
  /** Kept for the caller's benefit; the live state comes from the room. */
  startMicOff?: boolean;
  startCameraOff?: boolean;
  onLeave: () => void;
}) {
  const t = useTranslations("call");
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } =
    useLocalParticipant();

  // Read at first render rather than at module load, so this is not evaluated
  // during a server render where navigator does not exist.
  const [screenShareSupported] = useState(canShareScreen);

  const screenShareOn = Boolean(
    localParticipant.getTrackPublication(Track.Source.ScreenShare),
  );

  // One share at a time in v0.1. Two at once needs a way to choose between
  // them, and that is a layout question this release does not answer.
  const someoneElseSharing = participants.some(
    (participant) =>
      participant.identity !== localParticipant.identity &&
      participant.getTrackPublication(Track.Source.ScreenShare),
  );

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-t border-[#2a2a2e] px-4 py-3">
      {canPublish ? (
        <>
          <ControlButton
            active={isMicrophoneEnabled}
            onLabel={t("muteMic")}
            offLabel={t("unmuteMic")}
            onClick={() =>
              localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
            }
          />

          <ControlButton
            active={isCameraEnabled}
            onLabel={t("stopCamera")}
            offLabel={t("startCamera")}
            onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
          />

          {screenShareSupported && (
            <ControlButton
              active={!screenShareOn}
              onLabel={t("shareScreen")}
              offLabel={t("stopSharing")}
              // Disabled rather than hidden: the button vanishing when someone
              // else starts sharing is more confusing than it being unavailable
              // with a reason.
              disabled={someoneElseSharing && !screenShareOn}
              title={
                someoneElseSharing && !screenShareOn
                  ? t("someoneElseSharing")
                  : undefined
              }
              onClick={() =>
                localParticipant.setScreenShareEnabled(!screenShareOn, {
                  // Tab audio matters for anything with sound in it, and there
                  // is no good reason to make people ask for it separately.
                  audio: true,
                })
              }
            />
          )}
        </>
      ) : (
        // Someone still in the waiting room. Saying why the controls are absent
        // beats showing buttons that silently do nothing.
        <p className="text-sm text-[#a1a1aa]">{t("waitingToPublish")}</p>
      )}

      <button
        type="button"
        onClick={() => {
          void room.disconnect();
          onLeave();
        }}
        // Separated from the rest so it is not the button next to the one you
        // meant to press.
        className="ms-4 h-11 rounded-md bg-[#f87171] px-5 text-sm font-medium text-[#0a0a0b] transition-opacity duration-150 hover:opacity-90"
      >
        {t("leave")}
      </button>
    </div>
  );
}

function ControlButton({
  active,
  onLabel,
  offLabel,
  onClick,
  disabled,
  title,
}: {
  active: boolean;
  onLabel: string;
  offLabel: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={!active}
      className={cn(
        // 44px tall, and wide enough that the label is the target rather than
        // an icon somebody has to aim at.
        "h-11 rounded-md px-4 text-sm font-medium transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "bg-[#1e1e21] text-[#f4f4f5] hover:bg-[#2a2a2e]"
          : "bg-[#f87171] text-[#0a0a0b] hover:opacity-90",
      )}
    >
      {active ? onLabel : offLabel}
    </button>
  );
}
