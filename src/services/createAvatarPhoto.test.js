import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  UNTITLED_PHOTO_AVATAR_NAME,
  describePhotoPlaceError,
  researchHintFromCreatePhoto,
  resolveCreateAvatarName,
  resolvePhotoCapturePlace,
  startCreateAvatarPhotoFollowUp,
} from './createAvatarPhoto.js';

test('resolveCreateAvatarName prefers the typed name, then the place, then Untitled', () => {
  assert.equal(
    resolveCreateAvatarName({ typedName: '  Maya  ', locationName: 'Bridge' }),
    'Maya'
  );
  assert.equal(
    resolveCreateAvatarName({
      typedName: '  ',
      locationName: ' Stone Arch ',
      hasPhoto: true,
    }),
    'Stone Arch'
  );
  assert.equal(
    resolveCreateAvatarName({ typedName: '', locationName: '', hasPhoto: true }),
    UNTITLED_PHOTO_AVATAR_NAME
  );
  assert.equal(
    resolveCreateAvatarName({ typedName: '', locationName: '', hasPhoto: false }),
    ''
  );
});

test('researchHintFromCreatePhoto names the photograph and the place it was taken', () => {
  const hint = researchHintFromCreatePhoto({
    name: 'Maya',
    locationName: 'Stone Arch Bridge',
    latitude: 44.9809,
    longitude: -93.2533,
  });
  assert.match(hint, /photograph of a name or location/i);
  assert.match(hint, /identity media/);
  assert.match(hint, /reference image/);
  assert.match(hint, /Typed name: Maya/);
  assert.match(hint, /Place name: Stone Arch Bridge/);
  assert.match(hint, /44\.9809/);
  assert.match(hint, /-93\.2533/);
});

test('researchHintFromCreatePhoto omits the Untitled placeholder and missing coordinates', () => {
  const hint = researchHintFromCreatePhoto({
    name: UNTITLED_PHOTO_AVATAR_NAME,
    locationName: '',
  });
  assert.equal(hint.includes('Typed name'), false);
  assert.equal(hint.includes('Place name'), false);
  assert.equal(hint.includes('taken at'), false);
  assert.equal(hint.includes('fetched from'), false);
});

test('researchHintFromCreatePhoto names the address an image link came from', () => {
  const hint = researchHintFromCreatePhoto({
    imageUrl: ' https://example.com/maya.jpg ',
  });
  assert.match(hint, /fetched from https:\/\/example\.com\/maya\.jpg\./);
});

test('resolvePhotoCapturePlace prefers EXIF GPS over the live device position', async () => {
  const place = await resolvePhotoCapturePlace(
    { name: 'sign.jpg' },
    {
      readExifGps: async () => ({ latitude: 44.9809, longitude: -93.2533 }),
      readDevicePosition: async () => ({
        coords: { latitude: 10, longitude: 20 },
      }),
    }
  );
  assert.deepEqual(place, {
    latitude: 44.9809,
    longitude: -93.2533,
    source: 'exif',
  });
});

test('resolvePhotoCapturePlace uses the device when the file has no EXIF GPS', async () => {
  const place = await resolvePhotoCapturePlace(
    { name: 'snap.jpg' },
    {
      readExifGps: async () => null,
      readDevicePosition: async () => ({
        coords: { latitude: 44.9469, longitude: -93.1089 },
      }),
    }
  );
  assert.deepEqual(place, {
    latitude: 44.9469,
    longitude: -93.1089,
    source: 'device',
  });
});

test('resolvePhotoCapturePlace returns null when neither source has a point', async () => {
  assert.equal(
    await resolvePhotoCapturePlace(
      { name: 'blank.jpg' },
      {
        readExifGps: async () => null,
        readDevicePosition: async () => {
          throw Object.assign(new Error('denied'), { code: 1 });
        },
      }
    ),
    null
  );
  assert.equal(await resolvePhotoCapturePlace(null), null);
});

test('describePhotoPlaceError explains a refused location permission', () => {
  assert.match(describePhotoPlaceError({ code: 1 }), /refused/);
  assert.match(describePhotoPlaceError(null), /Pin a place/);
});

test('startCreateAvatarPhotoFollowUp uploads the portrait and identity and starts no research of its own', async () => {
  // POST /create_avatar starts the research server-side for every avatar and
  // hands the job back to the modal. Starting one here too would research the
  // same subject twice and bill for both.
  const uploads = [];
  const result = await startCreateAvatarPhotoFollowUp({
    assistantId: 'avatar-9',
    photoFile: { name: 'sign.jpg' },
    uploadIdentityMedia: async (options) => {
      uploads.push(options);
      return true;
    },
  });
  assert.equal(uploads.length, 2);
  assert.equal(uploads[0].isReferenceImage, true);
  assert.equal(uploads[1].isReferenceImage, false);
  assert.deepEqual(uploads[0].files, [{ name: 'sign.jpg' }]);
  assert.deepEqual(uploads[0].urls, []);
  assert.deepEqual(result, { portraitOk: true, identityOk: true });
});

test('startCreateAvatarPhotoFollowUp sends an image link as the url of both uploads', async () => {
  const uploads = [];
  const result = await startCreateAvatarPhotoFollowUp({
    assistantId: 'avatar-9',
    photoFile: null,
    photoUrl: ' https://example.com/maya.jpg ',
    uploadIdentityMedia: async (options) => {
      uploads.push(options);
      return true;
    },
  });
  assert.equal(uploads.length, 2);
  for (const upload of uploads) {
    assert.deepEqual(upload.files, []);
    assert.deepEqual(upload.urls, ['https://example.com/maya.jpg']);
  }
  assert.equal(uploads[0].isReferenceImage, true);
  assert.equal(uploads[1].isReferenceImage, false);
  assert.equal(result.portraitOk, true);
  assert.equal(result.identityOk, true);
});

test('startCreateAvatarPhotoFollowUp still stores the portrait when identity ingest fails', async () => {
  const result = await startCreateAvatarPhotoFollowUp({
    assistantId: 'avatar-9',
    photoFile: { name: 'sign.jpg' },
    uploadIdentityMedia: async ({ isReferenceImage }) => !isReferenceImage ? false : true,
  });
  assert.equal(result.identityOk, false);
  assert.equal(result.portraitOk, true);
});

test('startCreateAvatarPhotoFollowUp no-ops without an avatar, or without a file or link', async () => {
  const nothing = { portraitOk: false, identityOk: false };
  assert.deepEqual(
    await startCreateAvatarPhotoFollowUp({
      assistantId: '',
      photoFile: { name: 'sign.jpg' },
    }),
    nothing
  );
  assert.deepEqual(
    await startCreateAvatarPhotoFollowUp({
      assistantId: 'avatar-9',
      photoFile: null,
      photoUrl: '   ',
      uploadIdentityMedia: async () => {
        throw new Error('must not upload');
      },
    }),
    nothing
  );
});

test('startCreateAvatarPhotoFollowUp ingests identity links without a photograph', async () => {
  const uploads = [];
  const result = await startCreateAvatarPhotoFollowUp({
    assistantId: 'avatar-9',
    identityUrls: [
      ' https://example.com/bio ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    ],
    uploadIdentityMedia: async (options) => {
      uploads.push(options);
      return true;
    },
  });
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].isReferenceImage, false);
  assert.deepEqual(uploads[0].files, []);
  assert.deepEqual(uploads[0].urls, [
    'https://example.com/bio',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  ]);
  assert.deepEqual(result, { portraitOk: false, identityOk: true });
});

test('startCreateAvatarPhotoFollowUp adds identity links to the photograph identity ingest', async () => {
  const uploads = [];
  const result = await startCreateAvatarPhotoFollowUp({
    assistantId: 'avatar-9',
    photoFile: { name: 'sign.jpg' },
    identityUrls: ['https://example.com/bio'],
    uploadIdentityMedia: async (options) => {
      uploads.push(options);
      return true;
    },
  });
  assert.equal(uploads.length, 2);
  assert.equal(uploads[0].isReferenceImage, true);
  assert.deepEqual(uploads[0].files, [{ name: 'sign.jpg' }]);
  assert.deepEqual(uploads[0].urls, []);
  assert.equal(uploads[1].isReferenceImage, false);
  assert.deepEqual(uploads[1].files, [{ name: 'sign.jpg' }]);
  assert.deepEqual(uploads[1].urls, ['https://example.com/bio']);
  assert.deepEqual(result, { portraitOk: true, identityOk: true });
});

test('startCreateAvatarPhotoFollowUp does not send the photograph URL twice as identity media', async () => {
  const uploads = [];
  await startCreateAvatarPhotoFollowUp({
    assistantId: 'avatar-9',
    photoUrl: 'https://example.com/maya.jpg',
    identityUrls: [
      'https://example.com/maya.jpg',
      'https://example.com/bio',
    ],
    uploadIdentityMedia: async (options) => {
      uploads.push(options);
      return true;
    },
  });
  assert.deepEqual(uploads[0].urls, ['https://example.com/maya.jpg']);
  assert.equal(uploads[0].isReferenceImage, true);
  assert.deepEqual(uploads[1].urls, [
    'https://example.com/maya.jpg',
    'https://example.com/bio',
  ]);
  assert.equal(uploads[1].isReferenceImage, false);
});
