import { describe, expect, it } from "vitest";
import { applySlugRedirect, blogPath, type RedirectRule } from "./redirects";

const rule = (fromPath: string, toPath: string): RedirectRule => ({ fromPath, toPath, code: 301 });
const sorted = (rules: RedirectRule[]) =>
  [...rules].sort((a, b) => a.fromPath.localeCompare(b.fromPath));

describe("applySlugRedirect", () => {
  it("adds a 301 from the old path to the new one", () => {
    expect(applySlugRedirect([], "/blog/a", "/blog/b")).toEqual([rule("/blog/a", "/blog/b")]);
  });

  it("does nothing for identical paths", () => {
    const rules = [rule("/blog/x", "/blog/y")];
    expect(applySlugRedirect(rules, "/blog/a", "/blog/a")).toEqual(rules);
  });

  it("collapses chains a→b→c into a→c, b→c", () => {
    const after = applySlugRedirect([rule("/blog/a", "/blog/b")], "/blog/b", "/blog/c");
    expect(sorted(after)).toEqual([rule("/blog/a", "/blog/c"), rule("/blog/b", "/blog/c")]);
  });

  it("returning to a previous slug removes the loop", () => {
    const first = applySlugRedirect([], "/blog/a", "/blog/b");
    const back = applySlugRedirect(first, "/blog/b", "/blog/a");
    expect(back).toEqual([rule("/blog/b", "/blog/a")]);
  });

  it("upserts an existing rule from the same path", () => {
    const after = applySlugRedirect([rule("/blog/a", "/blog/old")], "/blog/a", "/blog/new");
    expect(after).toEqual([rule("/blog/a", "/blog/new")]);
  });

  it("builds blog paths", () => {
    expect(blogPath("pravila")).toBe("/blog/pravila");
  });
});
