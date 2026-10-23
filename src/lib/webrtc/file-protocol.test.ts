import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planChunks, reassembleChunks, sliceChunk } from "./file-chunks";
import { checksumsMatch } from "./file-checksum";
import {
  canTransition,
  decodeChunkFrame,
  encodeChunkFrame,
  parseControlMessage,
  sanitizeFileName,
} from "./file-protocol";

describe("sanitizeFileName", () => {
  it("strips path separators", () => {
    assert.equal(sanitizeFileName("../../etc/passwd"), "....etcpasswd");
  });

  it("falls back for unsafe names", () => {
    assert.equal(sanitizeFileName('bad<>name'), "download.bin");
  });
});

describe("control + chunk framing", () => {
  it("round-trips a chunk frame", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    const frame = encodeChunkFrame(id, 2, payload);
    const decoded = decodeChunkFrame(frame);
    assert.equal(decoded.transferId, id);
    assert.equal(decoded.chunkIndex, 2);
    assert.deepEqual([...decoded.payload], [1, 2, 3, 4, 5]);
  });

  it("rejects bad magic", () => {
    const buf = new ArrayBuffer(48);
    assert.throws(() => decodeChunkFrame(buf));
  });

  it("parses a valid offer and rejects bad size", () => {
    const offer = parseControlMessage(
      JSON.stringify({
        v: 1,
        type: "file-offer",
        transferId: "11111111-1111-4111-8111-111111111111",
        fileName: "notes.txt",
        mimeType: "text/plain",
        sizeBytes: 10,
        chunkSize: 4,
        totalChunks: 3,
        checksumSha256: "a".repeat(64),
      }),
    );
    assert.equal(offer.type, "file-offer");

    assert.throws(() =>
      parseControlMessage(
        JSON.stringify({
          v: 1,
          type: "file-offer",
          transferId: "11111111-1111-4111-8111-111111111111",
          fileName: "x",
          mimeType: "text/plain",
          sizeBytes: -1,
          chunkSize: 4,
          totalChunks: 1,
          checksumSha256: "a".repeat(64),
        }),
      ),
    );
  });
});

describe("chunk split/reassemble", () => {
  it("splits and reassembles", () => {
    const source = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const { totalChunks, sizes } = planChunks(source.byteLength, 4);
    assert.equal(totalChunks, 3);
    assert.deepEqual(sizes, [4, 4, 2]);
    const map = new Map<number, Uint8Array>();
    for (let i = 0; i < totalChunks; i += 1) {
      map.set(i, sliceChunk(source, i, 4));
    }
    const out = reassembleChunks(map, totalChunks, source.byteLength);
    assert.deepEqual([...out], [...source]);
  });

  it("fails on missing chunk", () => {
    const map = new Map<number, Uint8Array>([[0, new Uint8Array([1])]]);
    assert.throws(() => reassembleChunks(map, 2, 2));
  });

  it("fails on size mismatch", () => {
    const map = new Map<number, Uint8Array>([
      [0, new Uint8Array([1, 2])],
      [1, new Uint8Array([3])],
    ]);
    assert.throws(() => reassembleChunks(map, 2, 10));
  });
});

describe("transfer state machine", () => {
  it("allows offered → accepted → transferring → finalizing → completed", () => {
    assert.equal(canTransition("offered", "accepted"), true);
    assert.equal(canTransition("accepted", "transferring"), true);
    assert.equal(canTransition("transferring", "finalizing"), true);
    assert.equal(canTransition("finalizing", "completed"), true);
    assert.equal(canTransition("completed", "transferring"), false);
  });

  it("allows cancel/reject/fail from appropriate states", () => {
    assert.equal(canTransition("offered", "rejected"), true);
    assert.equal(canTransition("transferring", "cancelled"), true);
    assert.equal(canTransition("rejected", "accepted"), false);
  });
});

describe("checksum helper", () => {
  it("compares case-insensitively", () => {
    assert.equal(checksumsMatch("AbCd", "abcd"), true);
    assert.equal(checksumsMatch("aaaa", "bbbb"), false);
  });
});
