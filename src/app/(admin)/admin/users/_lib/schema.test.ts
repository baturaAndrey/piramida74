import { describe, expect, it } from "vitest";
import { createUserSchema, deleteUserSchema, resetTemporaryPasswordSchema } from "./schema";

describe("createUserSchema", () => {
  it("нормализует email и имя", () => {
    const parsed = createUserSchema.parse({
      email: "  Staff@Example.RU ",
      name: "  Ольга ",
      password: "Temp-password-1",
    });
    expect(parsed).toEqual({
      email: "staff@example.ru",
      name: "Ольга",
      password: "Temp-password-1",
    });
  });

  it("отклоняет некорректный email, пустое имя и короткий пароль", () => {
    const result = createUserSchema.safeParse({ email: "nope", name: " ", password: "short" });
    expect(result.success).toBe(false);
    const fields = result.error?.issues.map((issue) => issue.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["email", "name", "password"]));
  });
});

describe("userId", () => {
  it("принимает id Better Auth и отклоняет мусор", () => {
    expect(deleteUserSchema.safeParse({ userId: "Xy3_abc-DEF9" }).success).toBe(true);
    expect(deleteUserSchema.safeParse({ userId: "" }).success).toBe(false);
    expect(deleteUserSchema.safeParse({ userId: "a'; drop table user;--" }).success).toBe(false);
    expect(deleteUserSchema.safeParse({ userId: "x".repeat(65) }).success).toBe(false);
  });

  it("сброс временного пароля требует пароль по политике", () => {
    expect(resetTemporaryPasswordSchema.safeParse({ userId: "abc", password: "123" }).success).toBe(
      false
    );
    expect(
      resetTemporaryPasswordSchema.safeParse({ userId: "abc", password: "Long-enough-1" }).success
    ).toBe(true);
  });
});
