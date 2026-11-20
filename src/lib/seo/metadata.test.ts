import { afterEach, describe, expect, it, vi } from "vitest";
import { SITE_NAME, absoluteUrl, buildMetadata, getSiteUrl } from "./metadata";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("absoluteUrl", () => {
  it("joins the site URL and path", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://piramida-billiard-74.ru");
    expect(absoluteUrl("/menu")).toBe("https://piramida-billiard-74.ru/menu");
  });

  it("strips trailing slashes from the env value", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://piramida-billiard-74.ru//");
    expect(getSiteUrl()).toBe("https://piramida-billiard-74.ru");
    expect(absoluteUrl("/menu")).toBe("https://piramida-billiard-74.ru/menu");
  });

  it("adds a leading slash and defaults to root", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://x.ru");
    expect(absoluteUrl("menu")).toBe("https://x.ru/menu");
    expect(absoluteUrl()).toBe("https://x.ru/");
  });

  it("returns absolute URLs unchanged", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://x.ru");
    expect(absoluteUrl("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
  });

  it("falls back to localhost when env is empty", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(absoluteUrl("/menu")).toBe("http://localhost:3000/menu");
  });
});

describe("buildMetadata", () => {
  it("sets canonical, OG and twitter with absolute URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://x.ru/");
    const m = buildMetadata({
      title: "Меню",
      description: "Описание",
      path: "/menu",
      image: "/images/og.png",
    });
    expect(m.title).toBe("Меню");
    expect(m.alternates?.canonical).toBe("https://x.ru/menu");
    expect(m.robots).toBeUndefined();
    expect(m.openGraph).toMatchObject({
      url: "https://x.ru/menu",
      siteName: SITE_NAME,
      locale: "ru_RU",
      title: "Меню",
      description: "Описание",
      images: [{ url: "https://x.ru/images/og.png" }],
    });
    expect(m.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["https://x.ru/images/og.png"],
    });
  });

  it("disables indexing when noindex is set", () => {
    const m = buildMetadata({ title: "Черновик", path: "/x", noindex: true });
    expect(m.robots).toEqual({ index: false, follow: false });
  });

  it("handles absolute titles and omits images when none given", () => {
    const m = buildMetadata({ title: { absolute: "Пирамида" }, path: "/" });
    expect(m.title).toEqual({ absolute: "Пирамида" });
    expect(m.openGraph?.title).toBe("Пирамида");
    expect(m.openGraph).not.toHaveProperty("images");
    expect(m.twitter).toMatchObject({ card: "summary", title: "Пирамида" });
    expect(m.description).toBeTruthy();
  });
});
