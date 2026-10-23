import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  TwilioNtsError,
  clampTwilioTtl,
  createTwilioNtsProvider,
  inspectTwilioEnv,
  parseTwilioIceServers,
} from "./twilio-nts-provider.js";
import { resolveTurnProvider } from "./index.js";

const SAMPLE_ICE = [
  { urls: "stun:global.stun.twilio.com:3478" },
  {
    urls: "turn:global.turn.twilio.com:3478?transport=udp",
    username: "tmp-user",
    credential: "tmp-pass",
  },
];

describe("parseTwilioIceServers", () => {
  it("maps a valid Twilio ice_servers array", () => {
    const mapped = parseTwilioIceServers(SAMPLE_ICE);
    assert.equal(mapped.length, 2);
    assert.equal(mapped[0]?.urls, "stun:global.stun.twilio.com:3478");
    assert.equal(mapped[1]?.username, "tmp-user");
    assert.equal(mapped[1]?.credential, "tmp-pass");
  });

  it("rejects empty, missing, or malformed ice_servers", () => {
    assert.throws(() => parseTwilioIceServers([]), TwilioNtsError);
    assert.throws(() => parseTwilioIceServers(undefined), TwilioNtsError);
    assert.throws(() => parseTwilioIceServers([{ urls: "http://bad" }]), TwilioNtsError);
    assert.throws(() => parseTwilioIceServers([null]), TwilioNtsError);
  });
});

describe("clampTwilioTtl", () => {
  it("accepts 3600 and rejects out of range", () => {
    assert.equal(clampTwilioTtl(3600), 3600);
    assert.throws(() => clampTwilioTtl(30), /between/);
    assert.throws(() => clampTwilioTtl(100_000), /between/);
  });
});

describe("inspectTwilioEnv", () => {
  it("returns absent when unset", () => {
    assert.equal(inspectTwilioEnv({}), "absent");
  });

  it("fails clearly on partial configuration without echoing secrets", () => {
    assert.throws(
      () =>
        inspectTwilioEnv({
          TWILIO_ACCOUNT_SID: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          TWILIO_API_KEY: "SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        }),
      /Partial Twilio configuration/,
    );
    try {
      inspectTwilioEnv({
        TWILIO_ACCOUNT_SID: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        TWILIO_API_SECRET: "super-secret-value-do-not-leak",
      });
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(err instanceof Error);
      assert.doesNotMatch(err.message, /super-secret/);
    }
  });

  it("returns complete for valid trio", () => {
    assert.equal(
      inspectTwilioEnv({
        TWILIO_ACCOUNT_SID: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        TWILIO_API_KEY: "SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        TWILIO_API_SECRET: "secretvalue123456",
      }),
      "complete",
    );
  });
});

describe("createTwilioNtsProvider", () => {
  it("issues mapped ice servers from a mocked Twilio response", async () => {
    const fetchImpl = mock.fn(async () => {
      return new Response(
        JSON.stringify({
          ttl: "3600",
          ice_servers: SAMPLE_ICE,
          username: "tmp-user",
          password: "tmp-pass",
          account_sid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const provider = createTwilioNtsProvider({
      accountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      apiKey: "SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      apiSecret: "secretvalue123456",
      ttlSeconds: 3600,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const issued = await provider.issue("guest-1");
    assert.equal(issued.mode, "twilio-nts");
    assert.equal(issued.ttlSeconds, 3600);
    assert.equal(issued.iceServers.length, 2);
    assert.equal(fetchImpl.mock.callCount(), 1);
    const callArgs = fetchImpl.mock.calls[0]!.arguments as unknown as [string, RequestInit];
    const init = callArgs[1];
    assert.equal(init.method, "POST");
    assert.match(String(init.body), /Ttl=3600/);
  });

  it("fails safely on non-2xx without including credentials in the error", async () => {
    const fetchImpl = mock.fn(async () => {
      return new Response(JSON.stringify({ message: "Authenticate", code: 20003 }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    });
    const provider = createTwilioNtsProvider({
      accountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      apiKey: "SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      apiSecret: "secretvalue123456",
      ttlSeconds: 3600,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await assert.rejects(() => provider.issue("x"), (err: unknown) => {
      assert.ok(err instanceof TwilioNtsError);
      assert.doesNotMatch(err.message, /secretvalue|Authenticate|tmp-pass|Authorization/i);
      assert.match(err.message, /status 401/);
      return true;
    });
  });

  it("fails safely on timeout", async () => {
    const fetchImpl = mock.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });
    const provider = createTwilioNtsProvider({
      accountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      apiKey: "SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      apiSecret: "secretvalue123456",
      ttlSeconds: 3600,
      requestTimeoutMs: 20,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await assert.rejects(() => provider.issue("x"), /timed out/);
  });

  it("rejects empty ice_servers from Twilio", async () => {
    const fetchImpl = mock.fn(async () => {
      return new Response(JSON.stringify({ ttl: "3600", ice_servers: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const provider = createTwilioNtsProvider({
      accountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      apiKey: "SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      apiSecret: "secretvalue123456",
      ttlSeconds: 3600,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await assert.rejects(() => provider.issue("x"), /ice_servers/);
  });
});

describe("resolveTurnProvider with Twilio", () => {
  it("prefers Twilio when fully configured", () => {
    const p = resolveTurnProvider({
      TWILIO_ACCOUNT_SID: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      TWILIO_API_KEY: "SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      TWILIO_API_SECRET: "secretvalue123456",
      TURN_URLS: "turn:t.example:3478",
      TURN_HMAC_SECRET: "ignored-when-twilio-set",
      TURN_CREDENTIAL_TTL_SECONDS: "3600",
    });
    assert.equal(p?.id, "twilio-nts");
  });

  it("keeps coturn when Twilio is absent", () => {
    const p = resolveTurnProvider({
      TURN_URLS: "turn:t.example:3478",
      TURN_HMAC_SECRET: "secret",
      TURN_CREDENTIAL_TTL_SECONDS: "3600",
    });
    assert.equal(p?.id, "coturn-hmac");
  });

  it("throws on partial Twilio instead of falling back", () => {
    assert.throws(
      () =>
        resolveTurnProvider({
          TWILIO_ACCOUNT_SID: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          TURN_URLS: "turn:t.example:3478",
          TURN_HMAC_SECRET: "secret",
        }),
      /Partial Twilio/,
    );
  });
});
