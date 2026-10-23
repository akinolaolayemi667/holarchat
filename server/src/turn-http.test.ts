import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, it } from "node:test";
import { SlidingWindowRateLimiter } from "./rate-limit.js";
import { createTurnCredentialsHandler, turnHttpClientKey } from "./turn-http.js";
import type { TurnCredentialProvider } from "./turn/types.js";

function mockReq(overrides: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  remoteAddress?: string;
}): IncomingMessage {
  return {
    method: overrides.method ?? "GET",
    url: overrides.url ?? "/turn-credentials",
    headers: overrides.headers ?? {},
    socket: { remoteAddress: overrides.remoteAddress ?? "127.0.0.1" },
  } as unknown as IncomingMessage;
}

function mockRes() {
  const headers = new Map<string, string>();
  let statusCode = 0;
  let body = "";
  const res = {
    setHeader(k: string, v: string) {
      headers.set(k.toLowerCase(), v);
    },
    writeHead(code: number) {
      statusCode = code;
    },
    end(payload?: string) {
      body = payload ?? "";
    },
  } as unknown as ServerResponse;
  return {
    res,
    headers,
    get status() {
      return statusCode;
    },
    get json() {
      return body ? JSON.parse(body) : null;
    },
  };
}

const fakeProvider: TurnCredentialProvider = {
  id: "static",
  isConfigured: () => true,
  async issue() {
    return {
      mode: "static",
      ttlSeconds: 3600,
      notice: "test",
      iceServers: [{ urls: "turn:t.example:3478", username: "u", credential: "p" }],
    };
  },
};

describe("turnHttpClientKey", () => {
  it("ignores X-Forwarded-For unless trustProxy", () => {
    const req = mockReq({
      headers: { "x-forwarded-for": "9.9.9.9" },
      remoteAddress: "10.0.0.1",
    });
    assert.equal(turnHttpClientKey(req, false), "ip:10.0.0.1");
    assert.equal(turnHttpClientKey(req, true), "xff:9.9.9.9");
  });
});

describe("createTurnCredentialsHandler", () => {
  it("denies production with no-store headers", async () => {
    const handler = createTurnCredentialsHandler({
      nodeEnv: "production",
      allowTurnCredentialsEndpoint: true,
      corsOrigin: "http://localhost:3000",
      trustProxy: false,
      turnProvider: fakeProvider,
      rateLimiter: new SlidingWindowRateLimiter(60_000, 20, 64),
      retryAfterSeconds: 60,
    });
    const out = mockRes();
    const handled = await handler(mockReq({}), out.res);
    assert.equal(handled, true);
    assert.equal(out.status, 403);
    assert.equal(out.json.code, "TURN_CREDENTIALS_DISABLED");
    assert.match(out.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(out.headers.get("pragma"), "no-cache");
  });

  it("denies when development opt-in gates are off", async () => {
    const handler = createTurnCredentialsHandler({
      nodeEnv: "development",
      allowTurnCredentialsEndpoint: false,
      corsOrigin: "http://localhost:3000",
      trustProxy: false,
      turnProvider: fakeProvider,
      rateLimiter: new SlidingWindowRateLimiter(60_000, 20, 64),
      retryAfterSeconds: 60,
    });
    const out = mockRes();
    await handler(mockReq({}), out.res);
    assert.equal(out.status, 403);
    assert.match(out.headers.get("cache-control") ?? "", /no-store/);
  });

  it("returns 429 after the configured HTTP rate limit", async () => {
    const limiter = new SlidingWindowRateLimiter(60_000, 2, 64);
    const handler = createTurnCredentialsHandler({
      nodeEnv: "development",
      allowTurnCredentialsEndpoint: true,
      corsOrigin: "http://localhost:3000",
      trustProxy: false,
      turnProvider: fakeProvider,
      rateLimiter: limiter,
      retryAfterSeconds: 60,
    });

    const first = mockRes();
    await handler(mockReq({}), first.res);
    assert.equal(first.status, 200);
    assert.match(first.headers.get("cache-control") ?? "", /no-store/);

    const second = mockRes();
    await handler(mockReq({}), second.res);
    assert.equal(second.status, 200);

    const third = mockRes();
    await handler(mockReq({}), third.res);
    assert.equal(third.status, 429);
    assert.equal(third.json.code, "RATE_LIMITED");
    assert.equal(third.headers.get("retry-after"), "60");
    assert.match(third.headers.get("cache-control") ?? "", /no-store/);
  });

  it("returns sanitized 502 when provider fails", async () => {
    const failing: TurnCredentialProvider = {
      id: "twilio-nts",
      isConfigured: () => true,
      async issue() {
        throw Object.assign(new Error("Twilio NTS token request failed with status 401."), {
          name: "TwilioNtsError",
          code: "UPSTREAM_HTTP",
        });
      },
    };
    const handler = createTurnCredentialsHandler({
      nodeEnv: "development",
      allowTurnCredentialsEndpoint: true,
      corsOrigin: "http://localhost:3000",
      trustProxy: false,
      turnProvider: failing,
      rateLimiter: new SlidingWindowRateLimiter(60_000, 20, 64),
      retryAfterSeconds: 60,
    });
    const out = mockRes();
    await handler(mockReq({}), out.res);
    assert.equal(out.status, 502);
    assert.equal(out.json.code, "TURN_ISSUE_FAILED");
    assert.equal(out.json.message, "Failed to issue TURN credentials.");
    assert.doesNotMatch(JSON.stringify(out.json), /401|secretvalue|tmp-pass|Authorization/i);
    assert.equal(out.json.message, "Failed to issue TURN credentials.");
  });
});
