import { describe, expect, it } from "vitest";
import { parseLocalDateTime } from "@/lib/dates";
import { toLocalInputValue } from "./local-datetime";

describe("toLocalInputValue", () => {
  it("formats an instant in Asia/Yekaterinburg (UTC+5)", () => {
    expect(toLocalInputValue(new Date("2026-12-05T14:00:00Z"))).toBe("2026-12-05T19:00");
  });

  it("rolls over to the next day across the date boundary", () => {
    expect(toLocalInputValue(new Date("2026-12-31T21:00:00Z"))).toBe("2027-01-01T02:00");
    expect(toLocalInputValue(new Date("2026-03-01T19:00:00Z"))).toBe("2026-03-02T00:00");
  });

  it("round-trips with parseLocalDateTime to the minute", () => {
    const d = new Date("2026-07-14T08:37:42.123Z");
    const back = parseLocalDateTime(toLocalInputValue(d));
    expect(Math.floor(back.getTime() / 60_000)).toBe(Math.floor(d.getTime() / 60_000));
  });

  it("19:00 YEKT is published at 14:00 UTC", () => {
    expect(parseLocalDateTime("2026-12-05T19:00").toISOString()).toBe("2026-12-05T14:00:00.000Z");
  });
});
