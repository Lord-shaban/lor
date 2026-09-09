"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { recordingFilename, supportedWebmMimeType } from "@/lib/local-recording";

type StopReason = "manual" | "source-ended" | "source-changed" | "pagehide" | "failed";
export type RecordingError =
  | "unsupported"
  | "no-video"
  | "failed"
  | "empty"
  | "source-ended"
  | "source-changed";

export interface LocalRecording {
  supported: boolean;
  status: "idle" | "recording" | "stopping" | "ready" | "failed";
  startedAt: number | null;
  audioTrackCount: number;
  error: RecordingError | null;
  canStart: boolean;
  start: () => void;
  stop: () => void;
  download: () => void;
}

interface RecordingFile {
  blob: Blob;
  createdAt: Date;
}

interface AudioConnection {
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
}

interface RecordingSession {
  recorder: MediaRecorder;
  context: AudioContext;
  destination: MediaStreamAudioDestinationNode;
  videoTrack: MediaStreamTrack;
  mimeType: string;
  chunks: Blob[];
  connections: Map<string, AudioConnection>;
  reason: StopReason;
  ended: () => void;
  discarded: boolean;
  completed: boolean;
}

interface RecordingState {
  status: LocalRecording["status"];
  startedAt: number | null;
  audioTrackCount: number;
  error: RecordingError | null;
  file: RecordingFile | null;
}

const EMPTY_STATE: RecordingState = {
  status: "idle",
  startedAt: null,
  audioTrackCount: 0,
  error: null,
  file: null,
};

/**
 * A private, browser-only recorder for a participant's own chosen video.
 *
 * The finished Blob deliberately never enters React shared state, Yjs, a data
 * packet, or an API request. It remains in this tab until the participant
 * starts another recording or leaves the call.
 */
export function useLocalRecording({
  videoTrack,
  audioTracks,
  onRoomAnnouncement,
}: {
  /** Screen share wins while it is active; otherwise this is the local camera. */
  videoTrack: MediaStreamTrack | undefined;
  /** Every subscribed call-audio track, including this participant's microphone. */
  audioTracks: readonly MediaStreamTrack[];
  /** Sends only a started/stopped fact — never recording data — to the room. */
  onRoomAnnouncement: (started: boolean) => void;
}): LocalRecording {
  const [state, setState] = useState<RecordingState>(EMPTY_STATE);
  const sessionRef = useRef<RecordingSession | null>(null);
  const announcementRef = useRef(onRoomAnnouncement);

  useEffect(() => {
    announcementRef.current = onRoomAnnouncement;
  }, [onRoomAnnouncement]);

  const supported = canRecordWebm();

  const dispose = useCallback((session: RecordingSession) => {
    session.videoTrack.removeEventListener("ended", session.ended);

    for (const { source, gain } of session.connections.values()) {
      try {
        source.disconnect();
        gain.disconnect();
      } catch {
        // The browser may already have released a source after a page close.
      }
    }
    session.connections.clear();

    // This is the generated Web Audio track, not a LiveKit track. Stopping it
    // cannot turn off a participant's microphone or camera.
    for (const track of session.destination.stream.getAudioTracks()) track.stop();
    if (session.context.state !== "closed") void session.context.close().catch(() => {});
  }, []);

  const finish = useCallback(
    (session: RecordingSession) => {
      if (session.completed) return;
      session.completed = true;
      if (sessionRef.current === session) sessionRef.current = null;

      const blob = new Blob(session.chunks, { type: session.recorder.mimeType || session.mimeType });
      dispose(session);

      // A browser may be navigating away while it sends its final data chunk.
      // There is nowhere honest to offer that partial result, so it is dropped.
      if (session.discarded) return;

      // A recorder error can leave chunks behind without a playable final WebM.
      // Do not offer a download unless the browser reached a normal stop.
      if (blob.size === 0 || session.reason === "failed") {
        setState({
          status: "failed",
          startedAt: null,
          audioTrackCount: 0,
          error:
            session.reason === "source-ended"
              ? "source-ended"
              : session.reason === "failed"
                ? "failed"
                : "empty",
          file: null,
        });
      } else {
        setState({
          status: "ready",
          startedAt: null,
          audioTrackCount: 0,
          error:
            session.reason === "source-ended"
              ? "source-ended"
              : session.reason === "source-changed"
                ? "source-changed"
                : null,
          file: { blob, createdAt: new Date() },
        });
      }
      announcementRef.current(false);
    },
    [dispose],
  );

  const stopWithReason = useCallback(
    (reason: StopReason) => {
      const session = sessionRef.current;
      if (!session || session.completed) return;

      session.reason = reason;
      session.discarded ||= reason === "pagehide";

      if (!session.discarded) {
        setState((current) => ({ ...current, status: "stopping" }));
      }

      if (session.recorder.state === "inactive") {
        finish(session);
      } else {
        try {
          session.recorder.stop();
        } catch {
          // A recorder may become inactive between reading state and stopping.
          finish(session);
        }
      }
    },
    [finish],
  );

  const connectAudioTrack = useCallback((session: RecordingSession, track: MediaStreamTrack) => {
    if (track.readyState !== "live" || session.connections.has(track.id)) return;

    try {
      const source = session.context.createMediaStreamSource(new MediaStream([track]));
      const gain = session.context.createGain();
      source.connect(gain);
      gain.connect(session.destination);
      session.connections.set(track.id, { source, gain });
    } catch {
      // One unavailable remote audio track must not prevent a local recording.
    }
  }, []);

  const start = useCallback(() => {
    if (sessionRef.current) return;

    if (!supported) {
      setState({ ...EMPTY_STATE, status: "failed", error: "unsupported" });
      return;
    }
    if (!videoTrack || videoTrack.readyState !== "live") {
      setState({ ...EMPTY_STATE, status: "failed", error: "no-video" });
      return;
    }

    const mimeType = supportedWebmMimeType(MediaRecorder.isTypeSupported);
    if (!mimeType) {
      setState({ ...EMPTY_STATE, status: "failed", error: "unsupported" });
      return;
    }

    let context: AudioContext | undefined;
    let session: RecordingSession | undefined;
    try {
      context = new AudioContext();
      if (context.state === "suspended") void context.resume().catch(() => {});
      const destination = context.createMediaStreamDestination();
      const stream = new MediaStream([videoTrack, ...destination.stream.getAudioTracks()]);
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128_000,
        videoBitsPerSecond: 2_500_000,
      });
      const activeSession: RecordingSession = {
        recorder,
        context,
        destination,
        videoTrack,
        mimeType,
        chunks: [],
        connections: new Map(),
        reason: "manual",
        ended: () => stopWithReason("source-ended"),
        discarded: false,
        completed: false,
      };
      session = activeSession;

      for (const track of audioTracks) connectAudioTrack(activeSession, track);
      activeSession.videoTrack.addEventListener("ended", activeSession.ended, { once: true });
      recorder.ondataavailable = (event) => {
        if (!activeSession.discarded && event.data.size > 0) activeSession.chunks.push(event.data);
      };
      recorder.onerror = () => stopWithReason("failed");
      recorder.onstop = () => finish(activeSession);

      sessionRef.current = activeSession;
      recorder.start(1_000);
      setState({
        status: "recording",
        startedAt: Date.now(),
        audioTrackCount: activeSession.connections.size,
        error: null,
        file: null,
      });
      announcementRef.current(true);
    } catch {
      if (session) {
        if (sessionRef.current === session) sessionRef.current = null;
        dispose(session);
      } else if (context?.state !== "closed") {
        void context?.close().catch(() => {});
      }
      setState({ ...EMPTY_STATE, status: "failed", error: "failed" });
    }
  }, [audioTracks, connectAudioTrack, dispose, finish, supported, stopWithReason, videoTrack]);

  // A caller joining midway through the recording should be included. The set
  // makes re-renders harmless and the mixed output remains one audio track.
  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;
    const liveIds = new Set(audioTracks.map((track) => track.id));
    for (const [id, { source, gain }] of session.connections) {
      if (liveIds.has(id)) continue;
      try {
        source.disconnect();
        gain.disconnect();
      } catch {
        // The remote source may already have disappeared.
      }
      session.connections.delete(id);
    }
    for (const track of audioTracks) connectAudioTrack(session, track);
  }, [audioTracks, connectAudioTrack]);

  // MediaRecorder cannot swap its video input mid-file. Stop explicitly when
  // a screen share starts/stops instead of silently claiming one continuous
  // recording represented both sources.
  useEffect(() => {
    const session = sessionRef.current;
    if (session && session.videoTrack !== videoTrack) stopWithReason("source-changed");
  }, [stopWithReason, videoTrack]);

  useEffect(() => {
    const discardOnPageHide = () => stopWithReason("pagehide");
    window.addEventListener("pagehide", discardOnPageHide);
    return () => {
      window.removeEventListener("pagehide", discardOnPageHide);
      discardOnPageHide();
    };
  }, [stopWithReason]);

  const download = useCallback(() => {
    const file = state.file;
    if (!file) return;

    const url = URL.createObjectURL(file.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = recordingFilename(file.createdAt);
    // Appending briefly is required by a few browser download implementations;
    // the URL and the element are revoked immediately after the user gesture.
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [state.file]);

  return {
    supported,
    status: state.status,
    startedAt: state.startedAt,
    audioTrackCount: state.audioTrackCount,
    error: state.error,
    canStart: supported && Boolean(videoTrack && videoTrack.readyState === "live"),
    start,
    stop: () => stopWithReason("manual"),
    download,
  };
}

function canRecordWebm(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof AudioContext !== "undefined" &&
    typeof MediaRecorder.isTypeSupported === "function" &&
    supportedWebmMimeType(MediaRecorder.isTypeSupported) !== null
  );
}
