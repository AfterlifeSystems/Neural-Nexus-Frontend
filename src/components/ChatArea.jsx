// src/components/ChatArea.jsx

import React, { useEffect } from 'react';
import { User, AudioLines } from 'lucide-react';
import LiveTranscriptionTicker from './LiveTranscriptionTicker';
import MessageList from './MessageList';
import InputBar from './InputBar';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import AvatarSettings from './AvatarSettings';
import AvatarSelectionComponent from './AvatarSelectionComponent';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
const ChatArea = ({
  showDataExchangeDropdown,
  setShowDataExchangeDropdown,
  dropdownRef,
  onActivateLiveChat,
  setShowCreateModal,
  onEndLiveChat,
  className,
}) => {
  const { isLoggedIn, accessToken, activeAvatar, setActiveAvatar } = useAuth();
  const { messages, setMessages, fetchMessages, messagesEndRef } = useMedia();
  const { avatarId } = useParams(); // from /chat/:avatarId
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('chat');
  // const { messages, fetchMessages, messagesEndRef } = useMedia();

  // Load messages when avatarId changes
  useEffect(() => {
    if (avatarId) {
      fetchMessages(avatarId);
    }
  }, [avatarId, fetchMessages]);

  // Send message handler (passed to InputBar)
  const handleSendMessage = (text) => {
    if (!avatarId || !text.trim()) return;
    sendMessage(avatarId, text); // Sends to correct avatar's conversation
  };

  // Simple tab switcher (no setActiveTab prop needed)
  const handleTabChange = (tab) => {
    if (tab === 'avatar-selection') {
      navigate('/avatars'); // Go back to selection screen
    } else if (tab === 'avatar-settings') {
      setActiveTab('avatar-settings');
    } else if (tab === 'chat') {
      setActiveTab('chat');
    } else {
      // Just update local tab state or do nothing (keep single chat view)
      console.log('Tab changed to:', tab);
    }
  };

  return (
    <div
      className={`flex flex-row flex-grow w-full h-full bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden relative ${className}`}
    >
      {/* Background Image or User Icon - only show when not logged in or no active avatar */}
      <>
        {/* {activeAvatar?.icon ? (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${activeAvatar.icon})`,
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <User className="w-64 h-64 text-gray-400 opacity-20" />
          </div>
        )} */}
        {/* Overlay for better contrast */}
        {/* <div className="absolute inset-0 bg-black/30" /> */}
      </>

      {/* Main Chat Section */}
      <div className="flex flex-col flex-grow p-2 sm:p-4 relative z-10">
        {/* Tabs */}
        {
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
        }

        {activeTab === 'chat' && (
          <div className="flex flex-col flex-grow overflow-hidden">
            <div className="flex-grow overflow-y-auto p-2 sm:p-4 relative">
              <MessageList
                messages={messages[activeAvatar.avatar_id] || []}
                messagesEndRef={messagesEndRef}
              />
            </div>

            <div className="flex-shrink-0 items-center mt-2">
              <InputBar
                avatarId={activeAvatar.avatar_id}
                accessToken={accessToken}
                dropdownRef={dropdownRef}
                isLiveChatView={false}
                onActivateLiveChat={onActivateLiveChat}
              />
            </div>
          </div>
        )}

        {activeTab === 'avatar-settings' && (
          <div className="flex flex-col flex-grow p-2 sm:p-4 relative overflow-y-auto">
            <AvatarSettings
              avatarId={activeAvatar.avatar_id}
              accessToken={accessToken}
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
