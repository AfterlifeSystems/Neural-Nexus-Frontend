// src/hooks/useAvatarReferenceImage.js
//
// One avatar's stored portrait, for a card that shows an avatar the person has
// not opened. Avatar records carry no imagery, so it comes from
// GET /avatar_reference_image like everywhere else.

import { useEffect, useState } from 'react';

import { getAvatarReferenceImage } from '../services/avatarService';
import { isValidImageUrl } from '../components/utils';

/**
 * @param {string|null|undefined} assistantId
 * @param {{asAnonymousIdentity?: boolean}} [options] Ask as the visitor.
 * @returns {string|null} A data URI or URL, or null while loading / when none.
 */
export default function useAvatarReferenceImage(
  assistantId,
  { asAnonymousIdentity = false } = {}
) {
  const [portrait, setPortrait] = useState(null);
  useEffect(() => {
    setPortrait(null);
    if (!assistantId) return undefined;
    let cancelled = false;
    getAvatarReferenceImage(assistantId, { asAnonymousIdentity })
      .then((image) => {
        if (!cancelled) setPortrait(isValidImageUrl(image) ? image : null);
      })
      .catch((portraitError) => {
        // No portrait is the normal case for many avatars; whatever stands in
        // for it (initials on a pin) stays.
        console.debug('No portrait for this avatar:', portraitError);
      });
    return () => {
      cancelled = true;
    };
  }, [assistantId, asAnonymousIdentity]);
  return portrait;
}
