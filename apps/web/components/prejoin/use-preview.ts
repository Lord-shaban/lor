"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  classifyMediaError,
  listDevices,
  stopStream,
  type MediaDevice,
  type MediaErrorKind,
} from "@/lib/media-devices";

interface PreviewOptions {
  videoDeviceId?: string;
  audioDeviceId?: string;
  cameraOff: boolean;
  micOff: boolean;
}

export interface PreviewState {
  stream: MediaStream | null;
  devices: MediaDevice[];
  error: MediaErrorKind | null;
  /** True while a device is being opened, so the preview can say so. */
  opening: boolean;
  /** No camera at all. Audio-only is still a perfectly good way to join. */
  hasCamera: boolean;
  hasMicrophone: boolean;
  retry: () => void;
}

/**
 * Owns the preview stream.
 *
 * The whole point is that nothing is a surprise once you are in the call: you
 * see and hear yourself first. That means re-opening the stream whenever a
 * choice changes, and stopping the old tracks every single time — a stream left
 * running keeps the camera light on, which people reasonably read as being
 * watched.
 */
export function usePreview({
  videoDeviceId,
  audioDeviceId,
  cameraOff,
  micOff,
}: PreviewOptions): PreviewState {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDevice[]>([]);
  const [error, setError] = useState<MediaErrorKind | null>(null);
  const [opening, setOpening] = useState(true);
  const [attempt, setAttempt] = useState(0);

  // Held in a ref as well as state so cleanup can stop the exact stream it
  // opened, even when an effect re-runs before the state settles.
  const current = useRef<MediaStream | null>(null);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function open() {
      setOpening(true);
      setError(null);

      // Always release the previous devices before asking for new ones. Chrome
      // will otherwise refuse a second camera with NotReadableError, which
      // looks exactly like the device being used by another application.
      stopStream(current.current);
      current.current = null;
      setStream(null);

      // Both off is a legitimate way to join: listen first, turn things on
      // later. There is nothing to open, and asking for permission anyway
      // would be a prompt for no reason.
      if (cameraOff && micOff) {
        try {
          if (!cancelled) setDevices(await listDevices());
        } catch {
          // Enumeration is best-effort; an empty list is handled below.
        }
        if (!cancelled) setOpening(false);
        return;
      }

      try {
        const next = await navigator.mediaDevices.getUserMedia({
          video: cameraOff
            ? false
            : videoDeviceId
              ? { deviceId: { exact: videoDeviceId } }
              : true,
          audio: micOff
            ? false
            : audioDeviceId
              ? { deviceId: { exact: audioDeviceId } }
              : true,
        });

        // The effect was superseded while the permission prompt was open.
        // Without this the abandoned stream stays live and the light stays on.
        if (cancelled) {
          stopStream(next);
          return;
        }

        current.current = next;
        setStream(next);

        // Labels are blank until a permission has been granted, so devices are
        // only worth listing once we are past that.
        setDevices(await listDevices());
      } catch (caught) {
        if (cancelled) return;
        setError(classifyMediaError(caught));
        // Even on failure, list what is there: a missing camera is worth
        // showing as an empty camera list rather than an unexplained error.
        try {
          setDevices(await listDevices());
        } catch {
          setDevices([]);
        }
      } finally {
        if (!cancelled) setOpening(false);
      }
    }

    void open();

    return () => {
      cancelled = true;
      stopStream(current.current);
      current.current = null;
    };
  }, [videoDeviceId, audioDeviceId, cameraOff, micOff, attempt]);

  // Someone plugging in a headset mid-setup should see it appear.
  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return;

    const onChange = () => {
      void listDevices().then(setDevices).catch(() => {});
    };

    navigator.mediaDevices.addEventListener("devicechange", onChange);
    return () =>
      navigator.mediaDevices.removeEventListener("devicechange", onChange);
  }, []);

  return {
    stream,
    devices,
    error,
    opening,
    hasCamera: devices.some((device) => device.kind === "videoinput"),
    hasMicrophone: devices.some((device) => device.kind === "audioinput"),
    retry,
  };
}
