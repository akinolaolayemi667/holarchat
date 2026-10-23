import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { FileTransferEngine } from "./file-transfer-engine";
import { encodeChunkFrame, encodeControlMessage, PROTOCOL_VERSION } from "./file-protocol";
import { sha256Hex } from "./file-checksum";

function makePair(opts?: {
  bufferedHigh?: number;
  transferTimeoutMs?: number;
  maxFileSizeBytes?: number;
}) {
  let buffered = 0;
  const lowHandlers: Array<() => void> = [];
  const aInbox: Array<string | ArrayBuffer> = [];
  const bInbox: Array<string | ArrayBuffer> = [];

  const a = new FileTransferEngine({
    bufferedHigh: opts?.bufferedHigh ?? 1024 * 1024,
    bufferedLow: 256,
    transferTimeoutMs: opts?.transferTimeoutMs ?? 120_000,
    maxFileSizeBytes: opts?.maxFileSizeBytes ?? 50 * 1024 * 1024,
    chunkSizeBytes: 4,
    send: (data) => bInbox.push(data),
    getBufferedAmount: () => buffered,
    setBufferedAmountLowThreshold: () => undefined,
    onBufferedAmountLow: (cb) => {
      lowHandlers.push(cb);
      return () => undefined;
    },
  });

  const b = new FileTransferEngine({
    bufferedHigh: opts?.bufferedHigh ?? 1024 * 1024,
    bufferedLow: 256,
    transferTimeoutMs: opts?.transferTimeoutMs ?? 120_000,
    maxFileSizeBytes: opts?.maxFileSizeBytes ?? 50 * 1024 * 1024,
    chunkSizeBytes: 4,
    send: (data) => aInbox.push(data),
    getBufferedAmount: () => 0,
    setBufferedAmountLowThreshold: () => undefined,
    onBufferedAmountLow: () => () => undefined,
  });

  const drain = async () => {
    // Alternate drain until both inboxes settle (async checksum needs a few ticks).
    for (let i = 0; i < 80; i += 1) {
      let progressed = false;
      while (bInbox.length) {
        b.handleMessage(bInbox.shift()!);
        progressed = true;
      }
      while (aInbox.length) {
        a.handleMessage(aInbox.shift()!);
        progressed = true;
      }
      await new Promise((r) => setTimeout(r, 0));
      if (!progressed && !aInbox.length && !bInbox.length) {
        // Extra tick for async onRemoteComplete (SHA-256).
        await new Promise((r) => setTimeout(r, 5));
        if (!aInbox.length && !bInbox.length) break;
      }
    }
  };

  return { a, b, aInbox, bInbox, drain, setBuffered: (n: number) => (buffered = n), lowHandlers };
}

function fakeFile(name: string, bytes: Uint8Array, type = "application/octet-stream"): File {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return new File([ab], name, { type });
}

describe("FileTransferEngine happy path", () => {
  it("transfers bytes with checksum verification", async () => {
    const { a, b, drain } = makePair();
    try {
      const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7]);
      const id = await a.offerFile(fakeFile("notes.txt", payload, "text/plain"));
      await drain();

      const offered = b.list().find((t) => t.transferId === id);
      assert.ok(offered);
      assert.equal(offered!.phase, "offered");
      b.accept(id);
      await drain();

      const doneB = b.list().find((t) => t.transferId === id);
      const doneA = a.list().find((t) => t.transferId === id);
      assert.equal(doneB?.phase, "completed");
      assert.equal(doneA?.phase, "completed");
      assert.ok(doneB?.objectUrl);
    } finally {
      a.dispose();
      b.dispose();
    }
  });
});

describe("rejection and cancellation", () => {
  it("rejects an offer", async () => {
    const { a, b, drain } = makePair();
    try {
      const id = await a.offerFile(fakeFile("x.bin", new Uint8Array([9, 9])));
      await drain();
      b.reject(id, "no thanks");
      await drain();
      assert.equal(a.list()[0]?.phase, "rejected");
      assert.equal(b.list()[0]?.phase, "rejected");
    } finally {
      a.dispose();
      b.dispose();
    }
  });

  it("cancels mid-offer", async () => {
    const { a, b, drain } = makePair();
    try {
      const id = await a.offerFile(fakeFile("x.bin", new Uint8Array([1])));
      await drain();
      a.cancel(id);
      await drain();
      assert.equal(a.list()[0]?.phase, "cancelled");
      assert.equal(b.list()[0]?.phase, "cancelled");
    } finally {
      a.dispose();
      b.dispose();
    }
  });
});

describe("limits and checksum failure", () => {
  it("rejects oversized local files", async () => {
    const { a } = makePair({ maxFileSizeBytes: 4 });
    try {
      await assert.rejects(
        () => a.offerFile(fakeFile("big.bin", new Uint8Array([1, 2, 3, 4, 5]))),
        /exceeds max size/,
      );
    } finally {
      a.dispose();
    }
  });

  it("fails on checksum mismatch", async () => {
    const { a, b, drain } = makePair();
    try {
      const payload = new Uint8Array([1, 2, 3, 4]);
      const id = await a.offerFile(fakeFile("x.bin", payload));
      await drain();
      b.accept(id);
      await drain();

      const badId = crypto.randomUUID();
      const realHash = await sha256Hex(payload);
      b.handleMessage(
        encodeControlMessage({
          v: PROTOCOL_VERSION,
          type: "file-offer",
          transferId: badId,
          fileName: "tamper.bin",
          mimeType: "application/octet-stream",
          sizeBytes: 4,
          chunkSize: 4,
          totalChunks: 1,
          checksumSha256: realHash,
        }),
      );
      b.accept(badId);
      b.handleMessage(encodeChunkFrame(badId, 0, new Uint8Array([9, 9, 9, 9])));
      b.handleMessage(
        encodeControlMessage({
          v: PROTOCOL_VERSION,
          type: "file-complete",
          transferId: badId,
        }),
      );
      await drain();
      const failed = b.list().find((t) => t.transferId === badId);
      assert.equal(failed?.phase, "failed");
      assert.match(failed?.errorMessage ?? "", /CHECKSUM/);
    } finally {
      a.dispose();
      b.dispose();
    }
  });
});

describe("backpressure", () => {
  it("pauses when bufferedAmount is high and resumes on low", async () => {
    const { a, b, drain, setBuffered, lowHandlers } = makePair({ bufferedHigh: 10 });
    try {
      const payload = new Uint8Array(20); // 5 chunks of size 4
      const id = await a.offerFile(fakeFile("buf.bin", payload));
      await drain();
      setBuffered(100);
      b.accept(id);
      await drain();
      assert.equal(a.isWaitingForBuffer(id), true);
      assert.ok((a.list()[0]?.chunksCompleted ?? 0) < 5);

      setBuffered(0);
      lowHandlers.forEach((h) => h());
      await drain();
      assert.equal(a.list()[0]?.phase, "completed");
      assert.equal(b.list()[0]?.phase, "completed");
    } finally {
      a.dispose();
      b.dispose();
    }
  });
});

describe("timeouts and invalid states", () => {
  it("times out a stalled offer", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    const { a } = makePair({ transferTimeoutMs: 1000 });
    try {
      await a.offerFile(fakeFile("slow.bin", new Uint8Array([1])));
      mock.timers.tick(1000);
      assert.equal(a.list()[0]?.phase, "failed");
      assert.match(a.list()[0]?.errorMessage ?? "", /TIMEOUT/);
    } finally {
      a.dispose();
      mock.timers.reset();
    }
  });

  it("rejects chunks in wrong phase", async () => {
    const { b } = makePair();
    try {
      const id = crypto.randomUUID();
      const hash = await sha256Hex(new Uint8Array([1, 2, 3, 4]));
      b.handleMessage(
        encodeControlMessage({
          v: PROTOCOL_VERSION,
          type: "file-offer",
          transferId: id,
          fileName: "x.bin",
          mimeType: "application/octet-stream",
          sizeBytes: 4,
          chunkSize: 4,
          totalChunks: 1,
          checksumSha256: hash,
        }),
      );
      assert.throws(() =>
        b.handleMessage(encodeChunkFrame(id, 0, new Uint8Array([1, 2, 3, 4]))),
      );
    } finally {
      b.dispose();
    }
  });

  it("rejects incorrect chunk size", async () => {
    const { b } = makePair();
    try {
      const id = crypto.randomUUID();
      const hash = await sha256Hex(new Uint8Array([1, 2, 3, 4]));
      b.handleMessage(
        encodeControlMessage({
          v: PROTOCOL_VERSION,
          type: "file-offer",
          transferId: id,
          fileName: "x.bin",
          mimeType: "application/octet-stream",
          sizeBytes: 4,
          chunkSize: 4,
          totalChunks: 1,
          checksumSha256: hash,
        }),
      );
      b.accept(id);
      assert.throws(() =>
        b.handleMessage(encodeChunkFrame(id, 0, new Uint8Array([1, 2]))),
      );
    } finally {
      b.dispose();
    }
  });
});
