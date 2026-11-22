import { describe, expect, it } from "vitest";
import {
  generateTemporaryPassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  TEMP_PASSWORD_LENGTH,
} from "./password-policy";

describe("generateTemporaryPassword", () => {
  it("по умолчанию — TEMP_PASSWORD_LENGTH символов из алфавита без похожих символов", () => {
    const password = generateTemporaryPassword();
    expect(password).toHaveLength(TEMP_PASSWORD_LENGTH);
    expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/);
  });

  it("не короче минимальной длины политики", () => {
    expect(TEMP_PASSWORD_LENGTH).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH);
    expect(generateTemporaryPassword(MIN_PASSWORD_LENGTH)).toHaveLength(MIN_PASSWORD_LENGTH);
  });

  it("пароли не повторяются", () => {
    const passwords = new Set(Array.from({ length: 200 }, () => generateTemporaryPassword()));
    expect(passwords.size).toBe(200);
  });

  it("отклоняет длину вне политики", () => {
    expect(() => generateTemporaryPassword(MIN_PASSWORD_LENGTH - 1)).toThrow(RangeError);
    expect(() => generateTemporaryPassword(MAX_PASSWORD_LENGTH + 1)).toThrow(RangeError);
    expect(() => generateTemporaryPassword(12.5)).toThrow(RangeError);
  });
});
