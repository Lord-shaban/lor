"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LevelMeter } from "@/components/prejoin/level-meter";
import { usePreview } from "@/components/prejoin/use-preview";
import {
  detectBrowser,
  loadPreferences,
  savePreferences,
  type BrowserFamily,
  type DeviceKind,
  type MediaDevice,
} from "@/lib/media-devices";
import { cn } from "@/lib/cn";

export interface JoinDetails {
  name: string;
  cameraOff: boolean;
  micOff: boolean;
  videoDeviceId?: string;
  audioDeviceId?: string;
  speakerDeviceId?: string;
}

/**
 * See and hear yourself before anyone else does.
 *
 * Nobody should discover their microphone was muted at the hardware level
 * thirty seconds into a meeting, so everything here exists to make that
 * discoverable now rather than later.
 */
export function Prejoin({
  onJoin,
  joining,
  joinError,
}: {
  onJoin: (details: JoinDetails) => void;
  joining: boolean;
  joinError?: string | null;
}) {
  const t = useTranslations("prejoin");
  const fieldId = useId();

  // Read straight out of storage rather than in an effect. This component is
  // loaded with SSR disabled — it has nothing meaningful to render on a server
  // with no devices and no storage — so there is no server output to mismatch,
  // and the form is correct on its very first paint instead of flickering from
  // defaults to saved values.
  const [saved] = useState(loadPreferences);

  const [name, setName] = useState(saved.name ?? "");
  const [cameraOff, setCameraOff] = useState(saved.cameraOff ?? false);
  const [micOff, setMicOff] = useState(saved.micOff ?? false);
  const [videoDeviceId, setVideoDeviceId] = useState(saved.videoDeviceId);
  const [audioDeviceId, setAudioDeviceId] = useState(saved.audioDeviceId);
  const [speakerDeviceId, setSpeakerDeviceId] = useState(saved.speakerDeviceId);
  const [browser] = useState<BrowserFamily>(() =>
    detectBrowser(navigator.userAgent),
  );

  const preview = usePreview({
    videoDeviceId,
    audioDeviceId,
    cameraOff,
    micOff,
  });

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    element.srcObject = preview.stream;
    return () => {
      // Leaving the object attached keeps a reference to a stopped stream and
      // freezes the last frame on the element.
      element.srcObject = null;
    };
  }, [preview.stream]);

  function persist(changes: Partial<JoinDetails>) {
    savePreferences(changes);
  }

  function devicesOfKind(kind: DeviceKind): MediaDevice[] {
    return preview.devices.filter((device) => device.kind === kind);
  }

  /** A short tone through the chosen output, so "which speaker" is answerable. */
  async function testSpeaker() {
    let context: AudioContext | undefined;
    try {
      context = new AudioContext();
      const destination = context.createMediaStreamDestination();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.frequency.value = 440;
      // Ramped rather than switched: an abrupt start and stop produces a click
      // that is louder than the tone.
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, context.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.45);

      oscillator.connect(gain).connect(destination);

      const audio = new Audio();
      audio.srcObject = destination.stream;

      // Routing to a chosen output only exists in some browsers. Where it does
      // not, the tone still plays on the default device, which answers most of
      // the question anyway.
      const withSink = audio as HTMLAudioElement & {
        setSinkId?: (id: string) => Promise<void>;
      };
      if (speakerDeviceId && withSink.setSinkId) {
        await withSink.setSinkId(speakerDeviceId).catch(() => {});
      }

      oscillator.start();
      await audio.play().catch(() => {});
      oscillator.stop(context.currentTime + 0.5);

      setTimeout(() => {
        audio.srcObject = null;
        void context?.close().catch(() => {});
      }, 700);
    } catch {
      void context?.close().catch(() => {});
    }
  }

  const canJoin = name.trim().length > 0 && !joining;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canJoin) return;

    const details: JoinDetails = {
      name: name.trim(),
      cameraOff,
      micOff,
      videoDeviceId,
      audioDeviceId,
      speakerDeviceId,
    };
    persist(details);
    onJoin(details);
  }

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div>
        {/* The preview is always dark. A bright surround around a video frame
            is fatiguing, and the call itself is dark for the same reason. */}
        <div className="relative aspect-video overflow-hidden rounded-lg bg-[#141416]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            // Mirrored, because an unmirrored self-view reads as wrong to
            // everyone who has ever used a mirror. Only the preview: what is
            // sent to the room is not flipped.
            className={cn(
              "h-full w-full scale-x-[-1] object-cover",
              (cameraOff || !preview.stream) && "hidden",
            )}
          />

          {(cameraOff || !preview.stream) && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-[#a1a1aa]">
              {preview.opening
                ? t("opening")
                : cameraOff
                  ? t("cameraIsOff")
                  : t("noPreview")}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant={micOff ? "danger" : "secondary"}
            onClick={() => {
              setMicOff(!micOff);
              persist({ micOff: !micOff });
            }}
            aria-pressed={micOff}
          >
            {micOff ? t("micOn") : t("micOff")}
          </Button>

          <Button
            type="button"
            variant={cameraOff ? "danger" : "secondary"}
            onClick={() => {
              setCameraOff(!cameraOff);
              persist({ cameraOff: !cameraOff });
            }}
            aria-pressed={cameraOff}
          >
            {cameraOff ? t("cameraOn") : t("cameraOff")}
          </Button>

          {!micOff && (
            <LevelMeter
              stream={preview.stream}
              label={t("levelLabel")}
              className="ms-auto"
            />
          )}
        </div>

        {preview.error && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-danger/40 bg-surface p-4 text-sm"
          >
            <p className="font-medium">{t(`errors.${preview.error}.title`)}</p>
            {/* Naming the actual menu, because "check your browser settings"
                is not a recovery path. */}
            <p className="mt-1 text-muted">
              {t(`errors.${preview.error}.fix`, { browser: t(`browsers.${browser}`) })}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={preview.retry}
            >
              {t("tryAgain")}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <label htmlFor={`${fieldId}-name`} className="mb-2 block text-sm">
            {t("nameLabel")}
          </label>
          <Input
            id={`${fieldId}-name`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("namePlaceholder")}
            maxLength={60}
            autoComplete="name"
            required
          />
        </div>

        <DeviceSelect
          id={`${fieldId}-mic`}
          label={t("microphone")}
          devices={devicesOfKind("audioinput")}
          value={audioDeviceId}
          empty={t("noMicrophone")}
          onChange={(id) => {
            setAudioDeviceId(id);
            persist({ audioDeviceId: id });
          }}
        />

        <DeviceSelect
          id={`${fieldId}-camera`}
          label={t("camera")}
          devices={devicesOfKind("videoinput")}
          value={videoDeviceId}
          empty={t("noCamera")}
          onChange={(id) => {
            setVideoDeviceId(id);
            persist({ videoDeviceId: id });
          }}
        />

        {devicesOfKind("audiooutput").length > 0 && (
          <div>
            <DeviceSelect
              id={`${fieldId}-speaker`}
              label={t("speaker")}
              devices={devicesOfKind("audiooutput")}
              value={speakerDeviceId}
              empty={t("noSpeaker")}
              onChange={(id) => {
                setSpeakerDeviceId(id);
                persist({ speakerDeviceId: id });
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={testSpeaker}
            >
              {t("testSpeaker")}
            </Button>
          </div>
        )}

        <Button type="submit" size="lg" disabled={!canJoin} className="mt-auto">
          {joining ? t("joining") : t("join")}
        </Button>

        {joinError && (
          <p role="alert" className="text-sm text-danger">
            {joinError}
          </p>
        )}
      </div>
    </form>
  );
}

function DeviceSelect({
  id,
  label,
  devices,
  value,
  empty,
  onChange,
}: {
  id: string;
  label: string;
  devices: MediaDevice[];
  value: string | undefined;
  empty: string;
  onChange: (deviceId: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm">
        {label}
      </label>
      <select
        id={id}
        // A device name can be in any script — "MacBook Pro Microphone" or a
        // localised driver name — so the direction follows the content.
        dir="auto"
        value={value ?? ""}
        disabled={devices.length === 0}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-sm border border-border bg-surface px-3 text-sm text-foreground transition-colors duration-150 hover:border-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        {devices.length === 0 ? (
          <option value="">{empty}</option>
        ) : (
          <>
            {/* The browser's own default is a real choice, and often the right
                one after someone plugs in a headset. */}
            <option value="">{label}</option>
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}
