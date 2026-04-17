export function computeTextsVersion(texts: string[]): string {
  // Deterministic, fast hash (FNV-1a 32-bit) over joined texts.
  // Not cryptographic; used only for "same content" checks.
  let hash = 0x811c9dc5;
  const input = texts.join("\n");

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
