import type { MilestoneIndex } from '../../../shared/api';
import { MAX_FILE_BYTES } from './hashing';

export const CONCEPT_FILE_ACCEPT = '.png,.jpg,.jpeg,.jpe,.jfif,.webp,.gif,.svg';
export const VIDEO_FILE_ACCEPT = '.mp4,video/mp4';

const imageTypes: Record<string, readonly string[]> = {
  png: ['image/png'],
  jpg: ['image/jpeg', 'image/jpg', 'image/pjpeg'],
  jpeg: ['image/jpeg', 'image/jpg', 'image/pjpeg'],
  jpe: ['image/jpeg', 'image/jpg', 'image/pjpeg'],
  jfif: ['image/jpeg', 'image/jpg', 'image/pjpeg'],
  webp: ['image/webp'],
  gif: ['image/gif'],
  svg: ['image/svg+xml', 'application/xml', 'text/xml'],
};
const mp4Brands = new Set(['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'iso7', 'iso8', 'iso9', 'mp41', 'mp42', 'avc1', 'av01', 'dash', 'M4V ', 'MSNV']);

const ascii = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
const uint32 = (bytes: Uint8Array, offset: number) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);
const uint16 = (bytes: Uint8Array, offset: number) => (bytes[offset] << 8) | bytes[offset + 1];
const little16 = (bytes: Uint8Array, offset: number) => bytes[offset] | (bytes[offset + 1] << 8);

function validPng(bytes: Uint8Array): boolean {
  if (bytes.length < 45 || ascii(bytes, 1, 3) !== 'PNG' || bytes[0] !== 137 || ascii(bytes, 4, 4) !== '\r\n\x1a\n') return false;
  let offset = 8;
  let imageData = false;
  while (offset + 12 <= bytes.length) {
    const size = uint32(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    const end = offset + size + 12;
    if (end > bytes.length) return false;
    if (offset === 8 && (type !== 'IHDR' || size !== 13 || !uint32(bytes, offset + 8) || !uint32(bytes, offset + 12))) return false;
    if (type === 'IDAT' && size > 0) imageData = true;
    if (type === 'IEND') return size === 0 && end === bytes.length && imageData;
    offset = end;
  }
  return false;
}

function validJpeg(bytes: Uint8Array): boolean {
  if (bytes.length < 20 || bytes[0] !== 255 || bytes[1] !== 216) return false;
  let offset = 2;
  let frame = false;
  while (offset + 4 < bytes.length) {
    if (bytes[offset++] !== 255) return false;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    const size = uint16(bytes, offset);
    if (size < 2 || offset + size > bytes.length - 2) return false;
    if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
      if (size < 8 || !uint16(bytes, offset + 3) || !uint16(bytes, offset + 5)) return false;
      frame = true;
    }
    if (marker === 218) {
      if (!frame || size < 6) return false;
      for (let scan = offset + size; scan + 1 < bytes.length; scan++) {
        if (bytes[scan] === 255 && bytes[scan + 1] === 217) return scan > offset + size;
      }
      return false;
    }
    offset += size;
  }
  return false;
}

function validGif(bytes: Uint8Array): boolean {
  if (bytes.length < 14 || !['GIF87a', 'GIF89a'].includes(ascii(bytes, 0, 6)) || !little16(bytes, 6) || !little16(bytes, 8)) return false;
  let offset = 13 + ((bytes[10] & 128) ? 3 * 2 ** ((bytes[10] & 7) + 1) : 0);
  let image = false;
  while (offset < bytes.length) {
    const marker = bytes[offset++];
    if (marker === 59) return image && offset === bytes.length;
    if (marker === 33) offset++; // Extension label; the remaining data is sub-blocks.
    else if (marker === 44) {
      if (offset + 9 >= bytes.length || !little16(bytes, offset + 4) || !little16(bytes, offset + 6)) return false;
      const packed = bytes[offset + 8];
      offset += 9 + ((packed & 128) ? 3 * 2 ** ((packed & 7) + 1) : 0);
      if (bytes[offset] < 2 || bytes[offset] > 8) return false;
      offset++;
      image = true;
    } else return false;
    let size: number;
    let blockData = false;
    do {
      if (offset >= bytes.length) return false;
      size = bytes[offset++];
      if (size) blockData = true;
      offset += size;
      if (offset > bytes.length) return false;
    } while (size);
    if (marker === 44 && !blockData) return false;
  }
  return false;
}

function validWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 25 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 !== bytes.length) return false;
  let offset = 12;
  let image = false;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const end = offset + 8 + size + (size % 2);
    if (end > bytes.length) return false;
    if (type === 'VP8 ' && size >= 10 && ascii(bytes, offset + 11, 3) === '\x9d\x01\x2a') image = true;
    if (type === 'VP8L' && size >= 5 && bytes[offset + 8] === 47) image = true;
    if (type === 'ANMF' && size >= 24) image = true;
    offset = end;
  }
  return image && offset === bytes.length;
}

type Box = { type: string; start: number; end: number };
function boxes(bytes: Uint8Array, start = 0, end = bytes.length): Box[] {
  const result: Box[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = start;
  while (offset < end) {
    if (offset + 8 > end || result.length >= 4096) throw new Error('Invalid MP4 box.');
    let size = view.getUint32(offset);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) throw new Error('Truncated MP4 box.');
      const extended = view.getBigUint64(offset + 8);
      if (extended > BigInt(end - offset)) throw new Error('Truncated MP4 box.');
      size = Number(extended);
      header = 16;
    } else if (size === 0) size = end - offset;
    if (size < header || offset + size > end) throw new Error('Truncated MP4 box.');
    result.push({ type: ascii(bytes, offset + 4, 4), start: offset + header, end: offset + size });
    offset += size;
  }
  return result;
}

function validMp4(bytes: Uint8Array): boolean {
  try {
    const top = boxes(bytes);
    const ftyp = top.find((box) => box.type === 'ftyp');
    const moov = top.find((box) => box.type === 'moov');
    if (!ftyp || !moov || ftyp.end - ftyp.start < 8 || (ftyp.end - ftyp.start) % 4 || !top.some((box) => box.type === 'mdat' && box.end > box.start)) return false;
    const brands = [ascii(bytes, ftyp.start, 4)];
    for (let offset = ftyp.start + 8; offset < ftyp.end; offset += 4) brands.push(ascii(bytes, offset, 4));
    if (!brands.some((brand) => mp4Brands.has(brand))) return false;
    return boxes(bytes, moov.start, moov.end).filter((box) => box.type === 'trak').some((track) =>
      boxes(bytes, track.start, track.end).filter((box) => box.type === 'mdia').some((media) =>
        boxes(bytes, media.start, media.end).some((handler) => handler.type === 'hdlr' && handler.end - handler.start >= 24 && ascii(bytes, handler.start + 8, 4) === 'vide')));
  } catch {
    return false;
  }
}

/** Checks the local file's format, not delivery URL contents or creative quality. */
export async function validateMilestoneFile(file: File, index: MilestoneIndex): Promise<void> {
  if (index !== 0 && index !== 1 && index !== 2) throw new Error('Unknown milestone. Refresh the deal and select the file again.');
  if (!file || file.size === 0) throw new Error('Select a non-empty delivery file.');
  if (file.size > MAX_FILE_BYTES) throw new Error('Delivery file must be at most 128 MiB.');
  const extension = file.name.match(/\.([^.]+)$/)?.[1].toLowerCase() ?? '';
  const image = index === 0;
  const formatError = image ? 'Concept requires a PNG, JPEG, WebP, GIF or SVG image.' : `${index === 1 ? 'Draft' : 'Final'} requires an MP4 video. Export your video as .mp4.`;
  const mimeTypes = image ? imageTypes[extension] : extension === 'mp4' ? ['video/mp4', 'application/mp4', 'video/x-m4v'] : undefined;
  if (!mimeTypes) throw new Error(formatError);
  const mime = file.type.toLowerCase().split(';')[0].trim();
  if (mime && mime !== 'application/octet-stream' && !mimeTypes.includes(mime)) throw new Error(`${formatError} The selected file reports a different format.`);
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    throw new Error('Could not read the delivery file. Select it again.');
  }
  let valid = false;
  if (!image) valid = validMp4(bytes);
  else if (extension === 'png') valid = validPng(bytes);
  else if (['jpg', 'jpeg', 'jpe', 'jfif'].includes(extension)) valid = validJpeg(bytes);
  else if (extension === 'gif') valid = validGif(bytes);
  else if (extension === 'webp') valid = validWebp(bytes);
  else if (extension === 'svg') {
    try {
      const xml = new DOMParser().parseFromString(new TextDecoder('utf-8', { fatal: true }).decode(bytes), 'image/svg+xml');
      valid = xml.documentElement.localName === 'svg' && xml.documentElement.namespaceURI === 'http://www.w3.org/2000/svg' && !xml.getElementsByTagName('parsererror').length;
    } catch { /* Invalid XML or unsupported UTF-8 encoding. */ }
  }
  if (!valid) throw new Error(`${formatError} Its contents do not match that format, or the file is incomplete. Export it again; renaming the extension is insufficient.`);
}
