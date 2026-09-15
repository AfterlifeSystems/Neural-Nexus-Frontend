// src/hooks/useAvatarFaceSource.js
import { useCallback, useEffect, useState } from 'react';
import {
  AVATAR_FACE_SOURCE_GENERATED,
  AVATAR_FACE_SOURCE_REFERENCE,
  readAvatarFaceSource,
  subscribeAvatarFaceSource,
  writeAvatarFaceSource,
} from '../config/avatarFaceSource';

/**
 * This avatar's choice between generated emotion media and the original photo.
 *
 * The store is read for the open assistant on every render. Caching the
 * choice in `useState` kept the previous avatar's generated/reference
 * setting for one paint after a swap, so the well jumped between 9:16 and
 * a square.
 *
 * @param {string|null|undefined} assistantId The avatar the choice belongs to.
 * @returns {{showGenerated: boolean, setShowGenerated: Function}}
 */
export default function useAvatarFaceSource(assistantId) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    return subscribeAvatarFaceSource((changedId) => {
      if (!changedId || changedId === assistantId) {
        setRevision((count) => count + 1);
      }
    });
  }, [assistantId]);
  const source = readAvatarFaceSource(assistantId);
  void revision;
  const setShowGenerated = useCallback(
    (show) => {
      writeAvatarFaceSource(
        assistantId,
        show ? AVATAR_FACE_SOURCE_GENERATED : AVATAR_FACE_SOURCE_REFERENCE
      );
    },
    [assistantId]
  );
  return {
    showGenerated: source === AVATAR_FACE_SOURCE_GENERATED,
    setShowGenerated,
  };
}

/**
 * Bumps when any avatar's face source changes, so a list of cards can re-read.
 *
 * @returns {number}
 */
export function useAvatarFaceSourceRevision() {
  const [revision, setRevision] = useState(0);
  useEffect(
    () => subscribeAvatarFaceSource(() => setRevision((count) => count + 1)),
    []
  );
  return revision;
}
