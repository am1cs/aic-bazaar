import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { File as NodeFile } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { hashFile, MAX_FILE_BYTES } from './hashing';

describe('local SHA-256 fingerprinting', () => {
  beforeEach(() => vi.stubGlobal('crypto', webcrypto));
  afterEach(() => vi.unstubAllGlobals());

  it('hashes actual file bytes to a 64-character lowercase SHA-256', async () => {
    const file = new NodeFile(['abc'], 'demo.txt') as unknown as File;
    await expect(hashFile(file)).resolves.toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('hashes UTF-8 bytes, including non-ASCII file contents', async () => {
    const file = new NodeFile(['я🙂'], 'unicode.txt') as unknown as File;
    const expected = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode('я🙂'));
    const hex = Array.from(new Uint8Array(expected), (byte) => byte.toString(16).padStart(2, '0')).join('');
    await expect(hashFile(file)).resolves.toBe(hex);
  });

  it('rejects an empty file', async () => {
    const file = new NodeFile([], 'empty.txt') as unknown as File;
    await expect(hashFile(file)).rejects.toThrow(/non-empty/);
  });

  it('rejects an oversized file before attempting to read it', async () => {
    const arrayBuffer = vi.fn();
    await expect(hashFile({ size: MAX_FILE_BYTES + 1, arrayBuffer } as unknown as File)).rejects.toThrow(/128 MiB/);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('accepts the exact size boundary without allocating a 128 MiB test file', async () => {
    const file = { size: MAX_FILE_BYTES, arrayBuffer: async () => new TextEncoder().encode('abc').buffer } as unknown as File;
    await expect(hashFile(file)).resolves.toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('reports unavailable Web Crypto truthfully', async () => {
    vi.stubGlobal('crypto', undefined);
    const file = new NodeFile(['abc'], 'demo.txt') as unknown as File;
    await expect(hashFile(file)).rejects.toThrow(/Web Crypto.*secure browser context/);
  });

  it('reports file reading and digest failures without returning a fingerprint', async () => {
    const readFailure = { size: 3, arrayBuffer: async () => { throw new Error('read failed'); } } as unknown as File;
    await expect(hashFile(readFailure)).rejects.toThrow(/Could not read/);
    vi.stubGlobal('crypto', { subtle: { digest: async () => { throw new Error('digest failed'); } } });
    const file = new NodeFile(['abc'], 'demo.txt') as unknown as File;
    await expect(hashFile(file)).rejects.toThrow(/fingerprint is unavailable/);
  });
});
