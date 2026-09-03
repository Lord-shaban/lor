"use client";

import { useEffect, useRef } from "react";
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
  className,
  style,
}: {
  participant: Participant;
  isActiveSpeaker: boolean;
  isLocal: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const t = useTranslations("call");

  const cameraPublication = participant.getTrackPublication(Track.Source.Camera);
  const micPublication = participant.getTrackPublication(Track.Source.Microphone);

  const cameraOn = Boolean(
    cameraPublication?.isSubscribed && !cameraPublication.isMuted,
  );
  const micOn = Boolean(micPublication && !micPublication.isMuted);

  const name = participant.name || participant.identity;

  return (
    <div
      style={style}
      className={cn(
        "group relative overflow-hidden rounded-lg bg-[#141416]",
        // The highlight is a ring rather than a colour wash: it has to be
        // readable against any video without tinting somebody's face.
        isActiveSpeaker && "ring-2 ring-[#f4f4f5]",
        className,
      )}
    >
      <MediaTrack publication={cameraPublication} muted={isLocal} />

      {!cameraOn && (
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
          {isLocal ? t("youLabel", { name }) : name}
        </span>

        <QualityBadge quality={participant.connectionQuality} />
      </div>

      <button
        type="button"
        onClick={onTogglePin}
        aria-pressed={isPinned}
        // Hidden until hover or focus so it does not sit on every face all the
        // time, but always reachable by keyboard.
        className="absolute end-2 top-2 rounded-md bg-black/50 px-2 py-1 text-xs text-[#f4f4f5] opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
      >
        {isPinned ? t("unpin") : t("pin")}
      </button>
    </div>
  );
}

/** Attach a published track to a media element, and detach it on the way out. */
function MediaTrack({
  publication,
  muted,
}: {
  publication: TrackPublication | undefined;
  muted: boolean;
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
      className="h-full w-full object-cover"
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
