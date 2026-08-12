// src/services/avatarService.jsx
//
// Avatar lifecycle, document management, and media ingestion, all through the
// Neural Nexus API. Every function here is a thin, named wrapper over one
// endpoint so components never build paths or headers themselves.

import {
  requestJson,
  streamServerSentEvents,
} from './neuralNexusApiClient';

/**
 * List the caller's own avatars plus any public avatars.
 * GET /list_user_avatars — anonymous callers receive only the public set.
 *
 * @returns {Promise<Array>} Assistant records ({assistant_id, name, description, ...}).
 */
export const listUserAvatars = async () => {
  return requestJson('/list_user_avatars');
};

/**
 * List publicly shared avatars without authenticating.
 * GET /list_public_avatars
 *
 * @param {string} [assistantId] Narrow the listing to one avatar.
 * @returns {Promise<Array>} Assistant records with metadata stripped.
 */
export const listPublicAvatars = async (assistantId) => {
  return requestJson('/list_public_avatars', {
    query: { assistant_id: assistantId },
  });
};

/**
 * Create an avatar. The server mints the assistant_id; nothing is generated
 * client-side. No conversation thread is created here — a new avatar has none
 * until its first message, and the server mints the thread on that send.
 * POST /create_avatar
 *
 * @param {Object} options
 * @param {string} options.name Avatar name (required).
 * @param {string} [options.description] Avatar description.
 * @param {boolean} [options.isPublic] Share the avatar publicly at creation.
 * @param {boolean} [options.isPersonalAvatarOfCreator] The avatar depicts the creator.
 * @returns {Promise<Object>} The created assistant record.
 */
export const createAvatar = async ({
  name,
  description,
  isPublic = false,
  isPersonalAvatarOfCreator = false,
}) => {
  return requestJson('/create_avatar', {
    method: 'POST',
    query: {
      name,
      description,
      is_public: isPublic,
      is_personal_avatar_of_creator: isPersonalAvatarOfCreator,
    },
  });
};

/**
 * Rename or re-describe an avatar.
 * PATCH /modify_avatar
 *
 * @param {Object} options
 * @param {string} options.assistantId The avatar to modify.
 * @param {string} [options.newAvatarName] Replacement name.
 * @param {string} [options.newAvatarDescription] Replacement description.
 * @param {boolean} [options.isPersonalAvatarOfCreator] Update the personal-avatar flag.
 * @returns {Promise<Object>} The modified assistant record.
 */
export const modifyAvatar = async ({
  assistantId,
  newAvatarName,
  newAvatarDescription,
  isPersonalAvatarOfCreator,
}) => {
  return requestJson('/modify_avatar', {
    method: 'PATCH',
    query: {
      assistant_id: assistantId,
      new_avatar_name: newAvatarName,
      new_avatar_description: newAvatarDescription,
      is_personal_avatar_of_creator: isPersonalAvatarOfCreator,
    },
  });
};

/**
 * Publish or unpublish an avatar to the public gallery.
 * POST /share_avatar
 *
 * @param {string} assistantId The avatar to share.
 * @param {boolean} [isPublic] Target visibility, defaults to true.
 * @returns {Promise<Object>} The share result.
 */
export const shareAvatar = async (assistantId, isPublic = true) => {
  return requestJson('/share_avatar', {
    method: 'POST',
    query: { assistant_id: assistantId, is_public: isPublic },
  });
};

/**
 * Delete an avatar and all of the avatar's server-side data (assistant,
 * threads, store namespaces, vector documents).
 * DELETE /delete_avatar
 *
 * @param {string} assistantId The avatar to delete.
 * @returns {Promise<Object>} The deletion result.
 */
export const deleteAvatar = async (assistantId) => {
  return requestJson('/delete_avatar', {
    method: 'DELETE',
    query: { assistant_id: assistantId },
  });
};

/**
 * Select an avatar as the account's active avatar.
 *
 * This is not a cosmetic preference: /list_avatar_documents and
 * /delete_avatar_document take no assistant_id and operate on the avatar
 * selected HERE, server-side. Any screen that touches an avatar's documents
 * must run this first and must not assume an earlier selection survived —
 * the selection is per-account global state another tab can change.
 * POST /select_avatar
 *
 * @param {string} assistantId The avatar to select.
 * @returns {Promise<Object>} The assistant configuration now active.
 */
export const selectAvatar = async (assistantId) => {
  return requestJson('/select_avatar', {
    method: 'POST',
    query: { assistant_id: assistantId },
  });
};

/**
 * Fetch the stored reference image for an avatar, for use as the avatar's
 * icon. The response is a data URI or an image URL string, directly usable as
 * an <img src>.
 * GET /avatar_reference_image
 *
 * @param {string} assistantId The avatar whose portrait to fetch.
 * @returns {Promise<string|null>} A data URI / URL, or null when none is stored.
 */
export const getAvatarReferenceImage = async (assistantId) => {
  const referenceImageResponse = await requestJson('/avatar_reference_image', {
    query: { assistant_id: assistantId },
  });
  if (!referenceImageResponse) {
    return null;
  }
  if (typeof referenceImageResponse === 'string') {
    return referenceImageResponse;
  }
  // The API names this field `reference_image_data`, and its value is either a
  // `data:image/…;base64,…` URI or an https URL. The `image` / `url` keys read
  // here previously do not exist on the response, so every portrait in the
  // application resolved to null and every avatar fell back to a placeholder.
  // The alternatives are kept only as tolerance for a future rename.
  return (
    referenceImageResponse.reference_image_data ??
    referenceImageResponse.image ??
    referenceImageResponse.url ??
    null
  );
};

/**
 * List the source documents uploaded to the currently SELECTED avatar (see
 * selectAvatar for the sequencing requirement).
 * GET /list_avatar_documents
 *
 * @returns {Promise<string[]>} Document labels, one per uploaded source.
 */
export const listAvatarDocuments = async () => {
  const documentsResponse = await requestJson('/list_avatar_documents');
  return documentsResponse?.uploaded_documents ?? [];
};

/**
 * Delete one uploaded source document from the currently SELECTED avatar.
 * The name is a label exactly as returned by listAvatarDocuments.
 * DELETE /delete_avatar_document
 *
 * @param {string} sourceDocumentName The label of the document to delete.
 * @returns {Promise<Object>} The deletion result.
 */
export const deleteAvatarDocument = async (sourceDocumentName) => {
  return requestJson('/delete_avatar_document', {
    method: 'DELETE',
    query: { source_document_name: sourceDocumentName },
  });
};

/**
 * Upload media (files and/or URLs) to build an avatar's identity. Returns
 * immediately with a job identifier; the processing itself runs in the
 * background — follow progress with streamMediaJobProgress.
 * POST /update_avatar_identity_with_media (responds 202 {job_id})
 *
 * @param {Object} options
 * @param {string} options.assistantId The avatar receiving the media.
 * @param {File[]} [options.files] Files to upload.
 * @param {string[]} [options.urls] URLs to ingest (YouTube videos, playlists, articles).
 * @param {boolean} [options.isReferenceAudio] Treat the upload as the voice reference.
 * @param {boolean} [options.isReferenceImage] Treat the upload as the portrait reference.
 * @returns {Promise<Object>} `{job_id}` for the background processing job.
 */
export const uploadAvatarIdentityMedia = async ({
  assistantId,
  files = [],
  urls = [],
  isReferenceAudio = false,
  isReferenceImage = false,
}) => {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  for (const mediaUrl of urls) {
    formData.append('url', mediaUrl);
  }
  if (assistantId) {
    formData.append('assistant_id', assistantId);
  }
  formData.append('reference_audio', isReferenceAudio);
  formData.append('reference_image', isReferenceImage);

  return requestJson('/update_avatar_identity_with_media', {
    method: 'POST',
    formData,
  });
};

/**
 * Follow a media-processing job's progress stream until the job finishes.
 * Replays buffered events, then live ones; the final frame has
 * `type: 'done'` carrying the job status and result (or error).
 * GET /media_job/{job_id}/progress (server-sent events)
 *
 * @param {string} jobId The job to follow.
 * @param {Function} onEvent Called with each progress event object.
 * @param {AbortSignal} [signal] Cancellation signal.
 */
export const streamMediaJobProgress = async (jobId, onEvent, signal) => {
  return streamServerSentEvents(`/media_job/${encodeURIComponent(jobId)}/progress`, {
    method: 'GET',
    onEvent,
    signal,
  });
};

/**
 * Cancel a running media-processing job.
 * POST /media_job/{job_id}/cancel
 *
 * @param {string} jobId The job to cancel.
 * @returns {Promise<Object>} The cancellation result.
 */
export const cancelMediaJob = async (jobId) => {
  return requestJson(`/media_job/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
  });
};

/**
 * Read the account's personal avatar and the live status of its capabilities.
 *
 * The capability statuses are where connected data servers (Model Context
 * Protocol machines) are reported: `connected_data_servers` holds one entry per
 * connection, each naming the server and whether it is bound to that avatar.
 * GET /personal_avatar
 *
 * @returns {Promise<Object>} `{personal_avatar, capabilities}`.
 */
export const getPersonalAvatar = async () => {
  return requestJson('/personal_avatar');
};

/**
 * Forget saved data-server connections — the disconnect.
 *
 * Omitting `deviceId` disconnects every machine on the account; passing one
 * disconnects only that machine. The avatar re-adopts a reachable machine on a
 * later turn, so this is unplugging rather than a permanent opt-out.
 * POST /disconnect_mcp
 *
 * @param {string} [deviceId] The machine to disconnect.
 * @returns {Promise<Object>} The disconnect result.
 */
export const disconnectDataServer = async (deviceId) => {
  return requestJson('/disconnect_mcp', {
    method: 'POST',
    query: { device_id: deviceId },
  });
};
