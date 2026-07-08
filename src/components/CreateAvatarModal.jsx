import React, { useState, useEffect } from 'react';
import { UserPenIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { createAvatar, getAvatars } from '../services/avatarService';
import { useAuth } from '../context/AuthContext';

const CreateAvatarModal = ({ setShowCreateModal }) => {
  const [error, setError] = useState(null);
  const [newAvatarName, setNewAvatarName] = useState('');
  const [newAvatarDescription, setNewAvatarDescription] = useState('');
  const { user, isLoading, setIsLoading, setUserAvatars } = useAuth();

  // 4331fbb8-b4a4-41a3-a0d1-ab0158a1abec
  // 7e644e6b-f05c-47e9-a179-368517d480f8
  const handleCreate = async () => {
    console.log('handleCreate');
    if (!newAvatarName.trim()) {
      setError('Avatar name is required');
      return;
    }
    console.log(
      `CHANGING THE VALUE OF SET LOADING TO TRUE: CURRENT LOADING VALUE: ${isLoading}`
    );
    setIsLoading(true);
    setError(null);
    try {
      const created = await createAvatar(
        user,
        newAvatarName,
        newAvatarDescription,
        null
      );
      if (created) {
        // updating the current list of avatars for the current user
        try {
          const avatars = await getAvatars(user.id);

          console.log(`response from getAvatars: avatars: ${avatars}`);

          setUserAvatars(avatars);
        } catch (error) {
          console.log(
            ` Handle Create avatar; getting avatars error; error.message: ${error.message}`
          );
          console.log(
            'indicate error of getting avatar list after successful creation'
          );
          toast.error(error.message, { options: { duration: 5000 } });
        }
        setShowCreateModal(false);
        setNewAvatarName('');
        setNewAvatarDescription('');
        // toast.success('Avatar created successfully');
      } else {
        setError('Failed to create avatar');
        toast.error('Failed to create avatar');
      }
    } catch (err) {
      const errorMessage = err.message.includes('detail')
        ? JSON.parse(err.message).detail
        : err.message || 'Failed to create avatar';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Create avatar error:', err);
    } finally {
      console.log(
        `CHANGING THE VALUE OF SET LOADING TO FALSE: CURRENT LOADING VALUE: ${isLoading}`
      );
      setIsLoading(false);
    }
  };

  const handleClick = async (cardData) => {
    console.log('handleClick');
    let actualCardData = cardData;
    if (!cardData.type) {
      const matchingCard = authenticatedCards.find(
        (card) =>
          card.id === cardData.avatar_data.assistant_id ||
          (cardData.text && card.text === cardData.text)
      );
      if (matchingCard) actualCardData = matchingCard;
    }

    if (actualCardData.type === 'avatar') {
      const avatarId =
        actualCardData.avatar_data.assistant_id ||
        userAvatars?.find((avatar) => avatar.name === actualCardData.text)
          ?.assistant_id;
      if (!avatarId) {
        toast.error('Avatar ID not found');
        return;
      }

      const avatarIndex = userAvatars.findIndex(
        (avatar) => avatar.assistant_id === avatarId
      );

      setCurrentCardIndex(avatarIndex);
      if (galleryRef.current) {
        galleryRef.current.setCurrentIndex(avatarIndex);
      }
      localStorage.setItem('last_used_avatar_index', avatarIndex);
      localStorage.setItem('last_used_avatar_id', avatarId);

      // Use AuthContext selectAvatar which updates Firestore
      // await selectAvatar(avatarId);

      const selectedAvatar = userAvatars.find(
        (avatar) => avatar.assistant_id === avatarId
      );

      // when the avatar is selected, the backend is responsible for updating the identity and awareness of the avatar

      cacheAvatarPosition(avatarId, avatarIndex);
      if (selectedAvatar?.icon) {
        cacheAvatarIcon(avatarId, selectedAvatar.icon, avatarIndex);
      }
      setActiveAvatar(selectedAvatar);
      // await selectAvatar(avatarId); // Update Firestore last_used_avatar
      // localStorage.setItem('last_used_avatar_id', avatarId);

      // Load messages for this avatar
      // await fetchMessages();
      // toast.success(`Selected ${avatar.name || 'avatar'}`);
      // console.log('HANDLE CLICK');
      navigate(`/chat/${avatarId}`); // ← ROUTE TO CHAT AREA
      // navigate(/chat:selectedAvatar)
    } else if (actualCardData.type === 'create') {
      setShowCreateModal(true);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowCreateModal]);

  return (
    <div
      className="fixed inset-0 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 bg-opacity-75 flex items-center justify-center z-50"
      type="dialog"
      aria-modal="true"
      aria-labelledby="create-avatar-title"
    >
      <div className="bg-gray/20 p-4 sm:p-6 rounded-lg w-[90vw] sm:w-96 max-w-full">
        <h2
          id="create-avatar-title"
          className="text-xl font-semibold mb-4 text-white"
        >
          <div className="flex items-center gap-2">
            <UserPenIcon className="w-6 h-6" />
            <span className="portrait:hidden">Create Avatar</span>
          </div>
        </h2>
        {error && (
          <div className="mb-4 text-red-500 text-sm" type="alert">
            {error}
          </div>
        )}
        <label className="block mb-2 text-xl sm:text-2xl text-gray-300">
          Name
          <input
            type="text"
            value={newAvatarName}
            onChange={(e) => setNewAvatarName(e.target.value)}
            placeholder="Name the Avatar"
            className="w-full p-2 mt-1 rounded bg-black/35 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all duration-300"
            autoFocus
            aria-required="true"
            disabled={isLoading}
          />
        </label>
        <label className="block mb-4 text-xl sm:text-2xl text-gray-300">
          Description
          <textarea
            value={newAvatarDescription}
            onChange={(e) => setNewAvatarDescription(e.target.value)}
            placeholder="Describe your avatar in 50 characters or less (Optional)"
            className="w-full p-2 mt-1 rounded bg-black/35 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all duration-300"
            rows={3}
            aria-multiline="true"
            disabled={isLoading}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowCreateModal(false)}
            className="px-4 py-2 rounded bg-black/35 text-white border border-gray-700 hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all duration-300 transform hover:scale-105"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded bg-black/35 text-white border border-gray-700 hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
            disabled={isLoading || !newAvatarName.trim()}
          >
            {isLoading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateAvatarModal;
