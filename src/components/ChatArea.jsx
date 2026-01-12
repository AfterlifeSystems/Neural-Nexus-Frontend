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

const ChatArea = ({
  showDataExchangeDropdown,
  setShowDataExchangeDropdown,
  dropdownRef,
  activeTab,
  setActiveTab,
  onActivateLiveChat,
  setShowCreateModal,
  onEndLiveChat,
  className,
}) => {
  const { isLoggedIn, accessToken, activeAvatar, setActiveAvatar } = useAuth();
  const { messages, setMessages, fetchMessages, messagesEndRef } = useMedia();

  return (
    <div
      className={`flex flex-row flex-grow bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden relative ${className}`}
    >
      {/* Background Image or User Icon - only show when not logged in or no active avatar */}
      {(!isLoggedIn || (!activeAvatar && activeTab === 'chat')) && (
        <>
          {activeAvatar?.icon ? (
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
          )}
          {/* Overlay for better contrast */}
          <div className="absolute inset-0 bg-black/30" />
        </>
      )}

      {/* Main Chat Section */}
      <div className="flex flex-col flex-grow p-2 sm:p-4 relative z-10">
        {/* Tabs */}
        {isLoggedIn && (
          <div className="flex justify-center mb-2 border-b border-white/20 gap-4">
            <button
              className={`px-4 py-2 ${
                activeTab === 'chat'
                  ? 'border-b-2 border-white font-semibold'
                  : ''
              } text-white`}
              onClick={() => setActiveTab('chat')}
            >
              {activeAvatar?.name
                ? `A.I. ${activeAvatar.name} Chat`
                : 'A.I. Chat'}
            </button>
            <button
              className={`px-4 py-2 ${
                activeTab === 'documents'
                  ? 'border-b-2 border-white font-semibold'
                  : ''
              } text-white`}
              onClick={() => setActiveTab('documents')}
            >
              Avatar Settings
            </button>
            <button
              className={`px-4 py-2 ${
                activeTab === 'avatar-selection'
                  ? 'border-b-2 border-white font-semibold'
                  : ''
              } text-white`}
              onClick={() => setActiveTab('avatar-selection')}
            >
              Avatar Selection
            </button>
          </div>
        )}

        <LiveTranscriptionTicker isTranscribing={false} />

        {!isLoggedIn && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-2xl z-20">
            <div className="text-center">
              <h2 className="text-4xl font-bold text-white mb-4">
                Welcome to Neural Nexus
              </h2>
              <p className="text-white/80 text-lg">Please log in to continue</p>
            </div>
          </div>
        )}

        {isLoggedIn && activeTab === 'chat' && activeAvatar && (
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

        {isLoggedIn && activeTab === 'chat' && !activeAvatar && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-2xl z-20">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                No Avatar Selected
              </h2>
              <p className="text-white/80 text-lg mb-6">
                Please select an avatar to start chatting
              </p>
              <button
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all duration-300"
                onClick={() => setActiveTab('avatar-selection')}
              >
                Select Avatar
              </button>
            </div>
          </div>
        )}

        {isLoggedIn && activeTab === 'documents' && activeAvatar && (
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

        {isLoggedIn && activeTab === 'avatar-selection' && (
          <div className="flex flex-col flex-grow p-2 sm:p-4 relative overflow-y-auto">
            <AvatarSelectionComponent
              setShowCreateModal={setShowCreateModal}
              setActiveTab={setActiveTab}
              onEndLiveChat={onEndLiveChat}
            />
          </div>
        )}
      </div>
    </div>
  );
};
export default ChatArea;
