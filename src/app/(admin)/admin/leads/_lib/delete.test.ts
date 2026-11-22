import { describe, expect, it } from "vitest";
import {
  deletedLeadsMessage,
  deleteLeadsSchema,
  deleteLeadsTitle,
  MAX_DELETE_LEADS,
} from "./delete";

const ID_A = "0b5c2f8e-3c3a-4f0e-9a51-6d7c1f2e8a10";
const ID_B = "7f3e9d21-5b8c-4a6f-8e2d-1c9b0a4f3e72";

describe("deleteLeadsSchema", () => {
  it("принимает UUID и убирает повторы", () => {
    const parsed = deleteLeadsSchema.parse({ ids: [ID_A, ID_B, ID_A] });
    expect(parsed.ids).toEqual([ID_A, ID_B]);
  });

  it("отклоняет пустой список, не-UUID и слишком большой список", () => {
    expect(deleteLeadsSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(deleteLeadsSchema.safeParse({ ids: ["1; drop table leads"] }).success).toBe(false);
    expect(deleteLeadsSchema.safeParse({ ids: "not-an-array" }).success).toBe(false);
    const tooMany = Array.from({ length: MAX_DELETE_LEADS + 1 }, () => ID_A);
    expect(deleteLeadsSchema.safeParse({ ids: tooMany }).success).toBe(false);
  });
});

describe("тексты удаления", () => {
  it("склоняет число заявок", () => {
    expect(deleteLeadsTitle(1)).toBe("Удалить 1 заявку?");
    expect(deleteLeadsTitle(3)).toBe("Удалить 3 заявки?");
    expect(deleteLeadsTitle(5)).toBe("Удалить 5 заявок?");
    expect(deleteLeadsTitle(11)).toBe("Удалить 11 заявок?");
    expect(deleteLeadsTitle(21)).toBe("Удалить 21 заявку?");
  });

  it("сообщение об успехе", () => {
    expect(deletedLeadsMessage(1)).toBe("Удалена 1 заявка");
    expect(deletedLeadsMessage(2)).toBe("Удалены 2 заявки");
    expect(deletedLeadsMessage(7)).toBe("Удалено 7 заявок");
  });
});
