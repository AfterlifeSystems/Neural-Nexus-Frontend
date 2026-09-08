/**
 * After POST /create_avatar, take the person to that avatar's settings.
 *
 * Create used to close the dialog and leave the gallery on screen. A new
 * avatar has no portrait, no voice, and no documents yet — settings is the
 * next place the creator needs to be, not another click through the card they
 * just made.
 */

export function assistantIdOf(avatar) {
  if (typeof avatar === 'string') {
    const trimmed = avatar.trim();
    return trimmed || null;
  }
  return (
    avatar?.assistant_id ??
    avatar?.avatar_id ??
    avatar?.metadata?.assistant_id ??
    null
  );
}

/**
 * The assistant record from a create response, whatever the API wraps it in.
 *
 * @param {*} created The POST /create_avatar JSON body.
 * @returns {Object|null}
 */
export function unwrapCreatedAvatarRecord(created) {
  if (typeof created === 'string' && created.trim()) {
    return { assistant_id: created.trim() };
  }
  if (!created || typeof created !== 'object') return null;
  if (assistantIdOf(created)) return created;

  const nested =
    created.avatar ??
    created.assistant ??
    created.data ??
    created.created ??
    created.result ??
    null;
  if (nested != null && nested !== created) {
    return unwrapCreatedAvatarRecord(nested);
  }
  if (created.name) return created;
  return null;
}

/**
 * The avatar that was just created, preferring the refreshed list record.
 *
 * The list copy is the one ChatArea uses to decide ownership, so settings
 * can open on the first paint instead of bouncing through Chat.
 *
 * @param {Object} [parameters]
 * @param {*} [parameters.created] The create response.
 * @param {Array} [parameters.listedAvatars] GET /list_user_avatars after create.
 * @param {Array} [parameters.previousAvatars] The list that was on screen before.
 * @param {string} [parameters.createdName] The name typed in the dialog.
 * @returns {Object|null}
 */
export function resolveCreatedAvatar({
  created,
  listedAvatars,
  previousAvatars,
  createdName,
} = {}) {
  const createdRecord = unwrapCreatedAvatarRecord(created);
  const createdId = assistantIdOf(createdRecord);
  const listed = Array.isArray(listedAvatars) ? listedAvatars : [];

  if (createdId) {
    const fromList = listed.find(
      (avatar) => assistantIdOf(avatar) === createdId
    );
    if (fromList) return fromList;
  }

  const previousIds = new Set(
    (Array.isArray(previousAvatars) ? previousAvatars : [])
      .map(assistantIdOf)
      .filter(Boolean)
  );
  const newcomers = listed.filter((avatar) => {
    const id = assistantIdOf(avatar);
    return id && !previousIds.has(id);
  });
  if (newcomers.length === 1) return newcomers[0];

  const name = String(createdName ?? createdRecord?.name ?? '').trim();
  if (name) {
    const pool = newcomers.length > 0 ? newcomers : listed;
    const named = pool.filter(
      (avatar) => String(avatar?.name ?? '').trim() === name
    );
    if (named.length === 1) return named[0];
  }

  return createdRecord;
}

/**
 * The workspace URL that opens this avatar on the settings tab.
 *
 * @param {Object|string|null|undefined} avatar The created avatar, or its id.
 * @returns {string|null}
 */
export function avatarSettingsPath(avatar) {
  const id = assistantIdOf(avatar);
  if (!id) return null;
  return `/chat/${encodeURIComponent(id)}?tab=settings`;
}
