// src/components/ChatArea.jsx

import React, { useEffect } from 'react';
import { User } from 'lucide-react';
import MessageList from './MessageList';
import InputBar from './InputBar';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import AvatarSettings from './AvatarSettings';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useCallback } from 'react';

const ChatArea = ({
  dropdownRef,
  onActivateLiveChat,
  onEndLiveChat,
  className,
}) => {
  const { activeAvatar, user, setContext } = useAuth();
  const {
    messages,
    messagesEndRef,
    getConversationList,
    getActiveConversationMessages,
    setActiveConversation,
  } = useMedia(); // messages is now a simple array
  const { avatarId } = useParams(); // from /chat/:avatarId
  const navigate = useNavigate();
  // const [activeTab, setActiveTab] = useState('avatar-settings');
  const [activeTab, setActiveTab] = useState('chat');

  // Simple tab switcher
  const handleTabChange = (tab) => {
    if (tab === 'avatar-selection') {
      navigate('/avatars'); // Go back to selection screen
    } else if (tab === 'avatar-settings') {
      setActiveTab('avatar-settings');
    } else if (tab === 'chat') {
      setActiveTab('chat');
    }
  };

  // async handler callback
  const avatarChangeHandler = useCallback(async () => {
    try {
      // Get all the conversations for the current avatar
      // whenever the active avatar changes
      // build context for the conversation
      console.log(`CHAT AREA BREAKPOINT`);
      const context = {
        user_ctx: {
          user_id: user.id,
          name: user.name || '',
          description: user.description || '',
          metadata: user.metadata || {},
        },
        assistant_ctx: {
          assistant_id: avatarId,
          user_id: user.id,
          name: user.name || '',
          description: user.description || '',
          metadata: user.metadata || {},
        },
      };

      setContext(context);

      // get all the conversations for the active avatar
      const threads = await getConversationList(user, activeAvatar);

      // establish the initial conversation: the avatar's recorded active
      // conversation, falling back to the newest thread
      const active_conversation =
        activeAvatar?.metadata?.active_conversation ??
        threads?.[0]?.thread_id ??
        null;

      setActiveConversation(active_conversation);

      // get all the messages for the current conversation
      await getActiveConversationMessages(
        user,
        activeAvatar,
        active_conversation
      );
    } catch (error) {
      console.error(
        'Failed during avatar Change Handler when the avatar changed: ',
        error
      );
    }
  });

  // handle avatar selection
  useEffect(() => {
    if (activeAvatar) {
      avatarChangeHandler();
    }
  }, [activeAvatar]);

  return (
    <div
      className={`flex flex-row flex-grow w-full h-full bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden relative ${className}`}
    >
      {/* Main Chat Section */}
      <div className="flex flex-col flex-grow p-2 sm:p-4 relative z-10">
        {/* Tabs */}
        <div className="flex justify-center mb-2 border-b border-white/20 gap-4">
          <button
            className={`px-4 py-2 ${
              activeTab === 'chat'
                ? 'border-b-2 border-white font-semibold'
                : ''
            } text-white`}
            onClick={() => handleTabChange('chat')}
          >
            {activeAvatar?.name
              ? `A.I. ${activeAvatar.name} Chat`
              : 'A.I. Chat'}
          </button>
          <button
            className={`px-4 py-2 ${
              activeTab === 'avatar-settings'
                ? 'border-b-2 border-white font-semibold'
                : ''
            } text-white`}
            onClick={() => handleTabChange('avatar-settings')}
          >
            Avatar Settings
          </button>
          <button
            className={`px-4 py-2 ${
              activeTab === 'avatar-selection'
                ? 'border-b-2 border-white font-semibold'
                : ''
            } text-white`}
            onClick={() => navigate('/avatars')}
          >
            Avatar Selection
          </button>
        </div>

        {activeTab === 'chat' && (
          <div className="flex flex-col flex-grow overflow-hidden">
            <div className="flex-grow overflow-y-auto p-2 sm:p-4 relative">
              <MessageList
                messages={messages} // Pass messages array directly
                messagesEndRef={messagesEndRef}
              />
            </div>

            <div className="flex-shrink-0 items-center mt-2">
              <InputBar
                avatarId={activeAvatar?.assistant_id ?? avatarId}
                dropdownRef={dropdownRef}
              />
            </div>
          </div>
        )}

        {activeTab === 'avatar-settings' && (
          <div className="flex flex-col flex-grow p-2 sm:p-4 relative overflow-y-auto">
            <AvatarSettings
              avatarId={activeAvatar?.assistant_id ?? avatarId}
              onAvatarDeleted={() => {
                // Switch to avatar selection tab after deletion
                setActiveTab('avatar-selection');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatArea;
