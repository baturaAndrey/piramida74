import { describe, expect, it } from "vitest";
import { panelLevel, parseRoles, userDeletionError } from "./roles";

describe("parseRoles", () => {
  it("разбирает список через запятую без trim (как Better Auth) и убирает пустые значения", () => {
    expect(parseRoles("admin,staff,")).toEqual(["admin", "staff"]);
    expect(parseRoles("staff, admin")).toEqual(["staff", " admin"]);
    expect(parseRoles(null)).toEqual([]);
    expect(parseRoles(undefined)).toEqual([]);
    expect(parseRoles("")).toEqual([]);
  });
});

describe("panelLevel", () => {
  it("admin — главный админ (важнее staff в списке)", () => {
    expect(panelLevel("admin")).toBe("owner");
    expect(panelLevel("staff,admin")).toBe("owner");
  });

  it("staff — сотрудник", () => {
    expect(panelLevel("staff")).toBe("staff");
  });

  it("прочие роли доступа не дают", () => {
    expect(panelLevel("user")).toBeNull();
    expect(panelLevel(null)).toBeNull();
    // Похожие строки не считаются ролью
    expect(panelLevel("administrator")).toBeNull();
    expect(panelLevel("staffer")).toBeNull();
    // Пробел — не та роль, что у Better Auth: прав главного админа не даёт
    expect(panelLevel("staff, admin")).toBe("staff");
  });
});

describe("userDeletionError", () => {
  const actorId = "me";

  it("запрещает удалять себя", () => {
    expect(userDeletionError(actorId, { id: actorId, role: "admin" }, 3)).toMatch(/самого себя/);
  });

  it("запрещает удалять последнего главного админа", () => {
    expect(userDeletionError(actorId, { id: "other", role: "admin" }, 1)).toMatch(/последнего/);
  });

  it("разрешает удалить сотрудника и не последнего админа", () => {
    expect(userDeletionError(actorId, { id: "other", role: "staff" }, 1)).toBeNull();
    expect(userDeletionError(actorId, { id: "other", role: "admin" }, 2)).toBeNull();
  });
});
