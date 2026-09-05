/**
 * Rebuild the signed-in user after GET /verify_login_status.
 *
 * The API names the account. The stored record names the identifier this
 * browser already resolved. Prefer the API email so Account Settings shows
 * the address even when an older local session omitted it.
 *
 * @param {Object|null} storedUser The record in localStorage.
 * @param {Object|null} loginStatus Body of `/verify_login_status`.
 * @returns {Object|null} The user to hold in context, or null to stay signed out.
 */
export function restoreSignedInUser(storedUser, loginStatus) {
  if (!loginStatus?.logged_in || !storedUser?.id) return null;
  return {
    ...storedUser,
    email: loginStatus.email || storedUser.email,
  };
}
