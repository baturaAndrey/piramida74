import { describe, expect, it } from "vitest";
import { leadFormFieldsSchema, leadInputSchema, quoteInputSchema } from "./leads-schema";

const base = {
  type: "booking",
  sourceBlock: "Первый экран",
  formTitle: "Забронировать",
  name: "Иван",
  phone: "+7(900)068-50-00",
  consent: true,
} as const;

const quote = {
  opDate: "2026-12-05",
  startMin: 600,
  durationMin: 120,
  guests: 4,
  hallId: "8d3b9c1e-2f4a-4b6c-9d8e-1a2b3c4d5e6f",
  tables: 1,
  pensioner: false,
  extras: [],
  sets: [],
  items: [{ code: "abc123-x9y8z7", qty: 2 }],
};

describe("leadInputSchema", () => {
  it("accepts a valid booking", () => {
    expect(leadInputSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an incomplete phone", () => {
    const r = leadInputSchema.safeParse({ ...base, phone: "+7(900)068" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === "phone")).toBe(true);
  });

  it("rejects missing consent", () => {
    const r = leadInputSchema.safeParse({ ...base, consent: false });
    expect(r.error?.issues.some((i) => i.path[0] === "consent")).toBe(true);
  });

  it("requires name for non-callback types but not for callback", () => {
    const { name: _name, ...noName } = base;
    expect(leadInputSchema.safeParse(noName).success).toBe(false);
    expect(
      leadInputSchema.safeParse({ ...noName, type: "callback", callbackWindow: "hour" }).success
    ).toBe(true);
  });

  it("requires quote for calculator", () => {
    const r = leadInputSchema.safeParse({ ...base, type: "calculator" });
    expect(r.error?.issues.some((i) => i.path[0] === "quote")).toBe(true);
  });

  it("strips unknown keys", () => {
    const r = leadInputSchema.safeParse({ ...base, total: 1 });
    expect(r.success && "total" in r.data).toBe(false);
  });
});

describe("quoteInputSchema", () => {
  it("accepts tier codes", () => {
    expect(quoteInputSchema.safeParse(quote).success).toBe(true);
  });

  it("rejects fractional quantities", () => {
    expect(
      quoteInputSchema.safeParse({ ...quote, items: [{ code: "abc123", qty: 1.5 }] }).success
    ).toBe(false);
    expect(quoteInputSchema.safeParse({ ...quote, guests: 2.5 }).success).toBe(false);
  });

  it("rejects invalid codes", () => {
    expect(
      quoteInputSchema.safeParse({ ...quote, sets: [{ code: "DROP TABLE", qty: 1 }] }).success
    ).toBe(false);
  });
});

describe("leadFormFieldsSchema", () => {
  it("applies the same phone and name rules", () => {
    expect(
      leadFormFieldsSchema.safeParse({
        type: "promo",
        name: "И",
        phone: "+7(900)068-50-00",
        consent: true,
      }).success
    ).toBe(false);
    expect(
      leadFormFieldsSchema.safeParse({ type: "callback", phone: "+7(900)068-50-00", consent: true })
        .success
    ).toBe(true);
    expect(
      leadFormFieldsSchema.safeParse({
        type: "callback",
        phone: "+7(900)068-50-00",
        consent: false,
      }).success
    ).toBe(false);
  });
});
