"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { REACTIONS, type Reaction } from "@/lib/data-channel";
import type { VideoMode } from "@/lib/video-mode";
import { VideoModeControl } from "@/components/call/video-mode-control";
import { cn } from "@/lib/cn";

/**
 * What each reaction is called.
 *
 * Keyed by the emoji itself rather than by position, so reordering the list
 * cannot silently relabel them. An emoji with no name is unreadable to anyone
 * using a screen reader and ambiguous to everyone else.
 */
const REACTION_LABELS: Record<Reaction, string> = {
  "\u{1F44D}": "thumbsUp",
  "\u2764\uFE0F": "heart",
  "\u{1F602}": "laugh",
  "\u{1F389}": "celebrate",
  "\u{1F44F}": "clap",
  "\u{1F62E}": "wow",
};

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
  chatOpen,
  unread,
  onToggleChat,
  handRaised,
  onToggleHand,
  onReact,
  videoMode,
  onChooseVideoMode,
  onLeave,
}: {
  canPublish: boolean;
  chatOpen: boolean;
  unread: number;
  onToggleChat: () => void;
  handRaised: boolean;
  onToggleHand: () => void;
  onReact: (emoji: Reaction) => void;
  videoMode: VideoMode;
  onChooseVideoMode: (mode: VideoMode) => void;
  onLeave: () => void;
}) {
  const t = useTranslations("call");
  const format = useFormatter();
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } =
    useLocalParticipant();

  // Read at first render rather than at module load, so this is not evaluated
  // during a server render where navigator does not exist.
  const [screenShareSupported] = useState(canShareScreen);

  const [pickerOpen, setPickerOpen] = useState(false);

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
    <div className="relative flex flex-wrap items-center justify-center gap-2 border-t border-[#2a2a2e] px-4 py-3">
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

      {/* Outside the canPublish branch too: most of what this saves is what you
          receive, and somebody waiting to be admitted is already receiving it. */}
      <VideoModeControl mode={videoMode} onChoose={onChooseVideoMode} />

      {/* Reactions and a raised hand are how you answer without interrupting,
          which matters most to the people who are not speaking. Both stay
          available to someone still waiting to be admitted: with no camera and
          no microphone, they are the only way to ask. */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-expanded={pickerOpen}
          aria-label={t("reactions.open")}
          className={cn(
            "h-11 rounded-md px-4 text-base leading-none transition-colors duration-150",
            pickerOpen
              ? "bg-[#f4f4f5] text-[#0a0a0b]"
              : "bg-[#1e1e21] text-[#f4f4f5] hover:bg-[#2a2a2e]",
          )}
        >
          <span aria-hidden="true">{REACTIONS[3]}</span>
        </button>

        {pickerOpen && (
          // Above the bar rather than inside it: a row that appeared in place
          // would shove every other control sideways the moment it opened.
          <div
            role="group"
            aria-label={t("reactions.open")}
            className="absolute bottom-full left-1/2 z-30 mb-2 flex -translate-x-1/2 gap-1 rounded-full border border-[#2a2a2e] bg-[#141416] p-1"
          >
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={t(`reactions.${REACTION_LABELS[emoji]}`)}
                onClick={() => {
                  onReact(emoji);
                  setPickerOpen(false);
                }}
                className="h-11 w-11 rounded-full text-2xl leading-none transition-colors duration-150 hover:bg-[#2a2a2e]"
              >
                <span aria-hidden="true">{emoji}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onToggleHand}
        aria-pressed={handRaised}
        aria-label={handRaised ? t("hands.lower") : t("hands.raise")}
        className={cn(
          "h-11 rounded-md px-4 text-base leading-none transition-colors duration-150",
          handRaised
            ? "bg-[#f4f4f5] text-[#0a0a0b]"
            : "bg-[#1e1e21] text-[#f4f4f5] hover:bg-[#2a2a2e]",
        )}
      >
        <span aria-hidden="true">✋</span>
      </button>

      {/* Outside the canPublish branch on purpose: someone still waiting to be
          admitted has no camera, but they can still type — and asking to be let
          in is exactly what they need to do. */}
      <button
        type="button"
        onClick={onToggleChat}
        aria-pressed={chatOpen}
        aria-label={
          unread > 0
            ? t("chat.openWithUnread", { count: unread })
            : chatOpen
              ? t("chat.close")
              : t("chat.open")
        }
        className={cn(
          "relative h-11 rounded-md px-4 text-sm font-medium transition-colors duration-150",
          chatOpen
            ? "bg-[#f4f4f5] text-[#0a0a0b] hover:opacity-90"
            : "bg-[#1e1e21] text-[#f4f4f5] hover:bg-[#2a2a2e]",
        )}
      >
        {t("chat.title")}

        {unread > 0 && (
          // aria-hidden because the count is already in the button's label;
          // announcing it twice is how a screen reader turns one message into
          // two.
          <span
            aria-hidden="true"
            className="absolute -top-1 -end-1 min-w-5 rounded-full bg-[#f87171] px-1.5 py-0.5 text-xs font-medium text-[#0a0a0b] tabular-nums"
          >
            {/* Localised, so an Arabic interface gets Arabic-Indic digits, and
                isolated so they do not reorder against the button label. */}
            <bdi>{format.number(unread)}</bdi>
          </span>
        )}
      </button>

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
