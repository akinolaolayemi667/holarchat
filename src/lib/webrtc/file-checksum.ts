/** SHA-256 via Web Crypto — works in browsers and Node 20+ (global crypto.subtle). */

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API is not available.");
  }
  const bytes =
    data instanceof Uint8Array
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      : data;
  const digest = await subtle.digest("SHA-256", bytes as ArrayBuffer);
  return toHex(digest);
}

export async function sha256File(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  return sha256Hex(buffer);
}

export function checksumsMatch(expected: string, actual: string): boolean {
  return expected.toLowerCase() === actual.toLowerCase();
}
