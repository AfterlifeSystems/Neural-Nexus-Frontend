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

const ChatArea = ({
  dropdownRef,
  onActivateLiveChat,
  onEndLiveChat,
  className,
}) => {
  const { accessToken, activeAvatar, user } = useAuth();
  const { messages, messagesEndRef } = useMedia(); // messages is now a simple array
  const { avatarId } = useParams(); // from /chat/:avatarId
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('avatar-settings');

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
                avatarId={activeAvatar?.avatar_id}
                accessToken={accessToken}
                dropdownRef={dropdownRef}
              />
            </div>
          </div>
        )}

        {activeTab === 'avatar-settings' && (
          <div className="flex flex-col flex-grow p-2 sm:p-4 relative overflow-y-auto">
            <AvatarSettings
              avatarId={activeAvatar?.avatar_id}
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
