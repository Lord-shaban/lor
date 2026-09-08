import { describe, expect, it } from "vitest";
import {
  CANVAS_RETENTION_DAYS,
  canvasKeptSince,
  canvasRetentionDays,
} from "./canvas-retention";

describe("Canvas retention", () => {
  it("defaults to thirty days and lets an operator shorten, never lengthen it", () => {
    expect(canvasRetentionDays({})).toBe(CANVAS_RETENTION_DAYS);
    expect(canvasRetentionDays({ LOR_CANVAS_RETENTION_DAYS: "7" })).toBe(7);
    expect(canvasRetentionDays({ LOR_CANVAS_RETENTION_DAYS: "365" })).toBe(30);
    expect(canvasRetentionDays({ LOR_CANVAS_RETENTION_DAYS: "no" })).toBe(30);
  });

  it("calculates the read-path expiry boundary in UTC milliseconds", () => {
    const now = new Date("2026-09-08T12:00:00.000Z");
    expect(canvasKeptSince(now, 7).toISOString()).toBe("2026-09-01T12:00:00.000Z");
  });
});
