import React, { useState, useEffect } from 'react';
import { MapPin, UserPenIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { createAvatar, listUserAvatars } from '../services/avatarService';
import { useAuth } from '../context/AuthContext';
import {
  avatarSettingsPath,
  resolveCreatedAvatar,
} from './createdAvatarSettings';
import AvatarLocationPicker from './geo/AvatarLocationPicker';
import {
  DEFAULT_GEOFENCE_RADIUS_METERS,
  isValidCoordinate,
} from '../services/avatarProximity';

const CreateAvatarModal = ({ setShowCreateModal }) => {
  const [error, setError] = useState(null);
  const [newAvatarName, setNewAvatarName] = useState('');
  const [newAvatarDescription, setNewAvatarDescription] = useState('');
  // An avatar may be pinned to a real-world place here, but the place is never
  // required: a memorial or a marker is often placed long after the avatar was
  // made, from Avatar Settings.
  const [isPinnedToAPlace, setIsPinnedToAPlace] = useState(false);
  const [geoLocation, setGeoLocation] = useState({
    latitude: undefined,
    longitude: undefined,
    locationName: '',
    geofenceRadiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
  });
  const navigate = useNavigate();
  const {
    isLoading,
    setIsLoading,
    setUserAvatars,
    userAvatars,
    setActiveAvatar,
  } = useAuth();

  const handleCreate = async () => {
    if (!newAvatarName.trim()) {
      setError('Avatar name is required');
      return;
    }
    if (
      isPinnedToAPlace &&
      !isValidCoordinate(geoLocation.latitude, geoLocation.longitude)
    ) {
      setError('Place this avatar on the map, or turn the pin off.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const created = await createAvatar({
        name: newAvatarName,
        description: newAvatarDescription,
        geoLocation: isPinnedToAPlace ? geoLocation : undefined,
      });

      // Refresh the avatar list so the new avatar appears immediately.
      let listedAvatars = [];
      try {
        listedAvatars = (await listUserAvatars()) ?? [];
        setUserAvatars(listedAvatars);
      } catch (listError) {
        console.error(
          'Avatar created, but refreshing the avatar list failed:',
          listError
        );
        toast.error(listError.message, { duration: 5000 });
      }

      const createdAvatar = resolveCreatedAvatar({
        created,
        listedAvatars,
        previousAvatars: userAvatars,
        createdName: newAvatarName,
      });
      setShowCreateModal(false);
      setNewAvatarName('');
      setNewAvatarDescription('');

      const settingsPath = avatarSettingsPath(createdAvatar);
      if (settingsPath) {
        // A listed record carries ownership metadata. Setting that before
        // navigating keeps ChatArea on settings instead of bouncing to chat
        // while it re-resolves the URL.
        if (createdAvatar?.metadata?.user_id) {
          setActiveAvatar(createdAvatar);
        }
        try {
          const createdId =
            createdAvatar.assistant_id ?? createdAvatar.avatar_id;
          if (createdId) {
            localStorage.setItem('last_used_avatar_id', createdId);
          }
        } catch {
          // quota or private mode — navigation does not depend on this
        }
        navigate(settingsPath);
      }
    } catch (createError) {
      const errorMessage = createError.message || 'Failed to create avatar';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Create avatar error:', createError);
    } finally {
      setIsLoading(false);
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
      className="fixed inset-0 bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 bg-opacity-75 flex items-center justify-center z-50"
      type="dialog"
      aria-modal="true"
      aria-labelledby="create-avatar-title"
    >
      <div className="bg-gray/20 p-4 sm:p-6 rounded-lg w-[90vw] sm:w-96 max-w-full">
        <h2
          id="create-avatar-title"
          className="text-xl font-semibold mb-4 text-neutral-200"
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
        <label className="block mb-2 text-xl sm:text-2xl text-neutral-300">
          Name
          <input
            type="text"
            value={newAvatarName}
            onChange={(e) => setNewAvatarName(e.target.value)}
            placeholder="Name the Avatar"
            className="w-full p-2 mt-1 rounded bg-black/60 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all duration-300"
            autoFocus
            aria-required="true"
            disabled={isLoading}
          />
        </label>
        <label className="block mb-4 text-xl sm:text-2xl text-neutral-300">
          Description
          <textarea
            value={newAvatarDescription}
            onChange={(e) => setNewAvatarDescription(e.target.value)}
            placeholder="Describe your avatar in 50 characters or less (Optional)"
            className="w-full p-2 mt-1 rounded bg-black/60 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all duration-300"
            rows={3}
            aria-multiline="true"
            disabled={isLoading}
          />
        </label>
        <div className="mb-4">
          <label className="flex items-start gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={isPinnedToAPlace}
              onChange={(changeEvent) =>
                setIsPinnedToAPlace(changeEvent.target.checked)
              }
              disabled={isLoading}
              className="mt-1 h-4 w-4 accent-amber-400"
            />
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-amber-300" aria-hidden="true" />
              Pin this avatar to a real-world place
            </span>
          </label>
          <p className="mt-1 ml-6 text-xs text-white/40">
            A pinned avatar appears on the world map, and greets anyone who walks
            up to the place. You can add or move the place later.
          </p>
          {isPinnedToAPlace && (
            <div className="mt-3">
              <AvatarLocationPicker
                value={geoLocation}
                onChange={setGeoLocation}
              />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowCreateModal(false)}
            className="px-4 py-2 rounded bg-black/60 text-neutral-200 border border-neutral-700 hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all duration-300 transform hover:scale-105"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded bg-black/60 text-neutral-200 border border-neutral-700 hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
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
