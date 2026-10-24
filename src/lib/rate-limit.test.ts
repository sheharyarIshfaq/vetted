import { describe, expect, it } from "vitest";
import { clientIp, rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  const limits = [
    { max: 2, windowMs: 60_000 },
    { max: 3, windowMs: 3_600_000 },
  ];

  it("lets requests through until a limit is reached, then says how long to wait", () => {
    expect(rateLimit("a", limits, 0)).toBeNull();
    expect(rateLimit("a", limits, 1_000)).toBeNull();
    expect(rateLimit("a", limits, 2_000)).toBe(58);
    expect(rateLimit("a", limits, 61_000)).toBeNull();
    expect(rateLimit("a", limits, 130_000)).toBe(3_470);
  });

  it("counts each client on its own", () => {
    expect(rateLimit("b", limits, 0)).toBeNull();
    expect(rateLimit("c", limits, 0)).toBeNull();
  });

  it("trusts the proxy's address, not one the client sent", () => {
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
