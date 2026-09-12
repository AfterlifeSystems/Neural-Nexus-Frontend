import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, UserPenIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { createAvatar, listUserAvatars } from '../services/avatarService';
import { useAuth } from '../context/AuthContext';
import {
  assistantIdOf,
  avatarSettingsPath,
  resolveCreatedAvatar,
} from './createdAvatarSettings';
import CreateAvatarPhotoField from './CreateAvatarPhotoField';
import CreateAvatarIdentityLinksField from './CreateAvatarIdentityLinksField';
import CreateAvatarVoiceField from './CreateAvatarVoiceField';
import {
  assignCreatedAvatarStandardVoice,
  standardVoiceIdToAssign,
} from '../services/createAvatarVoice';
import AvatarLocationPicker from './geo/AvatarLocationPicker';
import { rememberResearchJob } from './research/researchJobMemory';
import { startIdentityMediaUpload } from '../services/identityMediaJobs';
import {
  composeCreateAvatarResearchHint,
  takeIdentityLinkDraft,
} from '../services/createAvatarIdentityLinks';
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
  // An image address used instead of a file. The server fetches it as the
  // reference image; exactly one of `photoFile` / `photoUrl` is ever set.
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoPlaceSource, setPhotoPlaceSource] = useState(null);
  const [photoPlaceError, setPhotoPlaceError] = useState('');
  const [isResolvingPhotoPlace, setIsResolvingPhotoPlace] = useState(false);
  // Optional identity-source pages. Zero is fine. Ingested after create via
  // /update_avatar_identity_with_media, the same path Settings uses for URLs.
  const [identityLinks, setIdentityLinks] = useState([]);
  const [identityLinkDraft, setIdentityLinkDraft] = useState('');
  const [identityLinkError, setIdentityLinkError] = useState('');
  const [voiceGender, setVoiceGender] = useState('');
  const [standardVoiceId, setStandardVoiceId] = useState('');
  const [standardVoices, setStandardVoices] = useState([]);
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

  const hasPhoto = Boolean(photoFile || photoUrl);
  const resolvedName = resolveCreateAvatarName({
    typedName: newAvatarName,
    locationName: geoLocation.locationName,
    hasPhoto,
  });
  const canCreate = Boolean(resolvedName) && !isResolvingPhotoPlace;

  const handlePhotoChosen = ({ file, url, place, placeError }) => {
    setPhotoFile(file ?? null);
    setPhotoUrl(url ?? null);
    setPhotoPlaceError(placeError || '');
    setPhotoPlaceSource(place?.source ?? null);
    if (place && isValidCoordinate(place.latitude, place.longitude)) {
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
    setPhotoUrl(null);
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
    const takenIdentityLinks = takeIdentityLinkDraft(
      identityLinks,
      identityLinkDraft
    );
    if (takenIdentityLinks.error) {
      setIdentityLinkError(takenIdentityLinks.error);
      return;
    }
    const resolvedIdentityLinks = takenIdentityLinks.links;
    setIsLoading(true);
    setError(null);
    try {
      // The hint is sent whether or not a photo was chosen: it carries the
      // typed name and the place, which is what tells the research which of
      // several people with this name the avatar is about. Identity links
      // are appended so research can open the pages the creator already has.
      const created = await createAvatar({
        name: resolvedName,
        description: newAvatarDescription,
        geoLocation: isPinnedToAPlace ? geoLocation : undefined,
        researchHint: composeCreateAvatarResearchHint(
          researchHintFromCreatePhoto({
            name: resolvedName,
            locationName: geoLocation.locationName,
            latitude: geoLocation.latitude,
            longitude: geoLocation.longitude,
            imageUrl: photoUrl,
          }),
          resolvedIdentityLinks
        ),
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
      const voiceIdToStore = standardVoiceIdToAssign({
        selectedVoiceId: standardVoiceId,
        voices: standardVoices,
      });
      if (createdId && voiceIdToStore) {
        try {
          await assignCreatedAvatarStandardVoice({
            assistantId: createdId,
            voiceId: voiceIdToStore,
          });
        } catch (voiceError) {
          console.error(
            'Avatar created, but the initial standard voice was not saved:',
            voiceError
          );
          toast.error(
            'The avatar was created. Choose a standard voice in Settings if you want it to speak before a clone is uploaded.'
          );
        }
      }
      // The server starts research for every new avatar and hands the job back
      // here. Remembering it now is what lets the research panel pick the job
      // up and stream its progress the moment Settings mounts — including the
      // portrait and voice the research goes looking for when none were given.
      if (createdId && created?.research_job?.job_id) {
        rememberResearchJob(createdId, created.research_job.job_id);
      }
      if ((hasPhoto || resolvedIdentityLinks.length > 0) && createdId) {
        // Photograph and optional identity links are ingested after the
        // dialog closes. Settings shows the portrait and document jobs. A
        // link is fetched by the server.
        void startCreateAvatarPhotoFollowUp({
          assistantId: createdId,
          photoFile,
          photoUrl,
          identityUrls: resolvedIdentityLinks,
          uploadIdentityMedia: startIdentityMediaUpload,
        }).catch((followUpError) => {
          console.error('Create-from-photo follow-up failed:', followUpError);
          toast.error(
            followUpError?.message ||
              (hasPhoto
                ? 'The photograph could not be processed. Add it again in Settings.'
                : 'The links could not be processed. Add them again in Settings.')
          );
        });
      }

      setShowCreateModal(false);
      setNewAvatarName('');
      setNewAvatarDescription('');
      setPhotoFile(null);
      setPhotoUrl(null);
      setIdentityLinks([]);
      setIdentityLinkDraft('');
      setIdentityLinkError('');
      setVoiceGender('');
      setStandardVoiceId('');
      setStandardVoices([]);

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

  if (typeof document === 'undefined') return null;

  // Rendered into `document.body`, like `ui/Modal`. The signed-in page frame
  // (ProtectedRoute) is `relative z-10`, a stacking context, so an overlay
  // rendered inline is confined below the `z-40` sidebar rail no matter how
  // high its own z-index is. On a phone the 90vw card reaches under the rail
  // and its left edge is hidden; from body the overlay covers the rail too.
  return createPortal(
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
          url={photoUrl}
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
                ? 'Name on the sign'
                : photoUrl
                  ? 'Name'
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
        <CreateAvatarIdentityLinksField
          links={identityLinks}
          draft={identityLinkDraft}
          error={identityLinkError}
          disabled={isLoading}
          onLinksChange={setIdentityLinks}
          onDraftChange={setIdentityLinkDraft}
          onErrorChange={setIdentityLinkError}
        />
        <CreateAvatarVoiceField
          avatarName={resolvedName}
          gender={voiceGender}
          voiceId={standardVoiceId}
          disabled={isLoading}
          onGenderChange={setVoiceGender}
          onVoiceChange={setStandardVoiceId}
          onVoicesChange={setStandardVoices}
        />
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
          <p className="mt-1 ml-6 text-xs leading-relaxed text-white/40">
            {photoFile
              ? 'A photograph pins the avatar where it was taken. 1 m is a doorway.'
              : 'Walk up to the pin and the avatar opens on the phone. 1 m is a doorway.'}
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
    </div>,
    document.body
  );
};

export default CreateAvatarModal;
