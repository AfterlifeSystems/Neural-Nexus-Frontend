// src/services/jpegExifGps.js
//
// Read the place a JPEG was taken from its EXIF GPS tags. Phone cameras write
// those tags when Location Services are on; a canvas snapshot never has them.
// This is only a JPEG APP1 reader — HEIC and PNG need a different parser, and
// those files fall through to the device's live position instead.

const JPEG_SOI = 0xffd8;
const JPEG_SOS = 0xffda;
const JPEG_EOI = 0xffd9;
const JPEG_APP1 = 0xffe1;

const TIFF_TYPE_ASCII = 2;
const TIFF_TYPE_LONG = 4;
const TIFF_TYPE_RATIONAL = 5;

const IFD0_GPS_POINTER = 0x8825;
const GPS_LATITUDE_REF = 0x0001;
const GPS_LATITUDE = 0x0002;
const GPS_LONGITUDE_REF = 0x0003;
const GPS_LONGITUDE = 0x0004;

const TIFF_TYPE_SIZE = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  6: 1,
  7: 1,
  8: 2,
  9: 4,
  10: 8,
  11: 4,
  12: 8,
};

/**
 * @param {number} decimal Signed decimal degrees.
 * @returns {number}
 */
export function roundCoordinate(decimal) {
  return Number(Number(decimal).toFixed(6));
}

/**
 * Degrees + minutes + seconds, with an N/S/E/W hemisphere, as decimal degrees.
 *
 * @param {number} degrees
 * @param {number} minutes
 * @param {number} seconds
 * @param {string} hemisphere One of N, S, E, W.
 * @returns {number|null}
 */
export function decimalDegreesFromExifDms(degrees, minutes, seconds, hemisphere) {
  if (
    !Number.isFinite(degrees) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds)
  ) {
    return null;
  }
  const absolute = Math.abs(degrees) + minutes / 60 + seconds / 3600;
  if (!Number.isFinite(absolute)) return null;
  const ref = String(hemisphere ?? '')
    .trim()
    .toUpperCase()
    .slice(0, 1);
  const signed = ref === 'S' || ref === 'W' ? -absolute : absolute;
  return signed;
}

/**
 * GPS latitude/longitude from a JPEG's EXIF APP1 segment, if present.
 *
 * @param {ArrayBuffer|Uint8Array|DataView} bytes The image file.
 * @returns {{latitude: number, longitude: number}|null}
 */
export function readJpegExifGps(bytes) {
  const view = dataViewOf(bytes);
  if (!view || view.byteLength < 4) return null;
  if (view.getUint16(0) !== JPEG_SOI) return null;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return null;
    const marker = view.getUint16(offset);
    if (marker === JPEG_SOS || marker === JPEG_EOI) break;
    // Standalone markers have no length word.
    if (marker === 0xff01 || (marker >= 0xffd0 && marker <= 0xffd9)) {
      offset += 2;
      continue;
    }
    const size = view.getUint16(offset + 2);
    if (size < 2 || offset + 2 + size > view.byteLength) return null;
    if (marker === JPEG_APP1) {
      const gps = readExifApp1(view, offset + 4, size - 2);
      if (gps) return gps;
    }
    offset += 2 + size;
  }
  return null;
}

/**
 * Read GPS from a File that might be a JPEG. Non-JPEGs return null.
 *
 * @param {File|Blob} file
 * @returns {Promise<{latitude: number, longitude: number}|null>}
 */
export async function readImageFileGps(file) {
  if (!file || typeof file.arrayBuffer !== 'function') return null;
  try {
    const buffer = await file.arrayBuffer();
    return readJpegExifGps(buffer);
  } catch {
    return null;
  }
}

function dataViewOf(bytes) {
  if (bytes instanceof DataView) return bytes;
  if (bytes instanceof ArrayBuffer) return new DataView(bytes);
  if (ArrayBuffer.isView(bytes)) {
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  return null;
}

function readExifApp1(view, start, length) {
  if (length < 14) return null;
  if (!hasExifHeader(view, start)) return null;
  return readGpsFromExifTiff(view, start + 6, length - 6);
}

function hasExifHeader(view, start) {
  return (
    view.getUint8(start) === 0x45 &&
    view.getUint8(start + 1) === 0x78 &&
    view.getUint8(start + 2) === 0x69 &&
    view.getUint8(start + 3) === 0x66 &&
    view.getUint8(start + 4) === 0x00 &&
    view.getUint8(start + 5) === 0x00
  );
}

/**
 * GPS from a TIFF/EXIF body (the bytes after the "Exif\0\0" header).
 *
 * @param {DataView|ArrayBuffer|Uint8Array} bytes
 * @param {number} [tiffStart]
 * @param {number} [length]
 * @returns {{latitude: number, longitude: number}|null}
 */
export function readGpsFromExifTiff(bytes, tiffStart = 0, length) {
  const view = dataViewOf(bytes);
  if (!view) return null;
  const tiffLength = length ?? view.byteLength - tiffStart;
  if (tiffLength < 8) return null;
  const endianMark = view.getUint16(tiffStart);
  const littleEndian = endianMark === 0x4949;
  if (!littleEndian && endianMark !== 0x4d4d) return null;
  if (view.getUint16(tiffStart + 2, littleEndian) !== 0x002a) return null;
  const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
  const ifd0 = readIfd(view, tiffStart, ifd0Offset, littleEndian, tiffLength);
  const gpsPointer = ifd0.find((entry) => entry.tag === IFD0_GPS_POINTER);
  if (!gpsPointer) return null;
  const gpsIfdOffset = readInlineUint32(view, gpsPointer, littleEndian);
  if (gpsIfdOffset == null) return null;
  const gpsIfd = readIfd(view, tiffStart, gpsIfdOffset, littleEndian, tiffLength);
  const latitudeRef = readAsciiValue(view, tiffStart, gpsIfd, GPS_LATITUDE_REF, littleEndian);
  const longitudeRef = readAsciiValue(view, tiffStart, gpsIfd, GPS_LONGITUDE_REF, littleEndian);
  const latitudeDms = readRationalTriplet(
    view,
    tiffStart,
    gpsIfd,
    GPS_LATITUDE,
    littleEndian
  );
  const longitudeDms = readRationalTriplet(
    view,
    tiffStart,
    gpsIfd,
    GPS_LONGITUDE,
    littleEndian
  );
  if (!latitudeDms || !longitudeDms) return null;
  const latitude = decimalDegreesFromExifDms(
    latitudeDms[0],
    latitudeDms[1],
    latitudeDms[2],
    latitudeRef
  );
  const longitude = decimalDegreesFromExifDms(
    longitudeDms[0],
    longitudeDms[1],
    longitudeDms[2],
    longitudeRef
  );
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return {
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude),
  };
}

function readIfd(view, tiffStart, ifdOffset, littleEndian, tiffLength) {
  const absolute = tiffStart + ifdOffset;
  if (ifdOffset < 0 || ifdOffset + 2 > tiffLength) return [];
  if (absolute + 2 > view.byteLength) return [];
  const count = view.getUint16(absolute, littleEndian);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    const entryOffset = absolute + 2 + index * 12;
    if (entryOffset + 12 > view.byteLength) break;
    if (2 + (index + 1) * 12 > tiffLength - ifdOffset) break;
    entries.push({
      tag: view.getUint16(entryOffset, littleEndian),
      type: view.getUint16(entryOffset + 2, littleEndian),
      count: view.getUint32(entryOffset + 4, littleEndian),
      valueOffset: view.getUint32(entryOffset + 8, littleEndian),
      entryOffset,
    });
  }
  return entries;
}

function valueIsInline(entry) {
  const unit = TIFF_TYPE_SIZE[entry.type] ?? 1;
  return unit * entry.count <= 4;
}

function readInlineUint32(view, entry, littleEndian) {
  if (entry.type === TIFF_TYPE_LONG && entry.count === 1) {
    return entry.valueOffset;
  }
  return view.getUint32(entry.entryOffset + 8, littleEndian);
}

function readAsciiValue(view, tiffStart, entries, tag, littleEndian) {
  const entry = entries.find((candidate) => candidate.tag === tag);
  if (!entry || entry.type !== TIFF_TYPE_ASCII || entry.count < 1) return '';
  if (valueIsInline(entry)) {
    return String.fromCharCode(view.getUint8(entry.entryOffset + 8));
  }
  const start = tiffStart + entry.valueOffset;
  if (start < tiffStart || start >= view.byteLength) return '';
  return String.fromCharCode(view.getUint8(start));
}

function readRationalTriplet(view, tiffStart, entries, tag, littleEndian) {
  const entry = entries.find((candidate) => candidate.tag === tag);
  if (!entry || entry.type !== TIFF_TYPE_RATIONAL || entry.count < 3) {
    return null;
  }
  const start = tiffStart + entry.valueOffset;
  if (start + 24 > view.byteLength) return null;
  const degrees = readRational(view, start, littleEndian);
  const minutes = readRational(view, start + 8, littleEndian);
  const seconds = readRational(view, start + 16, littleEndian);
  if (degrees == null || minutes == null || seconds == null) return null;
  return [degrees, minutes, seconds];
}

function readRational(view, offset, littleEndian) {
  const denominator = view.getUint32(offset + 4, littleEndian);
  if (!denominator) return null;
  return view.getUint32(offset, littleEndian) / denominator;
}
