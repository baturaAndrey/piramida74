import { describe, expect, it } from "vitest";
import { changeTemporaryPasswordSchema } from "./_schema";

const errorPaths = (input: unknown) =>
  changeTemporaryPasswordSchema.safeParse(input).error?.issues.map((i) => i.path.join(".")) ?? [];

describe("changeTemporaryPasswordSchema", () => {
  it("принимает корректную смену", () => {
    expect(
      changeTemporaryPasswordSchema.safeParse({
        currentPassword: "Temp-password-1",
        newPassword: "My-own-password-2",
        repeatPassword: "My-own-password-2",
      }).success
    ).toBe(true);
  });

  it("требует совпадения повтора", () => {
    expect(
      errorPaths({
        currentPassword: "Temp-password-1",
        newPassword: "My-own-password-2",
        repeatPassword: "My-own-password-3",
      })
    ).toEqual(["repeatPassword"]);
  });

  it("запрещает оставить временный пароль и короткий пароль", () => {
    expect(
      errorPaths({
        currentPassword: "Temp-password-1",
        newPassword: "Temp-password-1",
        repeatPassword: "Temp-password-1",
      })
    ).toEqual(["newPassword"]);
    expect(
      errorPaths({ currentPassword: "x", newPassword: "short", repeatPassword: "short" })
    ).toContain("newPassword");
  });
});
