import { describe, expect, it } from "vitest";
import { FetchBlockedError, isPublicAddress, safeFetch } from "./safe-fetch";

describe("isPublicAddress", () => {
  it("accepts public addresses", () => {
    expect(isPublicAddress("93.184.216.34")).toBe(true);
    expect(isPublicAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(true);
  });

  it("rejects loopback, private, link-local and mapped private addresses", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.20.0.5", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd12::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });

  it("rejects anything that is not an IP", () => {
    expect(isPublicAddress("localhost")).toBe(false);
  });
});

describe("safeFetch", () => {
  it("refuses private hosts and non-http schemes before any request", async () => {
    await expect(safeFetch("http://127.0.0.1:5432/", { timeoutMs: 1000, maxBytes: 10 })).rejects.toBeInstanceOf(FetchBlockedError);
    await expect(safeFetch("http://postgres.railway.internal/", { timeoutMs: 1000, maxBytes: 10 })).rejects.toBeInstanceOf(
      FetchBlockedError,
    );
    await expect(safeFetch("file:///etc/passwd", { timeoutMs: 1000, maxBytes: 10 })).rejects.toBeInstanceOf(FetchBlockedError);
  });
});
