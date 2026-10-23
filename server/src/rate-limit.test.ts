import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SlidingWindowRateLimiter } from "./rate-limit.js";

describe("SlidingWindowRateLimiter", () => {
  it("allows events under the cap and blocks after", () => {
    const limiter = new SlidingWindowRateLimiter(1000, 3);
    const t0 = 1_000_000;
    assert.equal(limiter.allow("g1", t0), true);
    assert.equal(limiter.allow("g1", t0 + 1), true);
    assert.equal(limiter.allow("g1", t0 + 2), true);
    assert.equal(limiter.allow("g1", t0 + 3), false);
  });
});
