import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("keeps a custom font size alongside a text color", () => {
    expect(cn("text-h2", "text-white")).toBe("text-h2 text-white");
  });

  it("lets a later custom font size override an earlier one", () => {
    expect(cn("text-h2", "text-price")).toBe("text-price");
  });

  it("lets a custom font size override a default font size", () => {
    expect(cn("text-sm", "text-h1")).toBe("text-h1");
  });

  it.each([
    "text-h1",
    "text-h2",
    "text-calendar-title",
    "text-card-title",
    "text-promo-title",
    "text-price",
    "text-hero-sub",
    "text-badge-size",
    "text-popup-title",
    "text-body-lg",
    "text-btn",
  ])("treats %s as a font size, not a color", (size) => {
    expect(cn(size, "text-date")).toBe(`${size} text-date`);
    expect(cn("text-base", size)).toBe(size);
  });

  it("lets a custom text color override a default one", () => {
    expect(cn("text-white", "text-date")).toBe("text-date");
  });

  it("merges custom color tokens as colors", () => {
    expect(cn("text-subtle", "text-accent-red")).toBe("text-accent-red");
    expect(cn("text-success", "text-badge-foreground")).toBe("text-badge-foreground");
    expect(cn("bg-nav", "bg-footer")).toBe("bg-footer");
    expect(cn("bg-badge", "bg-primary-dark")).toBe("bg-primary-dark");
    expect(cn("text-white", "text-badge")).toBe("text-badge");
  });

  it("keeps the badge color and the badge font size together", () => {
    expect(cn("text-badge-size", "text-badge-foreground")).toBe(
      "text-badge-size text-badge-foreground"
    );
  });
});
