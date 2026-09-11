// src/hooks/usePersonalAvatar.js
import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  assistantIdOfAvatar,
  personalAvatarOf,
} from '../services/personalAvatar';

/**
 * The signed-in person's own avatar, when the list in context holds it.
 *
 * @returns {{personalAvatar: Object|null, personalAssistantId: string|null}}
 */
export default function usePersonalAvatar() {
  const { userAvatars } = useAuth();
  const personalAvatar = useMemo(
    () => personalAvatarOf(userAvatars),
    [userAvatars]
  );
  return {
    personalAvatar,
    personalAssistantId: assistantIdOfAvatar(personalAvatar),
  };
}
