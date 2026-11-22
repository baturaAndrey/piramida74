import { describe, expect, it } from "vitest";
import { articleSchema, authorSchema, isValidLocalDateTime, slugSchema } from "./blog";

const baseArticle = { title: "Статья", slug: "statya", status: "draft" as const };

describe("slugSchema", () => {
  it.each(["pravila", "turnir-2026", "a1-b2-c3"])("accepts %s", (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(true);
  });

  it.each(["", "Pravila", "dva--defisa", "-start", "end-", "пирамида", "a_b", "rss.xml"])(
    "rejects %j",
    (slug) => {
      expect(slugSchema.safeParse(slug).success).toBe(false);
    }
  );

  it("rejects reserved slugs with an explicit message", () => {
    const res = slugSchema.safeParse("preview");
    expect(res.success).toBe(false);
    expect(res.error?.issues[0]?.message).toBe("Этот slug зарезервирован");
  });
});

describe("articleSchema", () => {
  it("fills defaults", () => {
    const res = articleSchema.parse(baseArticle);
    expect(res).toMatchObject({ excerpt: "", body: "", tagIds: [], showToc: true, noindex: false });
    expect(res.seoTitle).toBeNull();
  });

  it("requires publishAt for scheduled", () => {
    const res = articleSchema.safeParse({ ...baseArticle, status: "scheduled", publishAt: "" });
    expect(res.success).toBe(false);
    expect(res.error?.issues[0]?.path).toEqual(["publishAt"]);
  });

  it("accepts scheduled with a datetime-local value", () => {
    const res = articleSchema.safeParse({
      ...baseArticle,
      status: "scheduled",
      publishAt: "2026-12-05T19:00",
    });
    expect(res.success).toBe(true);
  });

  it("rejects malformed publishAt", () => {
    const res = articleSchema.safeParse({ ...baseArticle, publishAt: "05.12.2026 19:00" });
    expect(res.success).toBe(false);
  });

  it.each(["2026-02-30T10:00", "2026-13-01T10:00", "2026-12-05T24:00", "2026-12-05T19:60"])(
    "rejects out-of-range publishAt %s",
    (publishAt) => {
      const res = articleSchema.safeParse({ ...baseArticle, status: "scheduled", publishAt });
      expect(res.success).toBe(false);
      expect(res.error?.issues[0]?.path).toEqual(["publishAt"]);
    }
  );

  it("turns empty SEO fields into null", () => {
    const res = articleSchema.parse({ ...baseArticle, seoTitle: "  ", seoDescription: "" });
    expect(res.seoTitle).toBeNull();
    expect(res.seoDescription).toBeNull();
  });
});

describe("authorSchema", () => {
  const author = { slug: "ivan-petrov", name: "Иван Петров" };

  it("accepts https sameAs links", () => {
    const res = authorSchema.safeParse({ ...author, sameAs: ["https://vk.com/ivan"] });
    expect(res.success).toBe(true);
  });

  it.each(["http://vk.com/ivan", "javascript:alert(1)", "vk.com/ivan", "https://localhost"])(
    "rejects sameAs %s",
    (url) => {
      expect(authorSchema.safeParse({ ...author, sameAs: [url] }).success).toBe(false);
    }
  );

  it("limits sameAs to 10 links", () => {
    const sameAs = Array.from({ length: 11 }, (_, i) => `https://example.ru/${i}`);
    expect(authorSchema.safeParse({ ...author, sameAs }).success).toBe(false);
  });
});

describe("isValidLocalDateTime", () => {
  it.each(["2026-12-05T19:00", "2028-02-29T00:00", "2026-01-01T23:59"])("accepts %s", (v) => {
    expect(isValidLocalDateTime(v)).toBe(true);
  });

  it.each([
    "2026-02-29T10:00",
    "2026-04-31T10:00",
    "2026-00-10T10:00",
    "2026-12-32T10:00",
    "2026-12-05T25:00",
    "2026-12-05T10:99",
    "2026-12-05 10:00",
    "",
  ])("rejects %j", (v) => {
    expect(isValidLocalDateTime(v)).toBe(false);
  });
});
