import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import CreateAvatarModal from './components/CreateAvatarModal';
import AvatarSelectionComponent from './components/AvatarSelectionComponent';
import VantaBackground from './components/VantaBackground';
import { useAuth } from './context/AuthContext';
import { useMedia } from './context/MediaContext';
import { Toaster } from 'react-hot-toast';
import LiveChat from './components/LiveChat';
import AccountSettings from './components/AccountSettings';
import BillingDashboard from './components/BillingDashboard';

const App = () => {
  const { activeAvatar, setActiveAvatar } = useAuth();
  const {
    messages,
    sendMessage,
    messagesEndRef,
    inputMessage,
    dataExchangeTypes,
  } = useMedia();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDataExchangeDropdown, setShowDataExchangeDropdown] =
    useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('avatar-selection'); // Default to avatar-selection
  const dropdownRef = useRef(null);
  const [isLiveChat, setIsLiveChat] = useState(false);

  const handleEndLiveChat = () => {
    setIsLiveChat(false);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      const isFormElement =
        target.tagName === 'TEXTAREA' ||
        (target.tagName === 'INPUT' && !target.readOnly);

      if (isFormElement) return;

      if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarVisible((v) => !v);
      }

      if (e.key === 'Escape') {
        setShowDataExchangeDropdown(false);
        setSidebarVisible(false);
      }
    };

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDataExchangeDropdown(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [inputMessage, activeAvatar, dataExchangeTypes?.text]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-green-900 text-white relative">
      <VantaBackground />
      <Toaster
        position="top-center"
        containerStyle={{ zIndex: 99999 }}
        toastOptions={{
          style: { boxShadow: 'none', zIndex: 99999 },
          className: 'z-[99999]',
        }}
      />
      <div className="w-screen h-screen flex flex-col gap-1 relative z-10">
        <div className="relative flex flex-grow overflow-hidden justify-center items-center">
          {activeTab === 'avatar-selection' || !activeAvatar ? (
            <AvatarSelectionComponent
              setShowCreateModal={setShowCreateModal}
              setActiveTab={setActiveTab}
              onEndLiveChat={handleEndLiveChat}
            />
          ) : activeTab === 'billing' ? (
            <BillingDashboard />
          ) : activeTab === 'account' ? (
            <AccountSettings />
          ) : isLiveChat ? (
            <LiveChat
              avatarIcon={activeAvatar?.icon}
              onEndLiveChat={handleEndLiveChat}
              onSendVoice={sendMessage}
            />
          ) : (
            <ChatArea
              className="flex flex-grow w-full h-full z-50"
              showDataExchangeDropdown={showDataExchangeDropdown}
              setShowDataExchangeDropdown={setShowDataExchangeDropdown}
              dropdownRef={dropdownRef}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onActivateLiveChat={() => setIsLiveChat(true)}
              setShowCreateModal={setShowCreateModal}
              onEndLiveChat={handleEndLiveChat}
            />
          )}
        </div>
        {showCreateModal && (
          <CreateAvatarModal setShowCreateModal={setShowCreateModal} />
        )}
      </div>
    </div>
  );
};

export default App;
