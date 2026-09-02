import { isAdminAccount } from '../config/adminAccount';
import { getSessionCredential } from '../services/neuralNexusApiClient';

export const isValidImageUrl = (url) => {
  if (!url) return false;
  if (url.startsWith('data:image/')) {
    return url.includes('base64,');
  }
  return /^(https?:\/\/|\/)/.test(url);
};

/**
 * Decide whether the signed-in user created this avatar.
 *
 * `metadata.user_id` is the creator, and it is the same field the API enforces
 * on for editing, uploading and deleting. Public listings strip `metadata`
 * entirely and the user listing strips it from any public entry, so an avatar
 * with no metadata is one the caller does not own — absence is the answer, not
 * missing information.
 *
 * Ownership decides whether settings are offered at all, so it fails closed:
 * without a signed-in user or an avatar, nobody owns anything.
 *
 * @param {Object} avatar An avatar/assistant record.
 * @param {Object} user The signed-in user.
 * @returns {boolean} Whether the user may administer this avatar.
 */
export const isAvatarOwnedByUser = (avatar, user) => {
  if (!avatar || !user?.id) return false;
  const creatorId = avatar.metadata?.user_id;
  return Boolean(creatorId) && creatorId === user.id;
};

/**
 * Decide whether this avatar is currently listed in the public gallery.
 *
 * The owner's own copy of an avatar carries `metadata.is_public`, so that flag
 * answers the question outright. An avatar arriving WITHOUT metadata is one the
 * API stripped, and the API strips metadata from exactly one kind of record:
 * another user's public avatar. Absence therefore means public, and reading it
 * as private would show the administrator a "Share publicly" control for an
 * avatar that is already published.
 *
 * @param {Object} avatar An avatar/assistant record.
 * @returns {boolean} Whether the avatar is listed publicly.
 */
export const isAvatarListedPublicly = (avatar) => {
  if (!avatar) return false;
  if (!avatar.metadata) return true;
  return Boolean(avatar.metadata.is_public);
};

/**
 * Decide whether the signed-in user may publish or withdraw this avatar.
 *
 * This mirrors what POST /share_avatar enforces, and it is deliberately a
 * different question from {@link isAvatarOwnedByUser}. Ordinarily an avatar may
 * be shared only by the person who created it, and only when the avatar depicts
 * that person — a user publishes their own likeness, not a character they
 * invented. The administrator is exempt from both halves of that rule and may
 * share any avatar, so for that account this is true where ownership is false.
 *
 * @param {Object} avatar An avatar/assistant record.
 * @param {Object} user The signed-in user.
 * @returns {boolean} Whether the user may change this avatar's sharing.
 */
export const canShareAvatar = (avatar, user) => {
  if (!avatar || !user?.id) return false;
  if (isAdminAccount(user)) return true;
  return (
    isAvatarOwnedByUser(avatar, user) &&
    Boolean(avatar.metadata?.is_personal_avatar_of_creator)
  );
};

/**
 * The route a shared avatar is reached at.
 *
 * Shared links are handed to people who have no account, so the path is short
 * enough to read out loud or put on a QR code, and carries nothing but the
 * avatar: no api key, no thread. Compare the Streamlit interface's
 * `?assistant_id=` links, which this replaces for public sharing.
 */
export const SHARED_AVATAR_ROUTE_PREFIX = '/share';

/**
 * Build the link that opens one avatar's public chat.
 *
 * The origin is taken from the page doing the sharing rather than configured,
 * so a link copied from a preview deployment points back at that deployment
 * instead of silently sending people to production.
 *
 * @param {string} assistantId The avatar to share.
 * @param {string} [origin] Override the origin (tests, previews).
 * @returns {string} An absolute URL, or an empty string without an avatar.
 */
export const buildSharedAvatarUrl = (
  assistantId,
  origin = typeof window === 'undefined' ? '' : window.location.origin
) =>
  assistantId
    ? `${origin}${SHARED_AVATAR_ROUTE_PREFIX}/${encodeURIComponent(assistantId)}`
    : '';

/**
 * The chats this BROWSER has held with one shared avatar.
 *
 * The API scopes an anonymous visitor by network address: every guest chat from
 * one address resolves to the same identity, so GET /conversations on a shared
 * link returns everything that address has ever said to the avatar — earlier
 * demo sessions, another tab's chat, and, behind one office or café NAT, a
 * stranger's. None of that is this reader's conversation, and offering it as
 * theirs is both confusing and a disclosure.
 *
 * So the panel lists the intersection: threads the server confirms belong to
 * the anonymous identity AND that this browser started. The thread ids are the
 * only part kept locally; the titles and previews still come from the server.
 * Clearing site data forgets them, which is the right behaviour for a guest.
 */
const sharedAvatarThreadsStorageKey = (assistantId) =>
  `shared_avatar_threads_${assistantId}`;

/**
 * Note that this browser started a conversation with a shared avatar.
 *
 * @param {string} assistantId The shared avatar.
 * @param {string} threadId The thread the server minted.
 */
export const rememberSharedAvatarThread = (assistantId, threadId) => {
  if (!assistantId || !threadId) return;
  try {
    const storageKey = sharedAvatarThreadsStorageKey(assistantId);
    const remembered = listRememberedSharedAvatarThreadIds(assistantId);
    if (remembered.includes(threadId)) return;
    localStorage.setItem(
      storageKey,
      JSON.stringify([threadId, ...remembered].slice(0, 100))
    );
  } catch (storageError) {
    // Private mode, or a full quota. Losing the note costs the visitor a
    // history panel, never the conversation they are having.
    console.debug('Could not remember this guest conversation:', storageError);
  }
};

/**
 * The thread ids this browser has started with a shared avatar, newest first.
 *
 * @param {string} assistantId The shared avatar.
 * @returns {string[]} Thread identifiers; empty when there are none to read.
 */
export const listRememberedSharedAvatarThreadIds = (assistantId) => {
  if (!assistantId) return [];
  try {
    const stored = JSON.parse(
      localStorage.getItem(sharedAvatarThreadsStorageKey(assistantId)) ?? '[]'
    );
    return Array.isArray(stored)
      ? stored.filter((threadId) => typeof threadId === 'string')
      : [];
  } catch (storageError) {
    console.debug('Could not read remembered guest conversations:', storageError);
    return [];
  }
};

/**
 * Read the path the browser is on, without assuming there is a browser.
 *
 * @returns {string} The current path, or an empty string outside a browser.
 */
const currentPathname = () =>
  typeof window === 'undefined' ? '' : window.location.pathname;

/**
 * Whether this path is the public chat of a shared avatar link.
 *
 * True for the chat itself — `/share/<assistant id>` — and deliberately NOT for
 * the pages underneath it. It answers one question: is the person on this
 * screen talking to the avatar as an anonymous visitor? On the chat they are,
 * whether or not a session happens to be stored in this browser, because that
 * is what a shared link is. On `/share/<assistant id>/billing` they are not:
 * that screen signs a signed-in visitor into the customer portal with their own
 * credential, and treating it as anonymous would take their own account away
 * from them.
 *
 * @param {string} [pathname] The path to judge; defaults to the current one.
 * @returns {boolean} Whether this is a shared avatar's public chat.
 */
export const isSharedAvatarChatPath = (pathname = currentPathname()) =>
  new RegExp(`^${SHARED_AVATAR_ROUTE_PREFIX}/[^/]+/?$`).test(pathname);

/**
 * Whether the person reading this screen is acting as an anonymous visitor.
 *
 * Two ways to be one, and both count: holding no session at all, or being on a
 * shared avatar's public chat, where the turn is sent as the anonymous identity
 * whatever session this browser happens to hold. It decides what to offer them
 * — signing up, or the subscription and payment method their account already
 * has — so a signed-in person following a shared link is offered the sign-up,
 * because it is the anonymous allotment they just spent.
 *
 * @param {string} [pathname] The path to judge; defaults to the current one.
 * @returns {boolean} Whether to address this reader as an anonymous visitor.
 */
export const readerIsAnonymousVisitor = (pathname = currentPathname()) =>
  !getSessionCredential() || isSharedAvatarChatPath(pathname);

/**
 * Whether this path belongs to a shared avatar link at all — the public chat or
 * anything under it, such as its billing screen.
 *
 * Distinct from `isSharedAvatarChatPath`, which answers a narrower question
 * (does this screen speak to the API as the anonymous visitor). This one
 * answers "is the visitor's sidebar on screen", which is what a page-level
 * ornament needs to know before adding a second copy of something the sidebar
 * already carries.
 *
 * @param {string} [pathname] The path to judge; defaults to the current one.
 * @returns {boolean} Whether this path is served under a shared avatar link.
 */
export const isSharedAvatarLinkPath = (pathname = currentPathname()) =>
  pathname === SHARED_AVATAR_ROUTE_PREFIX ||
  pathname.startsWith(`${SHARED_AVATAR_ROUTE_PREFIX}/`);

/**
 * The billing screen to send the reader of this path to.
 *
 * `/billing` is behind the sign-in guard, so a visitor following a shared link
 * would be bounced to the login page by it. Every shared link carries its own
 * public billing route to the same customer portal — which has its own sign-in
 * and its own sign-up — so a visitor is sent there instead. This is the same
 * reasoning, and the same destination, as AnonymousSidebar's `billingPath`.
 *
 * @param {string} [pathname] The path to resolve from; defaults to the current one.
 * @returns {string} The path of the billing screen this reader can reach.
 */
export const resolveBillingPath = (pathname = currentPathname()) => {
  const sharedLink = new RegExp(
    `^${SHARED_AVATAR_ROUTE_PREFIX}/([^/]+)`
  ).exec(pathname);
  return sharedLink
    ? `${SHARED_AVATAR_ROUTE_PREFIX}/${sharedLink[1]}/billing`
    : '/billing';
};

// Portraits are cached under one key each. The prefix is named once so the
// readers, the writer, and the two eviction paths cannot disagree about it.
const AVATAR_ICON_KEY_PREFIX = 'avatar_icon_';

/**
 * Every portrait this browser has already seen, keyed by assistant_id.
 *
 * Read synchronously at mount so the gallery can paint immediately instead of
 * waiting on a request per avatar. What comes back may be stale — the caller is
 * expected to revalidate against the API and correct any entry that changed.
 *
 * @returns {Object} A map of assistant_id to data URI / URL.
 */
export const readCachedAvatarIcons = () => {
  const cachedIcons = {};
  try {
    for (let keyIndex = 0; keyIndex < localStorage.length; keyIndex++) {
      const key = localStorage.key(keyIndex);
      if (!key?.startsWith(AVATAR_ICON_KEY_PREFIX)) continue;
      const iconSource = localStorage.getItem(key);
      if (iconSource) {
        cachedIcons[key.slice(AVATAR_ICON_KEY_PREFIX.length)] = iconSource;
      }
    }
  } catch (cacheError) {
    // Private mode and disabled storage both throw here. A cold gallery is the
    // cost; it still fills in from the API.
    console.error('Failed to read cached avatar portraits:', cacheError);
  }
  return cachedIcons;
};

/**
 * Remember one avatar's portrait for the next visit.
 *
 * A portrait is a base64 data URI and can run to hundreds of kilobytes, so a
 * large account can exhaust the storage quota. That is survivable — the cache
 * is an optimisation, and the API remains the source of truth — so a failed
 * write is logged and otherwise ignored.
 *
 * @param {string} avatarId The assistant_id the portrait belongs to.
 * @param {string} iconSource A data URI or image URL.
 */
export const writeCachedAvatarIcon = (avatarId, iconSource) => {
  if (!avatarId || !iconSource) return;
  try {
    localStorage.setItem(`${AVATAR_ICON_KEY_PREFIX}${avatarId}`, iconSource);
  } catch (cacheError) {
    console.error('Failed to cache an avatar portrait:', cacheError);
  }
};

/**
 * Forget one avatar's portrait, leaving the rest of its cached state alone.
 *
 * Used when the API answers that an avatar has no stored portrait: the entry is
 * not stale, it is wrong, and leaving it would show a picture the avatar no
 * longer has.
 *
 * @param {string} avatarId The assistant_id whose portrait is gone.
 */
export const forgetCachedAvatarIcon = (avatarId) => {
  if (!avatarId) return;
  try {
    localStorage.removeItem(`${AVATAR_ICON_KEY_PREFIX}${avatarId}`);
  } catch (cacheError) {
    console.error('Failed to drop a cached avatar portrait:', cacheError);
  }
};

/**
 * Drop every browser-local trace of one avatar.
 *
 * The selection screen caches an avatar's icon and gallery position under
 * per-avatar keys, and remembers the last avatar used. Those entries outlive the
 * avatar itself, so a deleted avatar can reappear as a tile or be restored as
 * the last selection unless they are removed at the moment of deletion.
 *
 * @param {string} avatarId The assistant_id of the avatar being forgotten.
 */
export const forgetCachedAvatar = (avatarId) => {
  if (!avatarId) return;
  try {
    localStorage.removeItem(`${AVATAR_ICON_KEY_PREFIX}${avatarId}`);
    localStorage.removeItem(`avatar_position_${avatarId}`);
    for (const sharedKey of [
      'last_used_avatar_id',
      'last_used_avatar_index',
      'last_avatar_icon',
      'last_avatar_position',
      'current_card_index',
    ]) {
      // These name "whichever avatar was last used" rather than a specific one,
      // so they cannot be checked against this id — and pointing at a deleted
      // avatar is worse than pointing at nothing.
      localStorage.removeItem(sharedKey);
    }
  } catch (cacheError) {
    // Storage can be unavailable (private mode, quota). Losing the cleanup is
    // survivable; failing the deletion over it is not.
    console.error('Failed to clear cached avatar state:', cacheError);
  }
};

/**
 * The API's assistant records carry `assistant_id`, while older parts of this
 * frontend passed around `avatar_id` or nested the id under `metadata`. This
 * resolves whichever shape an avatar object arrives in.
 *
 * @param {Object} avatar An avatar/assistant record.
 * @returns {string|undefined} The assistant identifier.
 */
export const resolveAssistantId = (avatar) =>
  avatar?.assistant_id ?? avatar?.avatar_id ?? avatar?.metadata?.assistant_id;

/**
 * Follow an application path, leaving any frame this page is embedded in.
 *
 * The shared-avatar screen is embedded as the live demo on the landing page, so
 * a plain in-application navigation from it — "Create your own avatar", "About
 * Neural Nexus" — would paint the signup or marketing page inside the demo
 * panel, a few hundred pixels tall, with the landing page still around it.
 * Those destinations are whole screens and belong to the whole window.
 *
 * When the page is not embedded, nothing here applies and the caller's normal
 * router navigation should run instead.
 *
 * @param {string} applicationPath A root-relative path, e.g. "/signup".
 * @returns {boolean} True when the top window was sent to the path, so the
 *   caller should not also navigate; false when this page owns its window, or
 *   when the embedding page is cross-origin and therefore not ours to move.
 */
export const followPathInTopWindow = (applicationPath) => {
  if (typeof window === 'undefined' || window.top === window.self) return false;
  try {
    window.top.location.href = new URL(
      applicationPath,
      window.location.origin
    ).toString();
    return true;
  } catch {
    // A cross-origin embedder. Reading or writing its location throws, and the
    // navigation stays inside this frame rather than failing outright.
    return false;
  }
};
