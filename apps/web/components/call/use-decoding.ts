"use client";

import { useCallback, useSyncExternalStore, type RefObject } from "react";
import { decodingOf, look } from "@/lib/decoding";

// The value lives in the DOM, so expose it as an external store instead of
// copying it into React state from an effect.
const POLL_MS = 500;

const EVENTS = [
  "loadeddata",
  "playing",
  "resize",
  "emptied",
  "ended",
  "stalled",
  "suspend",
  "waiting",
] as const;

export function useDecoding(
  ref: RefObject<HTMLVideoElement | null>,
  source: object | undefined,
): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const element = ref.current;
      if (!element) return () => {};

      const check = () => {
        const before = decodingOf(element, source);
        if (look(element, Date.now(), source) !== before) notify();
      };

      for (const event of EVENTS) element.addEventListener(event, check);
      // Events cover arriving; only polling notices a silent freeze.
      const timer = setInterval(check, POLL_MS);

      check();
      return () => {
        for (const event of EVENTS) element.removeEventListener(event, check);
        clearInterval(timer);
      };
    },
    [ref, source],
  );

  return useSyncExternalStore(
    subscribe,
    () => (ref.current ? decodingOf(ref.current, source) : false),
    () => false,
  );
}
