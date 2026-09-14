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
import CreateAvatarMediaField from './CreateAvatarMediaField';
import CreateAvatarVoiceField from './CreateAvatarVoiceField';
import {
  assignCreatedAvatarStandardVoice,
  standardVoiceIdToAssign,
} from '../services/createAvatarVoice';
import AvatarLocationPicker from './geo/AvatarLocationPicker';
import { rememberResearchJob } from './research/researchJobMemory';
import { startIdentityMediaUpload } from '../services/identityMediaJobs';
import { composeCreateAvatarResearchHint } from '../services/createAvatarIdentityLinks';
import {
  applyCreateAvatarMedia,
  assignDefaultReferenceAudio,
  createAvatarMediaFromDataTransfer,
  emptyCreateAvatarMedia,
  hasCreateAvatarFollowUpMedia,
  researchHintFromVoiceSources,
  takeCreateAvatarMediaDraft,
  toggleCreateAvatarReferenceAudio,
} from '../services/createAvatarMedia';
import {
  describePhotoPlaceError,
  researchHintFromCreatePhoto,
  resolveCreateAvatarName,
  resolvePhotoCapturePlace,
  startCreateAvatarPhotoFollowUp,
} from '../services/createAvatarPhoto';
import { isFileOrUrlDrag } from './documentDropOverlay';
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
  // Optional identity-source pages and documents. Zero is fine. Ingested
  // after create via /update_avatar_identity_with_media.
  const [identityLinks, setIdentityLinks] = useState([]);
  const [identityFiles, setIdentityFiles] = useState([]);
  const [mediaDraft, setMediaDraft] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [voiceFiles, setVoiceFiles] = useState([]);
  const [voiceUrls, setVoiceUrls] = useState([]);
  const [referenceAudioKey, setReferenceAudioKey] = useState(null);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);
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
  const { setUserAvatars, userAvatars, setActiveAvatar } = useAuth();
  const [isCreating, setIsCreating] = useState(false);

  const hasPhoto = Boolean(photoFile || photoUrl);
  const resolvedName = resolveCreateAvatarName({
    typedName: newAvatarName,
    locationName: geoLocation.locationName,
    hasPhoto,
  });
  const closeCreateModal = () => {
    setShowCreateModal(false);
  };

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

  const currentCreateMedia = () =>
    emptyCreateAvatarMedia({
      photoFile,
      photoUrl,
      voiceFiles,
      voiceUrls,
      identityFiles,
      identityLinks,
      referenceAudioKey,
    });

  const applyVoiceList = (nextMedia) => {
    const assigned = assignDefaultReferenceAudio(nextMedia);
    setVoiceFiles(assigned.voiceFiles);
    setVoiceUrls(assigned.voiceUrls);
    setReferenceAudioKey(assigned.referenceAudioKey);
  };

  const choosePhotograph = async ({ file = null, url = null }) => {
    if (file) {
      setIsResolvingPhotoPlace(true);
      try {
        const place = await resolvePhotoCapturePlace(file);
        handlePhotoChosen({
          file,
          url: null,
          place,
          placeError: place ? '' : describePhotoPlaceError(null),
        });
      } catch (placeError) {
        handlePhotoChosen({
          file,
          url: null,
          place: null,
          placeError: describePhotoPlaceError(placeError),
        });
      } finally {
        setIsResolvingPhotoPlace(false);
      }
      return;
    }
    handlePhotoChosen({
      file: null,
      url,
      place: null,
      placeError: '',
    });
  };

  const handleIncomingMedia = (incoming) => {
    const files = incoming?.files ?? [];
    const urls = incoming?.urls ?? [];
    if (files.length === 0 && urls.length === 0) return;
    setIsDraggingMedia(false);
    const applied = applyCreateAvatarMedia(currentCreateMedia(), {
      files,
      urls,
    });
    setVoiceFiles(applied.voiceFiles);
    setVoiceUrls(applied.voiceUrls);
    setReferenceAudioKey(applied.referenceAudioKey);
    setIdentityFiles(applied.identityFiles);
    setIdentityLinks(applied.identityLinks);
    setMediaDraft('');
    setMediaError('');
    if (applied.photoReplaced) {
      // Hold the photograph immediately so Create can post it even while
      // the place is still being read from EXIF or this device.
      setPhotoFile(applied.photoFile);
      setPhotoUrl(applied.photoUrl);
      void choosePhotograph({
        file: applied.photoFile,
        url: applied.photoUrl,
      });
    }
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
    const takenMedia = takeCreateAvatarMediaDraft(
      currentCreateMedia(),
      mediaDraft
    );
    if (takenMedia.error) {
      setMediaError(takenMedia.error);
      setError(takenMedia.error);
      return;
    }
    const resolvedMedia = takenMedia.media;
    const resolvedIdentityLinks = resolvedMedia.identityLinks;
    setIsCreating(true);
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
            imageUrl: resolvedMedia.photoUrl,
          }),
          resolvedIdentityLinks,
          researchHintFromVoiceSources({
            files: resolvedMedia.voiceFiles,
            urls: resolvedMedia.voiceUrls,
            referenceAudioKey: resolvedMedia.referenceAudioKey,
          })
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
      if (hasCreateAvatarFollowUpMedia(resolvedMedia) && createdId) {
        // Photograph, voice reference, and optional identity sources are
        // ingested after the dialog closes. Settings shows the jobs. A
        // link is fetched by the server.
        void startCreateAvatarPhotoFollowUp({
          assistantId: createdId,
          photoFile: resolvedMedia.photoFile,
          photoUrl: resolvedMedia.photoUrl,
          identityUrls: resolvedIdentityLinks,
          identityFiles: resolvedMedia.identityFiles,
          voiceFiles: resolvedMedia.voiceFiles,
          voiceUrls: resolvedMedia.voiceUrls,
          referenceAudioKey: resolvedMedia.referenceAudioKey,
          uploadIdentityMedia: startIdentityMediaUpload,
        }).catch((followUpError) => {
          console.error('Create-from-photo follow-up failed:', followUpError);
          toast.error(
            followUpError?.message ||
              'Media could not be processed. Add it again in Settings.'
          );
        });
      }

      closeCreateModal();
      setNewAvatarName('');
      setNewAvatarDescription('');
      setPhotoFile(null);
      setPhotoUrl(null);
      setIdentityLinks([]);
      setIdentityFiles([]);
      setMediaDraft('');
      setMediaError('');
      setVoiceFiles([]);
      setVoiceUrls([]);
      setReferenceAudioKey(null);
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
      setIsCreating(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isCreating) {
        closeCreateModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreating, setShowCreateModal]);

  if (typeof document === 'undefined') return null;

  // Rendered into `document.body`, like `ui/Modal`. The signed-in page frame
  // (ProtectedRoute) is `relative z-10`, a stacking context, so an overlay
  // rendered inline is confined below the `z-40` sidebar rail no matter how
  // high its own z-index is. On a phone the 90vw card reaches under the rail
  // and its left edge is hidden; from body the overlay covers the rail too.
  return createPortal(
    <div
      className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-lg bg-opacity-75 flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(pressEvent) => {
        if (isCreating) return;
        if (pressEvent.target === pressEvent.currentTarget) {
          closeCreateModal();
        }
      }}
      onDragOver={(dragEvent) => {
        if (isFileOrUrlDrag(dragEvent.dataTransfer)) {
          dragEvent.preventDefault();
        }
      }}
      onDrop={(dropEvent) => {
        dropEvent.preventDefault();
        setIsDraggingMedia(false);
        handleIncomingMedia(
          createAvatarMediaFromDataTransfer(dropEvent.dataTransfer)
        );
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-avatar-title"
        className="bg-gray/20 p-4 sm:p-6 rounded-lg w-[90vw] sm:w-[28rem] max-w-full max-h-[90vh] flex flex-col"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          void handleCreate();
        }}
        onDragEnter={(dragEvent) => {
          if (isFileOrUrlDrag(dragEvent.dataTransfer)) {
            setIsDraggingMedia(true);
          }
        }}
        onDragOver={(dragEvent) => {
          if (!isFileOrUrlDrag(dragEvent.dataTransfer)) return;
          dragEvent.preventDefault();
        }}
        onDragLeave={(dragEvent) => {
          if (!dragEvent.currentTarget.contains(dragEvent.relatedTarget)) {
            setIsDraggingMedia(false);
          }
        }}
      >
        <h2
          id="create-avatar-title"
          className="text-xl font-semibold mb-4 shrink-0 text-neutral-200"
        >
          <div className="flex items-center gap-2">
            <UserPenIcon className="w-6 h-6" />
            <span className="portrait:hidden">Create Avatar</span>
          </div>
        </h2>
        {error && (
          <div className="mb-4 shrink-0 text-red-500 text-sm" role="alert">
            {error}
          </div>
        )}
        <div className="min-h-0 shrink overflow-y-auto">
        <label className="block mb-2 text-sm text-neutral-300">
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
            disabled={isCreating}
          />
        </label>
        <label className="block mb-4 text-sm text-neutral-300">
          Description
          <textarea
            value={newAvatarDescription}
            onChange={(e) => setNewAvatarDescription(e.target.value)}
            placeholder="Optional, a short description"
            className="w-full p-2 mt-1 rounded bg-black/60 text-neutral-200 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all duration-300"
            rows={2}
            aria-multiline="true"
            disabled={isCreating}
          />
        </label>
        <CreateAvatarMediaField
          photoFile={photoFile}
          photoUrl={photoUrl}
          placeSource={photoPlaceSource}
          placeError={photoPlaceError}
          voiceFiles={voiceFiles}
          voiceUrls={voiceUrls}
          identityFiles={identityFiles}
          identityLinks={identityLinks}
          referenceAudioKey={referenceAudioKey}
          draft={mediaDraft}
          error={mediaError}
          disabled={isCreating}
          isDragging={isDraggingMedia}
          onBusyChange={setIsResolvingPhotoPlace}
          onPhotoChosen={handlePhotoChosen}
          onClearPhoto={handleClearPhoto}
          onVoiceFilesChange={(nextFiles) =>
            applyVoiceList({
              ...currentCreateMedia(),
              voiceFiles: nextFiles,
            })
          }
          onVoiceUrlsChange={(nextUrls) =>
            applyVoiceList({
              ...currentCreateMedia(),
              voiceUrls: nextUrls,
            })
          }
          onIdentityFilesChange={setIdentityFiles}
          onIdentityLinksChange={setIdentityLinks}
          onToggleReferenceAudio={(voiceKey) => {
            const next = toggleCreateAvatarReferenceAudio(
              currentCreateMedia(),
              voiceKey
            );
            setReferenceAudioKey(next.referenceAudioKey);
          }}
          onDraftChange={setMediaDraft}
          onErrorChange={setMediaError}
          onIncoming={handleIncomingMedia}
        />
        <CreateAvatarVoiceField
          avatarName={resolvedName}
          gender={voiceGender}
          voiceId={standardVoiceId}
          disabled={isCreating}
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
              disabled={isCreating}
              className="mt-1 h-4 w-4 accent-amber-400"
            />
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-amber-300" aria-hidden="true" />
              Pin this avatar to a real-world place
            </span>
          </label>
          <p className="mt-1 ml-6 text-xs leading-relaxed text-white/40">
            {photoFile
              ? 'A photograph pins the avatar where it was taken.'
              : 'Walk up to the pin and the avatar opens on the phone.'}
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
        </div>
        <div className="mt-4 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={closeCreateModal}
            className="px-4 py-2 rounded bg-black/60 text-neutral-200 border border-neutral-700 hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all duration-300 transform hover:scale-105"
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded bg-black/60 text-neutral-200 border border-neutral-700 hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
            disabled={isCreating}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
};

export default CreateAvatarModal;
