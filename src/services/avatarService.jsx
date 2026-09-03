// src/services/avatarService.jsx
//
// Avatar lifecycle, document management, and media ingestion, all through the
// Neural Nexus API. Every function here is a thin, named wrapper over one
// endpoint so components never build paths or headers themselves.

import {
  NEURAL_NEXUS_API_BASE_URL,
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
 * Fetch the stored reference image for an avatar, for use as the avatar's
 * icon. The response is a data URI or an image URL string, directly usable as
 * an <img src>.
 * GET /avatar_reference_image
 *
 * @param {string} assistantId The avatar whose portrait to fetch.
 * @param {Object} [options]
 * @param {boolean} [options.asAnonymousIdentity] Ask as the anonymous visitor,
 *   withholding any credential this browser holds. The portrait itself is the
 *   same either way — the endpoint reads the avatar owner's namespace, not the
 *   caller's — but a shared avatar's public chat must reach the API as the
 *   visitor on every request it makes, not only on the ones whose answer would
 *   otherwise differ.
 * @returns {Promise<string|null>} A data URI / URL, or null when none is stored.
 */
export const getAvatarReferenceImage = async (
  assistantId,
  { asAnonymousIdentity = false } = {}
) => {
  const referenceImageResponse = await requestJson('/avatar_reference_image', {
    query: { assistant_id: assistantId },
    asAnonymousIdentity,
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
 * List the source documents uploaded to one avatar.
 *
 * The avatar is named in the request. It used to be implied by a separate
 * POST /select_avatar call that wrote a per-account "currently selected avatar"
 * server-side; that endpoint is gone, and with it the sequencing hazard where a
 * second tab could repoint this listing at a different avatar between the
 * selection and the read.
 * GET /list_avatar_documents
 *
 * Each entry names the uploaded source and says whether that source is one of
 * the avatar's two reference assets: the portrait the avatar is depicted by
 * (`referenceRole === 'reference_image'`) or the voice sample the diarizer
 * labels the target speaker with (`referenceRole === 'reference_audio'`). Every
 * other upload has a `referenceRole` of null.
 *
 * The API reports the roles on a `documents` array; the older `uploaded_documents`
 * array of plain label strings is still returned alongside it and is read here as
 * a fallback, so this screen keeps listing files (without role marks) against an
 * API that predates the roles.
 *
 * @param {string} assistantId The avatar whose documents to list.
 * @returns {Promise<Array<{label: string, referenceRole: string|null, isReferenceImage: boolean, isReferenceAudio: boolean}>>}
 *   One entry per uploaded source. `label` is the exact string
 *   deleteAvatarDocument accepts back.
 */
export const listAvatarDocuments = async (assistantId) => {
  const documentsResponse = await requestJson('/list_avatar_documents', {
    query: { assistant_id: assistantId },
  });

  const documentEntries = documentsResponse?.documents;
  if (Array.isArray(documentEntries)) {
    return documentEntries
      .filter((documentEntry) => Boolean(documentEntry?.label))
      .map((documentEntry) => ({
        label: documentEntry.label,
        referenceRole: documentEntry.reference_role ?? null,
        // Read the booleans the API sends when present, and otherwise derive
        // them from the role, so one renamed field cannot silently turn every
        // reference mark off.
        isReferenceImage:
          documentEntry.is_reference_image ??
          documentEntry.reference_role === 'reference_image',
        isReferenceAudio:
          documentEntry.is_reference_audio ??
          documentEntry.reference_role === 'reference_audio',
      }));
  }

  return (documentsResponse?.uploaded_documents ?? []).map((documentLabel) => ({
    label: documentLabel,
    referenceRole: null,
    isReferenceImage: false,
    isReferenceAudio: false,
  }));
};

/**
 * Delete one uploaded source document from an avatar. The name is a label
 * exactly as returned by listAvatarDocuments.
 * DELETE /delete_avatar_document
 *
 * @param {string} assistantId The avatar holding the document.
 * @param {string} sourceDocumentName The label of the document to delete.
 * @returns {Promise<Object>} The deletion result.
 */
export const deleteAvatarDocument = async (assistantId, sourceDocumentName) => {
  return requestJson('/delete_avatar_document', {
    method: 'DELETE',
    query: {
      assistant_id: assistantId,
      source_document_name: sourceDocumentName,
    },
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

/**
 * Connect one of the owner's email accounts to their personal avatar.
 *
 * The credential is proved against the real mail server before anything is
 * stored, so a rejected password comes back as a 400 whose message names what
 * went wrong while the connect card is still on screen. Surface that message as
 * written rather than replacing it with a generic failure: for Gmail it is the
 * only place the owner is told that an app password is required and that their
 * account password will never work.
 *
 * Unlike most write endpoints in this file, this one reads a JSON body rather
 * than query parameters — a password does not belong in a URL, where it would
 * be recorded by proxies, browser history, and server access logs.
 * POST /connect_mailbox
 *
 * @param {Object} parameters
 * @param {string} [parameters.provider] Provider name. Defaults to `gmail`.
 * @param {string} parameters.emailAddress The mailbox address to connect.
 * @param {string} parameters.appPassword The provider-issued app password.
 * @returns {Promise<Object>} `{connected, account}` — no secret in either.
 */
export const connectMailbox = async ({
  provider = 'gmail',
  emailAddress,
  appPassword,
}) => {
  return requestJson('/connect_mailbox', {
    method: 'POST',
    body: {
      provider,
      email_address: emailAddress,
      app_password: appPassword,
    },
  });
};

/**
 * List the external accounts connected to the account's personal avatar.
 *
 * Each entry carries the provider, address, display label, kind, and status —
 * never the password and never the stored ciphertext. An entry whose status is
 * `needs_reconnect` has a credential the mail server has stopped accepting.
 * GET /list_connected_accounts
 *
 * @returns {Promise<Object>} `{accounts}`.
 */
export const listConnectedAccounts = async () => {
  return requestJson('/list_connected_accounts');
};

/**
 * Disconnect one connected account and forget its stored credential.
 *
 * The account key is required. The endpoint has no "disconnect everything"
 * mode on purpose, so a call that loses its argument cannot quietly wipe every
 * account the owner has connected.
 * DELETE /disconnect_account
 *
 * @param {string} accountKey The `provider:address` key to disconnect.
 * @returns {Promise<Object>} The disconnect result.
 */
export const disconnectAccount = async (accountKey) => {
  return requestJson('/disconnect_account', {
    method: 'DELETE',
    query: { account_key: accountKey },
  });
};

/**
 * Describe the accounts that can be connected, and the form each one needs.
 *
 * The same description the avatar raises as a card mid-conversation. Reading it
 * from the API rather than hardcoding provider names, field labels, and help
 * text here is what keeps the settings screen and the in-chat card from drifting
 * into two different accounts of how to connect the same provider.
 * GET /connectable_providers
 *
 * @returns {Promise<Object>} `{providers}`, each a connect-card description.
 */
export const listConnectableProviders = async () => {
  return requestJson('/connectable_providers');
};

/**
 * Connect any catalog provider through the generic route.
 *
 * The provider's connect card (from `listConnectableProviders`) names the fields
 * this call must carry and the endpoint to post them to; passing them through
 * unchanged is what lets a provider added to the API registry connect from this
 * client with no code change. Secrets travel in the JSON body, never the URL.
 * POST /connect_account (or the card's own `connect_endpoint`)
 *
 * @param {Object} parameters
 * @param {string} parameters.provider The provider name from the catalog.
 * @param {Object} parameters.fields The card's fields, keyed by field name.
 * @param {string} [parameters.endpoint] The card's `connect_endpoint`.
 * @returns {Promise<Object>} `{connected, account}` — no secret in either.
 */
export const connectAccount = async ({
  provider,
  fields,
  endpoint = '/connect_account',
}) => {
  return requestJson(endpoint, {
    method: 'POST',
    body: { provider, fields },
  });
};

/**
 * Everything the personal avatar is connected to, accounts and devices alike.
 *
 * One row shape for a mailbox, a custom connector, and a machine running the
 * Neural Nexus daemon. Keys are prefixed `account:` / `device:` so the toggle
 * endpoint can route them, and each row names its own `disconnect_endpoint`.
 * GET /list_connections
 *
 * @returns {Promise<Object>} `{personal_avatar_id, connection_count, connections}`.
 */
export const listConnections = async () => {
  return requestJson('/list_connections');
};

/**
 * Toggle one connection on or off.
 *
 * Off DISCONNECTS: the account's credential is deleted (or the machine is
 * unbound and suppressed from re-adoption). On cannot restore a deleted
 * credential, so for an account the response carries `action:
 * 'open_connect_card'` and the card to open; for a machine it clears the
 * suppression so the avatar reconnects on the next turn.
 * POST /set_connection_state
 *
 * @param {string} connectionKey A prefixed key from `listConnections`.
 * @param {boolean} connected The desired state.
 * @returns {Promise<Object>} `{connection_key, connected, action?, card?}`.
 */
export const setConnectionState = async (connectionKey, connected) => {
  return requestJson('/set_connection_state', {
    method: 'POST',
    body: { connection_key: connectionKey, connected },
  });
};

/**
 * Pull the owner's sent mail into the personal avatar's identity.
 *
 * Runs as a background media job, exactly like an uploaded text file, so the
 * returned `job_id` can be followed with `streamMediaJobProgress`.
 * POST /import_mailbox_writing_samples
 *
 * @param {Object} [parameters]
 * @param {string} [parameters.accountKey] Which mailbox, when several are connected.
 * @param {number} [parameters.limit] How many sent messages to read.
 * @returns {Promise<Object>} `{job_id, progress_url, messages_imported, ...}`.
 */
export const importMailboxWritingSamples = async ({
  accountKey,
  limit,
} = {}) => {
  return requestJson('/import_mailbox_writing_samples', {
    method: 'POST',
    body: { account_key: accountKey, limit },
  });
};

/**
 * The avatar's emotion media manifest: one still and one idle loop per emotion.
 *
 * `emotions[emotion].still.url` / `.idle_loop.url` are API paths served by
 * `GET /avatar_emotion_media/{asset_id}` (immutable, cacheable). `complete` is
 * true only when all seven emotions have both. Readable by anyone who may chat
 * with the avatar, like the portrait.
 * GET /avatar_emotion_media
 *
 * @param {string} assistantId The avatar.
 * @param {Object} [options]
 * @param {boolean} [options.asAnonymousIdentity] Withhold the credential (public chat).
 * @returns {Promise<Object>} `{emotions, complete, missing}`.
 */
export const getAvatarEmotionMedia = async (
  assistantId,
  { asAnonymousIdentity = false } = {}
) => {
  return requestJson('/avatar_emotion_media', {
    query: { assistant_id: assistantId },
    asAnonymousIdentity,
  });
};

/**
 * (Re)build the avatar's emotion stills and idle loops from its reference image.
 *
 * Runs as a durable job; poll `getAvatarMediaJob(job_id)` for its state.
 * POST /avatar_emotion_media/regenerate
 *
 * @param {string} assistantId The avatar.
 * @param {Object} [options]
 * @param {boolean} [options.onlyMissing] Retry only what failed (default true).
 * @returns {Promise<Object>} `{job_id, status_url}`.
 */
export const regenerateAvatarEmotionMedia = async (
  assistantId,
  { onlyMissing = true } = {}
) => {
  return requestJson('/avatar_emotion_media/regenerate', {
    method: 'POST',
    body: { assistant_id: assistantId, only_missing: onlyMissing },
  });
};

/**
 * State and progress of one durable media job.
 * GET /avatar_media_jobs/{job_id}
 *
 * @param {string} jobId The job.
 * @returns {Promise<Object>} `{job_id, job_kind, state, detail, ...}`.
 */
export const getAvatarMediaJob = async (jobId) => {
  return requestJson(`/avatar_media_jobs/${encodeURIComponent(jobId)}`);
};

/**
 * Turn an API-relative media path into an absolute URL the browser can load.
 *
 * Emotion media is served as bytes with immutable caching, so an `<img>` or
 * `<video>` can point straight at it; the bearer credential is not needed for
 * public avatars and is deliberately not embedded in the URL.
 *
 * @param {string} path An API path such as `/avatar_emotion_media/{id}`.
 * @returns {string} The absolute URL.
 */
export const absoluteMediaUrl = (path) =>
  path?.startsWith('http') ? path : `${NEURAL_NEXUS_API_BASE_URL}${path ?? ''}`;
