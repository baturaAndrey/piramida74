import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PREVIEW_TOKEN_TTL_MS, signPreviewToken, verifyPreviewToken } from "./preview-token";

const ID = "6f1c2a8e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";
const OTHER_ID = "7a2b3c4d-5e6f-4a1b-9c8d-7e6f5a4b3c2d";
const NOW = Date.UTC(2026, 10, 20, 12, 0, 0);
const SECRET = "test-secret-test-secret-test-secret-123456";

beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("preview-token", () => {
  it("валидный токен принимается в течение 24 ч", () => {
    const token = signPreviewToken(ID, NOW);
    expect(verifyPreviewToken(ID, token, NOW)).toBe(true);
    expect(verifyPreviewToken(ID, token, NOW + PREVIEW_TOKEN_TTL_MS - 1)).toBe(true);
  });

  it("чужой id → false", () => {
    expect(verifyPreviewToken(OTHER_ID, signPreviewToken(ID, NOW), NOW)).toBe(false);
  });

  it("истёкший → false", () => {
    const token = signPreviewToken(ID, NOW);
    expect(verifyPreviewToken(ID, token, NOW + PREVIEW_TOKEN_TTL_MS + 1)).toBe(false);
  });

  it("изменённая подпись или срок → false", () => {
    const token = signPreviewToken(ID, NOW);
    const [exp, sig] = token.split(".") as [string, string];
    const flipped = `${sig.slice(0, -1)}${sig.endsWith("A") ? "B" : "A"}`;
    expect(verifyPreviewToken(ID, `${exp}.${flipped}`, NOW)).toBe(false);
    expect(verifyPreviewToken(ID, `${Number(exp) - 1000}.${sig}`, NOW)).toBe(false);
  });

  it("токен со сроком дальше TTL отклоняется", () => {
    const token = signPreviewToken(ID, NOW, PREVIEW_TOKEN_TTL_MS * 10);
    expect(verifyPreviewToken(ID, token, NOW)).toBe(false);
  });

  it("мусор и пустая строка → false", () => {
    for (const bad of ["", "abc", ".", "123.", ".abc", "x.y", "1.2.3", "-5.abc", null, undefined]) {
      expect(verifyPreviewToken(ID, bad, NOW)).toBe(false);
    }
  });

  it("другой секрет → false", () => {
    const token = signPreviewToken(ID, NOW);
    vi.stubEnv("BETTER_AUTH_SECRET", "another-secret-another-secret-another-1");
    expect(verifyPreviewToken(ID, token, NOW)).toBe(false);
  });

  it("без секрета подпись невозможна", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    expect(() => signPreviewToken(ID, NOW)).toThrow();
  });
});
