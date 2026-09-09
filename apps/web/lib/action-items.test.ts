import { describe, expect, it } from "vitest";
import { isCalendarDate } from "@lor/db";

describe("action-item calendar dates", () => {
  it("accepts only complete calendar dates, never relative or normalised input", () => {
    for (const value of ["2026-02-28", "2028-02-29", "2026-12-01"]) {
      expect(isCalendarDate(value)).toBe(true);
    }
    for (const value of [
      "tomorrow",
      "2026-2-3",
      "2026-02-30",
      "2026-13-01",
      "2026-01-00",
      "2026-01-01T10:00:00Z",
    ]) {
      expect(isCalendarDate(value)).toBe(false);
    }
  });
});
