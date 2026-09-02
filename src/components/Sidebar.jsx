//components/Sidebar.jsx

import React from 'react';
import { UserPenIcon, User, Trash2, Settings, Settings2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthComponent from './AuthComponent';
import AnimatedList from './AnimatedList';
import { deleteAvatar, listUserAvatars } from '../services/avatarService';

const Sidebar = ({
  setShowCreateModal,
  isOpen,
  onClose,
  setActiveTab,
  activeTab,
  onEndLiveChat,
}) => {
  const {
    user,
    userAvatars: avatars,
    setUserAvatars,
    activeAvatar,
    setActiveAvatar,
  } = useAuth();
  const isLoggedIn = Boolean(user);

  // Handle avatar selection and close sidebar
  const handleAvatarSelect = (avatar) => {
    setActiveAvatar(avatar);
    setActiveTab('chat'); // <-- this must come from props
    onEndLiveChat?.();
    onClose?.();
  };

  // Handle create avatar button click and close sidebar
  const handleCreateAvatar = () => {
    setShowCreateModal(true);
    setActiveTab('chat');
    onEndLiveChat?.();
    onClose?.();
  };

  const handleSelectDocs = (avatar, e) => {
    e.stopPropagation();
    setActiveAvatar(avatar);
    setActiveTab('documents'); // <-- this must come from props
    onEndLiveChat?.();
    onClose?.();
  };

  const handleDelete = async (avatar, e) => {
    e.stopPropagation();
    const assistantId = avatar.assistant_id ?? avatar.avatar_id;
    try {
      await deleteAvatar(assistantId);
      setUserAvatars(await listUserAvatars());
    } catch (deleteError) {
      console.error('Delete avatar error:', deleteError);
    }
  };

  const renderAvatarItem = (avatar, index, isSelected) => {
    const isActive =
      (activeAvatar?.assistant_id ?? activeAvatar?.avatar_id) ===
      (avatar.assistant_id ?? avatar.avatar_id);

    return (
      <div
        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
          isActive
            ? 'bg-white/10 text-neutral-200 shadow-lg scale-[1.02]'
            : 'hover:bg-white/10 text-neutral-300 hover:text-neutral-100'
        }`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAvatarSelect(avatar);
          if (e.key === 'Delete') handleDelete(avatar, e);
        }}
        onClick={(e) => {
          if (e.target.tagName !== 'BUTTON') handleAvatarSelect(avatar);
        }}
      >
        {/* Avatar Icon */}
        {avatar.iconUrl ? (
          <img
            src={avatar.iconUrl}
            alt="avatar"
            className="w-8 h-8 rounded-lg object-cover"
          />
        ) : (
          <User className="w-6 h-6" />
        )}

        <div className="flex-grow min-w-0">
          <div className="font-semibold text-sm sm:text-base whitespace-normal">
            {avatar.name}
          </div>
          <div className="text-xs text-neutral-400 mt-1 whitespace-normal">
            {avatar.description}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveAvatar(avatar);
            setActiveTab('documents');
            onEndLiveChat?.();
            onClose?.();
          }}
          className="flex-shrink-0 px-2 py-1 text-grey-400 hover:text-grey-300 hover:bg-grey-500/20 rounded transition-colors text-xs"
          aria-label={`Go to documents for ${avatar.name}`}
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={(e) => handleDelete(avatar, e)}
          className="flex-shrink-0 p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
          aria-label={`Delete avatar ${avatar.name}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Overlay when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Sliding Panel */}
      <div
        className={`
          fixed top-0 left-0
          w-80 sm:w-96 lg:w-80
          h-full
          z-50
          bg-black/60 backdrop-blur-lg
          border-r border-white/10 lg:rounded-2xl lg:border
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          shadow-lg
        `}
      >
        <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-neutral-200">Avatars</h2>
            <button
              onClick={onClose}
              className="text-neutral-300 hover:text-neutral-100 p-2 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
              aria-label="Close sidebar"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Create Avatar Button or Auth */}
          {isLoggedIn ? (
            <button
              onClick={handleCreateAvatar}
              className="px-4 py-2 rounded hover:bg-neutral-900 transition-colors focus:outline focus:outline-2 focus:outline-amber-400 border border-neutral-700 text-neutral-200 bg-black/60 flex font-semibold gap-2 items-center justify-center"
            >
              <UserPenIcon className="w-6 h-6" />
              <span className="sm:inline">Create Avatar</span>
            </button>
          ) : (
            <div className="flex items-center justify-center">
              <AuthComponent />
            </div>
          )}
          {/* Avatar List */}
          <div className="flex-grow overflow-y-auto min-h-0 space-y-2">
            {Array.isArray(avatars) && avatars.length > 0 ? (
              <AnimatedList
                items={avatars}
                selectedKey={activeAvatar?.avatar_id} // <-- NEW
                onItemSelect={(avatar) => handleAvatarSelect(avatar)}
                renderItem={(avatar, index, isSelected) =>
                  renderAvatarItem(avatar, index, isSelected)
                }
                showGradients={true}
                enableArrowNavigation={true}
                displayScrollbar={true}
                className="relative flex-grow overflow-y-auto min-h-0"
              />
            ) : (
              <div className="text-neutral-400 text-sm p-4 italic text-center">
                {isLoggedIn
                  ? 'No avatars available. Create one to get started.'
                  : 'No avatars available. Sign up or Log in to get started.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
