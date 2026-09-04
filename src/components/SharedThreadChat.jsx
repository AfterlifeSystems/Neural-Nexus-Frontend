// src/components/SharedThreadChat.jsx
//
// A read-only window onto one conversation. Shared with others the way an
// anonymous avatar chat is shared: the message list only, no composer, so the
// thread cannot be continued from this link.

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import MessageList from './MessageList';
import { getAvatarReferenceImage, listPublicAvatars } from '../services/avatarService';
import { isValidImageUrl } from './utils';

const SharedThreadChat = () => {
  const { avatarId, threadId } = useParams();
  const { setActiveAvatar } = useAuth();
  const {
    messages,
    messagesEndRef,
    getActiveConversationMessages,
    setActiveConversation,
  } = useMedia();
  const [avatarName, setAvatarName] = useState(null);
  const [avatarPortrait, setAvatarPortrait] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const localEndRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const publicAvatars = await listPublicAvatars(avatarId);
        const avatar = (publicAvatars ?? []).find(
          (candidate) =>
            (candidate.assistant_id ?? candidate.avatar_id) === avatarId
        );
        if (cancelled) return;
        if (avatar) {
          setActiveAvatar(avatar);
          setAvatarName(avatar.name);
        }
        try {
          const portrait = await getAvatarReferenceImage(avatarId);
          if (!cancelled) setAvatarPortrait(portrait);
        } catch {
          // A missing portrait is normal.
        }
        setActiveConversation(threadId);
        await getActiveConversationMessages(null, avatar ?? { assistant_id: avatarId }, threadId);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error.message || 'This conversation is not available.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarId, threadId]);

  return (
    <div className="flex flex-col flex-grow w-full h-full bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-black/50 border border-white/10 flex items-center justify-center">
          {avatarPortrait && isValidImageUrl(avatarPortrait) ? (
            <img src={avatarPortrait} alt="" className="w-full h-full object-cover" />
          ) : (
            <User className="w-4 h-4 text-white/40" />
          )}
        </div>
        <div>
          <p className="text-neutral-200 font-semibold leading-tight">
            {avatarName ?? 'Shared conversation'}
          </p>
          <p className="text-white/40 text-xs">Read only — this conversation cannot be continued here.</p>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto p-4">
        <div className="w-full max-w-3xl mx-auto">
          {loadError ? (
            <p className="text-white/50 text-sm text-center py-12">{loadError}</p>
          ) : (
            <MessageList
              messages={messages}
              messagesEndRef={messagesEndRef ?? localEndRef}
              avatarPortrait={avatarPortrait}
              avatarName={avatarName}
              assistantId={avatarId}
              readOnly
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SharedThreadChat;
