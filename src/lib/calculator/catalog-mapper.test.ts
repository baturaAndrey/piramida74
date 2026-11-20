import { describe, expect, it } from "vitest";
import { type MenuVariantSourceRows, buildMenuVariants } from "./catalog-mapper";

const CHAI = { id: "c-chai", slug: "chai", title: "Чай", priceGroupId: "g-tea", sortOrder: 2 };
const KUHNYA = { id: "c-kuhnya", slug: "kuhnya", title: "Кухня", priceGroupId: null, sortOrder: 1 };

const TIERS: MenuVariantSourceRows["tiers"] = [
  { code: "t1000", groupId: "g-tea", label: "Чайник 1 л", price: 500, sortOrder: 2 },
  { code: "b1", groupId: "g-big", label: "Большой", price: 900, sortOrder: 1 },
  { code: "t600", groupId: "g-tea", label: "Чайник 600 мл", price: 350, sortOrder: 1 },
];

function rows(overrides: Partial<MenuVariantSourceRows> = {}): MenuVariantSourceRows {
  return { categories: [CHAI, KUHNYA], items: [], variants: [], tiers: TIERS, ...overrides };
}

const item = (
  id: string,
  categoryId: string,
  sortOrder = 1,
  priceGroupId: string | null = null
): MenuVariantSourceRows["items"][number] => ({
  id,
  code: `${id}code`,
  name: `Позиция ${id}`,
  categoryId,
  priceGroupId,
  sortOrder,
});

describe("buildMenuVariants", () => {
  it("1. собственные варианты позиции", () => {
    const result = buildMenuVariants(
      rows({
        items: [item("burg", KUHNYA.id)],
        variants: [
          { code: "v1", itemId: "burg", label: "Большой", price: 500, sortOrder: 1 },
          { code: "v2", itemId: "burg", label: null, price: 400, sortOrder: 2 },
        ],
      })
    );
    expect(result).toEqual([
      {
        code: "v1",
        itemName: "Позиция burg",
        label: "Большой",
        price: 500,
        categorySlug: "kuhnya",
        categoryName: "Кухня",
      },
      {
        code: "v2",
        itemName: "Позиция burg",
        label: "",
        price: 400,
        categorySlug: "kuhnya",
        categoryName: "Кухня",
      },
    ]);
  });

  it("2. сетка категории", () => {
    const result = buildMenuVariants(rows({ items: [item("tea", CHAI.id)] }));
    expect(result.map((v) => [v.code, v.label, v.price])).toEqual([
      ["teacode-t600", "Чайник 600 мл", 350],
      ["teacode-t1000", "Чайник 1 л", 500],
    ]);
    expect(result[0]!.categorySlug).toBe("chai");
  });

  it("3. сетка позиции перекрывает сетку категории", () => {
    const result = buildMenuVariants(rows({ items: [item("big", CHAI.id, 1, "g-big")] }));
    expect(result.map((v) => v.code)).toEqual(["bigcode-b1"]);
    expect(result[0]!.price).toBe(900);
  });

  it("4. собственные варианты имеют приоритет над сеткой", () => {
    const result = buildMenuVariants(
      rows({
        items: [item("own", CHAI.id)],
        variants: [{ code: "own1", itemId: "own", label: "Пуэр", price: 700, sortOrder: 1 }],
      })
    );
    expect(result.map((v) => v.code)).toEqual(["own1"]);
  });

  it("5. без вариантов и без сетки — пропуск", () => {
    expect(buildMenuVariants(rows({ items: [item("bare", KUHNYA.id)] }))).toEqual([]);
  });

  it("6. категория отсутствует — пропуск", () => {
    expect(buildMenuVariants(rows({ items: [item("orphan", "c-missing", 1, "g-big")] }))).toEqual(
      []
    );
  });

  it("7. порядок по sortOrder категорий, позиций, вариантов/уровней", () => {
    const result = buildMenuVariants(
      rows({
        categories: [CHAI, KUHNYA],
        items: [
          item("tea2", CHAI.id, 2),
          item("soup", KUHNYA.id, 2),
          item("tea1", CHAI.id, 1),
          item("burg", KUHNYA.id, 1),
        ],
        variants: [
          { code: "soup1", itemId: "soup", label: null, price: 300, sortOrder: 1 },
          { code: "burg2", itemId: "burg", label: "B", price: 500, sortOrder: 2 },
          { code: "burg1", itemId: "burg", label: "A", price: 450, sortOrder: 1 },
        ],
      })
    );
    expect(result.map((v) => v.code)).toEqual([
      "burg1",
      "burg2",
      "soup1",
      "tea1code-t600",
      "tea1code-t1000",
      "tea2code-t600",
      "tea2code-t1000",
    ]);
  });

  it("8. пустой вход", () => {
    expect(buildMenuVariants({ categories: [], items: [], variants: [], tiers: [] })).toEqual([]);
  });

  it("9. вход не мутирован, повторный вызов даёт равный результат", () => {
    const input = rows({
      items: [item("tea", CHAI.id, 2), item("burg", KUHNYA.id, 1)],
      variants: [
        { code: "b2", itemId: "burg", label: null, price: 1, sortOrder: 2 },
        { code: "b1", itemId: "burg", label: null, price: 1, sortOrder: 1 },
      ],
    });
    const before = structuredClone(input);
    const first = buildMenuVariants(input);
    expect(input).toEqual(before);
    expect(buildMenuVariants(input)).toEqual(first);
  });
});
