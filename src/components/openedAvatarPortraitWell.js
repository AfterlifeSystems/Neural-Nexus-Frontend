/**
 * Size the voice well to the gallery card before that avatar's chat opens.
 *
 * Generated cards are already 9:16. Opening chat from the carousel used to
 * start the well as a square, then snap when the loop reported its size.
 * The idle-loop URL is not required: generated faces are 9:16 before that
 * URL is cached.
 *
 * Reference-photo avatars must drop a leftover 9:16 well from a prior
 * generated visit, or voice mode object-cover crops the face too close.
 */

import { showsGeneratedFace } from '../config/avatarFaceSource.js';
import {
  GALLERY_GENERATED_PORTRAIT_HEIGHT,
  GALLERY_GENERATED_PORTRAIT_WIDTH,
} from './galleryScrollIndex.js';
import {
  forgetTallPortraitWellForReference,
  seedPortraitWellAspectIfUnknown,
} from './voicePortraitBox.js';

/**
 * @param {string|null|undefined} assistantId
 * @param {Storage|null|undefined} [storage]
 */
export function seedOpenedAvatarPortraitWell(assistantId, storage) {
  if (!assistantId) return;
  if (!showsGeneratedFace(assistantId, storage)) {
    forgetTallPortraitWellForReference(assistantId);
    return;
  }
  // Generated faces are 9:16 even before the idle-loop URL is cached.
  // Waiting for that URL left the well square, so the still painted a
  // circle and the loop hopped the face into the portrait.
  seedPortraitWellAspectIfUnknown(
    assistantId,
    GALLERY_GENERATED_PORTRAIT_WIDTH,
    GALLERY_GENERATED_PORTRAIT_HEIGHT
  );
}
