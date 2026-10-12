export const MAX_FILE_BYTES = 128 * 1024 * 1024;

/** Fingerprint the selected local file; this does not upload it. */
export async function hashFile(file: File): Promise<string> {
  if (!file || file.size === 0) throw new Error('Select a non-empty file to calculate its SHA-256 fingerprint.');
  if (file.size > MAX_FILE_BYTES) throw new Error('File must be at most 128 MiB for local hashing.');
  if (!globalThis.crypto?.subtle) {
    throw new Error('Local SHA-256 hashing requires Web Crypto in a secure browser context (HTTPS or localhost).');
  }
  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    throw new Error('Could not read this file for local hashing. Select it again.');
  }
  let digest: ArrayBuffer;
  try {
    digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  } catch {
    throw new Error('SHA-256 calculation failed in this browser. The fingerprint is unavailable; select the file again.');
  }
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
