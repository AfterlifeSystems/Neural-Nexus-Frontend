// src/hooks/useAvatarVideoReplies.js
import { useCallback, useEffect, useState } from 'react';
import {
  readAvatarVideoReplies,
  subscribeAvatarVideoReplies,
  writeAvatarVideoReplies,
} from '../config/avatarVideoReplies';

/**
 * This avatar's choice to generate a lip-synced video of each spoken reply.
 *
 * @param {string|null|undefined} assistantId The avatar the choice belongs to.
 * @returns {{videoEnabled: boolean, setVideoEnabled: Function}}
 */
export default function useAvatarVideoReplies(assistantId) {
  const [videoEnabled, setEnabled] = useState(() =>
    readAvatarVideoReplies(assistantId)
  );
  useEffect(() => {
    setEnabled(readAvatarVideoReplies(assistantId));
    return subscribeAvatarVideoReplies((changedId) => {
      if (!changedId || changedId === assistantId) {
        setEnabled(readAvatarVideoReplies(assistantId));
      }
    });
  }, [assistantId]);
  const setVideoEnabled = useCallback(
    (enabled) => {
      writeAvatarVideoReplies(assistantId, enabled);
    },
    [assistantId]
  );
  return { videoEnabled, setVideoEnabled };
}
