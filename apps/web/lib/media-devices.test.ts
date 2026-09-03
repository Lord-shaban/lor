import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyMediaError,
  detectBrowser,
  loadPreferences,
  savePreferences,
} from "./media-devices";

describe("classifyMediaError", () => {
  beforeEach(() => {
    // Every branch except the two environment ones assumes the API exists.
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => {} } });
    vi.stubGlobal("window", { isSecureContext: true });
  });

  it.each([
    ["NotAllowedError", "denied"],
    ["SecurityError", "denied"],
    ["NotFoundError", "notFound"],
    ["OverconstrainedError", "notFound"],
    ["NotReadableError", "inUse"],
    ["AbortError", "inUse"],
    ["SomethingElse", "unknown"],
  ])("maps %s to %s", (name, expected) => {
    expect(classifyMediaError(new DOMException("", name))).toBe(expected);
  });

  it("reports an insecure origin rather than a permission problem", () => {
    // getUserMedia is absent entirely on http. Telling someone to allow camera
    // access is useless advice when the real problem is the URL.
    vi.stubGlobal("navigator", { mediaDevices: undefined });
    vi.stubGlobal("window", { isSecureContext: false });
    expect(classifyMediaError(new Error("boom"))).toBe("insecureContext");
  });

  it("reports an unsupported browser when the origin is fine", () => {
    vi.stubGlobal("navigator", { mediaDevices: undefined });
    vi.stubGlobal("window", { isSecureContext: true });
    expect(classifyMediaError(new Error("boom"))).toBe("unsupported");
  });

  it("does not guess at a non-DOMException", () => {
    expect(classifyMediaError("a string")).toBe("unknown");
  });
});

describe("detectBrowser", () => {
  it.each([
    [
      "chrome",
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
    ],
    [
      // Edge claims both Chrome and Safari; the settings menu is close enough
      // to Chrome's that the same instructions apply.
      "chrome",
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/141.0 Safari/537.36 Edg/141.0",
    ],
    ["chrome", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) CriOS/141.0 Mobile"],
    ["firefox", "Mozilla/5.0 (Windows NT 10.0; rv:135.0) Gecko/20100101 Firefox/135.0"],
    ["firefox", "Mozilla/5.0 (iPhone) FxiOS/135.0 Mobile Safari/605.1.15"],
    [
      "safari",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
    ],
    ["other", "SomeCrawler/1.0"],
  ])("detects %s", (expected, userAgent) => {
    expect(detectBrowser(userAgent)).toBe(expected);
  });

  it("does not mistake Chrome for Safari", () => {
    // Chrome's user agent contains "Safari". Checking in the wrong order sends
    // every Chrome user instructions for a menu they do not have.
    const chrome =
      "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/141.0 Safari/537.36";
    expect(detectBrowser(chrome)).toBe("chrome");
  });
});

describe("preferences", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
  });

  it("round-trips what was saved", () => {
    savePreferences({ name: "أحمد", cameraOff: true });
    expect(loadPreferences()).toEqual({ name: "أحمد", cameraOff: true });
  });

  it("merges rather than replacing, so one choice does not erase another", () => {
    savePreferences({ name: "أحمد" });
    savePreferences({ micOff: true });
    expect(loadPreferences()).toEqual({ name: "أحمد", micOff: true });
  });

  it("falls back to defaults when storage holds something unparseable", () => {
    localStorage.setItem("lor-devices", "{not json");
    expect(loadPreferences()).toEqual({});
  });

  it("survives storage being unavailable entirely", () => {
    // A private window, or site data blocked. Losing the preference is fine;
    // throwing on the first render is not.
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });

    expect(loadPreferences()).toEqual({});
    expect(() => savePreferences({ name: "أحمد" })).not.toThrow();
  });
});
