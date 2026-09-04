"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ConnectionQuality,
  Track,
  type Participant,
  type TrackPublication,
} from "livekit-client";
import { cn } from "@/lib/cn";

/**
 * One person.
 *
 * Everything on a tile competes with the face on it, so the chrome is as quiet
 * as it can be while still answering the three questions people actually ask:
 * who is this, can they hear me, and is their connection the reason they keep
 * breaking up.
 */
export function ParticipantTile({
  participant,
  isActiveSpeaker,
  isLocal,
  isPinned,
  onTogglePin,
  onMute,
  onStopShare,
  onRemove,
  source = Track.Source.Camera,
  className,
  style,
}: {
  participant: Participant;
  isActiveSpeaker: boolean;
  isLocal: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
  /**
   * Present only for a host looking at somebody else.
   *
   * There is deliberately no unmute counterpart. A host can close a microphone
   * and never open one — being silenced is recoverable, having your microphone
   * opened for you is not.
   */
  onMute?: () => void;
  onStopShare?: () => void;
  /** Removal blocks rejoining for the rest of the meeting, so it asks twice. */
  onRemove?: () => void;
  /** Which of this participant's tracks to draw. */
  source?: Track.Source;
  className?: string;
  style?: React.CSSProperties;
}) {
  const t = useTranslations("call");

  // Removal is the one action here that the person cannot undo for themselves,
  // so it asks twice. A dialog would cover the face of whoever you are deciding
  // about, which is exactly the thing you want to still be looking at.
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const isScreenShare = source === Track.Source.ScreenShare;
  const videoPublication = participant.getTrackPublication(source);
  const micPublication = participant.getTrackPublication(Track.Source.Microphone);

  const videoOn = Boolean(
    videoPublication?.isSubscribed && !videoPublication.isMuted,
  );
  const micOn = Boolean(micPublication && !micPublication.isMuted);

  const name = participant.name || participant.identity;

  return (
    <div
      style={style}
      // Named in the markup so a browser-driven check can tell whose tile it is
      // without reading the label. Without this, "is video still arriving?" gets
      // asked of every <video> on the page including your own preview, which
      // answers a different question — the local camera is unaffected by what
      // you choose to receive.
      data-identity={participant.identity}
      data-local={isLocal}
      data-source={isScreenShare ? "screen" : "camera"}
      className={cn(
        "group relative overflow-hidden rounded-lg bg-[#141416]",
        // The highlight is a ring rather than a colour wash: it has to be
        // readable against any video without tinting somebody's face.
        isActiveSpeaker && "ring-2 ring-[#f4f4f5]",
        className,
      )}
    >
      <MediaTrack
        publication={videoPublication}
        muted={isLocal}
        // A shared window is any shape. Cropping it to 16:9 is the one case
        // where filling the tile loses information people need to read.
        contain={isScreenShare}
      />

      {!videoOn && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1e1e21] text-xl font-medium text-[#f4f4f5]"
          >
            {/* Intl.Segmenter so an emoji or an Arabic ligature counts as one
                character rather than half a surrogate pair. */}
            {firstCharacter(name)}
          </span>
        </div>
      )}

      {/* The label sits over the video, so it needs its own contrast rather
          than borrowing the theme's. */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6">
        {!micOn && (
          <span
            title={t("muted")}
            aria-label={t("muted")}
            className="shrink-0 text-[#f87171]"
          >
            <MutedIcon />
          </span>
        )}

        {/* dir="auto" and min-w-0: a name can be Arabic, Latin, or both, and a
            long one must truncate rather than push the badges off the tile. */}
        <span
          dir="auto"
          className="min-w-0 truncate text-sm text-[#f4f4f5]"
          title={name}
        >
          {/* The name is isolated in <bdi>. "أحمد's screen" reorders into
              "s screen'أحمد" without it: the Latin possessive is neutral text
              following an RTL run, so it lands on the wrong side. */}
          {isScreenShare
            ? t.rich("sharingLabel", {
                name: isLocal ? t("you") : name,
                n: (chunks) => <bdi>{chunks}</bdi>,
              })
            : isLocal
              ? t.rich("youLabel", {
                  name,
                  n: (chunks) => <bdi>{chunks}</bdi>,
                })
              : name}
        </span>

        <QualityBadge quality={participant.connectionQuality} />
      </div>

      {/* Hidden until hover or focus so they do not sit on every face all the
          time, but always reachable by keyboard. */}
      <div className="absolute end-2 top-2 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
        {onMute && micOn && (
          <button
            type="button"
            onClick={onMute}
            className="rounded-md bg-black/50 px-2 py-1 text-xs text-[#f4f4f5] hover:bg-black/70"
          >
            {t("moderation.mute")}
          </button>
        )}

        {onStopShare && isScreenShare && (
          <button
            type="button"
            onClick={onStopShare}
            className="rounded-md bg-black/50 px-2 py-1 text-xs text-[#f4f4f5] hover:bg-black/70"
          >
            {t("moderation.stopShare")}
          </button>
        )}

        {onRemove && (
          <button
            type="button"
            onClick={() => {
              if (confirmingRemove) {
                onRemove();
                setConfirmingRemove(false);
              } else {
                setConfirmingRemove(true);
              }
            }}
            onBlur={() => setConfirmingRemove(false)}
            className={cn(
              "rounded-md px-2 py-1 text-xs hover:bg-black/70",
              confirmingRemove
                ? "bg-[#f87171] text-[#0a0a0b] hover:opacity-90"
                : "bg-black/50 text-[#f4f4f5]",
            )}
          >
            {confirmingRemove
              ? t("moderation.removeConfirm")
              : t("moderation.remove")}
          </button>
        )}

        <button
          type="button"
          onClick={onTogglePin}
          aria-pressed={isPinned}
          className="rounded-md bg-black/50 px-2 py-1 text-xs text-[#f4f4f5] hover:bg-black/70"
        >
          {isPinned ? t("unpin") : t("pin")}
        </button>
      </div>
    </div>
  );
}

/** Attach a published track to a media element, and detach it on the way out. */
function MediaTrack({
  publication,
  muted,
  contain = false,
}: {
  publication: TrackPublication | undefined;
  muted: boolean;
  contain?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = ref.current;
    const track = publication?.track;
    if (!element || !track) return;

    track.attach(element);
    return () => {
      // Detaching matters more than it looks: a track left attached to a
      // removed element keeps decoding frames nobody sees.
      track.detach(element);
    };
  }, [publication?.track]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      // The local tile is the one showing you. Playing your own audio back is
      // an echo, so it is always silenced.
      muted={muted}
      className={cn("h-full w-full", contain ? "object-contain" : "object-cover")}
    />
  );
}

function QualityBadge({ quality }: { quality: ConnectionQuality }) {
  const t = useTranslations("call");

  // Excellent is the normal state and needs no badge — an indicator that is
  // always on says nothing.
  if (quality === ConnectionQuality.Excellent || quality === ConnectionQuality.Unknown) {
    return null;
  }

  const poor = quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost;

  return (
    <span
      // Never colour alone: the label is what a screen reader reads and what
      // anyone who cannot separate the two shades relies on.
      className={cn(
        "ms-auto shrink-0 rounded-full px-2 py-0.5 text-xs",
        poor ? "bg-[#f87171] text-[#0a0a0b]" : "bg-[#1e1e21] text-[#f4f4f5]",
      )}
    >
      {poor ? t("quality.poor") : t("quality.fair")}
    </span>
  );
}

function firstCharacter(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "?";
  if (typeof Intl?.Segmenter === "function") {
    const [first] = new Intl.Segmenter().segment(trimmed);
    return (first?.segment ?? trimmed[0]).toUpperCase();
  }
  return trimmed[0].toUpperCase();
}

function MutedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 1a2.5 2.5 0 0 0-2.5 2.5v3.29l5-5A2.5 2.5 0 0 0 8 1Z" />
      <path d="M11.5 6.2V7a3.5 3.5 0 0 1-5.1 3.1l-.9.9A4.7 4.7 0 0 0 7.4 11.7V13.5h-2a.5.5 0 0 0 0 1h5.2a.5.5 0 0 0 0-1h-2v-1.8a4.7 4.7 0 0 0 4-4.6v-.8a.5.5 0 0 0-1 0Z" />
      <path d="M4.5 7V5.9L3.6 6.8V7a4.7 4.7 0 0 0 .5 2.1l.8-.8A3.5 3.5 0 0 1 4.5 7Z" />
      <path d="M13.6 1.7a.5.5 0 0 0-.7 0l-11 11a.5.5 0 0 0 .7.7l11-11a.5.5 0 0 0 0-.7Z" />
    </svg>
  );
}
