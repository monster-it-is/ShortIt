import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { classifyResolveFailure, getApiErrorMessage, getShortUrl, normalizeClicks, toUserLink } from "./api";

const axiosError = (status?: number): AxiosError => {
  const error = new AxiosError("Request failed");
  if (status !== undefined) {
    error.response = {
      status,
      data: { message: "failed" },
      statusText: "Error",
      headers: {},
      config: {} as never,
    };
  }
  return error;
};

describe("normalizeClicks", () => {
  it("keeps finite non-negative counts and treats invalid values as zero", () => {
    expect(normalizeClicks(0)).toBe(0);
    expect(normalizeClicks(4)).toBe(4);
    expect(normalizeClicks(2.8)).toBe(2);
    expect(normalizeClicks(-1)).toBe(0);
    expect(normalizeClicks(Number.NaN)).toBe(0);
    expect(normalizeClicks(undefined)).toBe(0);
  });
});

describe("toUserLink", () => {
  it("normalizes missing click counts", () => {
    expect(
      toUserLink({
        id: "1",
        title: "Docs",
        slug: "docs",
        url: "https://example.com",
        clicks: Number.NaN,
      }).clicks
    ).toBe(0);
  });
});

describe("getShortUrl", () => {
  it("builds a public URL from the current origin", () => {
    expect(getShortUrl("docs", "http://localhost:5173")).toBe("http://localhost:5173/docs");
    expect(getShortUrl("docs", "http://localhost:5173/")).toBe("http://localhost:5173/docs");
  });
});

describe("classifyResolveFailure", () => {
  it("distinguishes not-found, network, invalid, and server failures", () => {
    expect(classifyResolveFailure(axiosError(404))).toBe("not-found");
    expect(classifyResolveFailure(axiosError())).toBe("network");
    expect(classifyResolveFailure(axiosError(400))).toBe("invalid");
    expect(classifyResolveFailure(axiosError(500))).toBe("server");
    expect(classifyResolveFailure(new Error("boom"))).toBe("server");
  });
});

describe("getApiErrorMessage", () => {
  it("explains timeouts and unreachable APIs without an HTTP response", () => {
    const timeout = new AxiosError("timeout of 90000ms exceeded", "ECONNABORTED");
    expect(getApiErrorMessage(timeout)).toMatch(/cold start/i);

    const network = new AxiosError("Network Error");
    expect(getApiErrorMessage(network)).toMatch(/Unable to reach the server/);
  });
});
