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
 * @param {string|null|undefined} assistantId The avatar the choice belongs to.
 * @returns {{showGenerated: boolean, setShowGenerated: Function}}
 */
export default function useAvatarFaceSource(assistantId) {
  const [source, setSource] = useState(() => readAvatarFaceSource(assistantId));
  useEffect(() => {
    setSource(readAvatarFaceSource(assistantId));
    return subscribeAvatarFaceSource((changedId) => {
      if (!changedId || changedId === assistantId) {
        setSource(readAvatarFaceSource(assistantId));
      }
    });
  }, [assistantId]);
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
