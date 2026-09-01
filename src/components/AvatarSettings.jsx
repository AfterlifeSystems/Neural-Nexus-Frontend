import React, { useState, useEffect, useCallback } from 'react';
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
  Mail,
  Copy,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  deleteAvatarDocument,
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
  listConnectedAccounts,
  listConnectableProviders,
  disconnectAccount,
} from '../services/avatarService';
import ConnectAccountCard from './ConnectAccountCard';
import {
  forgetCachedAvatar,
  writeCachedAvatarIcon,
  forgetCachedAvatarIcon,
  isAvatarOwnedByUser,
  isAvatarListedPublicly,
  canShareAvatar,
  buildSharedAvatarUrl,
} from './utils';
import { isAdminAccount } from '../config/adminAccount';
import { showRequestFailureToast } from './requestFailureToast';
import AvatarDocumentRow from './AvatarDocumentRow';
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
/**
 * @param {Object} props
 * @param {string} props.avatarId The avatar being administered.
 * @param {Function} [props.onPortraitChanged] Called with the avatar's portrait
 *   (a data URI, or null when the avatar no longer has one) the moment a new one
 *   is stored. The screen around this one paints the same portrait from its own
 *   state — the header beside the avatar's name, the face beside every message —
 *   and nothing else tells it that the portrait it fetched on mount has been
 *   replaced, which is why a new portrait used to appear only after a reload.
 */
const AvatarSettings = ({ avatarId, onPortraitChanged }) => {
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
    isAvatarListedPublicly(activeAvatar)
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
  // Source documents already uploaded to this avatar, from
  // GET /list_avatar_documents. Each entry is
  // {label, referenceRole, isReferenceImage, isReferenceAudio}: `label` is both
  // what is shown and what deleteAvatarDocument takes back, and the reference
  // fields say whether that upload is the avatar's portrait or its voice sample
  // rather than an ordinary source file.
  const [avatarDocuments, setAvatarDocuments] = useState([]);
  // Why the file list is empty, when it is empty because something FAILED
  // rather than because the avatar genuinely has no files. Without this the two
  // states render identically, and "No files attached to this avatar" is shown
  // over an avatar whose files the API is perfectly willing to list.
  const [avatarDocumentsError, setAvatarDocumentsError] = useState(null);
  // Bumped by the retry control to re-run the loading effect below.
  const [avatarDocumentsReloadCount, setAvatarDocumentsReloadCount] =
    useState(0);
  // The avatar's portrait from GET /avatar_reference_image (data URI or URL).
  const [avatarIcon, setAvatarIcon] = useState(null);

  const assistantId =
    activeAvatar?.assistant_id ??
    activeAvatar?.avatar_id ??
    activeAvatar?.metadata?.assistant_id ??
    avatarId;

  // Every control on this screen writes to the avatar, and the API refuses all
  // of them for an avatar the caller did not create. Sharing is the one
  // exception, handled by canChangeSharing below.
  const canAdministerAvatar = isAvatarOwnedByUser(activeAvatar, user);

  // The administrator may publish or withdraw ANY avatar — one it did not
  // create, and one that does not depict its creator — which is precisely what
  // POST /share_avatar exempts that account from. Without this the account's
  // own invented avatars (a pastor, a restaurant) offered no way to publish
  // them at all, because the sharing control below is otherwise reserved for
  // the personal avatar.
  const isAdministrator = isAdminAccount(user);
  const canChangeSharing = canShareAvatar(activeAvatar, user);

  // The avatar that depicts its creator. Two things belong only to it: sharing
  // (you may publish your own likeness, not a character you invented) and the
  // connected data servers, which are the account's own machines reached
  // through the personal avatar.
  const isPersonalAvatar = Boolean(
    activeAvatar?.metadata?.is_personal_avatar_of_creator
  );

  // Memoized on the avatar it reads, so the loading effect below can depend on
  // it honestly instead of closing over a stale assistantId.
  const refreshAvatarDocuments = useCallback(async () => {
    try {
      setAvatarDocuments(await listAvatarDocuments(assistantId));
      setAvatarDocumentsError(null);
    } catch (listError) {
      console.error('Loading the avatar document list failed:', listError);
      setAvatarDocuments([]);
      setAvatarDocumentsError(
        listError.message ?? 'This avatar’s files could not be listed.'
      );
    }
  }, [assistantId]);

  // The document endpoints name their avatar in the request, so opening this
  // screen is a plain read: there is no per-account "selected avatar" to
  // register first, and nothing another tab can repoint between the two calls.
  useEffect(() => {
    let cancelled = false;
    const loadAvatarFilesAndPortrait = async () => {
      if (!assistantId || !canAdministerAvatar) {
        // These endpoints are refused for an avatar the caller did not create,
        // so an avatar the user is merely visiting is not read at all.
        return;
      }
      await refreshAvatarDocuments();
      if (cancelled) return;
      try {
        const iconSource = await getAvatarReferenceImage(assistantId);
        if (!cancelled) {
          setAvatarIcon(iconSource);
        }
      } catch (iconError) {
        // The portrait is a separate request from the file list; losing one
        // must not blank the other.
        console.error('Loading the avatar portrait failed:', iconError);
      }
    };
    loadAvatarFilesAndPortrait();
    return () => {
      cancelled = true;
    };
  }, [
    assistantId,
    canAdministerAvatar,
    avatarDocumentsReloadCount,
    refreshAvatarDocuments,
  ]);

  // Mailboxes connected to this account. Read from the same personal-avatar
  // capability report as the data servers, so one request answers both.
  const [connectedMailboxes, setConnectedMailboxes] = useState([]);
  // The provider whose sign-in card is open, or null. The card itself is the
  // same component the avatar raises mid-conversation.
  const [providerBeingConnected, setProviderBeingConnected] = useState(null);
  const [connectableProviders, setConnectableProviders] = useState([]);

  /**
   * Re-read the connected accounts after connecting or disconnecting one.
   *
   * Reads the accounts endpoint rather than trusting what was just submitted:
   * the stored record is the only thing that decides whether the avatar can
   * actually reach a mailbox, and a list built from an optimistic update would
   * claim a connection the server may have refused.
   */
  const refreshConnectedMailboxes = useCallback(async () => {
    try {
      const accountsResponse = await listConnectedAccounts();
      const accounts = accountsResponse?.accounts ?? [];
      setConnectedMailboxes(
        accounts.filter((account) => account.kind === 'mailbox')
      );
    } catch (accountsError) {
      console.debug('No connected accounts to show:', accountsError);
    }
  }, []);

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
        ).find(
          (capability) => capability.status_key === 'connected_data_servers'
        );
        const connections =
          personalAvatarResponse?.connected_data_servers ??
          dataServerCapability?.status;
        setConnectedDataServers(Array.isArray(connections) ? connections : []);

        const mailboxCapability = (
          personalAvatarResponse?.capabilities ?? []
        ).find((capability) => capability.status_key === 'connected_mailboxes');
        const mailboxes = mailboxCapability?.status;
        // Every mailbox is listed, including one whose credential has stopped
        // working. Hiding a broken connection would leave the owner wondering
        // why the avatar cannot read mail it was told about.
        setConnectedMailboxes(Array.isArray(mailboxes) ? mailboxes : []);
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
    setIsAvatarShared(isAvatarListedPublicly(activeAvatar));
  }, [activeAvatar]);

  // Seed the editors with what the avatar is currently called. They started
  // empty, so pressing Edit offered a blank field and saving without retyping
  // would have wiped the name.
  useEffect(() => {
    setUpdatedAvatarName(activeAvatar?.name ?? '');
    setUpdatedDesc(activeAvatar?.description ?? '');
  }, [activeAvatar?.name, activeAvatar?.description]);

  // Global drag and drop handlers.
  //
  // These listen on the whole document, so they are registered only for an
  // avatar the caller created. The administrator opening somebody else's avatar
  // sees the sharing control alone, and a file dropped anywhere on that screen
  // would otherwise raise the full-screen upload overlay for an upload the API
  // refuses.
  useEffect(() => {
    if (!canAdministerAvatar) {
      return undefined;
    }
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
  }, [canAdministerAvatar]);

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
      stageDescriptions[progressEvent.stage] ??
      progressEvent.stage ??
      'Processing';

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
   * One upload is ONE toast from start to finish: the loading toast raised here
   * is the same toast that later says the upload landed or says why it did not.
   * Dismissing it and raising a fresh success toast — which is what this used to
   * do — breaks a single upload into a chain of unrelated messages that arrive in
   * different places in the stack, and lets a "finished" message stand beside a
   * later message saying nothing was stored.
   *
   * @param {Object} options
   * @param {File[]} [options.files] Files to send.
   * @param {string[]} [options.urls] URLs to ingest.
   * @param {boolean} [options.isReferenceImage] Send as the avatar's portrait.
   * @param {string} options.description What is being uploaded, for the toasts.
   * @param {Function} [options.confirmStored] Run after the job reports done, to
   *   check that what was uploaded is actually stored. Returns null when it is,
   *   or the message to show instead of the success message when it is not — so
   *   the upload's single toast ends on the truth rather than being contradicted
   *   by a second one.
   * @returns {Promise<boolean>} Whether the job finished successfully.
   */
  const uploadMediaAndFollowJob = async ({
    files = [],
    urls = [],
    isReferenceImage = false,
    description,
    confirmStored,
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
      position: 'top-right',
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
          { duration: 9000, position: 'top-right' }
        );
      }

      /**
       * End this upload's toast on its verdict: the confirmation step, when
       * there is one, has the last word.
       *
       * @returns {Promise<boolean>} Whether the upload is considered successful.
       */
      const finishOnConfirmation = async () => {
        const confirmationFailure = confirmStored ? await confirmStored() : null;
        if (confirmationFailure) {
          toast.error(confirmationFailure, {
            id: progressToastId,
            duration: 9000,
            position: 'top-right',
          });
          return false;
        }
        toast.success(`${description} added`, {
          id: progressToastId,
          position: 'top-right',
        });
        return true;
      };

      const jobId = uploadResponse?.job_id;
      if (!jobId) {
        // Nothing to follow — either everything was rejected, or this build of
        // the API answered synchronously.
        await refreshAvatarDocuments();
        if (Array.isArray(rejectedItems) && rejectedItems.length > 0) {
          // The rejection toast above already said what was refused; this one
          // must not claim the upload landed.
          toast.dismiss(progressToastId);
          return false;
        }
        return finishOnConfirmation();
      }

      let jobFailure = null;
      await streamMediaJobProgress(jobId, (progressEvent) => {
        if (progressEvent.type === 'media_progress') {
          toast.loading(describeMediaProgress(progressEvent, description), {
            id: progressToastId,
            position: 'top-right',
          });
        } else if (progressEvent.type === 'done') {
          jobFailure = progressEvent.error ?? null;
        }
      });

      if (jobFailure) {
        toast.error(`Processing ${description} failed: ${jobFailure}`, {
          id: progressToastId,
          duration: 9000,
          position: 'top-right',
        });
        return false;
      }

      await refreshAvatarDocuments();
      return finishOnConfirmation();
    } catch (uploadError) {
      toast.dismiss(progressToastId);
      console.error('Media upload failed:', uploadError);
      // An upload is metered too, so it can be refused for a spent allotment
      // exactly as a message can; reported through the shared path, that
      // refusal arrives with a way to billing rather than as a dead end.
      showRequestFailureToast(uploadError, {
        fallbackMessage: 'Upload failed.',
        position: 'top-right',
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
      description: files.length === 1 ? files[0].name : `${files.length} files`,
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
      await deleteAvatarDocument(assistantId, sourceDocumentName);
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

    await uploadMediaAndFollowJob({
      files: [chosenImage],
      isReferenceImage: true,
      description: 'the avatar portrait',
      confirmStored: confirmPortraitWasStored,
    });
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
   *
   * @returns {Promise<string|null>} Null when the portrait is stored, otherwise
   *   the message the upload's toast must end on instead of "added".
   */
  const confirmPortraitWasStored = async () => {
    try {
      const storedPortrait = await getAvatarReferenceImage(assistantId);
      setAvatarIcon(storedPortrait);
      // The screen around this one holds its own copy of the portrait, fetched
      // when it opened: the header beside the avatar's name and the face beside
      // every message. Handing it the new portrait is what replaces those the
      // moment it is stored rather than on the next page load.
      onPortraitChanged?.(storedPortrait);
      // The gallery paints from this cache before it asks the API, so a
      // replaced portrait has to land here too — otherwise the old face
      // survives on the selection screen until its revalidation catches up.
      if (storedPortrait) {
        writeCachedAvatarIcon(assistantId, storedPortrait);
      } else {
        forgetCachedAvatarIcon(assistantId);
      }
      if (storedPortrait) {
        // If this was the avatar that depicts the user, their icon changes
        // everywhere at once — the alternative is a stale face beside their
        // messages until the next reload.
        refreshUserPortrait();
      }
      if (!storedPortrait) {
        return 'The upload finished but no portrait was stored. The image could not be processed — check the server logs for the media job.';
      }
      return null;
    } catch (portraitError) {
      console.error('Re-reading the avatar portrait failed:', portraitError);
      return 'Could not confirm the portrait was saved.';
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
          metadata: {
            ...(activeAvatar.metadata ?? {}),
            is_public: shouldShare,
          },
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
      toast.success(`${dataServer.server_name ?? 'Data server'} disconnected.`);
    } catch (disconnectError) {
      console.error('Disconnecting the data server failed:', disconnectError);
      toast.error(disconnectError.message || 'Could not disconnect.');
    }
  };

  const handleDisconnectMailbox = async (mailbox) => {
    if (
      !window.confirm(
        `Disconnect ${mailbox.account_address}? The saved password is deleted ` +
          'and this avatar will no longer be able to read that mailbox.'
      )
    ) {
      return;
    }
    try {
      await disconnectAccount(mailbox.account_key);
      setConnectedMailboxes((previousMailboxes) =>
        previousMailboxes.filter(
          (candidate) => candidate.account_key !== mailbox.account_key
        )
      );
      toast.success(`${mailbox.account_address} disconnected.`);
    } catch (disconnectError) {
      console.error('Disconnecting the mailbox failed:', disconnectError);
      toast.error(disconnectError.message || 'Could not disconnect.');
    }
  };

  /**
   * Open the sign-in card for a provider, fetching its description first.
   *
   * The description — labels, fields, the app-password explanation — comes from
   * the API so this screen and the in-chat card show the same thing.
   */
  const handleOpenConnectCard = async () => {
    try {
      const providers =
        connectableProviders.length > 0
          ? connectableProviders
          : ((await listConnectableProviders())?.providers ?? []);
      setConnectableProviders(providers);
      const gmailProvider =
        providers.find((entry) => entry.provider === 'gmail') ?? providers[0];
      if (!gmailProvider) {
        toast.error('No mailbox providers are available to connect.');
        return;
      }
      setProviderBeingConnected({
        ...gmailProvider,
        already_connected: connectedMailboxes,
      });
    } catch (providersError) {
      console.error(
        'Reading the connectable providers failed:',
        providersError
      );
      toast.error(providersError.message || 'Could not open the sign-in form.');
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
  // The public address of this avatar, valid only while the avatar is shared.
  // It is built rather than returned by the API: the API knows nothing about
  // this application's routes.
  const sharedAvatarUrl = buildSharedAvatarUrl(assistantId);

  /**
   * Put the share link on the clipboard.
   *
   * The clipboard API is unavailable outside a secure context (plain http on a
   * hostname other than localhost), and refusing silently would look like a
   * dead button — so the failure says what to do instead, and the link stays
   * on screen and selectable either way.
   */
  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(sharedAvatarUrl);
      toast.success('Share link copied.');
    } catch (copyError) {
      console.error('Copying the share link failed:', copyError);
      toast.error('Could not copy automatically — select the link to copy it.');
    }
  };

  /**
   * The Sharing control.
   *
   * Rendered from a function because it appears in two places: inside the full
   * settings screen for the avatar's creator, and on its own for the
   * administrator looking at an avatar somebody else created — the one account
   * that may change the sharing of an avatar it does not otherwise administer.
   */
  const renderSharingCard = () => {
    const isAdministeringSomeoneElsesAvatar =
      !canAdministerAvatar && isAdministrator;
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          {isAvatarShared ? <Globe size={20} /> : <Lock size={20} />}
          Sharing
        </h3>
        <div className="flex items-start justify-between gap-6">
          <p className="text-white/60 text-sm">
            {isAdministeringSomeoneElsesAvatar
              ? isAvatarShared
                ? 'Another account created this avatar and it is listed publicly. As the administrator you can withdraw it from the public gallery. Its name, portrait and data stay with the account that created it.'
                : 'Another account created this avatar. As the administrator you can list it publicly, so anyone can find it and chat with it. Its name, portrait and data stay with the account that created it.'
              : isAvatarShared
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

        {isAvatarShared && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-white/60 text-sm mb-2">
              Anyone with this link can chat with this avatar. They do not need
              an account, and they see nothing else of Neural Nexus.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                readOnly
                value={sharedAvatarUrl}
                onFocus={(focusEvent) => focusEvent.target.select()}
                aria-label="Public link to this avatar"
                className="flex-grow min-w-0 px-3 py-2 rounded-lg bg-black/30 border border-white/20 text-white text-sm font-mono"
              />
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleCopyShareLink}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-300 font-semibold transition-colors"
                >
                  <Copy size={16} />
                  Copy link
                </button>
                <a
                  href={sharedAvatarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
                >
                  <ExternalLink size={16} />
                  Open
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // A last line of defence for everything OTHER than sharing. Renaming, the
  // portrait, the source documents and deletion are all refused by the API for
  // an avatar the caller did not create, so an avatar somebody else created
  // shows the administrator the one control that account does hold over it, and
  // shows everybody else nothing.
  if (!canAdministerAvatar) {
    if (canChangeSharing) {
      return (
        <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
          {renderSharingCard()}
          <p className="text-white/50 text-sm px-1">
            Another account created this avatar, so its name, portrait, source
            documents and deletion stay with that account. Sharing is the only
            setting the administrator can change here.
          </p>
        </div>
      );
    }
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
                // The screen also listens for a drop on the document itself, so
                // that a file dropped anywhere is taken as source material. An
                // image dropped HERE is the portrait and nothing else: without
                // this the one drop ran both handlers and uploaded the same file
                // twice — once as the portrait, once as an ordinary document —
                // with two independent sets of progress toasts to match.
                noDragEventsBubbling
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
              <Dropzone
                onDrop={handleIconUpload}
                multiple={false}
                accept={{ 'image/*': [] }}
                // Same reason as the replace-the-portrait dropzone above: this
                // drop is the portrait, not another source document.
                noDragEventsBubbling
              >
                {({ getRootProps, getInputProps }) => (
                  <div
                    {...getRootProps()}
                    className="w-32 h-32 border-2 border-dashed border-white/30 hover:border-white/50 flex flex-col gap-2 items-center justify-center cursor-pointer rounded-2xl bg-white/5 transition-all duration-300"
                  >
                    <input {...getInputProps()} />
                    <Upload size={28} className="text-white/50" />
                    <span className="text-xs text-white/50">
                      Add a portrait
                    </span>
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
      {/* Sharing. Publishing is for your own likeness, so this is the personal
          avatar's control — except for the administrator, who may publish any
          avatar and therefore sees it on all of them. */}
      {canChangeSharing && renderSharingCard()}

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
              No data servers connected. Connecting one lets this avatar work
              with files and data on your own machine.
            </p>
          )}
        </div>
      )}

      {/* Connected Mailboxes — personal-avatar only, for the same reason the
          data servers are: these carry the owner's own mail credentials, and a
          shared or demoted avatar must reach none of them. */}
      {isPersonalAvatar && (
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              <Mail size={20} />
              Connected Mailboxes
            </h3>
            <button
              onClick={handleOpenConnectCard}
              className="px-3 py-1.5 text-sm bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-lg border border-teal-500/30 transition-colors"
            >
              Connect Gmail
            </button>
          </div>
          {connectedMailboxes.length > 0 ? (
            <div className="space-y-2">
              {connectedMailboxes.map((mailbox) => (
                <div
                  key={mailbox.account_key}
                  className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="text-white truncate">
                      {mailbox.account_address}
                    </p>
                    <p
                      className={`text-xs ${
                        mailbox.status === 'connected'
                          ? 'text-white/50'
                          : 'text-amber-300'
                      }`}
                    >
                      {mailbox.status === 'connected'
                        ? `Available to this avatar as "${mailbox.display_label}"`
                        : 'The saved password has stopped working — reconnect this mailbox.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {mailbox.status !== 'connected' && (
                      <button
                        onClick={handleOpenConnectCard}
                        className="px-3 py-1.5 text-sm bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-lg border border-teal-500/30 transition-colors"
                      >
                        Reconnect
                      </button>
                    )}
                    <button
                      onClick={() => handleDisconnectMailbox(mailbox)}
                      className="px-3 py-1.5 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg border border-red-500/30 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/50 text-sm">
              No mailboxes connected. Connecting one lets this avatar search and
              read your email and write draft replies. It can never send.
            </p>
          )}
        </div>
      )}

      {/* The sign-in card, in a modal. Deliberately the same component the
          avatar raises mid-conversation, so there is one implementation of the
          form and one place the app-password guidance is worded. */}
      {providerBeingConnected && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <ConnectAccountCard
              interrupt={providerBeingConnected}
              startOpen
              className="w-full"
              onDecision={(decision) => {
                setProviderBeingConnected(null);
                if (decision === 'apply') {
                  refreshConnectedMailboxes();
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Connected Mailboxes — personal-avatar only, for the same reason the
          data servers are: these carry the owner's own mail credentials, and a
          shared or demoted avatar must reach none of them. */}
      {isPersonalAvatar && (
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <Mail size={20} />
            Connected Mailboxes
          </h3>
          <button
            onClick={handleOpenConnectCard}
            className="px-3 py-1.5 text-sm bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-lg border border-teal-500/30 transition-colors"
          >
            Connect Gmail
          </button>
        </div>
        {connectedMailboxes.length > 0 ? (
          <div className="space-y-2">
            {connectedMailboxes.map((mailbox) => (
              <div
                key={mailbox.account_key}
                className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg"
              >
                <div className="min-w-0">
                  <p className="text-white truncate">
                    {mailbox.account_address}
                  </p>
                  <p
                    className={`text-xs ${
                      mailbox.status === 'connected'
                        ? 'text-white/50'
                        : 'text-amber-300'
                    }`}
                  >
                    {mailbox.status === 'connected'
                      ? `Available to this avatar as "${mailbox.display_label}"`
                      : 'The saved password has stopped working — reconnect this mailbox.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {mailbox.status !== 'connected' && (
                    <button
                      onClick={handleOpenConnectCard}
                      className="px-3 py-1.5 text-sm bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-lg border border-teal-500/30 transition-colors"
                    >
                      Reconnect
                    </button>
                  )}
                  <button
                    onClick={() => handleDisconnectMailbox(mailbox)}
                    className="px-3 py-1.5 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg border border-red-500/30 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/50 text-sm">
            No mailboxes connected. Connecting one lets this avatar search and
            read your email and write draft replies. It can never send.
          </p>
        )}
      </div>
      )}

      {/* The sign-in card, in a modal. Deliberately the same component the
          avatar raises mid-conversation, so there is one implementation of the
          form and one place the app-password guidance is worded. */}
      {providerBeingConnected && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <ConnectAccountCard
              interrupt={providerBeingConnected}
              startOpen
              className="w-full"
              onDecision={(decision) => {
                setProviderBeingConnected(null);
                if (decision === 'apply') {
                  refreshConnectedMailboxes();
                }
              }}
            />
          </div>
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
            avatarDocuments.map((documentEntry) => (
              <AvatarDocumentRow
                key={documentEntry.label}
                documentEntry={documentEntry}
                portraitDataUri={avatarIcon}
                onDelete={handleDeleteDocument}
              />
            ))
          ) : avatarDocumentsError ? (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-300 text-sm">{avatarDocumentsError}</p>
              <button
                onClick={() =>
                  setAvatarDocumentsReloadCount(
                    (reloadCount) => reloadCount + 1
                  )
                }
                className="mt-2 px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-colors"
              >
                Try again
              </button>
            </div>
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
