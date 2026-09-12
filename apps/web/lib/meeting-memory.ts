/**
 * The memory panel is intentionally a compact doorway back into retained
 * evidence, not a second archive. These bounds cap an on-demand response even
 * when a recurring room has an unusually busy retention window.
 */
export const MAX_MEMORY_DECISIONS = 8;
export const MAX_MEMORY_ACTION_ITEMS = 8;
export const MAX_MEMORY_REPEATED_SPEAKERS = 8;

/**
 * The app has no accounts and its participant identity is deliberately scoped
 * to one browser tab. A name that appears in two retained occurrences is thus
 * useful as a repeated *speaker name*, never proof that two appearances are
 * the same person or that the named person attended silently.
 */
export function repeatedSpeakerLabel(occurrenceCount: number): "repeated" | "single" {
  return occurrenceCount >= 2 ? "repeated" : "single";
}
