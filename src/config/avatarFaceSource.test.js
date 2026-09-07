import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AVATAR_FACE_SOURCE_GENERATED,
  AVATAR_FACE_SOURCE_REFERENCE,
  galleryIdleLoopUrl,
  normalizeAvatarFaceSource,
  readAvatarFaceSource,
  showsGeneratedFace,
  voiceStageFace,
  writeAvatarFaceSource,
} from './avatarFaceSource.js';

function memoryStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key)
        ? store[key]
        : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
  };
}

test('an unknown source falls back to generated faces', () => {
  assert.equal(normalizeAvatarFaceSource('reference'), AVATAR_FACE_SOURCE_REFERENCE);
  assert.equal(normalizeAvatarFaceSource('generated'), AVATAR_FACE_SOURCE_GENERATED);
  assert.equal(normalizeAvatarFaceSource('nope'), AVATAR_FACE_SOURCE_GENERATED);
  assert.equal(normalizeAvatarFaceSource(null), AVATAR_FACE_SOURCE_GENERATED);
});

test('the voice stage drops generated loops when the original photo is on', () => {
  assert.deepEqual(
    voiceStageFace({
      showGenerated: false,
      generatedStill: 'generated.jpg',
      generatedLoop: 'idle.mp4',
      referenceStill: 'original.jpg',
    }),
    { still: 'original.jpg', loop: null }
  );
});

test('the voice stage uses generated media when that source is on', () => {
  assert.deepEqual(
    voiceStageFace({
      showGenerated: true,
      generatedStill: 'generated.jpg',
      generatedLoop: 'idle.mp4',
      referenceStill: 'original.jpg',
    }),
    { still: 'generated.jpg', loop: 'idle.mp4' }
  );
});

test('a missing generated still falls back to the original photo', () => {
  assert.deepEqual(
    voiceStageFace({
      showGenerated: true,
      generatedStill: null,
      generatedLoop: null,
      referenceStill: 'original.jpg',
    }),
    { still: 'original.jpg', loop: null }
  );
});

test('the carousel loop is withheld when the original photo is on', () => {
  assert.equal(galleryIdleLoopUrl('idle.mp4', true), 'idle.mp4');
  assert.equal(galleryIdleLoopUrl('idle.mp4', false), null);
  assert.equal(galleryIdleLoopUrl(null, true), null);
});

test('each avatar keeps its own generated-or-reference choice', () => {
  const storage = memoryStorage();
  writeAvatarFaceSource('maya', AVATAR_FACE_SOURCE_REFERENCE, storage);
  writeAvatarFaceSource('evan', AVATAR_FACE_SOURCE_GENERATED, storage);

  assert.equal(readAvatarFaceSource('maya', storage), AVATAR_FACE_SOURCE_REFERENCE);
  assert.equal(readAvatarFaceSource('evan', storage), AVATAR_FACE_SOURCE_GENERATED);
  assert.equal(showsGeneratedFace('maya', storage), false);
  assert.equal(showsGeneratedFace('evan', storage), true);
});

test('an unset avatar follows the legacy global choice', () => {
  const storage = memoryStorage({ avatar_face_source: 'reference' });
  assert.equal(readAvatarFaceSource('maya', storage), AVATAR_FACE_SOURCE_REFERENCE);
  assert.equal(showsGeneratedFace('maya', storage), false);

  writeAvatarFaceSource('maya', AVATAR_FACE_SOURCE_GENERATED, storage);
  assert.equal(readAvatarFaceSource('maya', storage), AVATAR_FACE_SOURCE_GENERATED);
  assert.equal(readAvatarFaceSource('evan', storage), AVATAR_FACE_SOURCE_REFERENCE);
});

test('a missing store and a write without an avatar stay on generated', () => {
  assert.equal(readAvatarFaceSource('maya', memoryStorage()), AVATAR_FACE_SOURCE_GENERATED);
  assert.equal(readAvatarFaceSource('maya', null), AVATAR_FACE_SOURCE_GENERATED);
  assert.equal(
    writeAvatarFaceSource('', AVATAR_FACE_SOURCE_REFERENCE, memoryStorage()),
    AVATAR_FACE_SOURCE_REFERENCE
  );
  assert.equal(
    readAvatarFaceSource('maya', memoryStorage()),
    AVATAR_FACE_SOURCE_GENERATED
  );
});
