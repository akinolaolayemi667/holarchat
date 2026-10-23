import { totalChunksForSize } from "./file-protocol";

export function planChunks(
  sizeBytes: number,
  chunkSize: number,
): { totalChunks: number; sizes: number[] } {
  if (chunkSize < 1) throw new Error("chunkSize must be >= 1");
  if (sizeBytes < 0) throw new Error("sizeBytes must be >= 0");
  const totalChunks = totalChunksForSize(sizeBytes, chunkSize);
  const sizes: number[] = [];
  let remaining = sizeBytes;
  for (let i = 0; i < totalChunks; i += 1) {
    const len = Math.min(chunkSize, remaining);
    sizes.push(len);
    remaining -= len;
  }
  return { totalChunks, sizes };
}

export function sliceChunk(
  source: Uint8Array,
  chunkIndex: number,
  chunkSize: number,
): Uint8Array {
  const start = chunkIndex * chunkSize;
  const end = Math.min(start + chunkSize, source.byteLength);
  if (start > source.byteLength) {
    throw new Error("chunkIndex out of range");
  }
  return source.subarray(start, end);
}

/** Reassemble ordered chunks into a single buffer. Missing indexes throw. */
export function reassembleChunks(
  chunks: Map<number, Uint8Array>,
  totalChunks: number,
  expectedSize: number,
): Uint8Array {
  if (chunks.size !== totalChunks) {
    throw new Error(`Expected ${totalChunks} chunks, got ${chunks.size}.`);
  }
  let total = 0;
  for (let i = 0; i < totalChunks; i += 1) {
    const part = chunks.get(i);
    if (!part) throw new Error(`Missing chunk ${i}.`);
    total += part.byteLength;
  }
  if (total !== expectedSize) {
    throw new Error(`Reassembled size ${total} !== expected ${expectedSize}.`);
  }
  const out = new Uint8Array(expectedSize);
  let offset = 0;
  for (let i = 0; i < totalChunks; i += 1) {
    const part = chunks.get(i)!;
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}
