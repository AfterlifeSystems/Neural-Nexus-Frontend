// src/services/avatarService.jsx
//
// Avatar lifecycle, document management, and media ingestion, all through the
// Neural Nexus API. Every function here is a thin, named wrapper over one
// endpoint so components never build paths or headers themselves.

import {
  NEURAL_NEXUS_API_BASE_URL,
  requestBinary,
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
        // Seconds of the avatar's speech this upload contributed to the voice
        // model, so the list can show which uploads feed the voice.
        voiceSeconds: Number(documentEntry.voice_seconds ?? 0),
        inVoiceCorpus: documentEntry.in_voice_corpus === true,
      }));
  }

  return (documentsResponse?.uploaded_documents ?? []).map((documentLabel) => ({
    label: documentLabel,
    referenceRole: null,
    isReferenceImage: false,
    isReferenceAudio: false,
    voiceSeconds: 0,
    inVoiceCorpus: false,
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
 * @param {AbortSignal} [options.signal] Abort the POST if the owner cancels before a job id exists.
 * @returns {Promise<Object>} `{job_id}` for the background processing job.
 */
export const uploadAvatarIdentityMedia = async ({
  assistantId,
  files = [],
  urls = [],
  isReferenceAudio = false,
  isReferenceImage = false,
  signal,
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
    signal,
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
 * List the caller's media-processing jobs, newest first.
 * GET /media_jobs
 *
 * Active jobs (`queued` / `running`) are returned by default. Finished jobs
 * linger briefly in the registry and are included when `includeFinished` is
 * set, which is how Settings can show a just-completed upload after the
 * owner left the avatar and came back.
 *
 * @param {Object} [options]
 * @param {string} [options.assistantId] Limit the list to one avatar.
 * @param {boolean} [options.includeFinished] Also return recently finished jobs.
 * @returns {Promise<Object|Array>} The listing the API returned.
 */
export const listMediaJobs = async ({
  assistantId,
  includeFinished = false,
} = {}) => {
  return requestJson('/media_jobs', {
    query: {
      assistant_id: assistantId,
      include_finished: includeFinished,
    },
  });
};

/**
 * Point-in-time snapshot of one media-processing job, including children.
 * GET /media_job/{job_id}
 *
 * @param {string} jobId The master or child job.
 * @returns {Promise<Object>} Status, children, and any last progress.
 */
export const getMediaJob = async (jobId) => {
  return requestJson(`/media_job/${encodeURIComponent(jobId)}`);
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
 * Drop one machine from the account's device list (registration record).
 *
 * Distinct from disconnect: that unbinds the avatar; this removes the machine
 * so it no longer appears under Connected.
 * POST /mcp/unregister
 *
 * @param {string} deviceId The machine to remove.
 * @returns {Promise<Object>} The unregister result.
 */
export const unregisterMcpDevice = async (deviceId) => {
  return requestJson('/mcp/unregister', {
    method: 'POST',
    body: { device_id: deviceId },
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
 * Bind a reachable Neural Nexus machine to the personal avatar immediately.
 *
 * Adoption normally waits for the next graph turn. Connect-now cannot:
 * the owner pressed a button that says the machine should be connected now.
 * POST /connect_mcp
 *
 * @param {Object} [parameters]
 * @param {string} [parameters.deviceId] Bind this machine only.
 * @param {string} [parameters.deviceLabel] Bind by the name the card shows.
 * @returns {Promise<Object>} `{connected, connected_devices, message}`.
 */
export const connectMcpDevice = async ({ deviceId, deviceLabel } = {}) => {
  return requestJson('/connect_mcp', {
    method: 'POST',
    body: {
      device_id: deviceId || undefined,
      device_label: deviceLabel || undefined,
    },
  });
};

/**
 * Every machine this account has registered, with live presence.
 * GET /list_mcp_connections
 *
 * @returns {Promise<Object>} `{devices}` — label, platform, online, connected.
 */
export const listMcpConnections = async () => {
  return requestJson('/list_mcp_connections');
};

const PLATFORM_ICON_KEYS = {
  ubuntu: 'ubuntu',
  linux: 'ubuntu',
  macos: 'apple',
  darwin: 'apple',
  ios: 'ios',
  iphone: 'ios',
  mobile: 'ios',
  android: 'android',
  windows: 'windows',
};

/**
 * Whether this connectors row is a machine (not a mailbox or custom URL).
 *
 * @param {Object} connection A `listConnections` row.
 * @returns {boolean}
 */
export const isDeviceConnection = (connection) =>
  connection?.source === 'device' ||
  connection?.category === 'device' ||
  connection?.provider === 'desktop_mcp' ||
  connection?.provider === 'neural_nexus_desktop';

/**
 * Whether this catalog provider is "add a device", not a form-based account.
 *
 * @param {Object} provider A connectable-providers card.
 * @returns {boolean}
 */
export const isDeviceProvider = (provider) =>
  provider?.category === 'device' ||
  String(provider?.provider ?? '').startsWith('desktop_mcp') ||
  provider?.provider === 'neural_nexus_desktop' ||
  provider?.credential_mechanism === 'device_pairing';

/**
 * The device identifier on a connectors row.
 *
 * @param {Object} connection A `listConnections` row.
 * @returns {string|null}
 */
export const deviceIdFromConnection = (connection) => {
  if (connection?.pending) return null;
  if (connection?.device_id) return connection.device_id;
  if (!isDeviceConnection(connection)) return null;
  const identifier = String(connection.connection_key ?? '').replace(
    /^device:/,
    ''
  );
  if (!identifier || identifier.startsWith('pending:')) return null;
  return identifier;
};

/**
 * Shape a machine from GET /list_mcp_connections as a connectors-row.
 *
 * The settings/connectors screens speak one row shape for mailboxes and
 * machines. The dedicated MCP listing is older and returns devices; mapping
 * here is what lets a newly registered daemon appear in that same grid.
 *
 * Online/offline is the status of the machine. Listing it means it has been
 * added; a separate "connected" pill is not shown.
 *
 * @param {Object} device A `/list_mcp_connections` device.
 * @returns {Object} A `listConnections` row.
 */
export const connectionRowFromMcpDevice = (device) => {
  const platform = String(device.platform || '').toLowerCase();
  const online = Boolean(device.online);
  const connected = Boolean(device.connected);
  return {
    connection_key: `device:${device.device_id}`,
    source: 'device',
    provider: device.provider || 'desktop_mcp',
    category: 'device',
    display_label: device.device_label || device.server_name || device.device_id,
    sub_label: platform || 'machine',
    connected,
    online,
    status: connected ? (online ? 'online' : 'offline') : 'registered',
    icon_key: PLATFORM_ICON_KEYS[platform] || 'mcp',
    device_id: device.device_id,
    platform: device.platform,
    server_name: device.server_name ?? null,
    connection_mode: device.connection_mode ?? null,
    last_seen_at: device.last_seen_at ?? null,
    connected_at: device.connected_at ?? null,
    bound_assistant_id: device.bound_assistant_id ?? null,
    connect_endpoint: '/connect_mcp',
    disconnect_endpoint: '/disconnect_mcp',
  };
};

/**
 * Fold registered machines into the connectors list so a newly paired daemon
 * appears even when `/list_connections` has not caught up yet. Live presence
 * from `/list_mcp_connections` overwrites stale online/offline on existing rows.
 *
 * @param {Array} connections Rows from `/list_connections`.
 * @param {Array} mcpDevices Devices from `/list_mcp_connections`.
 * @returns {Array} Connections plus any missing machines.
 */
export const mergeMcpDevicesIntoConnections = (connections, mcpDevices) => {
  const deviceById = new Map();
  for (const device of mcpDevices ?? []) {
    if (device?.device_id) deviceById.set(device.device_id, device);
  }

  const rows = (connections ?? []).map((row) => {
    const deviceId = deviceIdFromConnection(row);
    const device = deviceId ? deviceById.get(deviceId) : null;
    if (!device) return row;
    const fromDevice = connectionRowFromMcpDevice(device);
    return {
      ...row,
      ...fromDevice,
      display_label: row.display_label || fromDevice.display_label,
    };
  });

  const seenDeviceIds = new Set(
    rows
      .map((row) => deviceIdFromConnection(row))
      .filter(Boolean)
  );
  for (const device of mcpDevices ?? []) {
    if (!device?.device_id || seenDeviceIds.has(device.device_id)) continue;
    rows.push(connectionRowFromMcpDevice(device));
    seenDeviceIds.add(device.device_id);
  }
  return rows;
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
 * Shape one learned-fact row from the API into the camelCase entry the
 * settings card renders. `namespace` and `key` are the pair the delete and
 * update calls take back.
 */
const normalizeIdentityFact = (row) => ({
  factId: row.fact_id ?? row.key ?? null,
  fact: row.fact ?? '',
  context: row.context ?? null,
  learnedFrom: row.learned_from ?? 'conversation',
  feature: row.feature ?? null,
  sourceLabel: row.source_label ?? null,
  namespace: Array.isArray(row.namespace) ? row.namespace : [],
  key: row.key ?? null,
  createdAt: row.created_at ?? null,
  correctedFrom: row.corrected_from ?? null,
});

/**
 * Everything the avatar has learned about its own identity, newest first:
 * facts the owner told it in chat, first-person facts extracted from uploads,
 * traits derived by analysis, and episodic memories. Creator-only — the API
 * answers 403 for anyone else.
 * GET /avatar_identity_facts
 *
 * @param {string} assistantId The avatar.
 * @returns {Promise<{facts: Array<Object>, counts: Object}>} Normalized rows and
 *   a per-group count (`conversation`, `media`, `analysis`, `memory`).
 */
export const listAvatarIdentityFacts = async (assistantId) => {
  const response = await requestJson('/avatar_identity_facts', {
    query: { assistant_id: assistantId },
  });
  const facts = Array.isArray(response?.facts) ? response.facts : [];
  return {
    facts: facts.map(normalizeIdentityFact),
    counts: response?.counts ?? {},
  };
};

/**
 * Forget one learned fact.
 * DELETE /avatar_identity_facts (204)
 *
 * @param {string} assistantId The avatar.
 * @param {Object} fact A row from listAvatarIdentityFacts (`namespace`, `key`).
 * @returns {Promise<void>}
 */
export const deleteAvatarIdentityFact = async (assistantId, { namespace, key }) => {
  await requestJson('/avatar_identity_facts', {
    method: 'DELETE',
    query: { assistant_id: assistantId },
    body: { namespace, key },
  });
};

/**
 * Rewrite one learned fact in place. The stored format and the row's key are
 * kept, so the avatar reads the corrected wording on its next turn.
 * PUT /avatar_identity_facts
 *
 * @param {string} assistantId The avatar.
 * @param {Object} edit `namespace` and `key` from the listing, the new `fact`,
 *   and optionally a new `context`.
 * @returns {Promise<Object>} The updated row, normalized.
 */
export const updateAvatarIdentityFact = async (
  assistantId,
  { namespace, key, fact, context }
) => {
  const updated = await requestJson('/avatar_identity_facts', {
    method: 'PUT',
    query: { assistant_id: assistantId },
    body: { namespace, key, fact, context },
  });
  return normalizeIdentityFact(updated ?? {});
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
 * Delete one generated emotion still or idle loop. Creator-only; the row is
 * gone from the manifest on the next read, so callers forget the cached
 * manifest and re-read it.
 * DELETE /avatar_emotion_media/{asset_id} (204)
 *
 * @param {string} assetId The asset, from the manifest.
 * @returns {Promise<void>}
 */
export const deleteAvatarEmotionMedia = async (assetId) => {
  await requestJson(`/avatar_emotion_media/${encodeURIComponent(assetId)}`, {
    method: 'DELETE',
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

/**
 * The avatar's voice status: seconds collected, clones, thresholds, active voice.
 * GET /avatar_voice
 *
 * @param {string} assistantId The avatar.
 * @returns {Promise<Object>} `{collected_seconds, instant_voice_id, professional_state, active_voice, ...}`.
 */
export const getAvatarVoice = async (assistantId) => {
  return requestJson('/avatar_voice', { query: { assistant_id: assistantId } });
};

/**
 * Add a recording of the avatar speaking to its voice corpus.
 *
 * The dominant speaker is isolated server-side, so only the avatar's own
 * speech counts toward the clone. Returns the updated voice status plus the
 * seconds this take contributed.
 * POST /avatar_voice/samples
 *
 * @param {string} assistantId The avatar.
 * @param {File|Blob} audio The recording.
 * @returns {Promise<Object>} `{added_seconds, ...voice status}`.
 */
export const addAvatarVoiceSample = async (assistantId, audio) => {
  const formData = new FormData();
  formData.append('assistant_id', assistantId);
  formData.append(
    'audio',
    audio,
    audio.name ?? `voice-sample.${audio.type?.includes('mp4') ? 'm4a' : 'webm'}`
  );
  return requestJson('/avatar_voice/samples', { method: 'POST', formData });
};

/**
 * The CAPTCHA the owner reads aloud to verify the professional voice.
 * GET /avatar_voice/verification
 *
 * @param {string} assistantId The personal avatar.
 * @returns {Promise<Object>} `{voice_id, captcha}` — `captcha.text` is what to read.
 */
export const getAvatarVoiceVerification = async (assistantId) => {
  return requestJson('/avatar_voice/verification', {
    query: { assistant_id: assistantId },
  });
};

/**
 * Submit the spoken CAPTCHA; training starts on success.
 * POST /avatar_voice/verification
 *
 * @param {string} assistantId The personal avatar.
 * @param {File|Blob} recording The owner reading the CAPTCHA.
 * @returns {Promise<Object>} `{professional_state, training_started_at}`.
 */
export const submitAvatarVoiceVerification = async (assistantId, recording) => {
  const formData = new FormData();
  formData.append('assistant_id', assistantId);
  formData.append('recording', recording, recording.name ?? 'captcha.webm');
  return requestJson('/avatar_voice/verification', { method: 'POST', formData });
};

/**
 * Retry professional voice preparation after ElevenLabs refused it.
 * POST /avatar_voice/professional/retry
 *
 * Professional cloning needs the ElevenLabs Creator plan or above; the voice
 * parks in `plan_required` until the account is upgraded and this is called.
 *
 * @param {string} assistantId The personal avatar.
 * @returns {Promise<Object>} `{professional_state, detail}`.
 */
export const retryAvatarProfessionalVoice = async (assistantId) => {
  const formData = new FormData();
  formData.append('assistant_id', assistantId);
  return requestJson('/avatar_voice/professional/retry', { method: 'POST', formData });
};

/**
 * Point the avatar's reference clip at a different upload. Only the reference
 * changes: the avatar's identity and the trained voice stay as they are.
 * POST /avatar_voice/reference
 *
 * @param {string} assistantId The avatar.
 * @param {string} sourceDocumentName A document label from listAvatarDocuments
 *   that has speech in the voice model.
 * @returns {Promise<Object>} The updated voice status.
 */
export const setAvatarVoiceReference = async (assistantId, sourceDocumentName) => {
  return requestJson('/avatar_voice/reference', {
    method: 'POST',
    body: { assistant_id: assistantId, source_document_name: sourceDocumentName },
  });
};

/**
 * Turn one spoken utterance into text (dictation, live-audio turns).
 * POST /transcribe
 *
 * @param {string} assistantId The avatar being spoken to.
 * @param {File|Blob} audio The utterance.
 * @param {Object} [options]
 * @param {boolean} [options.asAnonymousIdentity] Public chat: withhold the credential.
 * @returns {Promise<Object>} `{text, duration_seconds}`.
 */
export const transcribeRecording = async (
  assistantId,
  audio,
  { asAnonymousIdentity = false } = {}
) => {
  const formData = new FormData();
  formData.append('assistant_id', assistantId);
  formData.append('audio', audio, audio.name ?? 'utterance.webm');
  return requestJson('/transcribe', {
    method: 'POST',
    formData,
    asAnonymousIdentity,
  });
};

/**
 * Render text in the avatar's cloned voice.
 *
 * Resolves to an audio Blob. A 409 `voice_not_ready` (no clone yet) is thrown
 * as an ApiError whose `detail` says so and whose `body.collected_seconds`
 * reports progress, so the caller can open the Voice panel.
 * POST /speak
 *
 * @param {string} assistantId The avatar.
 * @param {string} text What to say.
 * @param {Object} [options]
 * @param {boolean} [options.asAnonymousIdentity] Public chat: withhold the credential.
 * @param {AbortSignal} [options.signal] Cancel the request.
 * @returns {Promise<Blob>} MPEG audio.
 */
export const speakText = async (
  assistantId,
  text,
  { asAnonymousIdentity = false, signal } = {}
) => {
  return requestBinary('/speak', {
    method: 'POST',
    body: { assistant_id: assistantId, text },
    asAnonymousIdentity,
    signal,
  });
};

/**
 * Render a lip-synced video of the avatar saying `text` with the given emotion.
 *
 * Starts the generation, then polls until it completes (or fails) and resolves
 * to the clip's absolute URL — or null when the clip could not be made. A 403
 * (the plan lacks video replies) is thrown so the caller can turn the option off.
 * POST /lip_sync, then GET /lip_sync/{generation_id}
 *
 * @param {string} assistantId The avatar.
 * @param {string} text The reply being spoken.
 * @param {string} emotion The reply's base emotion (picks the still).
 * @param {Object} [options]
 * @param {boolean} [options.asAnonymousIdentity] Public chat: withhold the credential.
 * @param {number} [options.pollMilliseconds] Delay between status checks.
 * @param {number} [options.timeoutMilliseconds] Give up after this long.
 * @returns {Promise<string|null>} The clip URL, or null.
 */
export const requestLipSyncClip = async (
  assistantId,
  text,
  emotion,
  { asAnonymousIdentity = false, pollMilliseconds = 4000, timeoutMilliseconds = 240_000 } = {}
) => {
  const started = await requestJson('/lip_sync', {
    method: 'POST',
    body: { assistant_id: assistantId, text, emotion },
    asAnonymousIdentity,
  });
  if (started?.status === 'completed' && started?.video_url) {
    return absoluteMediaUrl(started.video_url);
  }
  const generationId = started?.generation_id;
  if (!generationId) return null;
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollMilliseconds));
    const status = await requestJson(`/lip_sync/${encodeURIComponent(generationId)}`, {
      asAnonymousIdentity,
    });
    if (status?.status === 'completed' && status?.video_url) {
      return absoluteMediaUrl(status.video_url);
    }
    if (status?.status === 'failed') return null;
  }
  return null;
};

/**
 * The owner's agent-inbox items.
 * GET /inbox/items
 *
 * @param {Object} [options]
 * @param {string} [options.state] `open` (default), `all`, or one state.
 * @param {number} [options.limit] Maximum items.
 * @returns {Promise<Object>} `{personal_avatar_id, pending_count, items}`.
 */
export const listInboxItems = async ({ state = 'open', limit = 50 } = {}) => {
  return requestJson('/inbox/items', { query: { state, limit } });
};

/**
 * How many inbox items await the owner — the badge.
 * GET /inbox/count
 *
 * @returns {Promise<Object>} `{pending_count}`.
 */
export const getInboxCount = async () => {
  return requestJson('/inbox/count');
};

/**
 * Deliver the owner's decision on a pending inbox item.
 *
 * `type` is `accept`, `edit`, `ignore`, or `response` (the Avatar Inbox
 * HumanResponse); `edit` carries `{action:'send_reply', args:{subject, body}}`,
 * `response` carries free text.
 * POST /inbox/items/{item_id}/decide
 *
 * @param {string} itemId The item.
 * @param {Object} decision `{type, args}`.
 * @returns {Promise<Object>} `{item}` after the graph resumed.
 */
export const decideInboxItem = async (itemId, decision) => {
  return requestJson(`/inbox/items/${encodeURIComponent(itemId)}/decide`, {
    method: 'POST',
    body: decision,
  });
};

/**
 * Check the owner's connected mailboxes now and triage anything new.
 * POST /inbox/poll
 *
 * @returns {Promise<Object>} `{polled, new_items, at}`.
 */
export const pollInbox = async () => {
  return requestJson('/inbox/poll', { method: 'POST' });
};

/**
 * Delete a conversation thread.
 * DELETE /threads/{thread_id}
 *
 * @param {string} threadId The LangGraph thread.
 * @returns {Promise<*>}
 */
export const deleteConversationThread = async (threadId) => {
  return requestJson(`/threads/${encodeURIComponent(threadId)}`, {
    method: 'DELETE',
  });
};

/**
 * Update a conversation thread (title, pin, and other metadata).
 * PATCH /threads/{thread_id}
 *
 * LangGraph merges this payload at the top level of `metadata` only. Nested
 * `thread_metadata` is replaced as a whole, so a patch that sends just
 * `{ pinned: true }` inside it would drop `user_id` and `assistant_id` and
 * hide the thread from GET /conversations. Existing nested keys are read and
 * merged before the PATCH so rename/share/pin cannot wipe the rest.
 *
 * @param {string} threadId The LangGraph thread.
 * @param {Object} metadata Metadata to merge onto the thread.
 * @returns {Promise<*>}
 */
export const updateConversationThread = async (threadId, metadata) => {
  let existingMetadata = {};
  try {
    const thread = await requestJson(
      `/threads/${encodeURIComponent(threadId)}`
    );
    if (thread?.metadata && typeof thread.metadata === 'object') {
      existingMetadata = thread.metadata;
    }
  } catch {
    // The PATCH still goes out; a missing GET must not block pin or rename.
  }
  const existingNested =
    existingMetadata.thread_metadata &&
    typeof existingMetadata.thread_metadata === 'object'
      ? existingMetadata.thread_metadata
      : {};
  const nextMetadata = {
    ...existingMetadata,
    ...metadata,
  };
  if (metadata?.thread_metadata) {
    nextMetadata.thread_metadata = {
      ...existingNested,
      ...metadata.thread_metadata,
    };
  }
  return requestJson(`/threads/${encodeURIComponent(threadId)}`, {
    method: 'PATCH',
    body: { metadata: nextMetadata },
  });
};

const AMBIENT_SOURCE_BY_FILENAME = {
  'webcam.jpg': 'webcam',
  'screen.jpg': 'screen',
  'microphone.webm': 'microphone',
};

/**
 * Build the request that sends one ambient observation.
 *
 * An observation is an ordinary turn on `POST /message/{assistant_id}` with
 * `ambient=true`: the attached snapshots are described into text on the
 * server, kept in the thread as hidden context, and triaged by the graph as
 * ignore / respond / notify. The same call will carry a microphone clip later,
 * so the avatar always receives one message per capture tick.
 *
 * @param {string} assistantId The avatar that is watching.
 * @param {File[]} files The snapshots (`webcam.jpg`, `screen.jpg`).
 * @param {Object} options
 * @param {string|null} options.threadId The conversation, or null to start one.
 * @param {string} options.capturedAt ISO-8601 time of the capture.
 * @param {boolean} options.voiceMode Whether the person is in voice mode.
 * @param {string} [options.userTimezone] The browser's IANA zone.
 * @returns {{path: string, formData: FormData}}
 */
export const buildAmbientMessageRequest = (
  assistantId,
  files,
  { threadId, capturedAt, voiceMode, userTimezone } = {}
) => {
  const formData = new FormData();
  formData.append('message', '');
  formData.append('stream', 'true');
  formData.append('ambient', 'true');
  formData.append('voice_mode', voiceMode ? 'true' : 'false');
  formData.append('captured_at', capturedAt ?? new Date().toISOString());
  const sources = [];
  for (const file of files ?? []) {
    formData.append('files', file);
    sources.push(AMBIENT_SOURCE_BY_FILENAME[file.name] ?? 'image');
  }
  formData.append('sources', JSON.stringify(sources));
  if (threadId) {
    formData.append('thread_id', threadId);
  }
  if (userTimezone) {
    formData.append('user_timezone', userTimezone);
  }
  return {
    path: `/message/${encodeURIComponent(assistantId)}`,
    formData,
  };
};

/**
 * Record the person's decision on an ambient notification card.
 * POST /ambient_preferences/{assistant_id}
 *
 * `type` is `ignore`, `response`, or `accept` (the Agent Inbox HumanResponse);
 * `args` carries the free-text note of a `response`. The decision is stored as
 * a preference the next triage of a similar scene reads as precedent.
 *
 * @param {string} assistantId The avatar that noticed.
 * @param {Object} decision `{observationId, observationKind, summary, type, args}`.
 * @returns {Promise<Object>} `{recorded, observation_id, preference}`.
 */
export const recordAmbientPreference = async (
  assistantId,
  { observationId, observationKind, summary, type, args }
) => {
  return requestJson(`/ambient_preferences/${encodeURIComponent(assistantId)}`, {
    method: 'POST',
    body: {
      observation_id: observationId ?? null,
      observation_kind: observationKind ?? 'other',
      summary: summary ?? '',
      type,
      args: args ?? null,
    },
  });
};
