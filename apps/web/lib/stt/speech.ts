"use client";

/**
 * The browser's own recogniser, used only for the half it is good at.
 *
 * `SpeechRecognition` is free, runs on device, and returns words while somebody
 * is still saying them. It is also worse at precisely the thing this product
 * exists for: it takes one language up front and transliterates everything
 * else, which is the failure the rest of `lib/stt/` is built to avoid.
 *
 * So it is the right instrument for "somebody is talking, roughly this" and the
 * wrong one for the record. Nothing it produces is stored, sent to the glossary,
 * or reaches the transcript — `caption-log.ts` marks it provisional and the
 * accurate pass overwrites it.
 *
 * Where it does not exist — Firefox has never shipped it, Safari's is partial —
 * this returns `null` and the accurate pass runs alone. Captions are then a
 * little later. The meeting is not affected, which is the invariant.
 */

/** The parts of the API this uses. The DOM lib does not declare it. */
interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  readonly length: number;
  isFinal: boolean;
  [index: number]: RecognitionAlternative;
}
interface RecognitionResultList {
  readonly length: number;
  [index: number]: RecognitionResult;
}
interface RecognitionEvent {
  resultIndex: number;
  results: RecognitionResultList;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}
type RecognitionConstructor = new () => Recognition;

function constructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export function speechAvailable(): boolean {
  return constructor() !== null;
}

export interface SpeechSource {
  stop: () => void;
}

/**
 * Errors that mean "nothing was said", not "this is broken".
 *
 * Chrome ends the session on a pause and reports it as an error. Treating those
 * as failures would switch the fast pass off within a minute of a normal
 * meeting, in which most people are listening most of the time.
 */
const HARMLESS = new Set(["no-speech", "aborted", "audio-capture"]);

export function startSpeech(
  onText: (text: string) => void,
  options: { lang: string },
): SpeechSource | null {
  const Recognition = constructor();
  if (!Recognition) return null;

  let stopped = false;
  let recognition: Recognition | null = null;

  const begin = () => {
    if (stopped) return;

    const instance = new Recognition();
    recognition = instance;

    // One language, because that is all it takes. This is why its output is
    // never the record: an English term inside an Arabic sentence comes back
    // in Arabic letters, which is the exact failure the accurate pass and the
    // repair pass exist to undo.
    instance.lang = options.lang;
    instance.continuous = true;
    instance.interimResults = true;
    instance.maxAlternatives = 1;

    instance.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0]?.transcript ?? "";
      }
      const trimmed = text.trim();
      if (trimmed) onText(trimmed);
    };

    // It ends by itself after a pause, and a fast pass that dies quietly two
    // minutes into a meeting is worse than one that was never there — the
    // captions would simply get slower with nothing to say why.
    instance.onend = () => {
      if (!stopped) begin();
    };

    instance.onerror = (event) => {
      if (HARMLESS.has(event.error)) return;
      // Anything else is not worth fighting. The accurate pass carries on
      // alone, which is the documented degradation rather than a failure.
      stopped = true;
    };

    try {
      instance.start();
    } catch {
      // Already running, or refused. Either way the accurate pass is unaffected.
    }
  };

  begin();

  return {
    stop: () => {
      stopped = true;
      recognition?.abort();
      recognition = null;
    },
  };
}
