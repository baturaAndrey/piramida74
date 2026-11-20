import { describe, expect, it } from "vitest";
import {
  TZ,
  clockToMin,
  formatEventDate,
  getOpDate,
  getToday,
  minToClock,
  parseLocalDateTime,
} from "./dates";

// All inputs are fixed UTC instants; Yekaterinburg = UTC+5.
const at = (iso: string) => new Date(iso);

describe("TZ", () => {
  it("is Asia/Yekaterinburg", () => {
    expect(TZ).toBe("Asia/Yekaterinburg");
  });
});

describe("getOpDate", () => {
  it("before 09:00 belongs to the previous day", () => {
    expect(getOpDate(at("2026-11-20T03:59:00Z"))).toBe("2026-11-19");
  });
  it("exactly 09:00 starts the new op day", () => {
    expect(getOpDate(at("2026-11-20T04:00:00Z"))).toBe("2026-11-20");
  });
  it("after midnight still belongs to the previous day", () => {
    expect(getOpDate(at("2026-11-19T19:30:00Z"))).toBe("2026-11-19");
  });
  it("late evening belongs to the same day", () => {
    expect(getOpDate(at("2026-11-20T18:59:00Z"))).toBe("2026-11-20");
  });
  it("night across the year boundary", () => {
    expect(getOpDate(at("2026-12-31T19:30:00Z"))).toBe("2026-12-31");
  });
});

describe("getToday", () => {
  it("returns the calendar date in TZ", () => {
    expect(getToday(at("2026-11-20T18:59:00Z"))).toBe("2026-11-20");
    expect(getToday(at("2026-11-20T19:00:00Z"))).toBe("2026-11-21");
  });
});

describe("formatEventDate", () => {
  it("single day", () => {
    expect(formatEventDate("2026-03-05")).toBe("5 марта");
    expect(formatEventDate("2026-03-05", "2026-03-05")).toBe("5 марта");
    expect(formatEventDate("2026-03-05", null)).toBe("5 марта");
  });
  it("range within one month", () => {
    expect(formatEventDate("2026-03-05", "2026-03-07")).toBe("5–7 марта");
    expect(formatEventDate("2026-01-17", "2026-01-18")).toBe("17–18 января");
    expect(formatEventDate("2026-05-09", "2026-05-10")).toBe("9–10 мая");
  });
  it("range across months", () => {
    expect(formatEventDate("2026-03-30", "2026-04-02")).toBe("30 марта – 2 апреля");
  });
  it("range across years", () => {
    expect(formatEventDate("2026-12-31", "2027-01-02")).toBe("31 декабря – 2 января");
  });
  it("throws RangeError on malformed date", () => {
    expect(() => formatEventDate("2026-3-5")).toThrow(RangeError);
  });
});

describe("minToClock", () => {
  it.each([
    [0, "09:00"],
    [30, "09:30"],
    [420, "16:00"],
    [960, "01:00"],
    [1020, "02:00"],
    [1440, "09:00"],
    [-60, "08:00"],
  ])("%i → %s", (min, expected) => {
    expect(minToClock(min)).toBe(expected);
  });
});

describe("clockToMin", () => {
  it.each([
    ["09:00", 0],
    ["19:00", 600],
    ["00:00", 900],
    ["08:30", 1410],
    ["01:00", 960],
  ])("%s → %i", (hhmm, expected) => {
    expect(clockToMin(hhmm)).toBe(expected);
  });

  it("round-trips every 30-minute step of the op day", () => {
    for (let m = 0; m <= 1410; m += 30) {
      expect(clockToMin(minToClock(m))).toBe(m);
    }
  });

  it("throws RangeError on invalid input", () => {
    expect(() => clockToMin("25:00")).toThrow(RangeError);
    expect(() => clockToMin("9")).toThrow(RangeError);
  });
});

describe("parseLocalDateTime", () => {
  it("interprets the value as Yekaterinburg time", () => {
    expect(parseLocalDateTime("2026-12-05T19:30").toISOString()).toBe("2026-12-05T14:30:00.000Z");
  });
  it("crosses the UTC date boundary", () => {
    expect(parseLocalDateTime("2026-12-05T00:15").toISOString()).toBe("2026-12-04T19:15:00.000Z");
  });
  it("keeps seconds", () => {
    expect(parseLocalDateTime("2026-12-05T19:30:15").toISOString()).toBe(
      "2026-12-05T14:30:15.000Z"
    );
  });
  it("throws RangeError on a non datetime-local value", () => {
    expect(() => parseLocalDateTime("2026-12-05 19:30")).toThrow(RangeError);
  });
});
