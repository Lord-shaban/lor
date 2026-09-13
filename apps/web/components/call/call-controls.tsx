"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
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
import type { LocalRecording } from "@/components/call/use-local-recording";

export type CallWorkspace =
  | "chat"
  | "door"
  | "whiteboard"
  | "notes"
  | "transcript"
  | "decisions"
  | "action-items"
  | "timeline"
  | "memory"
  | "search";

const REACTION_LABELS: Record<Reaction, string> = {
  "\u{1F44D}": "thumbsUp",
  "\u2764\uFE0F": "heart",
  "\u{1F602}": "laugh",
  "\u{1F389}": "celebrate",
  "\u{1F44F}": "clap",
  "\u{1F62E}": "wow",
};

function canShareScreen(): boolean {
  return typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function";
}

/**
 * The call dock keeps the five decisions needed in the moment in one row.
 * Everything else is grouped by the job it serves, without hiding live state.
 */
export function CallControls({
  canPublish,
  activeWorkspace,
  unread,
  onToggleWorkspace,
  recording,
  isHost,
  waitingCount,
  onMuteAll,
  handRaised,
  onToggleHand,
  onReact,
  captionsOn,
  onToggleCaptions,
  videoMode,
  onChooseVideoMode,
  onLeave,
}: {
  canPublish: boolean;
  activeWorkspace: CallWorkspace | null;
  unread: number;
  onToggleWorkspace: (workspace: CallWorkspace) => void;
  recording: LocalRecording;
  isHost: boolean;
  waitingCount: number;
  onMuteAll: () => void;
  handRaised: boolean;
  onToggleHand: () => void;
  onReact: (emoji: Reaction) => void;
  captionsOn: boolean;
  onToggleCaptions: () => void;
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
  const [screenShareSupported] = useState(canShareScreen);
  const [openMenu, setOpenMenu] = useState<"workspaces" | "more" | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const workspaceTriggerRef = useRef<HTMLButtonElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const previousWorkspaceRef = useRef<CallWorkspace | null>(activeWorkspace);

  const screenShareOn = Boolean(
    localParticipant.getTrackPublication(Track.Source.ScreenShare),
  );
  const someoneElseSharing = participants.some(
    (participant) =>
      participant.identity !== localParticipant.identity &&
      participant.getTrackPublication(Track.Source.ScreenShare),
  );
  const workspaceOpen = activeWorkspace !== null && activeWorkspace !== "door";
  const moreLive =
    screenShareOn || captionsOn || recording.status === "recording";

  useEffect(() => {
    if (!openMenu) return;

    const firstControl = dockRef.current?.querySelector<HTMLButtonElement>(
      `[data-call-menu="${openMenu}"] button:not(:disabled)`,
    );
    firstControl?.focus();

    function onPointerDown(event: PointerEvent) {
      if (dockRef.current?.contains(event.target as Node)) return;
      setOpenMenu(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      const trigger =
        openMenu === "workspaces" ? workspaceTriggerRef.current : moreTriggerRef.current;
      setOpenMenu(null);
      requestAnimationFrame(() => trigger?.focus());
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  useEffect(() => {
    const previous = previousWorkspaceRef.current;
    previousWorkspaceRef.current = activeWorkspace;
    if (!previous || activeWorkspace) return;

    const trigger =
      previous === "door" ? moreTriggerRef.current : workspaceTriggerRef.current;
    requestAnimationFrame(() => trigger?.focus());
  }, [activeWorkspace]);

  function closeMenuAndFocus(menu: "workspaces" | "more") {
    setOpenMenu(null);
    const trigger =
      menu === "workspaces" ? workspaceTriggerRef.current : moreTriggerRef.current;
    requestAnimationFrame(() => trigger?.focus());
  }

  function chooseWorkspace(workspace: CallWorkspace) {
    onToggleWorkspace(workspace);
    // The workspace owns initial focus (usually its Close button or primary
    // field). Focusing the dock here would steal it one frame later.
    setOpenMenu(null);
  }

  return (
    <div
      ref={dockRef}
      className="relative z-40 shrink-0 border-t border-[#2a2a2e] bg-[#0a0a0b]"
    >
      <div
        data-testid="call-dock"
        className="mx-auto grid h-[4.5rem] grid-cols-5 items-stretch gap-1 px-2 py-2 sm:flex sm:h-16 sm:items-center sm:justify-center sm:gap-2 sm:px-4"
      >
        <MediaButton
          kind="microphone"
          enabled={isMicrophoneEnabled}
          disabled={!canPublish}
          label={isMicrophoneEnabled ? t("muteMic") : t("unmuteMic")}
          disabledTitle={!canPublish ? t("waitingToPublish") : undefined}
          onClick={() =>
            localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
          }
        />

        <MediaButton
          kind="camera"
          enabled={isCameraEnabled}
          disabled={!canPublish}
          label={isCameraEnabled ? t("stopCamera") : t("startCamera")}
          disabledTitle={!canPublish ? t("waitingToPublish") : undefined}
          onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
        />

        <div className="relative min-w-0">
          <DockButton
            ref={workspaceTriggerRef}
            icon={<WorkspaceIcon />}
            label={t("controls.workspaces")}
            active={workspaceOpen || openMenu === "workspaces"}
            badge={unread > 0 ? format.number(unread) : undefined}
            ariaLabel={
              unread > 0
                ? t("controls.workspacesWithUnread", { count: unread })
                : openMenu === "workspaces"
                  ? t("controls.closeWorkspaces")
                  : t("controls.openWorkspaces")
            }
            aria-expanded={openMenu === "workspaces"}
            aria-controls="call-workspaces-menu"
            onClick={() =>
              setOpenMenu((current) =>
                current === "workspaces" ? null : "workspaces",
              )
            }
          />

          {openMenu === "workspaces" && (
            <ControlPopover
              id="call-workspaces-menu"
              menu="workspaces"
              title={t("controls.workspaces")}
            >
              <MenuSection title={t("controls.together")}>
                <MenuAction
                  label={t("chat.title")}
                  active={activeWorkspace === "chat"}
                  badge={unread > 0 ? format.number(unread) : undefined}
                  onClick={() => chooseWorkspace("chat")}
                />
                <MenuAction
                  label={t("whiteboard.title")}
                  active={activeWorkspace === "whiteboard"}
                  onClick={() => chooseWorkspace("whiteboard")}
                />
                <MenuAction
                  label={t("notes.title")}
                  active={activeWorkspace === "notes"}
                  onClick={() => chooseWorkspace("notes")}
                />
              </MenuSection>

              <MenuSection title={t("controls.after")} columns={2}>
                <MenuAction
                  label={t("keeping.open")}
                  active={activeWorkspace === "transcript"}
                  onClick={() => chooseWorkspace("transcript")}
                />
                <MenuAction
                  label={t("keeping.decisions")}
                  active={activeWorkspace === "decisions"}
                  onClick={() => chooseWorkspace("decisions")}
                />
                <MenuAction
                  label={t("keeping.actionItems")}
                  active={activeWorkspace === "action-items"}
                  onClick={() => chooseWorkspace("action-items")}
                />
                <MenuAction
                  label={t("keeping.timeline")}
                  active={activeWorkspace === "timeline"}
                  onClick={() => chooseWorkspace("timeline")}
                />
                <MenuAction
                  label={t("keeping.memory")}
                  active={activeWorkspace === "memory"}
                  onClick={() => chooseWorkspace("memory")}
                />
                <MenuAction
                  label={t("keeping.search")}
                  active={activeWorkspace === "search"}
                  onClick={() => chooseWorkspace("search")}
                />
              </MenuSection>
            </ControlPopover>
          )}
        </div>

        <div className="relative min-w-0">
          <DockButton
            ref={moreTriggerRef}
            icon={<MoreIcon />}
            label={t("controls.more")}
            active={openMenu === "more" || activeWorkspace === "door"}
            live={moreLive}
            badge={waitingCount > 0 ? format.number(waitingCount) : undefined}
            ariaLabel={
              waitingCount > 0
                ? t("controls.moreWithWaiting", { count: waitingCount })
                : openMenu === "more"
                  ? t("controls.closeMore")
                  : t("controls.openMore")
            }
            aria-expanded={openMenu === "more"}
            aria-controls="call-more-menu"
            onClick={() =>
              setOpenMenu((current) => (current === "more" ? null : "more"))
            }
          />

          {openMenu === "more" && (
            <ControlPopover
              id="call-more-menu"
              menu="more"
              title={t("controls.more")}
            >
              <MenuSection title={t("controls.callSettings")}>
                {canPublish && screenShareSupported && (
                  <MenuAction
                    label={screenShareOn ? t("stopSharing") : t("shareScreen")}
                    active={screenShareOn}
                    disabled={someoneElseSharing && !screenShareOn}
                    title={
                      someoneElseSharing && !screenShareOn
                        ? t("someoneElseSharing")
                        : undefined
                    }
                    onClick={() => {
                      void localParticipant.setScreenShareEnabled(!screenShareOn, {
                        audio: true,
                      });
                      closeMenuAndFocus("more");
                    }}
                  />
                )}
                {canPublish && (
                  <RecordingControls
                    recording={recording}
                    onAfterAction={() => closeMenuAndFocus("more")}
                  />
                )}
              </MenuSection>

              <div className="border-t border-[#2a2a2e] px-3 py-3">
                <VideoModeControl mode={videoMode} onChoose={onChooseVideoMode} />
              </div>

              <MenuSection title={t("controls.participate")} columns={2}>
                <MenuAction
                  label={handRaised ? t("hands.lower") : t("hands.raise")}
                  active={handRaised}
                  onClick={() => {
                    onToggleHand();
                    closeMenuAndFocus("more");
                  }}
                />
                <MenuAction
                  label={captionsOn ? t("captions.turnOff") : t("captions.turnOn")}
                  active={captionsOn}
                  live={captionsOn}
                  onClick={() => {
                    onToggleCaptions();
                    closeMenuAndFocus("more");
                  }}
                />
              </MenuSection>

              <div
                role="group"
                aria-label={t("reactions.open")}
                className="grid grid-cols-6 gap-1 border-t border-[#2a2a2e] px-3 py-3"
              >
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={t(`reactions.${REACTION_LABELS[emoji]}`)}
                    onClick={() => {
                      onReact(emoji);
                      closeMenuAndFocus("more");
                    }}
                    className="h-11 min-w-0 rounded-md text-xl leading-none transition-colors duration-150 hover:bg-[#2a2a2e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5]"
                  >
                    <span aria-hidden="true">{emoji}</span>
                  </button>
                ))}
              </div>

              {isHost && (
                <MenuSection title={t("controls.host")} columns={2}>
                  <MenuAction
                    label={t("door.title")}
                    active={activeWorkspace === "door"}
                    badge={
                      waitingCount > 0 ? format.number(waitingCount) : undefined
                    }
                    onClick={() => chooseWorkspace("door")}
                  />
                  <MenuAction
                    label={t("moderation.muteAll")}
                    onClick={() => {
                      onMuteAll();
                      closeMenuAndFocus("more");
                    }}
                  />
                </MenuSection>
              )}
            </ControlPopover>
          )}
        </div>

        <DockButton
          icon={<LeaveIcon />}
          label={t("leave")}
          danger
          onClick={() => {
            void room.disconnect();
            onLeave();
          }}
        />
      </div>
    </div>
  );
}

function ControlPopover({
  id,
  menu,
  title,
  children,
}: {
  id: string;
  menu: "workspaces" | "more";
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      data-call-menu={menu}
      role="dialog"
      aria-modal="false"
      aria-label={title}
      className="fixed inset-x-3 bottom-[4.75rem] z-50 max-h-[min(70dvh,36rem)] overflow-y-auto rounded-lg border border-[#2a2a2e] bg-[#141416] sm:absolute sm:inset-x-auto sm:bottom-full sm:left-1/2 sm:mb-2 sm:w-80 sm:-translate-x-1/2"
    >
      <p className="border-b border-[#2a2a2e] px-3 py-2 text-sm font-medium">
        {title}
      </p>
      {children}
    </div>
  );
}

function MenuSection({
  title,
  columns = 1,
  children,
}: {
  title: string;
  columns?: 1 | 2;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-[#2a2a2e] px-3 py-3 first:border-t-0">
      <h3 className="mb-2 text-xs font-medium text-[#a1a1aa]">{title}</h3>
      <div className={cn("grid gap-1", columns === 2 && "grid-cols-2")}>
        {children}
      </div>
    </section>
  );
}

function MenuAction({
  label,
  ariaLabel,
  ariaDescribedBy,
  active = false,
  live = false,
  badge,
  disabled,
  title,
  onClick,
}: {
  label: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  active?: boolean;
  live?: boolean;
  badge?: string;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-pressed={active || undefined}
      onClick={onClick}
      className={cn(
        "flex min-h-11 min-w-0 items-center gap-2 rounded-md px-3 py-2 text-start text-sm transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "bg-[#f4f4f5] text-[#0a0a0b]"
          : "bg-[#1e1e21] text-[#f4f4f5] hover:bg-[#2a2a2e]",
      )}
    >
      {live && (
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full bg-[#f87171]"
        />
      )}
      <span className="min-w-0 flex-1">{label}</span>
      {badge && (
        <span
          aria-hidden="true"
          className="min-w-5 rounded-full bg-[#f87171] px-1.5 py-0.5 text-center text-xs font-medium text-[#0a0a0b] tabular-nums"
        >
          <bdi>{badge}</bdi>
        </span>
      )}
    </button>
  );
}

function RecordingControls({
  recording,
  onAfterAction,
}: {
  recording: LocalRecording;
  onAfterAction: () => void;
}) {
  const t = useTranslations("call.recording");

  if (!recording.supported) {
    return (
      <p className="rounded-md bg-[#1e1e21] px-3 py-2 text-xs leading-relaxed text-[#a1a1aa]">
        {t("fallback")}
      </p>
    );
  }

  const isRecording = recording.status === "recording";
  const isStopping = recording.status === "stopping";
  const canDownload = recording.status === "ready";
  const needsVideo = !recording.canStart && !isRecording && !isStopping;

  return (
    <>
      <MenuAction
        label={
          isRecording
            ? t("stopShort")
            : isStopping
              ? t("stoppingShort")
              : t("title")
        }
        active={isRecording}
        live={isRecording}
        ariaLabel={isRecording ? t("stop") : t("start")}
        ariaDescribedBy={needsVideo ? "local-recording-status" : undefined}
        disabled={isStopping || (!isRecording && needsVideo)}
        title={needsVideo ? t("needVideo") : undefined}
        onClick={() => {
          if (isRecording) recording.stop();
          else recording.start();
          onAfterAction();
        }}
      />
      {needsVideo && (
        <p
          id="local-recording-status"
          className="px-2 py-1 text-xs leading-relaxed text-[#a1a1aa]"
        >
          {t("needVideo")}
        </p>
      )}
      {canDownload && (
        <MenuAction
          label={t("download")}
          onClick={() => {
            recording.download();
            onAfterAction();
          }}
        />
      )}
    </>
  );
}

function MediaButton({
  kind,
  enabled,
  disabled,
  disabledTitle,
  label,
  onClick,
}: {
  kind: "microphone" | "camera";
  enabled: boolean;
  disabled: boolean;
  disabledTitle?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <DockButton
      icon={
        kind === "microphone" ? (
          <MicrophoneIcon off={!enabled} />
        ) : (
          <CameraIcon off={!enabled} />
        )
      }
      label={label}
      live={enabled}
      active={!enabled}
      disabled={disabled}
      title={disabledTitle}
      aria-pressed={!enabled}
      onClick={onClick}
    />
  );
}

function DockButton({
  ref,
  icon,
  label,
  ariaLabel,
  active = false,
  live = false,
  danger = false,
  badge,
  ...props
}: {
  ref?: RefObject<HTMLButtonElement | null>;
  icon: ReactNode;
  label: string;
  ariaLabel?: string;
  active?: boolean;
  live?: boolean;
  danger?: boolean;
  badge?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={ariaLabel ?? label}
      className={cn(
        "relative flex h-full min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-[0.6875rem] font-medium transition-colors duration-150 sm:h-11 sm:min-w-20 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-50",
        danger
          ? "bg-[#f87171] text-[#0a0a0b] hover:opacity-90"
          : active
            ? "bg-[#f4f4f5] text-[#0a0a0b]"
            : "bg-[#1e1e21] text-[#f4f4f5] hover:bg-[#2a2a2e]",
      )}
      {...props}
    >
      <span aria-hidden="true" className="relative flex size-5 shrink-0 items-center justify-center">
        {icon}
        {live && (
          <span className="absolute -end-1 -top-1 size-2 rounded-full border border-[#1e1e21] bg-[#f87171]" />
        )}
      </span>
      <span className="max-w-full truncate">{label}</span>
      {badge && (
        <span
          aria-hidden="true"
          className="absolute -end-1 -top-1 min-w-5 rounded-full bg-[#f87171] px-1 py-0.5 text-xs font-medium text-[#0a0a0b] tabular-nums"
        >
          <bdi>{badge}</bdi>
        </span>
      )}
    </button>
  );
}

function MicrophoneIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 5.1 2.1" />
      <path d="M17 11v1a5 5 0 0 1-8.5 3.5M5 11v1a7 7 0 0 0 12 4.9M12 19v2M9 21h6" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

function CameraIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10 5-3v10l-5-3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

function WorkspaceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

function LeaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
      <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />
    </svg>
  );
}
