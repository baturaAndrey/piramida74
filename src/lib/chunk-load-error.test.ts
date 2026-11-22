import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "./chunk-load-error";

function namedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

describe("isChunkLoadError", () => {
  it("recognises ChunkLoadError by name (Turbopack, webpack)", () => {
    expect(isChunkLoadError(namedError("ChunkLoadError", "anything"))).toBe(true);
  });

  it.each([
    "Failed to load chunk /_next/static/chunks/0abc.js from module 1234: NetworkError",
    "Loading chunk 123 failed.",
    "Loading CSS chunk app-layout failed.",
    "Failed to fetch dynamically imported module: https://example.com/x.js",
    "error loading dynamically imported module: https://example.com/x.js",
    "Importing a module script failed.",
  ])("recognises %j by message", (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true);
  });

  it.each([
    new Error("Cannot read properties of undefined (reading 'map')"),
    new TypeError("x is not a function"),
    namedError("RangeError", "Invalid time value"),
  ])("treats render errors as non-chunk errors: %s", (error) => {
    expect(isChunkLoadError(error)).toBe(false);
  });

  it.each([null, undefined, "Loading chunk 1 failed.", { name: "ChunkLoadError" }])(
    "ignores non-Error values: %j",
    (value) => {
      expect(isChunkLoadError(value)).toBe(false);
    }
  );
});
