import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import Dropzone from 'react-dropzone';
import {
  ExternalLink,
  Trash2,
  Edit3,
  Upload,
  Link,
  File,
  Image,
  Video,
  Music,
  FileText,
  Globe,
  Youtube,
  Facebook,
  Instagram,
  Twitter,
  Twitch,
  X,
  Camera,
  Mic,
  Lock,
  Server,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  deleteAvatarDocument,
  selectAvatar,
  deleteAvatar,
  modifyAvatar,
  uploadAvatarIdentityMedia,
  streamMediaJobProgress,
  listAvatarDocuments,
  listUserAvatars,
  getAvatarReferenceImage,
  shareAvatar,
  getPersonalAvatar,
  disconnectDataServer,
} from '../services/avatarService';
import { forgetCachedAvatar, isAvatarOwnedByUser } from './utils';
import { useNavigate } from 'react-router-dom';

// Social Media Platform Configuration
const SOCIAL_PLATFORMS = [
  { id: 'youtube', name: 'YouTube', icon: Youtube, color: '#FF0000' },
  { id: 'google', name: 'Google', icon: Globe, color: '#4285F4' },
  { id: 'apple', name: 'Apple', icon: Globe, color: '#000000' },
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: '#1877F2' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: '#E4405F' },
  { id: 'twitch', name: 'Twitch', icon: Twitch, color: '#9146FF' },
  { id: 'twitter', name: 'X.com', icon: Twitter, color: '#000000' },
  { id: 'grok', name: 'Grok', icon: Globe, color: '#1DA1F2' },
  { id: 'claude', name: 'Claude', icon: Globe, color: '#8B4513' },
  { id: 'chatgpt', name: 'ChatGPT', icon: Globe, color: '#10A37F' },
  { id: 'microsoft', name: 'Microsoft', icon: Globe, color: '#00A4EF' },
  { id: 'reddit', name: 'Reddit', icon: Globe, color: '#FF4500' },
];
const AvatarSettings = ({ avatarId }) => {
  // Context first: state below is seeded from it, and reading `activeAvatar`
  // before this line is a temporal-dead-zone error that blanks the screen.
  const {
    user,
    activeAvatar,
    setActiveAvatar,
    setUserAvatars,
    refreshUserPortrait,
    isLoading,
  } = useAuth();
  const navigate = useNavigate();

  const [editingDesc, setEditingDesc] = useState(false);
  const [updatedDesc, setUpdatedDesc] = useState('');
  const [updatedAvatarName, setUpdatedAvatarName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Sharing state is mirrored locally so the control responds immediately, then
  // reconciled against the avatar record the server returns.
  const [isAvatarShared, setIsAvatarShared] = useState(
    Boolean(activeAvatar?.metadata?.is_public)
  );
  const [isUpdatingSharing, setIsUpdatingSharing] = useState(false);
  const [connectedDataServers, setConnectedDataServers] = useState([]);
  // New state for document management
  const [isDragging, setIsDragging] = useState(false);
  // Social account linking has no API endpoint yet; the modal below is kept
  // wired but reports the feature as unavailable.
  const [, setSocialLogins] = useState([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [loginCredentials, setLoginCredentials] = useState({
    username: '',
    password: '',
  });
  const [manualUrl, setManualUrl] = useState('');
  // Source documents already uploaded to this avatar, as labels from
  // GET /list_avatar_documents.
  const [avatarDocuments, setAvatarDocuments] = useState([]);
  // The avatar's portrait from GET /avatar_reference_image (data URI or URL).
  const [avatarIcon, setAvatarIcon] = useState(null);

  const assistantId =
    activeAvatar?.assistant_id ??
    activeAvatar?.avatar_id ??
    activeAvatar?.metadata?.assistant_id ??
    avatarId;

  // Every control on this screen writes to the avatar, and the API refuses all
  // of them for an avatar the caller did not create.
  const canAdministerAvatar = isAvatarOwnedByUser(activeAvatar, user);

  // The avatar that depicts its creator. Two things belong only to it: sharing
  // (you may publish your own likeness, not a character you invented) and the
  // connected data servers, which are the account's own machines reached
  // through the personal avatar.
  const isPersonalAvatar = Boolean(
    activeAvatar?.metadata?.is_personal_avatar_of_creator
  );

  const refreshAvatarDocuments = async () => {
    try {
      setAvatarDocuments(await listAvatarDocuments());
    } catch (listError) {
      console.error('Loading the avatar document list failed:', listError);
    }
  };

  // The document endpoints (/list_avatar_documents, /delete_avatar_document)
  // operate on the avatar selected SERVER-SIDE via POST /select_avatar, and
  // that selection is per-account global state another tab can change. So the
  // selection is re-registered every time this screen opens, before the
  // document list is read.
  useEffect(() => {
    let cancelled = false;
    const selectAndLoad = async () => {
      if (!assistantId || !canAdministerAvatar) {
        // Selecting is a WRITE to per-account state: doing it for an avatar the
        // user is merely visiting would silently repoint their account's
        // document endpoints at someone else's avatar.
        return;
      }
      try {
        await selectAvatar(assistantId);
        if (cancelled) return;
        await refreshAvatarDocuments();
        const iconSource = await getAvatarReferenceImage(assistantId);
        if (!cancelled) {
          setAvatarIcon(iconSource);
        }
      } catch (selectError) {
        console.error('Selecting the avatar failed:', selectError);
      }
    };
    selectAndLoad();
    return () => {
      cancelled = true;
    };
  }, [assistantId, canAdministerAvatar]);

  // Data-server connections belong to the account, and their live status is
  // reported alongside the personal avatar's capabilities rather than on the
  // avatar record itself.
  useEffect(() => {
    if (!canAdministerAvatar) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const personalAvatarResponse = await getPersonalAvatar();
        if (cancelled) return;
        const dataServerCapability = (
          personalAvatarResponse?.capabilities ?? []
        ).find((capability) => capability.status_key === 'connected_data_servers');
        const connections =
          personalAvatarResponse?.connected_data_servers ??
          dataServerCapability?.status;
        setConnectedDataServers(
          Array.isArray(connections) ? connections : []
        );
      } catch (dataServerError) {
        // An account with no personal avatar answers with an error here, and
        // "no servers connected" is the honest reading of that.
        console.debug('No data-server connections to show:', dataServerError);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAdministerAvatar]);

  // Keep the sharing control in step with whichever avatar is open.
  useEffect(() => {
    setIsAvatarShared(Boolean(activeAvatar?.metadata?.is_public));
  }, [activeAvatar]);

  // Seed the editors with what the avatar is currently called. They started
  // empty, so pressing Edit offered a blank field and saving without retyping
  // would have wiped the name.
  useEffect(() => {
    setUpdatedAvatarName(activeAvatar?.name ?? '');
    setUpdatedDesc(activeAvatar?.description ?? '');
  }, [activeAvatar?.name, activeAvatar?.description]);

  // Global drag and drop handlers
  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault();
      if (
        e.dataTransfer.types.includes('Files') ||
        e.dataTransfer.types.includes('text/uri-list')
      ) {
        setIsDragging(true);
      }
    };
    const handleDragOver = (e) => {
      e.preventDefault();
    };
    const handleDragLeave = (e) => {
      if (
        e.target === document.body ||
        !document.body.contains(e.relatedTarget)
      ) {
        setIsDragging(false);
      }
    };
    const handleDrop = async (e) => {
      e.preventDefault();
      setIsDragging(false);
      await handleFileUpload(e);
    };
    const handlePaste = async (e) => {
      const text = e.clipboardData.getData('text/plain');
      if (text.startsWith('http://') || text.startsWith('https://')) {
        await handleUrlUpload(text);
      }
    };
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
      document.removeEventListener('paste', handlePaste);
    };
  }, []);

  /**
   * Say what a media job is doing right now, in words rather than stage names.
   *
   * The progress stream reports a `stage` and, while indexing, a running count.
   * The stage names are internal vocabulary (`labeling`, `converting`), so they
   * are translated here; an unrecognized stage falls back to its own name,
   * which is still better than a spinner that says nothing.
   *
   * @param {Object} progressEvent A `media_progress` frame.
   * @param {string} description What is being uploaded.
   * @returns {string} A sentence for the progress toast.
   */
  const describeMediaProgress = (progressEvent, description) => {
    const stageDescriptions = {
      labeling: 'Working out what this is',
      converting_started: 'Converting',
      converting: 'Converting',
      expanding: 'Expanding the playlist',
      indexing: 'Adding to memory',
    };
    const stageDescription =
      stageDescriptions[progressEvent.stage] ?? progressEvent.stage ?? 'Processing';

    const documentsIndexed =
      progressEvent.documents_indexed ?? progressEvent.current;
    const documentsTotal = progressEvent.documents_total ?? progressEvent.total;
    const counted =
      documentsIndexed != null && documentsTotal != null
        ? ` (${documentsIndexed}/${documentsTotal})`
        : '';

    return `${stageDescription}: ${description}${counted}`;
  };

  /**
   * Send media to the avatar and follow the processing job to completion.
   *
   * The endpoint answers 202 the moment it has accepted the upload: nothing is
   * labeled, converted or indexed yet, and the document list will not contain
   * any of it. Announcing success there — which is what this screen used to do
   * — is why an upload could look like it worked and change nothing. So the
   * response is treated as the *start*: per-item rejections are reported, the
   * job's progress stream drives the toast, and the document list is only
   * re-read once the job says it is done.
   *
   * Everything goes in ONE request. Uploading file-by-file gave each file its
   * own job and defeated the batch semantics the server is built around
   * (a shared master job, URL manifests, playlist expansion).
   *
   * @param {Object} options
   * @param {File[]} [options.files] Files to send.
   * @param {string[]} [options.urls] URLs to ingest.
   * @param {boolean} [options.isReferenceImage] Send as the avatar's portrait.
   * @param {string} options.description What is being uploaded, for the toasts.
   * @returns {Promise<boolean>} Whether the job finished successfully.
   */
  const uploadMediaAndFollowJob = async ({
    files = [],
    urls = [],
    isReferenceImage = false,
    description,
  }) => {
    if (!user) {
      toast.error('Not logged in');
      return false;
    }
    if (!assistantId) {
      toast.error('No active avatar');
      return false;
    }

    const progressToastId = toast.loading(`Uploading ${description}…`, {
      position: 'bottom-left',
    });

    try {
      const uploadResponse = await uploadAvatarIdentityMedia({
        assistantId,
        files,
        urls,
        isReferenceImage,
      });

      // Per-item rejections ride along with an otherwise successful response:
      // the server skips what it cannot take and accepts the rest. Unreported,
      // a rejected file is indistinguishable from an accepted one.
      const rejectedItems =
        uploadResponse?.rejected ?? uploadResponse?.items_rejected ?? [];
      if (Array.isArray(rejectedItems) && rejectedItems.length > 0) {
        toast.error(
          `Not accepted: ${rejectedItems
            .map(
              (rejectedItem) =>
                `${rejectedItem.filename ?? rejectedItem.url ?? 'item'}${
                  rejectedItem.reason ? ` (${rejectedItem.reason})` : ''
                }`
            )
            .join('; ')}`,
          { duration: 9000, position: 'bottom-left' }
        );
      }

      const jobId = uploadResponse?.job_id;
      if (!jobId) {
        // Nothing to follow — either everything was rejected, or this build of
        // the API answered synchronously.
        toast.dismiss(progressToastId);
        await refreshAvatarDocuments();
        return Array.isArray(rejectedItems) ? rejectedItems.length === 0 : true;
      }

      let jobFailure = null;
      await streamMediaJobProgress(jobId, (progressEvent) => {
        if (progressEvent.type === 'media_progress') {
          toast.loading(describeMediaProgress(progressEvent, description), {
            id: progressToastId,
            position: 'bottom-left',
          });
        } else if (progressEvent.type === 'done') {
          jobFailure = progressEvent.error ?? null;
        }
      });

      toast.dismiss(progressToastId);
      if (jobFailure) {
        toast.error(`Processing ${description} failed: ${jobFailure}`, {
          duration: 9000,
          position: 'bottom-left',
        });
        return false;
      }

      toast.success(`${description} added`, { position: 'bottom-left' });
      await refreshAvatarDocuments();
      return true;
    } catch (uploadError) {
      toast.dismiss(progressToastId);
      console.error('Media upload failed:', uploadError);
      toast.error(`Upload failed: ${uploadError.message}`, {
        position: 'bottom-left',
      });
      return false;
    }
  };

  const handleFileUpload = async (e) => {
    const filesList = e.dataTransfer?.files || e.target?.files || [];
    const files = Array.from(filesList);
    if (files.length === 0) return;

    await uploadMediaAndFollowJob({
      files,
      description:
        files.length === 1 ? files[0].name : `${files.length} files`,
    });
    if (e.target) {
      // Let the same file be chosen again after a failure.
      e.target.value = '';
    }
  };

  const handleUrlUpload = async (url) => {
    await uploadMediaAndFollowJob({ urls: [url], description: url });
  };
  const handleSocialLogin = (platform) => {
    setSelectedPlatform(platform);
    setShowLoginModal(true);
  };
  const submitSocialLogin = async () => {
    // Social account linking is a planned feature with no API endpoint yet.
    toast.error('Connecting social accounts is not available yet.');
    setShowLoginModal(false);
    setLoginCredentials({ username: '', password: '' });
    setSelectedPlatform(null);
  };
  const removeSocialLogin = async (id) => {
    setSocialLogins((prev) => prev.filter((login) => login.id !== id));
  };
  const getSocialUrl = (platform, username) => {
    const urls = {
      youtube: `https://youtube.com/@${username}`,
      google: `https://myaccount.google.com/`,
      apple: `https://appleid.apple.com/`,
      facebook: `https://facebook.com/${username}`,
      instagram: `https://instagram.com/${username}`,
      twitch: `https://twitch.tv/${username}`,
      twitter: `https://x.com/${username}`,
      grok: `https://x.com/i/grok`,
      claude: `https://claude.ai/`,
      chatgpt: `https://chat.openai.com/`,
      microsoft: `https://account.microsoft.com/`,
      reddit: `https://reddit.com/user/${username}`,
    };
    return urls[platform] || '#';
  };
  const handleDeleteDocument = async (sourceDocumentName) => {
    try {
      if (!user) throw new Error('Not logged in');
      await deleteAvatarDocument(sourceDocumentName);
      toast.success('Document deleted');
      await refreshAvatarDocuments();
    } catch (err) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  const renderDocumentPreview = (doc) => {
    if (doc.loading) {
      return (
        <div className="flex items-center justify-center h-48 bg-white/5 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
        </div>
      );
    }
    const src = doc.previewUrl || doc.url;
    switch (doc.type) {
      case 'image':
        return (
          <div className="relative w-full h-48 bg-white/5 rounded-lg overflow-hidden">
            <img
              src={src}
              alt={doc.name}
              className="w-full h-full object-cover"
            />
          </div>
        );
      case 'video':
        return (
          <div className="relative w-full h-48 bg-white/5 rounded-lg overflow-hidden">
            <video src={src} controls className="w-full h-full object-cover" />
          </div>
        );
      case 'audio':
        return (
          <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
            <Music className="text-blue-400" size={32} />
            <audio src={src} controls className="flex-1" />
          </div>
        );
      case 'pdf':
      case 'text':
        return (
          <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
            <FileText className="text-red-400" size={32} />
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline flex items-center gap-2"
            >
              Open File <ExternalLink size={16} />
            </a>
          </div>
        );
      case 'youtube':
      case 'twitter':
      case 'web':
        return (
          <div className="p-4 bg-white/5 rounded-lg">
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline flex items-center gap-2"
            >
              <Globe size={20} />
              {doc.url}
              <ExternalLink size={16} />
            </a>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
            <File className="text-white/50" size={32} />
            <span className="text-white">{doc.name}</span>
          </div>
        );
    }
  };
  const getTypeIcon = (type) => {
    switch (type) {
      case 'image':
        return <Image className="text-green-400" />;
      case 'video':
        return <Video className="text-purple-400" />;
      case 'audio':
        return <Music className="text-blue-400" />;
      case 'pdf':
        return <FileText className="text-red-400" />;
      case 'text':
        return <FileText className="text-yellow-400" />;
      default:
        return <Globe className="text-cyan-400" />;
    }
  };
  /**
   * Set the avatar's portrait from a chosen image.
   *
   * The portrait is the avatar's reference image, so this uses the same media
   * endpoint with the reference_image flag rather than storing the file as
   * identity source material. The re-read only happens after the job reports
   * done: asking for the portrait the instant the 202 lands returns the OLD
   * image (or none), which looked exactly like the upload had failed.
   */
  const handleIconUpload = async (acceptedFiles) => {
    const [chosenImage] = acceptedFiles ?? [];
    if (!chosenImage) return;

    const succeeded = await uploadMediaAndFollowJob({
      files: [chosenImage],
      isReferenceImage: true,
      description: 'the avatar portrait',
    });
    if (!succeeded) return;
    await confirmPortraitWasStored();
  };

  /**
   * Read the portrait back and report honestly whether it is there.
   *
   * A finished job is not proof of a stored portrait. Storing one requires the
   * image to be described first, and that step can fail on its own — a bad
   * model credential, an unreadable image — while the job around it still
   * completes. When that happened the screen said "added" and the portrait
   * silently stayed empty, which is worse than an error: it sends the user off
   * believing something is set. So the portrait is fetched back, and its
   * absence is reported as the failure it is.
   */
  const confirmPortraitWasStored = async () => {
    try {
      const storedPortrait = await getAvatarReferenceImage(assistantId);
      setAvatarIcon(storedPortrait);
      if (storedPortrait) {
        // If this was the avatar that depicts the user, their icon changes
        // everywhere at once — the alternative is a stale face beside their
        // messages until the next reload.
        refreshUserPortrait();
      }
      if (!storedPortrait) {
        toast.error(
          'The upload finished but no portrait was stored. The image could not be processed — check the server logs for the media job.',
          { duration: 9000, position: 'bottom-left' }
        );
      }
    } catch (portraitError) {
      console.error('Re-reading the avatar portrait failed:', portraitError);
      toast.error('Could not confirm the portrait was saved.', {
        position: 'bottom-left',
      });
    }
  };

  /**
   * Set the avatar's portrait from an image URL. The API takes a reference
   * image as a URL just as readily as a file, on the same endpoint.
   */
  /**
   * Apply a change to the avatar record everywhere it is already on screen.
   *
   * PATCH /modify_avatar changes the server's copy, but the name in the chat
   * header, the sidebar heading and the avatar list all read the copy held in
   * context. Without this the rename appeared to do nothing until a reload —
   * the field said one thing and the rest of the application said another.
   *
   * @param {Object} changedFields Fields as the API now holds them.
   */
  const applyAvatarChangeLocally = (changedFields) => {
    const updatedAvatar = { ...(activeAvatar ?? {}), ...changedFields };
    setActiveAvatar(updatedAvatar);
    setUserAvatars((previousAvatars) =>
      (previousAvatars ?? []).map((candidate) =>
        (candidate.assistant_id ?? candidate.avatar_id) === assistantId
          ? { ...candidate, ...changedFields }
          : candidate
      )
    );
  };

  const handleDescSave = async (updatedDescription) => {
    try {
      if (!user) throw new Error('Not logged in');
      await modifyAvatar({
        assistantId,
        newAvatarDescription: updatedDescription,
      });
      setUpdatedDesc(updatedDescription);
      applyAvatarChangeLocally({ description: updatedDescription });
      setEditingDesc(false);
      toast.success('Description updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleUpdateName = async (newAvatarName) => {
    try {
      if (!user) throw new Error('Not logged in');
      await modifyAvatar({
        assistantId,
        newAvatarName,
      });
      setUpdatedAvatarName(newAvatarName);
      applyAvatarChangeLocally({ name: newAvatarName });
      setEditingName(false);
      toast.success('Name updated');
    } catch (err) {
      toast.error(err.message);
    }
  };
  /**
   * Publish this avatar, or withdraw it again.
   *
   * Sharing is reversible, so this needs no confirmation; what it does need is
   * to say plainly what changed, since the effect happens somewhere the user is
   * not looking (the public gallery).
   */
  const handleToggleSharing = async () => {
    const shouldShare = !isAvatarShared;
    setIsUpdatingSharing(true);
    try {
      await shareAvatar(assistantId, shouldShare);
      setIsAvatarShared(shouldShare);
      if (setActiveAvatar && activeAvatar) {
        setActiveAvatar({
          ...activeAvatar,
          metadata: { ...(activeAvatar.metadata ?? {}), is_public: shouldShare },
        });
      }
      toast.success(
        shouldShare
          ? 'Avatar shared. It is now listed publicly.'
          : 'Avatar is private again. It is no longer listed publicly.'
      );
    } catch (sharingError) {
      console.error('Changing sharing failed:', sharingError);
      toast.error(sharingError.message || 'Could not change sharing.');
    } finally {
      setIsUpdatingSharing(false);
    }
  };

  /**
   * Unplug a connected machine from the account.
   *
   * The avatar re-adopts a reachable machine on a later turn, so this is
   * reversible by design and the wording says as much rather than implying a
   * permanent revocation.
   */
  const handleDisconnectDataServer = async (dataServer) => {
    try {
      await disconnectDataServer(dataServer.device_id);
      setConnectedDataServers((previousServers) =>
        previousServers.filter(
          (candidate) => candidate.server_name !== dataServer.server_name
        )
      );
      toast.success(
        `${dataServer.server_name ?? 'Data server'} disconnected.`
      );
    } catch (disconnectError) {
      console.error('Disconnecting the data server failed:', disconnectError);
      toast.error(disconnectError.message || 'Could not disconnect.');
    }
  };

  const handleDeleteAvatar = async () => {
    if (
      !window.confirm(
        'Are you sure you want to delete this avatar? This action cannot be undone.'
      )
    ) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteAvatar(assistantId);

      // The avatar is gone on the server, but the selection screen renders from
      // `userAvatars` in context and never fetches on its own, so without this
      // the deleted avatar is still on screen after navigating back — which
      // reads as "delete did nothing". Clear the pointers to it as well: the
      // active avatar is now a dangling reference, and the cached icon/position
      // entries would resurrect its tile.
      forgetCachedAvatar(assistantId);
      setActiveAvatar(null);
      try {
        setUserAvatars((await listUserAvatars()) ?? []);
      } catch (refreshError) {
        // The delete itself succeeded; a failed refresh must not be reported as
        // a failed delete. The selection screen refetches on mount anyway.
        console.error('Refreshing the avatar list failed:', refreshError);
      }

      toast.success('Avatar deleted successfully');
      navigate('/avatars');
    } catch (err) {
      console.error('Delete avatar error:', err);
      toast.error(err.message || 'Failed to delete avatar');
    } finally {
      setIsDeleting(false);
    }
  };
  // A last line of defence. ChatArea does not offer the settings tab for an
  // avatar the user does not own, so reaching here means something routed
  // around that — and every control below would fail against the API anyway.
  if (!canAdministerAvatar) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 p-6 text-white/70">
        Settings are available to the person who created this avatar.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      {/* Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <Upload
              className="mx-auto mb-4 text-white animate-bounce"
              size={80}
            />
            <h2 className="text-3xl font-bold text-white mb-4">
              Drop to Upload
            </h2>
            <p className="text-white/80 text-lg mb-2">
              Supported: Images, Videos, Audio, PDFs, Text Files, URLs
            </p>
            <p className="text-white/60">
              YouTube • Twitter • Wikipedia • Twitch • Web Pages
            </p>
          </div>
        </div>
      )}
      {/* Social Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 max-w-md w-full border border-white/20">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">
                Connect{' '}
                {SOCIAL_PLATFORMS.find((p) => p.id === selectedPlatform)?.name}
              </h3>
              <button
                onClick={() => setShowLoginModal(false)}
                className="text-white/60 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Username"
                value={loginCredentials.username}
                onChange={(e) =>
                  setLoginCredentials((prev) => ({
                    ...prev,
                    username: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                placeholder="Password"
                value={loginCredentials.password}
                onChange={(e) =>
                  setLoginCredentials((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={submitSocialLogin}
                className="w-full px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-semibold rounded-lg transition-all duration-300 border border-blue-500/30"
              >
                Connect Account
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header with Delete Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Avatar Settings</h2>
        <button
          onClick={handleDeleteAvatar}
          disabled={isDeleting}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 rounded-lg transition-all duration-300 border border-red-500/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 size={16} />
          {isDeleting ? 'Deleting...' : 'Delete Avatar'}
        </button>
      </div>
      {/* Avatar Profile Section */}
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Profile Information
        </h3>
        <div className="flex gap-6 items-start">
          {/* Icon Upload */}
          <div className="flex flex-col gap-3">
            {avatarIcon ? (
              <Dropzone
                onDrop={handleIconUpload}
                multiple={false}
                accept={{ 'image/*': [] }}
                noClick
              >
                {({ getRootProps, getInputProps, open }) => (
                  <div
                    {...getRootProps()}
                    className="relative w-32 h-32 rounded-2xl overflow-hidden cursor-pointer group"
                  >
                    <img
                      src={avatarIcon}
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                    <div
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
                      onClick={open}
                    >
                      <Edit3 size={24} color="white" />
                    </div>
                    <input {...getInputProps()} />
                  </div>
                )}
              </Dropzone>
            ) : (
              <Dropzone onDrop={handleIconUpload} multiple={false}>
                {({ getRootProps, getInputProps }) => (
                  <div
                    {...getRootProps()}
                    className="w-32 h-32 border-2 border-dashed border-white/30 hover:border-white/50 flex flex-col gap-2 items-center justify-center cursor-pointer rounded-2xl bg-white/5 transition-all duration-300"
                  >
                    <input {...getInputProps()} />
                    <Upload size={28} className="text-white/50" />
                    <span className="text-xs text-white/50">Add a portrait</span>
                  </div>
                )}
              </Dropzone>
            )}
            <p className="text-xs text-white/40 text-center w-32">
              {avatarIcon ? 'Click to replace' : 'Drop or click'}
            </p>
          </div>
          {/* Name and Description */}
          <div className="flex-grow space-y-4">
            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Name
              </label>
              {editingName ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={updatedAvatarName}
                    onChange={(e) => setUpdatedAvatarName(e.target.value)}
                    placeholder="Enter avatar name"
                    className="flex-grow px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <button
                    onClick={() => {
                      handleUpdateName(updatedAvatarName);
                      setEditingName(false);
                    }}
                    className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all duration-300 border border-blue-500/30"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-300 border border-white/20"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-center px-4 py-2 bg-white/5 border border-white/10 rounded-lg">
                  <span className="text-white font-medium">
                    {activeAvatar?.name}
                  </span>
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-blue-400 hover:text-blue-300 transition-colors duration-300"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
            {/* Description Field */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Description
              </label>
              {editingDesc ? (
                <div className="space-y-2">
                  <textarea
                    value={updatedDesc}
                    onChange={(e) => setUpdatedDesc(e.target.value)}
                    placeholder="Enter description"
                    rows="3"
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        handleDescSave(updatedDesc);
                        setEditingDesc(false);
                      }}
                      className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all duration-300 border border-blue-500/30"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingDesc(false)}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-300 border border-white/20"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-start px-4 py-2 bg-white/5 border border-white/10 rounded-lg min-h-[80px]">
                  <p className="text-white/80 flex-grow">
                    {activeAvatar?.description}
                  </p>
                  <button
                    onClick={() => setEditingDesc(true)}
                    className="text-blue-400 hover:text-blue-300 transition-colors duration-300 ml-4"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Social Media Section */}
      {/* <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
        <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
          <Link size={24} />
          Social Media Accounts
        </h2>
        {socialLogins.length > 0 && (
          <div className="space-y-3 mb-4">
            {socialLogins.map((login) => {
              const platform = SOCIAL_PLATFORMS.find(
                (p) => p.id === login.platform
              );
              const Icon = platform?.icon;
              return (
                <div
                  key={login.id}
                  className="bg-white/10 border border-white/20 rounded-lg p-4 flex items-center justify-between hover:bg-white/15 transition-all duration-300"
                >
                  <a
                    href={getSocialUrl(login.platform, login.username)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 flex-1"
                  >
                    {Icon && (
                      <Icon size={32} style={{ color: platform.color }} />
                    )}
                    <div>
                      <p className="text-white font-semibold">
                        {platform?.name}
                      </p>
                      <p className="text-white/60 text-sm">@{login.username}</p>
                      <p className="text-white/40 text-xs">
                        Connected{' '}
                        {new Date(login.connectedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <ExternalLink size={16} className="text-white/40 ml-auto" />
                  </a>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      removeSocialLogin(login.id);
                    }}
                    className="text-red-400 hover:text-red-300 ml-4 p-2 hover:bg-red-500/20 rounded-lg transition-all duration-300"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {SOCIAL_PLATFORMS.map((platform) => {
            const Icon = platform.icon;
            const isConnected = socialLogins.some(
              (login) => login.platform === platform.id
            );
            return (
              <button
                key={platform.id}
                onClick={() => !isConnected && handleSocialLogin(platform.id)}
                disabled={isConnected}
                className={`p-3 rounded-lg border transition-all duration-300 flex flex-col items-center gap-2 ${
                  isConnected
                    ? 'bg-green-500/20 border-green-500/50 cursor-not-allowed'
                    : 'bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/40'
                }`}
              >
                <Icon size={24} style={{ color: platform.color }} />
                <span className="text-white text-xs">{platform.name}</span>
                {isConnected && (
                  <span className="text-xs text-green-400">Connected</span>
                )}
              </button>
            );
          })}
        </div>
      </div> */}
      {/* Upload Section */}
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
        <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
          <Upload size={24} />
          Upload
        </h2>
        {/* Manual URL Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-white/70 mb-2">
            Add URL
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://example.com or paste any URL"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && manualUrl) {
                  handleUrlUpload(manualUrl);
                  setManualUrl('');
                }
              }}
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => {
                if (manualUrl) {
                  handleUrlUpload(manualUrl);
                  setManualUrl('');
                }
              }}
              disabled={!manualUrl || isLoading}
              className="px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-semibold rounded-lg transition-all duration-300 flex items-center gap-2 border border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload size={20} />
              Add
            </button>
          </div>
        </div>
        <div className="border-2 border-dashed border-white/30 rounded-xl p-8 text-center hover:border-white/50 transition-all duration-300 bg-white/5">
          <Upload className="mx-auto mb-4 text-white/60" size={48} />
          <p className="text-white text-lg mb-2">
            Drag & drop anywhere on the page
          </p>
          <p className="text-white/60 text-sm mb-4">
            or paste URLs with Ctrl+V / Cmd+V
          </p>
          <label className="inline-block px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-semibold rounded-lg cursor-pointer transition-all duration-300 border border-blue-500/30">
            Choose Files
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFileUpload({ target: e.target });
              }}
            />
          </label>
          <p className="text-white/40 text-xs mt-3">
            Images • Videos • Audio • PDFs • Text • URLs
          </p>
        </div>
      </div>
      {/* Sharing — personal avatars only. Publishing is for your own likeness. */}
      {isPersonalAvatar && (
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          {isAvatarShared ? <Globe size={20} /> : <Lock size={20} />}
          Sharing
        </h3>
        <div className="flex items-start justify-between gap-6">
          <p className="text-white/60 text-sm">
            {isAvatarShared
              ? 'This avatar is listed publicly. Anyone can find it and chat with it. Only you can change its settings or its data.'
              : 'Only you can see this avatar. Share it to list it publicly, so anyone can find it and chat with it.'}
          </p>
          <button
            onClick={handleToggleSharing}
            disabled={isUpdatingSharing}
            className={`shrink-0 px-4 py-2 rounded-lg border transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
              isAvatarShared
                ? 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                : 'bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border-teal-500/30'
            }`}
          >
            {isUpdatingSharing
              ? 'Saving…'
              : isAvatarShared
                ? 'Make private'
                : 'Share publicly'}
          </button>
        </div>
      </div>
      )}

      {/* Connected data servers — reached through the personal avatar, so they
          are not a property of any other avatar. */}
      {isPersonalAvatar && (
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Server size={20} />
          Connected Data Servers
        </h3>
        {connectedDataServers.length > 0 ? (
          <div className="space-y-2">
            {connectedDataServers.map((dataServer) => (
              <div
                key={dataServer.server_name ?? dataServer.device_id}
                className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg"
              >
                <div>
                  <p className="text-white">
                    {dataServer.server_name ?? 'Data server'}
                  </p>
                  <p className="text-white/50 text-xs">
                    {dataServer.bound_to_this_avatar
                      ? 'Available to this avatar'
                      : 'Connected to your account, bound to another avatar'}
                  </p>
                </div>
                <button
                  onClick={() => handleDisconnectDataServer(dataServer)}
                  className="px-3 py-1.5 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg border border-red-500/30 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/50 text-sm">
            No data servers connected. Connecting one lets this avatar work with
            files and data on your own machine.
          </p>
        )}
      </div>
      )}

      {/* Documents Section */}

      <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <File size={20} />
          Data Uploaded for {activeAvatar?.name}
        </h3>

        <div className="space-y-2">
          {avatarDocuments.length > 0 ? (
            avatarDocuments.map((documentLabel) => (
              <div
                key={documentLabel}
                className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-blue-400" />
                  <span className="text-white text-sm font-medium">
                    {documentLabel}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteDocument(documentLabel)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-white/40 text-sm italic">
              No files attached to this avatar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
export default AvatarSettings;
