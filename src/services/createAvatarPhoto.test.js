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

test('startCreateAvatarPhotoFollowUp uploads the portrait and identity, then starts research', async () => {
  const uploads = [];
  const result = await startCreateAvatarPhotoFollowUp({
    assistantId: 'avatar-9',
    photoFile: { name: 'sign.jpg' },
    researchHint: 'Identify the subject.',
    uploadIdentityMedia: async (options) => {
      uploads.push(options);
      return true;
    },
    startResearch: async (assistantId, options) => {
      assert.equal(assistantId, 'avatar-9');
      assert.equal(options.researchHint, 'Identify the subject.');
      return { job_id: 'research-1' };
    },
    rememberJob: (assistantId, jobId) => {
      assert.equal(assistantId, 'avatar-9');
      assert.equal(jobId, 'research-1');
    },
  });
  assert.equal(uploads.length, 2);
  assert.equal(uploads[0].isReferenceImage, true);
  assert.equal(uploads[1].isReferenceImage, false);
  assert.deepEqual(result, {
    portraitOk: true,
    identityOk: true,
    researchJobId: 'research-1',
  });
});

test('startCreateAvatarPhotoFollowUp still researches when identity ingest fails', async () => {
  const result = await startCreateAvatarPhotoFollowUp({
    assistantId: 'avatar-9',
    photoFile: { name: 'sign.jpg' },
    uploadIdentityMedia: async ({ isReferenceImage }) => !isReferenceImage ? false : true,
    startResearch: async () => ({ job_id: 'research-2' }),
    rememberJob: () => {},
  });
  assert.equal(result.identityOk, false);
  assert.equal(result.portraitOk, true);
  assert.equal(result.researchJobId, 'research-2');
});

test('startCreateAvatarPhotoFollowUp no-ops without an avatar or file', async () => {
  assert.deepEqual(
    await startCreateAvatarPhotoFollowUp({
      assistantId: '',
      photoFile: { name: 'sign.jpg' },
    }),
    { portraitOk: false, identityOk: false, researchJobId: null }
  );
});
