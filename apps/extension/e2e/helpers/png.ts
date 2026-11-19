/**
 * A PNG reader, small enough to read and strict enough to fail.
 *
 * ## Why this exists rather than a dependency
 *
 * The requirement it serves says an icon **in the shipped family** SHALL carry the accent the token
 * layer declares, and **that word is literal**: a check that read the file's size, or its existence,
 * or its byte length, would be satisfied by any 4 KB file at all. So the pixels have to be read.
 *
 * `pngjs` would do it, and it would be a production-shaped dependency in a disposable test tier for
 * one question. **The reader is therefore written here, supported narrowly, and loud about what it
 * does not support**: 8-bit RGBA, non-interlaced - which is what `System.Drawing` emitted for this
 * family, measured 2026-11-20. **Anything else throws**, because a reader that returned its input
 * for a format it did not understand would report a mark it never saw.
 *
 * ## The one thing worth knowing before changing it
 *
 * **A PNG's image data is filtered, not raw.** Every scanline carries a leading filter byte and its
 * bytes are encoded relative to the pixel to the left, the pixel above, or both. Passing the
 * inflated bytes straight to a caller would hand back plausible-looking colour values that are
 * wrong, and wrong in a way that looks like a real reading - so all five filters are implemented
 * rather than only the one this family happens to use.
 *
 * @module
 */

import { inflateSync } from "node:zlib";

/** A decoded raster: every pixel as unpremultiplied RGBA, row-major. */
export interface DecodedImage {
  readonly width: number;
  readonly height: number;
  /** `width * height * 4` bytes, `[r, g, b, a]` per pixel. */
  readonly pixels: Buffer;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Decode a PNG's pixels.
 *
 * @param bytes the whole file, as read from disk.
 * @param what a name used in error messages, so a failure says which icon it was reading.
 */
export function decodePng(bytes: Buffer, what: string): DecodedImage {
  if (!bytes.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error(`${what}: not a PNG (signature does not match)`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let seenHeader = false;
  const dataChunks: Buffer[] = [];

  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data.readUInt8(8);
      const colourType = data.readUInt8(9);
      const interlace = data.readUInt8(12);
      if (bitDepth !== 8 || colourType !== 6 || interlace !== 0) {
        throw new Error(
          `${what}: unsupported PNG (bit depth ${bitDepth}, colour type ${colourType}, interlace ${interlace}); this reader holds 8-bit RGBA, non-interlaced`,
        );
      }
      seenHeader = true;
    } else if (type === "IDAT") {
      dataChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (!seenHeader) throw new Error(`${what}: no IHDR chunk`);
  if (dataChunks.length === 0) throw new Error(`${what}: no IDAT chunk`);
  if (width === 0 || height === 0) throw new Error(`${what}: IHDR declares a zero dimension`);

  const raw = inflateSync(Buffer.concat(dataChunks));
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const expected = height * (stride + 1);
  if (raw.length !== expected) {
    throw new Error(`${what}: inflated ${raw.length} bytes, expected ${expected}`);
  }

  const pixels = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y++) {
    const filter = raw.readUInt8(y * (stride + 1));
    const source = y * (stride + 1) + 1;
    const target = y * stride;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw.readUInt8(source + x);
      const left = x >= bytesPerPixel ? pixels.readUInt8(target + x - bytesPerPixel) : 0;
      const above = y > 0 ? pixels.readUInt8(target - stride + x) : 0;
      const aboveLeft =
        y > 0 && x >= bytesPerPixel ? pixels.readUInt8(target - stride + x - bytesPerPixel) : 0;

      let value: number;
      switch (filter) {
        case 0:
          value = rawByte;
          break;
        case 1:
          value = rawByte + left;
          break;
        case 2:
          value = rawByte + above;
          break;
        case 3:
          value = rawByte + ((left + above) >> 1);
          break;
        case 4:
          value = rawByte + paeth(left, above, aboveLeft);
          break;
        default:
          throw new Error(`${what}: unknown scanline filter ${filter} on row ${y}`);
      }
      pixels.writeUInt8(value & 0xff, target + x);
    }
  }

  return { width, height, pixels };
}

function paeth(left: number, above: number, aboveLeft: number): number {
  const estimate = left + above - aboveLeft;
  const toLeft = Math.abs(estimate - left);
  const toAbove = Math.abs(estimate - above);
  const toAboveLeft = Math.abs(estimate - aboveLeft);
  if (toLeft <= toAbove && toLeft <= toAboveLeft) return left;
  if (toAbove <= toAboveLeft) return above;
  return aboveLeft;
}

/** One distinct colour, as `r,g,b,a`, with the count of pixels carrying it. */
export interface ColourCount {
  readonly rgba: readonly [number, number, number, number];
  readonly count: number;
}

/** Every distinct pixel value in an image, most common first. */
export function distinctColours(image: DecodedImage): ColourCount[] {
  const counts = new Map<string, ColourCount>();
  for (let index = 0; index < image.pixels.length; index += 4) {
    const r = image.pixels.readUInt8(index);
    const g = image.pixels.readUInt8(index + 1);
    const b = image.pixels.readUInt8(index + 2);
    const a = image.pixels.readUInt8(index + 3);
    const key = `${r},${g},${b},${a}`;
    const existing = counts.get(key);
    if (existing) {
      counts.set(key, { rgba: existing.rgba, count: existing.count + 1 });
    } else {
      counts.set(key, { rgba: [r, g, b, a], count: 1 });
    }
  }
  return [...counts.values()].sort((left, right) => right.count - left.count);
}

/** The bounding box of every pixel whose alpha is non-zero. */
export interface OpaqueBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export function opaqueBounds(image: DecodedImage, what: string): OpaqueBounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.pixels.readUInt8((y * image.width + x) * 4 + 3) === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error(`${what}: every pixel is transparent`);
  return { minX, minY, maxX, maxY };
}
