import { describe, expect, it } from "vitest";
import { SETTINGS_DEFAULTS } from "@/lib/settings-defaults";
import { parseHours, settingsToLocalBusinessInput } from "./local-business";

describe("parseHours", () => {
  it("parses an en dash range", () => {
    expect(parseHours("Ежедневно 09:00–02:00")).toEqual({ opens: "09:00", closes: "02:00" });
  });

  it("parses hyphen / em dash and pads single-digit hours", () => {
    expect(parseHours("9:00-2:00")).toEqual({ opens: "09:00", closes: "02:00" });
    expect(parseHours("с 10:30 — 23:00")).toEqual({ opens: "10:30", closes: "23:00" });
  });

  it("falls back to the default schedule on garbage", () => {
    expect(parseHours("круглосуточно")).toEqual({ opens: "09:00", closes: "02:00" });
    expect(parseHours("")).toEqual({ opens: "09:00", closes: "02:00" });
  });
});

describe("settingsToLocalBusinessInput", () => {
  const input = settingsToLocalBusinessInput(SETTINGS_DEFAULTS, "https://x.ru");

  it("maps contact data from settings", () => {
    expect(input.url).toBe("https://x.ru");
    expect(input.logo).toBe("https://x.ru/images/logo.png");
    expect(input.telephone).toBe("+79000685000");
    expect(input.telephone.startsWith("tel:")).toBe(false);
    expect(input.email).toBe(SETTINGS_DEFAULTS.email);
  });

  it("splits the address into city and street", () => {
    expect(input.address).toEqual({
      city: "Челябинск",
      street: "Орджоникидзе 58а к3",
      region: "Челябинская область",
    });
  });

  it("uses geo, hours and non-empty sameAs links", () => {
    expect(input.geo).toEqual({ lat: 55.153739, lon: 61.404441 });
    expect(input.hours).toEqual({ opens: "09:00", closes: "02:00" });
    expect(input.sameAs).toEqual([SETTINGS_DEFAULTS.vkUrl, SETTINGS_DEFAULTS.telegramUrl]);
  });

  it("drops empty social links and email; falls back to phone without href", () => {
    const res = settingsToLocalBusinessInput(
      {
        ...SETTINGS_DEFAULTS,
        vkUrl: "",
        email: "",
        phoneHref: "",
        address: "Орджоникидзе 58а",
      },
      "https://x.ru"
    );
    expect(res.sameAs).toEqual([SETTINGS_DEFAULTS.telegramUrl]);
    expect(res).not.toHaveProperty("email");
    expect(res.telephone).toBe(SETTINGS_DEFAULTS.phone);
    expect(res.address.city).toBe("Челябинск");
    expect(res.address.street).toBe("Орджоникидзе 58а");
  });
});
