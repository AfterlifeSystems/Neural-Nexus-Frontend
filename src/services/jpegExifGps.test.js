import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decimalDegreesFromExifDms,
  readGpsFromExifTiff,
  readJpegExifGps,
} from './jpegExifGps.js';

test('decimalDegreesFromExifDms applies the hemisphere', () => {
  assert.ok(
    Math.abs(decimalDegreesFromExifDms(44, 58, 51.24, 'N') - 44.9809) < 1e-6
  );
  assert.ok(
    Math.abs(decimalDegreesFromExifDms(93, 15, 11.88, 'W') + 93.2533) < 1e-6
  );
  assert.equal(decimalDegreesFromExifDms(45, 0, 0, 'S'), -45);
  assert.equal(decimalDegreesFromExifDms(Number.NaN, 0, 0, 'N'), null);
});

test('readJpegExifGps returns null for non-JPEG bytes', () => {
  assert.equal(readJpegExifGps(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), null);
  assert.equal(readJpegExifGps(new Uint8Array()), null);
});

test('a JPEG without EXIF GPS returns null', () => {
  const bare = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  assert.equal(readJpegExifGps(bare), null);
});

test('readJpegExifGps reads little-endian EXIF GPS', () => {
  const jpeg = buildJpegWithGps({
    latitude: 45,
    longitude: -93,
    latitudeRef: 'N',
    longitudeRef: 'W',
  });
  assert.deepEqual(readJpegExifGps(jpeg), {
    latitude: 45,
    longitude: -93,
  });
});

test('readJpegExifGps reads southern and eastern hemispheres', () => {
  const jpeg = buildJpegWithGps({
    latitude: -33.9,
    longitude: 18.4,
    latitudeRef: 'S',
    longitudeRef: 'E',
  });
  const gps = readJpegExifGps(jpeg);
  assert.ok(gps);
  assert.ok(Math.abs(gps.latitude + 33.9) < 1e-4);
  assert.ok(Math.abs(gps.longitude - 18.4) < 1e-4);
});

test('readGpsFromExifTiff rejects a truncated TIFF', () => {
  assert.equal(readGpsFromExifTiff(new Uint8Array([0x49, 0x49])), null);
});

/**
 * A minimal JPEG whose only APP1 payload is an EXIF GPS IFD.
 *
 * @param {Object} parameters
 * @param {number} parameters.latitude Signed decimal degrees.
 * @param {number} parameters.longitude Signed decimal degrees.
 * @param {string} parameters.latitudeRef
 * @param {string} parameters.longitudeRef
 * @returns {Uint8Array}
 */
function buildJpegWithGps({ latitude, longitude, latitudeRef, longitudeRef }) {
  const tiff = buildGpsTiff({
    latitude: Math.abs(latitude),
    longitude: Math.abs(longitude),
    latitudeRef,
    longitudeRef,
  });
  const app1Length = 2 + 6 + tiff.byteLength;
  const jpeg = new Uint8Array(4 + app1Length + 2);
  jpeg[0] = 0xff;
  jpeg[1] = 0xd8;
  jpeg[2] = 0xff;
  jpeg[3] = 0xe1;
  jpeg[4] = (app1Length >> 8) & 0xff;
  jpeg[5] = app1Length & 0xff;
  jpeg.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 6);
  jpeg.set(tiff, 12);
  jpeg[12 + tiff.byteLength] = 0xff;
  jpeg[13 + tiff.byteLength] = 0xd9;
  return jpeg;
}

function buildGpsTiff({ latitude, longitude, latitudeRef, longitudeRef }) {
  const tiff = new Uint8Array(128);
  const view = new DataView(tiff.buffer);
  view.setUint16(0, 0x4949, true);
  view.setUint16(2, 0x002a, true);
  view.setUint32(4, 8, true);

  view.setUint16(8, 1, true);
  writeIfdEntry(view, 10, 0x8825, 4, 1, 26);
  view.setUint32(22, 0, true);

  view.setUint16(26, 4, true);
  writeIfdEntry(view, 28, 0x0001, 2, 2, latitudeRef.charCodeAt(0));
  writeIfdEntry(view, 40, 0x0002, 5, 3, 80);
  writeIfdEntry(view, 52, 0x0003, 2, 2, longitudeRef.charCodeAt(0));
  writeIfdEntry(view, 64, 0x0004, 5, 3, 104);
  view.setUint32(76, 0, true);

  writeDmsRationals(view, 80, latitude);
  writeDmsRationals(view, 104, longitude);
  return tiff;
}

function writeIfdEntry(view, offset, tag, type, count, value) {
  view.setUint16(offset, tag, true);
  view.setUint16(offset + 2, type, true);
  view.setUint32(offset + 4, count, true);
  view.setUint32(offset + 8, value, true);
}

function writeDmsRationals(view, offset, decimal) {
  const degrees = Math.floor(decimal);
  const minutesFloat = (decimal - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;
  const scaledSeconds = Math.round(seconds * 10000);
  writeRational(view, offset, degrees, 1);
  writeRational(view, offset + 8, minutes, 1);
  writeRational(view, offset + 16, scaledSeconds, 10000);
}

function writeRational(view, offset, numerator, denominator) {
  view.setUint32(offset, numerator, true);
  view.setUint32(offset + 4, denominator, true);
}
