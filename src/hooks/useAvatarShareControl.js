// src/hooks/useAvatarShareControl.js
import { useCallback, useEffect, useState } from 'react';
import {
  readAvatarShareControl,
  subscribeAvatarShareControl,
  writeAvatarShareControl,
} from '../config/avatarShareControl';

/**
 * Whether this avatar may open the camera for a look and switch shares off.
 *
 * @param {string|null|undefined} assistantId The avatar the permission is for.
 * @returns {{shareControlAllowed: boolean, setShareControlAllowed: Function}}
 */
export default function useAvatarShareControl(assistantId) {
  const [shareControlAllowed, setAllowed] = useState(() =>
    readAvatarShareControl(assistantId)
  );
  useEffect(() => {
    setAllowed(readAvatarShareControl(assistantId));
    return subscribeAvatarShareControl((changedId) => {
      if (!changedId || changedId === assistantId) {
        setAllowed(readAvatarShareControl(assistantId));
      }
    });
  }, [assistantId]);
  const setShareControlAllowed = useCallback(
    (allowed) => {
      writeAvatarShareControl(assistantId, allowed);
    },
    [assistantId]
  );
  return { shareControlAllowed, setShareControlAllowed };
}
