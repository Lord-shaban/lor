/**
 * Camera and microphone plumbing for the prejoin screen.
 *
 * Deliberately free of any LiveKit import: this all runs before anyone joins a
 * room, and a device problem should be solvable without a media server in the
 * picture at all.
 */

export type DeviceKind = "videoinput" | "audioinput" | "audiooutput";

export interface MediaDevice {
  deviceId: string;
  label: string;
  kind: DeviceKind;
}

/**
 * Why we could not open a device.
 *
 * These map to distinct messages because the recovery is different for each:
 * a denied permission is fixed in browser settings, a missing device by
 * plugging one in, and a busy device by closing whatever else grabbed it.
 */
export type MediaErrorKind =
  | "denied"
  | "notFound"
  | "inUse"
  | "insecureContext"
  | "unsupported"
  | "unknown";

export function classifyMediaError(error: unknown): MediaErrorKind {
  // getUserMedia is absent entirely on http, so the failure arrives as a
  // missing API rather than a DOMException. Worth its own message: "allow
  // camera access" is useless advice when the real problem is the URL.
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    return typeof window !== "undefined" && !window.isSecureContext
      ? "insecureContext"
      : "unsupported";
  }

  if (!(error instanceof DOMException)) return "unknown";

  switch (error.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "OverconstrainedError":
      return "notFound";
    case "NotReadableError":
    case "AbortError":
      return "inUse";
    default:
      return "unknown";
  }
}

/**
 * Which browser, so the recovery instructions can name the actual menu.
 *
 * "Allow camera access in your browser settings" is not help. Where the button
 * is differs per browser, and this is the one place guessing is better than
 * saying nothing.
 */
export type BrowserFamily = "chrome" | "firefox" | "safari" | "other";

export function detectBrowser(userAgent: string): BrowserFamily {
  const ua = userAgent.toLowerCase();
  // Order matters: Edge and Chrome both claim Safari, and Chrome claims Safari.
  if (ua.includes("firefox/") || ua.includes("fxios")) return "firefox";
  if (ua.includes("edg/") || ua.includes("chrome/") || ua.includes("crios")) {
    return "chrome";
  }
  if (ua.includes("safari/")) return "safari";
  return "other";
}

/**
 * List devices.
 *
 * Labels are empty until a permission has been granted at least once, so this
 * is only worth calling after a successful `getUserMedia`. Entries without a
 * label are still returned — a camera with no name is better than no camera.
 */
export async function listDevices(): Promise<MediaDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];

  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device): device is MediaDeviceInfo =>
      ["videoinput", "audioinput", "audiooutput"].includes(device.kind),
    )
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `${device.kind} ${index + 1}`,
      kind: device.kind as DeviceKind,
    }));
}

/** Stop every track, so the camera light actually goes out. */
export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

const STORAGE_KEY = "lor-devices";

export interface DevicePreferences {
  videoDeviceId?: string;
  audioDeviceId?: string;
  speakerDeviceId?: string;
  name?: string;
  cameraOff?: boolean;
  micOff?: boolean;
}

/** Remember the choices, so the second meeting does not repeat the first. */
export function loadPreferences(): DevicePreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DevicePreferences) : {};
  } catch {
    // A private window, blocked site data, or something else's key under ours.
    // Defaults are a fine outcome; failing to load is not worth surfacing.
    return {};
  }
}

export function savePreferences(preferences: DevicePreferences) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...loadPreferences(), ...preferences }),
    );
  } catch {
    // Same as above: the choice still applies to this session.
  }
}
