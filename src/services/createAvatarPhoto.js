// src/services/createAvatarPhoto.js
//
// Creating an avatar from a photograph of a name or place: resolve where the
// picture was taken, name the avatar when the field was left blank, ingest the
// photo as both the reference image and identity media, then start deep
// research so the subject in the picture is looked up on the web.
//
// The picture may also be an image URL. The server fetches it, so nothing is
// downloaded here; a URL has no EXIF and does not pin the avatar anywhere.

import { isValidCoordinate } from './avatarProximity.js';
import { identityUrlsForUpload } from './createAvatarIdentityLinks.js';
import { splitCreateAvatarVoiceUploads } from './createAvatarMedia.js';
import { readDevicePositionOnce } from './deviceLocation.js';
import { readImageFileGps, roundCoordinate } from './jpegExifGps.js';

export const UNTITLED_PHOTO_AVATAR_NAME = 'Untitled';

/**
 * The name sent to POST /create_avatar when the creator photographed a name
 * or place instead of typing one.
 *
 * @param {Object} parameters
 * @param {string} [parameters.typedName]
 * @param {string} [parameters.locationName]
 * @param {boolean} [parameters.hasPhoto]
 * @returns {string}
 */
export function resolveCreateAvatarName({
  typedName = '',
  locationName = '',
  hasPhoto = false,
} = {}) {
  const typed = String(typedName ?? '').trim();
  if (typed) return typed;
  const place = String(locationName ?? '').trim();
  if (place) return place;
  return hasPhoto ? UNTITLED_PHOTO_AVATAR_NAME : '';
}

/**
 * Research hint that points the job at the photograph and any name or place
 * the creator already typed.
 *
 * @param {Object} parameters
 * @param {string} [parameters.name]
 * @param {string} [parameters.locationName]
 * @param {number} [parameters.latitude]
 * @param {number} [parameters.longitude]
 * @param {string} [parameters.imageUrl] Set when the picture came from a URL
 *   rather than a file; the address itself often names the subject.
 * @returns {string}
 */
export function researchHintFromCreatePhoto({
  name = '',
  locationName = '',
  latitude,
  longitude,
  imageUrl = '',
} = {}) {
  const parts = [
    'A photograph of a name or location was uploaded as identity media and as the reference image.',
    'Identify the person or place shown in the photograph and research that subject.',
  ];
  const trimmedUrl = String(imageUrl ?? '').trim();
  if (trimmedUrl) {
    parts.push(`The photograph was fetched from ${trimmedUrl}.`);
  }
  const trimmedName = String(name ?? '').trim();
  if (trimmedName && trimmedName !== UNTITLED_PHOTO_AVATAR_NAME) {
    parts.push(`Typed name: ${trimmedName}.`);
  }
  const trimmedPlace = String(locationName ?? '').trim();
  if (trimmedPlace) {
    parts.push(`Place name: ${trimmedPlace}.`);
  }
  if (isValidCoordinate(latitude, longitude)) {
    parts.push(
      `The photograph was taken at ${roundCoordinate(latitude)}, ${roundCoordinate(longitude)}.`
    );
  }
  return parts.join(' ');
}

/**
 * Where the picture was taken: EXIF GPS when the file has it, otherwise this
 * device's live position (a camera snapshot has no EXIF).
 *
 * @param {File|Blob|null} file
 * @param {Object} [options]
 * @param {Function} [options.readExifGps]
 * @param {Function} [options.readDevicePosition]
 * @returns {Promise<{latitude: number, longitude: number, source: 'exif'|'device'}|null>}
 */
export async function resolvePhotoCapturePlace(
  file,
  {
    readExifGps = readImageFileGps,
    readDevicePosition = readDevicePositionOnce,
  } = {}
) {
  if (!file) return null;
  const exif = await readExifGps(file);
  if (isValidCoordinate(exif?.latitude, exif?.longitude)) {
    return {
      latitude: roundCoordinate(exif.latitude),
      longitude: roundCoordinate(exif.longitude),
      source: 'exif',
    };
  }
  try {
    const position = await readDevicePosition();
    const latitude = position?.coords?.latitude;
    const longitude = position?.coords?.longitude;
    if (isValidCoordinate(latitude, longitude)) {
      return {
        latitude: roundCoordinate(latitude),
        longitude: roundCoordinate(longitude),
        source: 'device',
      };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * The sentence to show when the place the picture was taken could not be read.
 *
 * @param {GeolocationPositionError|Error|null} error
 * @returns {string}
 */
export function describePhotoPlaceError(error) {
  if (!error) {
    return 'Could not read where this picture was taken. Pin a place below if you know it.';
  }
  if (error.code === 1) {
    return 'Location access was refused. Allow it to pin this avatar where the picture was taken.';
  }
  if (error.code === 2) {
    return 'This device could not work out where it is. Try again outdoors or with Wi-Fi on.';
  }
  if (error.code === 3) {
    return 'Locating this device took too long. Try again in a moment.';
  }
  return 'Could not read where this picture was taken. Pin a place below if you know it.';
}

/**
 * After the avatar exists, store the photograph as the portrait and as
 * identity media, and ingest any optional identity-source links. Settings
 * shows the jobs; research waits until identity ingest finishes so it can
 * read the picture and the pages.
 *
 * @param {Object} parameters
 * @param {string} parameters.assistantId
 * @param {File} [parameters.photoFile] The chosen or captured picture.
 * @param {string} [parameters.photoUrl] An image address instead of a file.
 *   The server fetches it; the same media endpoint takes `url`.
 * @param {string[]} [parameters.identityUrls] Extra http(s) pages about the
 *   subject (articles, sites). Posted as identity media, not as the
 *   portrait. The photograph address and voice-reference addresses are
 *   omitted when they are already in this list so the same URL is not
 *   ingested twice.
 * @param {File[]} [parameters.identityFiles] Documents dropped on create
 *   that are neither a portrait nor voice media.
 * @param {File[]} [parameters.voiceFiles] Audio or video of the subject
 *   speaking.
 * @param {string[]} [parameters.voiceUrls] YouTube or direct audio/video
 *   addresses for the voice. Each address is its own job so the server
 *   fetches it as media.
 * @param {string|null} [parameters.referenceAudioKey] Which voice item is
 *   the reference clip. `null` uses the first item; `''` sends no
 *   reference flag.
 * @param {Function} [parameters.uploadIdentityMedia]
 * @returns {Promise<{portraitOk: boolean, identityOk: boolean, voiceOk: boolean}>}
 *
 * Research is deliberately NOT started here. POST /create_avatar starts it
 * server-side for every avatar, whether or not a photo was chosen, and returns
 * the job so the modal can remember it. Starting one here as well would run two
 * research jobs over the same subject and bill for both.
 */
export async function startCreateAvatarPhotoFollowUp({
  assistantId,
  photoFile,
  photoUrl,
  identityUrls = [],
  identityFiles = [],
  voiceFiles = [],
  voiceUrls = [],
  referenceAudioKey = null,
  uploadIdentityMedia,
}) {
  const trimmedUrl = String(photoUrl ?? '').trim();
  const extraUrls = identityUrlsForUpload(identityUrls, trimmedUrl, voiceUrls);
  const documentFiles = Array.isArray(identityFiles) ? identityFiles : [];
  const speechFiles = Array.isArray(voiceFiles) ? voiceFiles : [];
  const speechUrls = (Array.isArray(voiceUrls) ? voiceUrls : [])
    .map((url) => String(url ?? '').trim())
    .filter(Boolean);
  const hasPhoto = Boolean(photoFile || trimmedUrl);
  const hasIdentity = extraUrls.length > 0 || documentFiles.length > 0;
  const hasVoice = speechFiles.length > 0 || speechUrls.length > 0;
  if (!assistantId || (!hasPhoto && !hasIdentity && !hasVoice)) {
    return { portraitOk: false, identityOk: false, voiceOk: false };
  }

  const photoMedia = photoFile
    ? { files: [photoFile], urls: [] }
    : trimmedUrl
      ? { files: [], urls: [trimmedUrl] }
      : { files: [], urls: [] };

  const identityMedia = {
    files: [...photoMedia.files, ...documentFiles],
    urls: [...photoMedia.urls, ...extraUrls],
  };

  const upload =
    uploadIdentityMedia ??
    (await import('./identityMediaJobs.js')).startIdentityMediaUpload;

  const portraitPromise = hasPhoto
    ? Promise.resolve(
        upload({
          assistantId,
          ...photoMedia,
          isReferenceImage: true,
        })
      ).catch((error) => {
        console.error('Portrait upload after create-from-photo failed:', error);
        return false;
      })
    : Promise.resolve(false);

  const voicePromise = hasVoice
    ? uploadCreateAvatarVoiceFollowUp({
        assistantId,
        speechFiles,
        speechUrls,
        referenceAudioKey,
        upload,
      })
    : Promise.resolve(false);

  let identityOk = false;
  if (hasPhoto || hasIdentity) {
    try {
      identityOk = Boolean(
        await upload({
          assistantId,
          ...identityMedia,
          isReferenceImage: false,
        })
      );
    } catch (error) {
      console.error('Identity upload after create-from-photo failed:', error);
    }
  }

  const portraitOk = hasPhoto ? Boolean(await portraitPromise) : false;
  const voiceOk = hasVoice ? Boolean(await voicePromise) : false;
  return { portraitOk, identityOk, voiceOk };
}

/**
 * Voice media after create. Files travel together; each speech URL is its
 * own job so a direct media address is fetched as media, matching Settings.
 *
 * @param {Object} parameters
 * @param {string} parameters.assistantId
 * @param {File[]} parameters.speechFiles
 * @param {string[]} parameters.speechUrls
 * @param {Function} parameters.upload
 * @returns {Promise<boolean>}
 */
async function uploadCreateAvatarVoiceFollowUp({
  assistantId,
  speechFiles,
  speechUrls,
  referenceAudioKey = null,
  upload,
}) {
  const split = splitCreateAvatarVoiceUploads({
    voiceFiles: speechFiles,
    voiceUrls: speechUrls,
    referenceAudioKey,
  });
  const jobs = [];
  if (split.referenceFile) {
    jobs.push(
      Promise.resolve(
        upload({
          assistantId,
          files: [split.referenceFile],
          urls: [],
          isReferenceAudio: true,
          kind: 'voice',
        })
      )
    );
  } else if (split.referenceUrl) {
    jobs.push(
      Promise.resolve(
        upload({
          assistantId,
          files: [],
          urls: [split.referenceUrl],
          isReferenceAudio: true,
          kind: 'voice',
        })
      )
    );
  }
  if (split.otherFiles.length > 0) {
    jobs.push(
      Promise.resolve(
        upload({
          assistantId,
          files: split.otherFiles,
          urls: [],
          isReferenceAudio: false,
          kind: 'voice',
        })
      )
    );
  }
  for (const speechUrl of split.otherUrls) {
    jobs.push(
      Promise.resolve(
        upload({
          assistantId,
          files: [],
          urls: [speechUrl],
          isReferenceAudio: false,
          kind: 'voice',
        })
      )
    );
  }
  const results = await Promise.all(
    jobs.map((job) =>
      job.catch((error) => {
        console.error('Voice upload after create failed:', error);
        return false;
      })
    )
  );
  return results.length > 0 && results.every(Boolean);
}
