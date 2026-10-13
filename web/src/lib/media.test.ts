import { File as NodeFile, Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { validateMilestoneFile } from './media';
import { MAX_FILE_BYTES } from './hashing';

const file = (bytes: Uint8Array | string, name: string, type = '') => new NodeFile([bytes], name, { type }) as unknown as File;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4m8AAAAASUVORK5CYII=', 'base64');
const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
const jpeg = Buffer.from([255, 216, 255, 192, 0, 11, 8, 0, 1, 0, 1, 1, 1, 17, 0, 255, 218, 0, 8, 1, 1, 0, 0, 63, 0, 127, 255, 0, 255, 217]);
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1"/></svg>';

function box(type: string, ...parts: Uint8Array[]): Buffer {
  const payload = Buffer.concat(parts);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(payload.length + 8);
  header.write(type, 4, 'ascii');
  return Buffer.concat([header, payload]);
}
function mp4(handler = 'vide', brand = 'isom'): Buffer {
  const hdlr = Buffer.alloc(24);
  hdlr.write(handler, 8, 'ascii');
  return Buffer.concat([
    box('ftyp', Buffer.from(brand), Buffer.alloc(4), Buffer.from(brand)),
    box('moov', box('trak', box('mdia', box('hdlr', hdlr)))),
    box('mdat', Buffer.from([1, 2, 3])),
  ]);
}
const webp = (() => {
  const vp8l = Buffer.from([47, 0, 0, 0, 0, 1]);
  const chunk = Buffer.alloc(8);
  chunk.write('VP8L');
  chunk.writeUInt32LE(vp8l.length, 4);
  const payload = Buffer.concat([Buffer.from('WEBP'), chunk, vp8l]);
  const riff = Buffer.alloc(8);
  riff.write('RIFF');
  riff.writeUInt32LE(payload.length, 4);
  return Buffer.concat([riff, payload]);
})();

describe('local milestone delivery format checks', () => {
  it.each([
    ['storyboard.png', png, 'image/png'],
    ['storyboard.JPG', jpeg, 'image/jpeg'],
    ['storyboard.jpeg', jpeg, 'image/jpeg'],
    ['storyboard.jfif', jpeg, 'image/jpeg'],
    ['storyboard.gif', gif, 'image/gif'],
    ['storyboard.webp', webp, 'image/webp'],
    ['storyboard.svg', svg, 'image/svg+xml'],
  ])('accepts the supported Concept format %s', async (name, bytes, type) => {
    await expect(validateMilestoneFile(file(bytes, name, type), 0)).resolves.toBeUndefined();
  });

  it.each([0, 1, 2] as const)('accepts the existing real demo deliverable at index %i', async (index) => {
    const name = ['concept.svg', 'draft.mp4', 'final.mp4'][index];
    const bytes = readFileSync(join(process.cwd(), 'public', 'demo', name));
    await expect(validateMilestoneFile(file(bytes, name), index)).resolves.toBeUndefined();
  });

  it.each([1, 2] as const)('requires MP4 video at index %i, including for a replacement', async (index) => {
    await expect(validateMilestoneFile(file(mp4(), 'delivery.MP4', 'video/mp4'), index)).resolves.toBeUndefined();
    await expect(validateMilestoneFile(file(jpeg, 'photo.jpg', 'image/jpeg'), index)).rejects.toThrow(/requires an MP4 video/);
  });

  it('uses file contents with blank or generic OS MIME and accepts compatible MP4 brands', async () => {
    await expect(validateMilestoneFile(file(png, 'storyboard.png'), 0)).resolves.toBeUndefined();
    await expect(validateMilestoneFile(file(mp4('vide', 'mp42'), 'draft.mp4', 'application/octet-stream'), 1)).resolves.toBeUndefined();
  });

  it('accepts a JPEG with trailing metadata after its end-of-image marker', async () => {
    await expect(validateMilestoneFile(file(Buffer.concat([jpeg, Buffer.from('trailing metadata')]), 'storyboard.jpg'), 0)).resolves.toBeUndefined();
  });

  it('rejects unsupported extensions and contradictory MIME types', async () => {
    await expect(validateMilestoneFile(file(mp4(), 'storyboard.mp4'), 0)).rejects.toThrow(/Concept requires/);
    await expect(validateMilestoneFile(file(png, 'png'), 0)).rejects.toThrow(/Concept requires/);
    await expect(validateMilestoneFile(file(mp4(), 'draft.mov', 'video/quicktime'), 1)).rejects.toThrow(/Export your video as .mp4/);
    await expect(validateMilestoneFile(file(png, 'storyboard.png', 'image/jpeg'), 0)).rejects.toThrow(/reports a different format/);
  });

  it.each([jpeg, png, '<html><body>not a video</body></html>'])('rejects an image or HTML renamed to .mp4', async (bytes) => {
    await expect(validateMilestoneFile(file(bytes, 'renamed.mp4'), 2)).rejects.toThrow(/contents do not match.*renaming/i);
  });

  it('rejects audio-only MP4 and QuickTime-only containers renamed to MP4', async () => {
    await expect(validateMilestoneFile(file(mp4('soun'), 'audio.mp4'), 1)).rejects.toThrow(/contents do not match/);
    await expect(validateMilestoneFile(file(mp4('vide', 'qt  '), 'movie.mp4'), 1)).rejects.toThrow(/contents do not match/);
  });

  it('rejects incomplete MP4 metadata, missing media payload and corrupt box lengths', async () => {
    const truncated = mp4().subarray(0, -1);
    const noVideoMetadata = Buffer.concat([box('ftyp', Buffer.from('isom'), Buffer.alloc(4)), box('mdat', Buffer.from([1]))]);
    const noPayload = mp4().subarray(0, mp4().length - 11);
    const brokenLength = Buffer.from(mp4());
    brokenLength.writeUInt32BE(7, 0);
    for (const bytes of [truncated, noVideoMetadata, noPayload, brokenLength]) {
      await expect(validateMilestoneFile(file(bytes, 'broken.mp4'), 2)).rejects.toThrow(/incomplete/);
    }
  });

  it('accepts valid extended and trailing zero-size MP4 box headers', async () => {
    const extendedMdat = Buffer.alloc(17);
    extendedMdat.writeUInt32BE(1);
    extendedMdat.write('mdat', 4);
    extendedMdat.writeBigUInt64BE(17n, 8);
    extendedMdat[16] = 1;
    const head = mp4().subarray(0, mp4().length - 11);
    await expect(validateMilestoneFile(file(Buffer.concat([head, extendedMdat]), 'video.mp4'), 1)).resolves.toBeUndefined();
    const zeroSize = Buffer.from(mp4());
    zeroSize.writeUInt32BE(0, zeroSize.length - 11);
    await expect(validateMilestoneFile(file(zeroSize, 'video.mp4'), 1)).resolves.toBeUndefined();
  });

  it('rejects a truncated extended MP4 box without trusting its claimed size', async () => {
    const header = Buffer.alloc(16);
    header.writeUInt32BE(1);
    header.write('mdat', 4);
    header.writeBigUInt64BE(2n ** 60n, 8);
    await expect(validateMilestoneFile(file(header, 'bad.mp4'), 1)).rejects.toThrow(/incomplete/);
  });

  it.each([
    ['image.png', png.subarray(0, -1)],
    ['image.jpg', jpeg.subarray(0, -1)],
    ['image.gif', gif.subarray(0, -1)],
    ['image.webp', webp.subarray(0, -1)],
    ['image.svg', '<svg xmlns="http://www.w3.org/2000/svg"><rect></svg>'],
    ['image.svg', '<html xmlns="http://www.w3.org/1999/xhtml"/>'],
    ['image.svg', '<svg/>'],
    ['image.png', jpeg],
  ])('rejects corrupt, truncated or mismatched Concept %s', async (name, bytes) => {
    await expect(validateMilestoneFile(file(bytes, name), 0)).rejects.toThrow(/contents do not match/);
  });

  it('rejects missing and empty files and invalid milestone indexes', async () => {
    await expect(validateMilestoneFile(null as unknown as File, 0)).rejects.toThrow(/non-empty/);
    await expect(validateMilestoneFile(file('', 'empty.mp4'), 2)).rejects.toThrow(/non-empty/);
    await expect(validateMilestoneFile(file(png, 'image.png'), 3 as 0)).rejects.toThrow(/Unknown milestone/);
  });

  it('rejects files over 128 MiB before reading their contents', async () => {
    const arrayBuffer = vi.fn();
    await expect(validateMilestoneFile({ size: MAX_FILE_BYTES + 1, arrayBuffer } as unknown as File, 1)).rejects.toThrow(/at most 128 MiB/);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('does not reject the exact 128 MiB size boundary as oversized', async () => {
    const arrayBuffer = vi.fn(async () => { throw new Error('read error'); });
    await expect(validateMilestoneFile({ size: MAX_FILE_BYTES, name: 'draft.mp4', type: '', arrayBuffer } as unknown as File, 1)).rejects.toThrow(/Could not read/);
    expect(arrayBuffer).toHaveBeenCalledOnce();
  });

  it('reports file read failures without accepting an unverified file', async () => {
    const selected = { size: 10, name: 'draft.mp4', type: '', arrayBuffer: async () => { throw new Error('OS read error'); } } as unknown as File;
    await expect(validateMilestoneFile(selected, 1)).rejects.toThrow(/Could not read the delivery file/);
  });
});
