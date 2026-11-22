import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidCronRequest } from "./cron-auth";

const SECRET = "test-cron-secret-value";

function request(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) headers.set("authorization", authorization);
  return new Request("http://localhost/api/cron/blog", { method: "POST", headers });
}

describe("isValidCronRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the exact bearer token", () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    expect(isValidCronRequest(request(`Bearer ${SECRET}`))).toBe(true);
  });

  it("rejects a wrong, partial or missing token", () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    expect(isValidCronRequest(request(`Bearer ${SECRET}x`))).toBe(false);
    expect(isValidCronRequest(request(`Bearer ${SECRET.slice(0, -1)}`))).toBe(false);
    expect(isValidCronRequest(request(SECRET))).toBe(false);
    expect(isValidCronRequest(request("Bearer "))).toBe(false);
    expect(isValidCronRequest(request())).toBe(false);
  });

  it("always rejects when CRON_SECRET is unset or blank", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(isValidCronRequest(request("Bearer "))).toBe(false);
    expect(isValidCronRequest(request())).toBe(false);
    vi.stubEnv("CRON_SECRET", "   ");
    expect(isValidCronRequest(request("Bearer    "))).toBe(false);
    delete process.env.CRON_SECRET;
    expect(isValidCronRequest(request("Bearer undefined"))).toBe(false);
  });
});
