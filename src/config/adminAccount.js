// src/config/adminAccount.js
//
// Who the administrator is, for the capabilities the API grants that account
// beyond an ordinary user's: sharing any avatar, and uploading reference
// media (a menu or other consultable material, not identity) on avatars
// that account created.
//
// The Neural Nexus API resolves the administrator from ADMIN_USER_ID and lets
// that account publish or withdraw ANY avatar, including avatars it did not
// create and avatars that do not depict their creator — both of which
// /share_avatar refuses for everybody else. This module is how the frontend
// recognises the same account so it can offer the control instead of hiding it.
//
// The account is named here by email address because that is what a person
// signs in with; the API compares an internal user identifier. The two must
// denote the same account — if they drift apart, the sharing control appears
// for an account the API then refuses, and the refusal is surfaced as an error
// on the control rather than being swallowed.

/**
 * The administrator's email address. Configured through
 * VITE_ADMIN_ACCOUNT_EMAIL so a deployment can move the administrator without
 * a code change.
 */
export const ADMIN_ACCOUNT_EMAIL =
  import.meta.env?.VITE_ADMIN_ACCOUNT_EMAIL ?? 'e.woods.business@icloud.com';

/**
 * Decide whether the signed-in user is the administrator.
 *
 * Fails closed the same way ownership does: with no signed-in user, no address
 * on that user, or no configured administrator, nobody is the administrator.
 *
 * @param {Object} user The signed-in user, as held in AuthContext.
 * @returns {boolean} Whether this user holds the administrator's privileges.
 */
export const isAdminAccount = (user) => {
  const signedInEmail = user?.email;
  if (!signedInEmail || !ADMIN_ACCOUNT_EMAIL) return false;
  return (
    signedInEmail.trim().toLowerCase() ===
    ADMIN_ACCOUNT_EMAIL.trim().toLowerCase()
  );
};

/**
 * Decide whether Avatar Settings should offer reference-media upload.
 *
 * Reference media is a consultable item (a restaurant menu, a price list)
 * stored for the avatar to retrieve. The API accepts that flag only on
 * avatars created by the administrator, and only the creator sees the full
 * settings screen, so the signed-in account being the administrator is the
 * whole question. Other accounts never see the option.
 *
 * @param {Object} user The signed-in user, as held in AuthContext.
 * @returns {boolean} Whether the reference-media control should render.
 */
export const canUploadReferenceMedia = (user) => isAdminAccount(user);
