import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { legacyRedirects } from "./legacy-redirects";

const SITE_ROUTES_DIR = path.resolve(__dirname, "../../app/(site)");

/** Маршрут существует, если это `/` или есть `src/app/(site)/<path>/page.tsx`. */
function routeExists(route: string): boolean {
  if (route === "/") return true;
  return existsSync(path.join(SITE_ROUTES_DIR, route.replace(/^\//, ""), "page.tsx"));
}

describe("legacyRedirects", () => {
  it("has absolute sources and permanent status", () => {
    for (const r of legacyRedirects) {
      expect(r.source.startsWith("/")).toBe(true);
      expect(r.statusCode).toBe(301);
    }
  });

  it("points only to existing routes", () => {
    for (const r of legacyRedirects) {
      expect(routeExists(r.destination), r.destination).toBe(true);
    }
  });

  it("has no duplicate sources", () => {
    const sources = legacyRedirects.map((r) => r.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("has no loops", () => {
    const sources = new Set(legacyRedirects.map((r) => r.source));
    for (const r of legacyRedirects) {
      expect(r.source).not.toBe(r.destination);
      expect(sources.has(r.destination)).toBe(false);
    }
  });
});
