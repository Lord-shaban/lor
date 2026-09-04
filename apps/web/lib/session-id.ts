"use client";

/**
 * Who this browser tab is, for as long as it is open.
 *
 * The server hashes this together with a secret to derive a LiveKit identity, so
 * it is what makes a reload rejoin as the same participant, a second tab a
 * different one, and a removal survive both. It never leaves this origin.
 */

const SESSION_KEY = "lor-session-id";

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;

    const value = randomId();
    sessionStorage.setItem(SESSION_KEY, value);
    return value;
  } catch {
    // Storage can be unavailable — a private window with it switched off, or an
    // embedded browser. A fresh id still works for this page load; it just
    // means a reload joins as a new participant.
    return randomId();
  }
}
