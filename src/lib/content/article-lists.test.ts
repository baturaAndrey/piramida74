import { describe, expect, it } from "vitest";
import { excludeShown } from "./article-lists";

const items = (...ids: string[]) => ids.map((id) => ({ id }));

describe("excludeShown", () => {
  it("drops items already shown and keeps the original order", () => {
    expect(excludeShown(items("a", "b", "c", "d"), items("b", "d"), 4)).toEqual(items("a", "c"));
  });

  it("returns an empty list when everything was already shown", () => {
    expect(excludeShown(items("a"), items("a"), 4)).toEqual([]);
  });

  it("trims the result to the limit after filtering", () => {
    expect(excludeShown(items("a", "b", "c", "d", "e"), items("a"), 3)).toEqual(
      items("b", "c", "d")
    );
  });

  it("treats a negative limit as zero", () => {
    expect(excludeShown(items("a"), [], -1)).toEqual([]);
  });
});
