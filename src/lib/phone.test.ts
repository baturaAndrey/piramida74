import { describe, expect, it } from "vitest";
import {
  applyPhoneInput,
  formatPhone,
  isPhoneComplete,
  isValidPhone,
  nationalDigits,
  normalizePhone,
} from "./phone";

describe("nationalDigits", () => {
  it("drops one leading 7/8 country code and caps at 10 digits", () => {
    expect(nationalDigits("89000685000")).toBe("9000685000");
    expect(nationalDigits("+79000685000")).toBe("9000685000");
    expect(nationalDigits("9000685000")).toBe("9000685000");
    expect(nationalDigits("+7(900)068-50-00123")).toBe("9000685000");
  });
});

describe("formatPhone", () => {
  it.each([
    ["", ""],
    ["9", "+7(9"],
    ["900", "+7(900"],
    ["9000685", "+7(900)068-5"],
    ["90006850", "+7(900)068-50"],
    ["9000685000", "+7(900)068-50-00"],
    ["89000685000", "+7(900)068-50-00"],
    ["+79000685000", "+7(900)068-50-00"],
    ["+7(", ""],
  ])("%s → %s", (input, expected) => {
    expect(formatPhone(input)).toBe(expected);
  });

  it("does not allow more than 10 national digits", () => {
    expect(formatPhone("+7(900)068-50-009")).toBe("+7(900)068-50-00");
  });
});

describe("applyPhoneInput", () => {
  it("types digits after the mask prefix", () => {
    expect(applyPhoneInput("+7(", "+7(9")).toBe("+7(9");
    expect(applyPhoneInput("+7(90", "+7(900")).toBe("+7(900");
    expect(applyPhoneInput("+7(900", "+7(9000")).toBe("+7(900)0");
  });

  it("removes the last digit when a separator is deleted", () => {
    expect(applyPhoneInput("+7(900)068", "+7(900068")).toBe("+7(900)06");
    expect(applyPhoneInput("+7(900)068-5", "+7(900)0685")).toBe("+7(900)068");
  });

  it("keeps national numbers that start with 8 when deleting", () => {
    expect(applyPhoneInput("+7(800)1", "+7(8001")).toBe("+7(800");
  });

  it("drops the mask prefix when a full number with country code is pasted", () => {
    expect(applyPhoneInput("+7(", "+7(+7 (900) 111-22-33")).toBe("+7(900)111-22-33");
    expect(applyPhoneInput("+7(", "+7(89001112233")).toBe("+7(900)111-22-33");
    expect(applyPhoneInput("", "+7 (900) 111-22-33")).toBe("+7(900)111-22-33");
    // Вставка национального номера без кода — как раньше
    expect(applyPhoneInput("+7(", "+7(9001112233")).toBe("+7(900)111-22-33");
  });

  it("does not shift a complete number when an extra digit is typed", () => {
    expect(applyPhoneInput("+7(800)123-45-67", "+7(800)123-45-678")).toBe("+7(800)123-45-67");
  });

  it("clears the field when the prefix is deleted", () => {
    expect(applyPhoneInput("+7(", "+7")).toBe("");
  });
});

describe("validation and normalization", () => {
  it("isPhoneComplete requires 10 national digits", () => {
    expect(isPhoneComplete("+7(900)068-50-00")).toBe(true);
    expect(isPhoneComplete("+7(900)068-50-0")).toBe(false);
  });

  it("isValidPhone rejects extra digits and foreign country codes", () => {
    expect(isValidPhone("+7(900)068-50-00")).toBe(true);
    expect(isValidPhone("89000685000")).toBe(true);
    expect(isValidPhone("9000685000")).toBe(true);
    expect(isValidPhone("+7 900 068 50 00 99")).toBe(false);
    expect(isValidPhone("19000685000")).toBe(false);
    expect(isValidPhone("8900068500")).toBe(false);
  });

  it("normalizePhone returns the canonical form", () => {
    expect(normalizePhone("+7(900)068-50-00")).toBe("+7 (900) 068-50-00");
    expect(normalizePhone("89000685000")).toBe("+7 (900) 068-50-00");
    expect(normalizePhone("+7(900)068")).toBeNull();
  });
});
