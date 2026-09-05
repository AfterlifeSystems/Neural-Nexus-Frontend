import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
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
  Copy,
  Search,
  Sparkles,
  Loader2,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  DESCRIPTION_PROMPT_MARKER,
  NEW_CONVERSATION_ID,
  useMedia,
} from '../context/MediaContext';
import {
  deleteAvatarDocument,
  setAvatarVoiceReference,
  deleteAvatar,
  modifyAvatar,
  listAvatarDocuments,
  listUserAvatars,
  getAvatarReferenceImage,
  shareAvatar,
  deleteAvatarEmotionMedia,
} from '../services/avatarService';
import { streamServerSentEvents } from '../services/neuralNexusApiClient';
import {
  showRequestFailureToast,
  isBillingRefusal,
} from './requestFailureToast';
import ConnectionsSection from './connections/ConnectionsSection';
import EmotionMediaStatus from './media/EmotionMediaStatus';
import UploadProcessPanel from './media/UploadProcessPanel';
import VoicePanel from './voice/VoicePanel';
import useEmotionMedia, { forgetEmotionMedia } from '../hooks/useEmotionMedia';
import { subscribeAvatarPortraitChanged } from '../services/avatarPortraitEvents';
import { emotionMediaRows } from '../hooks/emotionMediaRows';
import AvatarIdentityFacts from './AvatarIdentityFacts';
import {
  forgetCachedAvatar,
  writeCachedAvatarIcon,
  readCachedAvatarIcons,
  forgetCachedAvatarIcon,
  isAvatarOwnedByUser,
  isAvatarListedPublicly,
  canShareAvatar,
  buildSharedAvatarUrl,
} from './utils';
import { isAdminAccount } from '../config/adminAccount';
import { parseHttpUrls } from '../services/parseHttpUrls';
import { singleReferenceImageUrl } from '../services/referenceImageUrl';
import {
  didDragLeaveViewport,
  isDropOverlayCancelKey,
  isFileOrUrlDrag,
} from './documentDropOverlay';
import { splitVoiceMedia } from '../services/voiceMedia';
import useIdentityMediaJobs from '../hooks/useIdentityMediaJobs';
import AvatarDocumentRow, {
  describeDocumentKind,
  describeUrlKind,
  parseDocumentSourceUrl,
} from './AvatarDocumentRow';
import { useNavigate, useSearchParams } from 'react-router-dom';

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
  const { activeConversation } = useMedia();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [editingDesc, setEditingDesc] = useState(false);
  const [updatedDesc, setUpdatedDesc] = useState('');
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const descriptionAbortRef = useRef(null);
  const voiceSectionRef = useRef(null);
  const [updatedAvatarName, setUpdatedAvatarName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Sharing state is mirrored locally so the control responds immediately, then
  // reconciled against the avatar record the server returns.
  const [isAvatarShared, setIsAvatarShared] = useState(
    isAvatarListedPublicly(activeAvatar)
  );
  const [isUpdatingSharing, setIsUpdatingSharing] = useState(false);
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
  const [portraitUrl, setPortraitUrl] = useState('');
  // Bumped whenever something outside the Voice panel changes the voice
  // (a deleted upload, a new reference clip) so the panel re-reads status.
  const [voiceStatusVersion, setVoiceStatusVersion] = useState(0);
  const urlInputRef = useRef(null);
  const portraitUrlInputRef = useRef(null);
  const uploadSectionRef = useRef(null);
  const startSectionUploadRef = useRef(null);
  // Source documents already uploaded to this avatar, from
  // GET /list_avatar_documents. Each entry is
  // {label, referenceRole, isReferenceImage, isReferenceAudio}: `label` is both
  // what is shown and what deleteAvatarDocument takes back, and the reference
  // fields say whether that upload is the avatar's portrait or its voice sample
  // rather than an ordinary source file.
  const [avatarDocuments, setAvatarDocuments] = useState([]);
  // Narrowing the uploads list: a text search over labels, and one kind at a
  // time. Both are view state only; the list itself is never changed by them.
  const [documentSearchQuery, setDocumentSearchQuery] = useState('');
  const [documentKindFilter, setDocumentKindFilter] = useState('all');
  const [isDataUploadedOpen, setIsDataUploadedOpen] = useState(true);
  // Why the file list is empty, when it is empty because something FAILED
  // rather than because the avatar genuinely has no files. Without this the two
  // states render identically, and "No files attached to this avatar" is shown
  // over an avatar whose files the API is perfectly willing to list.
  const [avatarDocumentsError, setAvatarDocumentsError] = useState(null);
  // Bumped by the retry control to re-run the loading effect below.
  const [avatarDocumentsReloadCount, setAvatarDocumentsReloadCount] =
    useState(0);
  const assistantId =
    activeAvatar?.assistant_id ??
    activeAvatar?.avatar_id ??
    activeAvatar?.metadata?.assistant_id ??
    avatarId;

  // The emotion portraits and idle loops generated from the reference image,
  // from GET /avatar_emotion_media (cached per avatar across screens). They are
  // listed under Data Uploaded beside the uploads, marked as generated.
  const { manifest: emotionManifest, refresh: refreshEmotionManifest } =
    useEmotionMedia(assistantId);

  // The avatar's portrait from GET /avatar_reference_image (data URI or URL).
  // Seeded from what this browser already holds for the avatar, so the screen
  // opens with the portrait in place; the effect below re-asks the API and
  // corrects the picture if the stored one has changed.
  const [avatarIcon, setAvatarIcon] = useState(
    () => readCachedAvatarIcons()[assistantId] ?? null
  );

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

  /**
   * Say which filter bucket an upload belongs to. The two reference roles come
   * first because they say what the upload is FOR, which is what someone
   * looking for "the portrait" or "the voice sample" filters by; everything
   * else is bucketed by what it IS.
   */
  const describeDocumentBucket = (documentEntry) => {
    // Generated media names its own bucket (portrait or idle loop).
    if (documentEntry.source === 'emotion') return documentEntry.bucket;
    if (documentEntry.isReferenceImage) return 'reference_image';
    if (documentEntry.isReferenceAudio) return 'reference_audio';
    const sourceUrl = parseDocumentSourceUrl(documentEntry.label);
    if (sourceUrl) {
      // Links are bucketed by where they point — YouTube, Instagram, X — so a
      // pull from one platform can be reviewed on its own.
      return `source:${describeUrlKind(sourceUrl)}`;
    }
    return describeDocumentKind(documentEntry.label) ?? 'other';
  };

  const DOCUMENT_BUCKET_LABELS = {
    all: 'All',
    reference_image: 'Reference image',
    reference_audio: 'Reference audio',
    emotion_portrait: 'Generated portraits',
    emotion_loop: 'Generated videos',
    image: 'Images',
    audio: 'Audio',
    video: 'Video',
    document: 'Documents',
    data: 'Data',
    text: 'Text',
    'source:YouTube': 'YouTube',
    'source:X': 'X',
    'source:Instagram': 'Instagram',
    'source:Twitch': 'Twitch',
    'source:Linktree': 'Linktree',
    'source:Link': 'Other links',
    other: 'Other',
  };

  // Everything the list shows: the uploads, then the generated portraits and
  // idle loops. One array so search, the filter chips, and the counts treat
  // both kinds the same way.
  const allAvatarRows = useMemo(
    () => [...avatarDocuments, ...emotionMediaRows(emotionManifest)],
    [avatarDocuments, emotionManifest]
  );

  // Only the buckets that actually hold something are offered, each with its
  // count, so the filter row never advertises an empty category.
  const documentBucketCounts = useMemo(() => {
    const counts = {};
    for (const documentEntry of allAvatarRows) {
      const bucket = describeDocumentBucket(documentEntry);
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }
    return counts;
  }, [allAvatarRows]);

  const visibleAvatarDocuments = useMemo(() => {
    const normalizedQuery = documentSearchQuery.trim().toLowerCase();
    return allAvatarRows.filter((documentEntry) => {
      if (
        documentKindFilter !== 'all' &&
        describeDocumentBucket(documentEntry) !== documentKindFilter
      ) {
        return false;
      }
      return (
        !normalizedQuery ||
        (documentEntry.label ?? '').toLowerCase().includes(normalizedQuery)
      );
    });
  }, [allAvatarRows, documentSearchQuery, documentKindFilter]);

  // A filter that no longer matches anything (its last item was deleted) falls
  // back to showing everything rather than an empty list with no explanation.
  useEffect(() => {
    if (
      documentKindFilter !== 'all' &&
      !documentBucketCounts[documentKindFilter]
    ) {
      setDocumentKindFilter('all');
    }
  }, [documentBucketCounts, documentKindFilter]);

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

  // Progress lives in identityMediaJobs, not this screen's state, so leaving
  // the avatar (Chat, Avatar Selection, a refresh) does not drop the card.
  const {
    jobs: sectionJobs,
    startUpload,
    cancelJob: cancelSectionJob,
    dismissJob: dismissSectionJob,
  } = useIdentityMediaJobs(assistantId, {
    onDocumentsChanged: refreshAvatarDocuments,
  });

  /**
   * Start an identity-media job from this Upload section. The checklist
   * follows the job in the store so convert 1/N, indexing, and the rest stay
   * on one card — including after this screen unmounts.
   *
   * Audio and video are speech of the avatar wherever they are dropped: the
   * batch is split, and the speech starts a voice job (card in the Voice
   * section) while everything else starts a document job. The server picks
   * the reference clip itself (the first speech upload), so no reference flag
   * is sent for speech.
   *
   * @param {Object} options
   * @param {File[]} [options.files]
   * @param {string[]} [options.urls]
   * @param {boolean} [options.isReferenceImage]
   * @param {'portrait'|'voice'|'document'} [options.kind] Skip the split and
   *   start one job of this kind (the Voice panel passes 'voice').
   * @param {Function} [options.confirmStored] After the job reports done, check
   *   that what was uploaded is actually stored. Returns null when it is, or
   *   the message the panel must end on instead of success.
   * @returns {Promise<boolean>}
   */
  const startSectionUpload = useCallback(
    async (options) => {
      if (!user) {
        toast.error('Not logged in');
        return false;
      }
      if (!assistantId) {
        toast.error('No active avatar');
        return false;
      }
      const scrollToVoice = () =>
        voiceSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      if (options?.isReferenceImage) {
        return startUpload(options);
      }
      if (options?.kind) {
        if (options.kind === 'voice') scrollToVoice();
        return startUpload(options);
      }
      const { voiceFiles, voiceUrls, otherFiles, otherUrls } = splitVoiceMedia({
        files: options?.files ?? [],
        urls: options?.urls ?? [],
      });
      const started = [];
      if (voiceFiles.length > 0) {
        started.push(
          startUpload({
            ...options,
            files: voiceFiles,
            urls: [],
            kind: 'voice',
          })
        );
      }
      // A direct media address must travel alone to be fetched as media, so
      // each speech URL is its own job.
      for (const voiceUrl of voiceUrls) {
        started.push(
          startUpload({
            ...options,
            files: [],
            urls: [voiceUrl],
            kind: 'voice',
          })
        );
      }
      if (otherFiles.length > 0 || otherUrls.length > 0) {
        started.push(
          startUpload({ ...options, files: otherFiles, urls: otherUrls })
        );
      }
      if (voiceFiles.length > 0 || voiceUrls.length > 0) scrollToVoice();
      const results = await Promise.all(started);
      return results.length > 0 && results.every(Boolean);
    },
    [assistantId, startUpload, user]
  );
  startSectionUploadRef.current = startSectionUpload;

  const voiceJobs = useMemo(
    () => sectionJobs.filter((job) => job.kind === 'voice'),
    [sectionJobs]
  );
  const portraitJobs = useMemo(
    () => sectionJobs.filter((job) => job.kind === 'portrait'),
    [sectionJobs]
  );
  const uploadSectionJobs = useMemo(
    () =>
      sectionJobs.filter(
        (job) => job.kind !== 'voice' && job.kind !== 'portrait'
      ),
    [sectionJobs]
  );
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
      // The file list and the portrait are independent reads, so they go out
      // together: waiting for one before starting the other made the screen
      // take the sum of both round trips.
      const loadPortrait = async () => {
        try {
          const iconSource = await getAvatarReferenceImage(assistantId);
          if (!cancelled) {
            setAvatarIcon(iconSource);
            if (iconSource) writeCachedAvatarIcon(assistantId, iconSource);
          }
        } catch (iconError) {
          // The portrait is a separate request from the file list; losing one
          // must not blank the other.
          console.error('Loading the avatar portrait failed:', iconError);
        }
      };
      await Promise.all([refreshAvatarDocuments(), loadPortrait()]);
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

  // A portrait stored by any job for this avatar — one dropped on the Upload
  // section with the reference flag, or one restored after the page reloaded
  // mid-upload — replaces the picture here the moment the job finishes. The
  // dropzone's own path confirms the portrait itself; this covers the rest.
  useEffect(() => {
    if (!assistantId) return undefined;
    let cancelled = false;
    const unsubscribe = subscribeAvatarPortraitChanged(async (changedAssistantId) => {
      if (changedAssistantId !== assistantId) return;
      try {
        const storedPortrait = await getAvatarReferenceImage(assistantId);
        if (cancelled) return;
        setAvatarIcon(storedPortrait);
        if (storedPortrait) {
          writeCachedAvatarIcon(assistantId, storedPortrait);
          onPortraitChanged?.(storedPortrait);
        } else {
          forgetCachedAvatarIcon(assistantId);
        }
      } catch (portraitError) {
        console.error('Re-reading the avatar portrait failed:', portraitError);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [assistantId, onPortraitChanged]);

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

  useEffect(() => {
    if (searchParams.get('section') === 'voice' && voiceSectionRef.current) {
      voiceSectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [searchParams]);

  // Global drag and drop handlers.
  //
  // These listen on the whole document, so they are registered only for an
  // avatar the caller created. The administrator opening somebody else's avatar
  // sees the sharing control alone, and a file dropped anywhere on that screen
  // would otherwise raise the full-screen upload overlay for an upload the API
  // refuses.
  //
  // Dismiss is not only dragleave: a cancelled OS file drag often never
  // reports a leave the page can trust, which used to leave "Drop to Upload"
  // covering the screen with no way off it. Escape, a click, dragend, and
  // leaving the window all clear it; drop still uploads.
  useEffect(() => {
    if (!canAdministerAvatar) {
      return undefined;
    }
    const dismissDropOverlay = () => {
      setIsDragging(false);
    };
    const handleDragEnter = (e) => {
      e.preventDefault();
      if (isFileOrUrlDrag(e.dataTransfer)) {
        setIsDragging(true);
      }
    };
    const handleDragOver = (e) => {
      e.preventDefault();
    };
    const handleDragLeave = (e) => {
      if (
        didDragLeaveViewport(e.clientX, e.clientY, {
          width: window.innerWidth,
          height: window.innerHeight,
        })
      ) {
        dismissDropOverlay();
      }
    };
    const handleDrop = async (e) => {
      e.preventDefault();
      dismissDropOverlay();
      const droppedUrls = parseHttpUrls(
        e.dataTransfer.getData('text/uri-list') ||
          e.dataTransfer.getData('text/plain')
      );
      const files = Array.from(e.dataTransfer.files ?? []);
      if (droppedUrls.length === 0 && files.length === 0) return;
      await startSectionUploadRef.current?.({
        files,
        urls: droppedUrls,
      });
    };
    const handlePaste = (e) => {
      if (
        e.target === urlInputRef.current ||
        e.target === portraitUrlInputRef.current
      ) {
        return;
      }
      const typingInAnotherField =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;
      if (typingInAnotherField) return;
      const pastedUrls = parseHttpUrls(e.clipboardData.getData('text/plain'));
      if (pastedUrls.length === 0) return;
      e.preventDefault();
      startSectionUploadRef.current?.({ urls: pastedUrls });
    };
    const handleKeyDown = (e) => {
      if (isDropOverlayCancelKey(e.key)) {
        dismissDropOverlay();
      }
    };
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);
    document.addEventListener('dragend', dismissDropOverlay);
    document.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
      document.removeEventListener('dragend', dismissDropOverlay);
      document.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canAdministerAvatar]);

  const handleFileUpload = async (e) => {
    const filesList = e.dataTransfer?.files || e.target?.files || [];
    const files = Array.from(filesList);
    if (files.length === 0) return;

    await startSectionUpload({ files });
    if (e.target) {
      e.target.value = '';
    }
  };

  const addManualUrls = () => {
    const urls = parseHttpUrls(manualUrl);
    if (urls.length === 0) {
      toast.error('Enter one or more http:// or https:// URLs');
      return;
    }
    setManualUrl('');
    startSectionUpload({ urls });
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
  /**
   * Delete one uploaded source from the avatar.
   *
   * Deletion is irreversible — the API drops the stored bytes along with the
   * identity documents derived from them — and the delete control sits beside
   * every row of the list, so one misplaced press must not silently remove a
   * source. The person confirms first, with the source named, so what is about
   * to be lost is unambiguous.
   */
  /**
   * Delete one row of Data Uploaded. An upload arrives as its label (the string
   * the document delete endpoint takes back); a generated portrait or idle loop
   * arrives as the whole row, and is deleted by asset id instead.
   */
  const handleDeleteDocument = async (documentEntryOrLabel) => {
    const documentEntry =
      typeof documentEntryOrLabel === 'string'
        ? { label: documentEntryOrLabel }
        : documentEntryOrLabel;
    if (documentEntry?.source === 'emotion') {
      if (
        !window.confirm(
          `Delete the ${documentEntry.label}? The avatar stops using this ` +
            'generated media. This cannot be undone.'
        )
      ) {
        return;
      }
      try {
        if (!user) throw new Error('Not logged in');
        await deleteAvatarEmotionMedia(documentEntry.assetId);
        toast.success('Generated media deleted');
        forgetEmotionMedia(assistantId);
        await refreshEmotionManifest({ force: true });
      } catch (err) {
        toast.error('Failed to delete: ' + err.message);
      }
      return;
    }
    const sourceDocumentName = documentEntry.label;
    const voiceNote = documentEntry.isReferenceAudio
      ? ' This is the reference clip: the next audio or video upload becomes the new reference.'
      : documentEntry.inVoiceCorpus
        ? ' Its seconds leave the voice model count; a trained voice is kept.'
        : '';
    if (
      !window.confirm(
        `Delete "${sourceDocumentName}" from this avatar? The upload and ` +
          'everything the avatar learned from it are removed. This cannot be undone.' +
          voiceNote
      )
    ) {
      return;
    }
    try {
      if (!user) throw new Error('Not logged in');
      await deleteAvatarDocument(assistantId, sourceDocumentName);
      toast.success('Document deleted');
      await refreshAvatarDocuments();
      setVoiceStatusVersion((version) => version + 1);
    } catch (err) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  /**
   * Make one upload the reference clip the diarizer uses to find this
   * avatar's voice. Only the reference changes: nothing is re-learned and the
   * trained voice is untouched.
   *
   * @param {Object} documentEntry A row from the document list.
   */
  const handleSetVoiceReference = async (documentEntry) => {
    try {
      if (!user) throw new Error('Not logged in');
      await setAvatarVoiceReference(assistantId, documentEntry.label);
      toast.success(`${documentEntry.label} is now the reference audio.`);
      await refreshAvatarDocuments();
      setVoiceStatusVersion((version) => version + 1);
    } catch (err) {
      showRequestFailureToast(err, {
        fallbackMessage: `${documentEntry.label} could not be made the reference.`,
      });
    }
  };

  const renderDocumentPreview = (doc) => {
    if (doc.loading) {
      return (
        <div className="flex items-center justify-center h-48 bg-black/60 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-300"></div>
        </div>
      );
    }
    const src = doc.previewUrl || doc.url;
    switch (doc.type) {
      case 'image':
        return (
          <div className="relative w-full h-48 bg-black/60 rounded-lg overflow-hidden">
            <img
              src={src}
              alt={doc.name}
              className="w-full h-full object-cover"
            />
          </div>
        );
      case 'video':
        return (
          <div className="relative w-full h-48 bg-black/60 rounded-lg overflow-hidden">
            <video src={src} controls className="w-full h-full object-cover" />
          </div>
        );
      case 'audio':
        return (
          <div className="flex items-center gap-3 p-4 bg-black/60 rounded-lg">
            <Music className="text-blue-400" size={32} />
            <audio src={src} controls className="flex-1" />
          </div>
        );
      case 'pdf':
      case 'text':
        return (
          <div className="flex items-center gap-3 p-4 bg-black/60 rounded-lg">
            <FileText className="text-red-400" size={32} />
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-300 hover:underline flex items-center gap-2"
            >
              Open File <ExternalLink size={16} />
            </a>
          </div>
        );
      case 'youtube':
      case 'twitter':
      case 'web':
        return (
          <div className="p-4 bg-black/60 rounded-lg">
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-300 hover:underline flex items-center gap-2"
            >
              <Globe size={20} />
              {doc.url}
              <ExternalLink size={16} />
            </a>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-3 p-4 bg-black/60 rounded-lg">
            <File className="text-white/50" size={32} />
            <span className="text-neutral-200">{doc.name}</span>
          </div>
        );
    }
  };
  const getTypeIcon = (type) => {
    switch (type) {
      case 'image':
        return <Image className="text-green-400" />;
      case 'video':
        return <Video className="text-neutral-400" />;
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
   * Set the avatar's portrait from a chosen image file or a single image URL.
   *
   * The portrait is the avatar's reference image, so this uses the same media
   * endpoint with the reference_image flag rather than storing the file as
   * identity source material. The re-read only happens after the job reports
   * done: asking for the portrait the instant the 202 lands returns the OLD
   * image (or none), which looked exactly like the upload had failed.
   */
  const submitPortraitUrl = async (text) => {
    const parsed = singleReferenceImageUrl(text);
    if (parsed.error) {
      toast.error(parsed.error);
      return;
    }
    setPortraitUrl('');
    await startSectionUpload({
      urls: [parsed.url],
      isReferenceImage: true,
      confirmStored: confirmPortraitWasStored,
    });
  };

  const handleIconUpload = async (acceptedFiles, fileRejections, dropEvent) => {
    const droppedUrlText =
      dropEvent?.dataTransfer?.getData('text/uri-list') ||
      dropEvent?.dataTransfer?.getData('text/plain') ||
      '';
    if (fileRejections?.length) {
      toast.error('Only an image file or an image URL can be the portrait.');
    }
    const [chosenImage] = acceptedFiles ?? [];
    if (chosenImage) {
      await startSectionUpload({
        files: [chosenImage],
        isReferenceImage: true,
        confirmStored: confirmPortraitWasStored,
      });
      return;
    }
    if (droppedUrlText.trim()) {
      await submitPortraitUrl(droppedUrlText);
    }
  };

  const handlePortraitPaste = (event) => {
    const text = event.clipboardData.getData('text/plain');
    if (!singleReferenceImageUrl(text).url) return;
    event.preventDefault();
    event.stopPropagation();
    submitPortraitUrl(text);
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
   *   the message the Upload card must end on instead of success.
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
      // The emotion stills and loops derive from the portrait, so a new
      // portrait means a new set; drop the cached manifest so the chat, the
      // gallery, and the status strip below the portrait re-read it.
      forgetEmotionMedia(assistantId);
      // Re-read it here too, so the generated rows under Data Uploaded show
      // the new set without a reload.
      refreshEmotionManifest({ force: true }).catch(() => {});
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

  const cancelDescriptionGeneration = () => {
    descriptionAbortRef.current?.abort();
    descriptionAbortRef.current = null;
    setIsGeneratingDescription(false);
  };

  const generateDescription = async () => {
    descriptionAbortRef.current?.abort();
    const controller = new AbortController();
    descriptionAbortRef.current = controller;
    const previousDescription = updatedDesc || activeAvatar?.description || '';
    setIsGeneratingDescription(true);
    setEditingDesc(true);
    setUpdatedDesc('');
    try {
      const formData = new FormData();
      formData.append(
        'message',
        `${DESCRIPTION_PROMPT_MARKER} Describe yourself in first person from your own identity and uploaded media. Write a concise profile description. Reply with only that description.`
      );
      formData.append('stream', 'true');
      if (activeConversation && activeConversation !== NEW_CONVERSATION_ID) {
        formData.append('thread_id', activeConversation);
      }
      let collected = '';
      await streamServerSentEvents(
        `/message/${encodeURIComponent(assistantId)}`,
        {
          formData,
          signal: controller.signal,
          onEvent: (streamEvent) => {
            if (streamEvent.type === 'assistant_token') {
              collected += streamEvent.text ?? '';
              setUpdatedDesc(collected);
            } else if (streamEvent.type === 'done') {
              collected = streamEvent.content ?? collected;
              setUpdatedDesc(collected.trim());
            }
          },
        }
      );
    } catch (generateError) {
      if (generateError?.name === 'AbortError') {
        setUpdatedDesc(previousDescription);
        return;
      }
      setUpdatedDesc(previousDescription);
      showRequestFailureToast(generateError, {
        fallbackMessage: 'Could not generate a description.',
      });
    } finally {
      setIsGeneratingDescription(false);
      if (descriptionAbortRef.current === controller) {
        descriptionAbortRef.current = null;
      }
    }
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
      <div className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
        <h3 className="text-xl font-semibold text-neutral-200 mb-4 flex items-center gap-2">
          {isAvatarShared ? <Globe size={20} /> : <Lock size={20} />}
          Sharing
        </h3>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <p className="text-white/60 text-sm min-w-0 flex-1">
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
            className={`self-start shrink-0 rounded-lg border transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
              isAvatarShared
                ? 'bg-black/50 hover:bg-white/10 text-neutral-200 border-white/10'
                : 'bg-amber-400 hover:bg-amber-300 text-neutral-900 border-amber-400 font-semibold'
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
                className="flex-grow min-w-0 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-neutral-200 text-sm font-mono"
              />
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleCopyShareLink}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-100/10 hover:bg-neutral-100/15 border border-neutral-700 text-neutral-300 font-semibold transition-colors"
                >
                  <Copy size={16} />
                  Copy link
                </button>
                <a
                  href={sharedAvatarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black/50 hover:bg-white/10 border border-white/10 text-neutral-200 transition-colors"
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
        <div className="avatar-settings flex flex-col gap-4 sm:gap-6 w-full max-w-4xl mx-auto min-w-0">
          {renderSharingCard()}
          {isAdministrator && (
            <AvatarIdentityFacts
              assistantId={assistantId}
              avatarName={activeAvatar?.name}
            />
          )}
          <p className="text-white/50 text-sm px-1">
            Another account created this avatar, so its name, portrait, source
            documents and deletion stay with that account. You can change
            sharing, and you can review what the avatar has learned.
          </p>
        </div>
      );
    }
    return (
      <div className="w-full max-w-4xl mx-auto bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-6 text-white/70">
        Settings are available to the person who created this avatar.
      </div>
    );
  }

  return (
    <div className="avatar-settings flex flex-col gap-4 sm:gap-6 w-full max-w-4xl mx-auto min-w-0">
      {/* Drag Overlay */}
      {isDragging && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drop-to-upload-title"
          onClick={() => setIsDragging(false)}
        >
          <button
            type="button"
            aria-label="Cancel upload"
            onClick={() => setIsDragging(false)}
            className="absolute top-4 right-4 text-white/60 hover:text-neutral-100"
          >
            <X size={28} />
          </button>
          <div className="text-center">
            <Upload
              className="mx-auto mb-4 text-neutral-200 animate-bounce"
              size={80}
            />
            <h2
              id="drop-to-upload-title"
              className="text-3xl font-bold text-neutral-200 mb-4"
            >
              Drop to Upload
            </h2>
            <p className="text-white/80 text-lg mb-2">
              Supported: Images, Videos, Audio, PDFs, Text Files, URLs
            </p>
            <p className="text-white/60">
              YouTube • Twitter • Wikipedia • Twitch • Web Pages
            </p>
            <button
              type="button"
              onClick={() => setIsDragging(false)}
              className="mt-6 px-4 py-2 bg-black/50 hover:bg-white/10 text-neutral-200 rounded-lg transition-all duration-300 border border-white/10"
            >
              Cancel
            </button>
            <p className="mt-3 text-white/50 text-sm">
              Press Escape or click anywhere to cancel
            </p>
          </div>
        </div>
      )}
      {/* Social Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-black/60 backdrop-blur-lg rounded-2xl p-6 max-w-md w-full border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-neutral-200">
                Connect{' '}
                {SOCIAL_PLATFORMS.find((p) => p.id === selectedPlatform)?.name}
              </h3>
              <button
                onClick={() => setShowLoginModal(false)}
                className="text-white/60 hover:text-neutral-100"
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
                className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-neutral-200 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
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
                className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-neutral-200 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
              <button
                onClick={submitSocialLogin}
                className="w-full px-6 py-3 bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 font-semibold rounded-lg transition-all duration-300 border border-amber-400/30"
              >
                Connect Account
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header with Delete Button */}
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-neutral-200">
          Avatar Settings
        </h2>
        <button
          onClick={handleDeleteAvatar}
          disabled={isDeleting}
          className="bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 rounded-lg transition-all duration-300 border border-red-500/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 size={16} />
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
      {/* Avatar Profile Section */}
      <div className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-4 sm:p-6 min-w-0">
        <h3 className="text-lg font-semibold text-neutral-200 mb-4">
          Profile Information
        </h3>
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start">
          {/* Icon Upload */}
          <div className="flex flex-col gap-3">
            <Dropzone
              onDrop={handleIconUpload}
              multiple={false}
              accept={{ 'image/*': [] }}
              noClick={Boolean(avatarIcon)}
              // The screen also listens for a drop on the document itself, so
              // that a file dropped anywhere is taken as source material. An
              // image dropped HERE is the portrait and nothing else: without
              // this the one drop ran both handlers and uploaded the same file
              // twice — once as the portrait, once as an ordinary document —
              // with two independent progress cards to match.
              noDragEventsBubbling
            >
              {({ getRootProps, getInputProps, open }) =>
                avatarIcon ? (
                  <div
                    {...getRootProps()}
                    onPaste={handlePortraitPaste}
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
                ) : (
                  <div
                    {...getRootProps()}
                    onPaste={handlePortraitPaste}
                    className="w-32 h-32 border-2 border-dashed border-white/30 hover:border-white/50 flex flex-col gap-2 items-center justify-center cursor-pointer rounded-2xl bg-black/60 transition-all duration-300"
                  >
                    <input {...getInputProps()} />
                    <Upload size={28} className="text-white/50" />
                    <span className="text-xs text-white/50">
                      Add a portrait
                    </span>
                  </div>
                )
              }
            </Dropzone>
            <p className="text-xs text-white/40 text-center w-32">
              {avatarIcon ? 'Click to replace' : 'Drop, click, or paste a URL'}
            </p>
            <EmotionMediaStatus
              assistantId={assistantId}
              hasPortrait={Boolean(avatarIcon)}
            />
          </div>
          {/* Name and Description */}
          <div className="w-full min-w-0 flex-grow space-y-4">
            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Name
              </label>
              {editingName ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={updatedAvatarName}
                    onChange={(e) => setUpdatedAvatarName(e.target.value)}
                    placeholder="Enter avatar name"
                    className="w-full min-w-0 sm:flex-grow px-4 py-2 bg-black/50 border border-white/10 rounded-lg text-neutral-200 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  />
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => {
                        handleUpdateName(updatedAvatarName);
                        setEditingName(false);
                      }}
                      className="bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 rounded-lg transition-all duration-300 border border-amber-400/30"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingName(false)}
                      className="bg-black/50 hover:bg-white/10 text-neutral-200 rounded-lg transition-all duration-300 border border-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 px-3 py-2 bg-black/60 border border-white/10 rounded-lg min-w-0">
                  <span className="text-neutral-200 font-medium min-w-0 break-words">
                    {activeAvatar?.name}
                  </span>
                  <button
                    onClick={() => setEditingName(true)}
                    className="self-start sm:self-auto text-amber-300 hover:text-amber-200 transition-colors duration-300"
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
                    placeholder={
                      isGeneratingDescription
                        ? 'Generating…'
                        : 'Enter description'
                    }
                    rows="3"
                    readOnly={isGeneratingDescription}
                    aria-busy={isGeneratingDescription}
                    className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg text-neutral-200 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50 resize-none read-only:opacity-90"
                  />
                  {/* {isGeneratingDescription && (
                    <div
                      className="flex items-center gap-2 text-sm text-amber-300"
                      role="status"
                      aria-live="polite"
                    >
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      Generating description…
                    </div>
                  )} */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        handleDescSave(updatedDesc);
                        setEditingDesc(false);
                      }}
                      disabled={isGeneratingDescription}
                      className={`px-4 py-2 rounded-lg transition-all duration-300 border inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                        isGeneratingDescription
                          ? 'bg-amber-400/15 text-amber-300 border-amber-400/30'
                          : 'bg-amber-400 hover:bg-amber-300 text-neutral-900 border-amber-400 font-semibold'
                      }`}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isGeneratingDescription) {
                          cancelDescriptionGeneration();
                        }
                        setUpdatedDesc(activeAvatar?.description ?? '');
                        setEditingDesc(false);
                      }}
                      className="px-4 py-2 bg-black/50 hover:bg-white/10 text-neutral-200 rounded-lg transition-all duration-300 border border-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={
                        isGeneratingDescription
                          ? cancelDescriptionGeneration
                          : generateDescription
                      }
                      className="px-4 py-2 bg-black/50 hover:bg-white/10 text-amber-300 rounded-lg transition-all duration-300 border border-amber-400/30 inline-flex items-center gap-1.5"
                    >
                      {isGeneratingDescription ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Cancel generation
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 px-3 py-2 bg-black/60 border border-white/10 rounded-lg min-h-[80px] min-w-0">
                  <p className="text-white/80 min-w-0 flex-1 break-words">
                    {activeAvatar?.description}
                  </p>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={
                        isGeneratingDescription
                          ? cancelDescriptionGeneration
                          : generateDescription
                      }
                      className="text-amber-300 hover:text-amber-200 transition-colors duration-300 inline-flex items-center gap-1 text-sm"
                    >
                      {isGeneratingDescription ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Cancel generation
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setEditingDesc(true)}
                      className="text-amber-300 hover:text-amber-200 transition-colors duration-300"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <input
            ref={portraitUrlInputRef}
            type="url"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            placeholder="https://example.com/portrait.jpg"
            value={portraitUrl}
            onChange={(event) => setPortraitUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (portraitUrl.trim()) submitPortraitUrl(portraitUrl);
              }
            }}
            className="w-full min-w-0 sm:flex-1 px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-sm text-neutral-200 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          />
          <button
            type="button"
            onClick={() => submitPortraitUrl(portraitUrl)}
            disabled={!portraitUrl.trim()}
            className="px-3 py-2 bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 border border-amber-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Link size={16} aria-hidden="true" />
            Add as reference image
          </button>
        </div>
        <p className="mt-1.5 text-xs text-white/40">
          A direct image link becomes this avatar's reference image — the
          portrait used for emotion stills and idle loops.
        </p>
        {portraitJobs.length > 0 && (
          <div className="mt-3 space-y-3">
            {portraitJobs.map((job) => (
              <UploadProcessPanel
                key={job.localId}
                job={job}
                onCancel={() => cancelSectionJob(job.localId)}
                onCancelItem={(itemJobId) =>
                  cancelSectionJob(job.localId, itemJobId)
                }
                onDismiss={() => dismissSectionJob(job.localId)}
              />
            ))}
          </div>
        )}
        {/* The avatar's voice: record it, watch the corpus fill, verify the
            professional voice model. Every avatar gets a voice audio model from this;
            only the personal avatar continues to a professional one. */}
        <div id="voice" ref={voiceSectionRef}>
          <VoicePanel
            assistantId={assistantId}
            isPersonalAvatar={isPersonalAvatar}
            avatarName={activeAvatar?.name}
            startUpload={startSectionUpload}
            voiceJobs={voiceJobs}
            onCancelJob={cancelSectionJob}
            onDismissJob={dismissSectionJob}
            refreshToken={voiceStatusVersion}
          />
        </div>
      </div>
      {/* Social Media Section */}
      {/* <div className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
        <h2 className="text-2xl font-semibold text-neutral-200 mb-4 flex items-center gap-2">
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
                  className="bg-black/50 border border-white/10 rounded-lg p-4 flex items-center justify-between hover:bg-white/10 transition-all duration-300"
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
                      <p className="text-neutral-200 font-semibold">
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
                    : 'bg-black/60 border-white/10 hover:bg-white/10 hover:border-white/40'
                }`}
              >
                <Icon size={24} style={{ color: platform.color }} />
                <span className="text-neutral-200 text-xs">{platform.name}</span>
                {isConnected && (
                  <span className="text-xs text-green-400">Connected</span>
                )}
              </button>
            );
          })}
        </div>
      </div> */}
      {/* Upload Section */}
      <div
        ref={uploadSectionRef}
        className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-4 sm:p-6 min-w-0"
      >
        <h2 className="text-xl sm:text-2xl font-semibold text-neutral-200 mb-4 flex items-center gap-2">
          <Upload size={22} />
          Upload
        </h2>
        {/* URLs start processing as soon as Add is pressed. */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-white/70 mb-2">
            Add URLs
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              ref={urlInputRef}
              type="text"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              placeholder="https://example.com — paste several, separated by spaces or lines"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (manualUrl.trim()) addManualUrls();
                }
              }}
              onPaste={(e) => {
                const pastedUrls = parseHttpUrls(
                  e.clipboardData.getData('text/plain')
                );
                if (pastedUrls.length > 1) {
                  e.preventDefault();
                  startSectionUpload({ urls: pastedUrls });
                }
              }}
              className="w-full min-w-0 sm:flex-1 px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-neutral-200 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
            <button
              type="button"
              onClick={addManualUrls}
              disabled={!manualUrl.trim()}
              className="px-4 py-3 bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 border border-amber-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={18} />
              Add
            </button>
          </div>
        </div>
        <div className="border-2 border-dashed border-white/30 rounded-xl p-4 sm:p-8 text-center hover:border-white/50 transition-all duration-300 bg-black/60">
          <Upload className="mx-auto mb-3 sm:mb-4 text-white/60" size={36} />
          <p className="text-neutral-200 mb-2">
            Drag & drop anywhere on the page
          </p>
          <p className="text-white/60 text-sm mb-4">
            or paste URLs with Ctrl+V / Cmd+V to start processing
          </p>
          <label className="inline-block px-5 py-2.5 bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 font-semibold rounded-lg cursor-pointer transition-all duration-300 border border-amber-400/30">
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
        {uploadSectionJobs.length > 0 && (
          <div className="mt-4 space-y-3">
            {uploadSectionJobs.map((job) => (
              <UploadProcessPanel
                key={job.localId}
                job={job}
                onCancel={() => cancelSectionJob(job.localId)}
                onCancelItem={(itemJobId) =>
                  cancelSectionJob(job.localId, itemJobId)
                }
                onDismiss={() => dismissSectionJob(job.localId)}
              />
            ))}
          </div>
        )}
      </div>
      {/* Sharing. Publishing is for your own likeness, so this is the personal
          avatar's control — except for the administrator, who may publish any
          avatar and therefore sees it on all of them. */}
      {canChangeSharing && renderSharingCard()}

      {/* Connections — mailboxes, custom connectors, and machines — reached
          through the personal avatar, so they are not a property of any other
          avatar. One section, one row shape; the catalog and the connect card
          are read from the API so a new provider needs no change here. */}
      {isPersonalAvatar && <ConnectionsSection />}

      {/* What the avatar has learned about itself. Creator-only by
          construction (this whole return is behind canAdministerAvatar) and
          by the API, which answers 403 for anyone else. */}
      <AvatarIdentityFacts
        assistantId={assistantId}
        avatarName={activeAvatar?.name}
      />

      {/* Documents Section */}

      <div className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
        <button
          type="button"
          onClick={() => setIsDataUploadedOpen((wasOpen) => !wasOpen)}
          aria-expanded={isDataUploadedOpen}
          aria-controls="avatar-data-uploaded"
          className={`w-full flex items-center justify-between gap-3 text-left text-xl font-semibold text-neutral-200 hover:text-white transition-colors ${
            isDataUploadedOpen ? 'mb-4' : ''
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <File size={20} className="shrink-0" />
            <span className="truncate">
              Data Uploaded for {activeAvatar?.name}
            </span>
            {allAvatarRows.length > 0 && (
              <span className="text-sm font-normal text-white/50 shrink-0">
                {allAvatarRows.length}
              </span>
            )}
          </span>
          {isDataUploadedOpen ? (
            <ChevronUp size={20} className="shrink-0 text-white/60" />
          ) : (
            <ChevronDown size={20} className="shrink-0 text-white/60" />
          )}
        </button>

        {isDataUploadedOpen && (
          <div id="avatar-data-uploaded">
            {allAvatarRows.length > 0 && (
              <div className="mb-4 space-y-3">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
                  />
                  <input
                    type="search"
                    value={documentSearchQuery}
                    onChange={(event) =>
                      setDocumentSearchQuery(event.target.value)
                    }
                    placeholder="Search uploaded data…"
                    aria-label="Search uploaded data"
                    className="w-full pl-9 pr-3 py-2 bg-black/50 border border-white/10 rounded-lg text-neutral-200 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50 text-sm"
                  />
                </div>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Filter by type"
                >
                  {[
                    'all',
                    ...Object.keys(DOCUMENT_BUCKET_LABELS).filter(
                      (bucket) =>
                        bucket !== 'all' && documentBucketCounts[bucket]
                    ),
                  ].map((bucket) => {
                    const isSelected = documentKindFilter === bucket;
                    const count =
                      bucket === 'all'
                        ? allAvatarRows.length
                        : documentBucketCounts[bucket];
                    return (
                      <button
                        key={bucket}
                        type="button"
                        onClick={() => setDocumentKindFilter(bucket)}
                        aria-pressed={isSelected}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          isSelected
                            ? 'bg-neutral-200 text-neutral-900 border-neutral-200'
                            : 'bg-black/60 text-white/70 border-white/10 hover:bg-white/10 hover:text-neutral-100'
                        }`}
                      >
                        {DOCUMENT_BUCKET_LABELS[bucket]}
                        <span className="ml-1 opacity-70">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* The list scrolls within a bounded height, so a long upload history
            does not push the rest of the settings off the bottom of the page,
            and the search and filters above it stay in reach. */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {allAvatarRows.length > 0 ? (
                visibleAvatarDocuments.length > 0 ? (
                  visibleAvatarDocuments.map((documentEntry) => (
                    <AvatarDocumentRow
                      key={documentEntry.assetId ?? documentEntry.label}
                      documentEntry={documentEntry}
                      portraitDataUri={avatarIcon}
                      onDelete={handleDeleteDocument}
                      onSetVoiceReference={handleSetVoiceReference}
                    />
                  ))
                ) : (
                  <p className="text-white/40 text-sm italic">
                    Nothing uploaded matches this search or filter.
                  </p>
                )
              ) : avatarDocumentsError ? (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-300 text-sm">{avatarDocumentsError}</p>
                  <button
                    onClick={() =>
                      setAvatarDocumentsReloadCount(
                        (reloadCount) => reloadCount + 1
                      )
                    }
                    className="mt-2 px-3 py-1.5 text-sm bg-black/50 hover:bg-white/10 text-neutral-200 rounded-lg border border-white/10 transition-colors"
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
        )}
      </div>
    </div>
  );
};
export default AvatarSettings;
