import React, { useState, useEffect } from 'react';
import { MapPin, UserPenIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { createAvatar, listUserAvatars, startAvatarDeepResearch } from '../services/avatarService';
import { useAuth } from '../context/AuthContext';
import {
  assistantIdOf,
  avatarSettingsPath,
  resolveCreatedAvatar,
} from './createdAvatarSettings';
import CreateAvatarPhotoField from './CreateAvatarPhotoField';
import AvatarLocationPicker from './geo/AvatarLocationPicker';
import { rememberResearchJob } from './research/researchJobMemory';
import { startIdentityMediaUpload } from '../services/identityMediaJobs';
import {
  researchHintFromCreatePhoto,
  resolveCreateAvatarName,
  startCreateAvatarPhotoFollowUp,
} from '../services/createAvatarPhoto';
import {
  DEFAULT_GEOFENCE_RADIUS_METERS,
  avatarIdOf,
  isValidCoordinate,
  withPin,
} from '../services/avatarProximity';

const CreateAvatarModal = ({ setShowCreateModal }) => {
  const [error, setError] = useState(null);
  const [newAvatarName, setNewAvatarName] = useState('');
  const [newAvatarDescription, setNewAvatarDescription] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPlaceSource, setPhotoPlaceSource] = useState(null);
  const [photoPlaceError, setPhotoPlaceError] = useState('');
  const [isResolvingPhotoPlace, setIsResolvingPhotoPlace] = useState(false);
  // An avatar may be pinned to a real-world place here, but the place is never
  // required: a memorial or a marker is often placed long after the avatar was
  // made, from Avatar Settings. A photograph of a place pins it automatically.
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

  const resolvedName = resolveCreateAvatarName({
    typedName: newAvatarName,
    locationName: geoLocation.locationName,
    hasPhoto: Boolean(photoFile),
  });
  const canCreate = Boolean(resolvedName) && !isResolvingPhotoPlace;

  const handlePhotoChosen = ({ file, place, placeError }) => {
    setPhotoFile(file);
    setPhotoPlaceError(placeError || '');
    setPhotoPlaceSource(place?.source ?? null);
    if (
      place &&
      isValidCoordinate(place.latitude, place.longitude)
    ) {
      setIsPinnedToAPlace(true);
      setGeoLocation((previous) => ({
        ...previous,
        latitude: place.latitude,
        longitude: place.longitude,
      }));
    }
  };

  const handleClearPhoto = () => {
    setPhotoFile(null);
    setPhotoPlaceSource(null);
    setPhotoPlaceError('');
  };

  const handleCreate = async () => {
    if (!resolvedName) {
      setError('Name the avatar, or take a picture of a name or place.');
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
        name: resolvedName,
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

      let createdAvatar = resolveCreatedAvatar({
        created,
        listedAvatars,
        previousAvatars: userAvatars,
        createdName: resolvedName,
      });
      if (
        isPinnedToAPlace &&
        createdAvatar &&
        isValidCoordinate(geoLocation.latitude, geoLocation.longitude)
      ) {
        const placed = withPin(createdAvatar, {
          latitude: geoLocation.latitude,
          longitude: geoLocation.longitude,
          location_name: geoLocation.locationName?.trim() || null,
          geofence_radius_meters: geoLocation.geofenceRadiusMeters,
        });
        createdAvatar = placed;
        const createdId = avatarIdOf(placed);
        setUserAvatars((previous) =>
          (previous ?? []).map((candidate) =>
            avatarIdOf(candidate) === createdId ? placed : candidate
          )
        );
      }

      const createdId = assistantIdOf(createdAvatar);
      if (photoFile && createdId) {
        // The photograph is ingested after the dialog closes. Settings shows
        // the portrait and document jobs; research starts once the picture
        // has been read as identity media.
        void startCreateAvatarPhotoFollowUp({
          assistantId: createdId,
          photoFile,
          researchHint: researchHintFromCreatePhoto({
            name: resolvedName,
            locationName: geoLocation.locationName,
            latitude: geoLocation.latitude,
            longitude: geoLocation.longitude,
          }),
          uploadIdentityMedia: startIdentityMediaUpload,
          startResearch: startAvatarDeepResearch,
          rememberJob: rememberResearchJob,
        }).catch((followUpError) => {
          console.error(
            'Create-from-photo follow-up failed:',
            followUpError
          );
          toast.error(
            followUpError?.message ||
              'The photograph could not be processed. Add it again in Settings.'
          );
        });
      }

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
      <div className="bg-gray/20 p-4 sm:p-6 rounded-lg w-[90vw] sm:w-[28rem] max-w-full max-h-[90vh] overflow-y-auto">
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
        <CreateAvatarPhotoField
          file={photoFile}
          placeSource={photoPlaceSource}
          placeError={photoPlaceError}
          disabled={isLoading}
          onBusyChange={setIsResolvingPhotoPlace}
          onChosen={handlePhotoChosen}
          onClear={handleClearPhoto}
        />
        <label className="block mb-2 text-xl sm:text-2xl text-neutral-300">
          Name
          <input
            type="text"
            value={newAvatarName}
            onChange={(e) => setNewAvatarName(e.target.value)}
            placeholder={
              photoFile
                ? 'Name on the sign (optional)'
                : 'Name the Avatar'
            }
            className="w-full p-2 mt-1 rounded bg-black/60 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all duration-300"
            autoFocus
            aria-required={!photoFile}
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
            {photoFile
              ? 'A photograph pins the avatar where it was taken. You can move or clear the pin.'
              : 'A pinned avatar appears on your world map. Share it to list it for everyone else. Someone who walks up to the place sees it over their camera. You can add, move, or remove the place later.'}
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
            disabled={isLoading || !canCreate}
          >
            {isLoading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateAvatarModal;
