// src/components/LiveVoiceMode.jsx
//
// Talking to the avatar instead of typing to it. Same conversation, different
// medium: every spoken turn lands in the same thread and is readable afterwards
// in the transcript.
//
// The stage is the avatar: its emotion still or idle loop fills the content
// well beside the application sidebar, and when video is enabled a lip-synced
// clip of the reply plays between the loops.
// Along the bottom sits the composer pill from the reference design — type, or
// attach; connectors on the personal avatar; share the webcam or the screen;
// live audio (turn-based, with voice activity detection) or one-shot
// dictation; enable video; show or hide the captions; and leave for the
// message view. Mute the avatar and mute the mic sit outside that pill so
// they stay readable as indicators when the bar is folded.
//
// Listening is half-duplex: the microphone is shut for the whole of a spoken
// reply and for a moment after it, so the avatar cannot hear itself. That is
// what `microphoneShouldListen` below is for, and it is the reason the person
// cannot talk over a reply — stopping one takes the Stop button until there is
// a realtime backend with real echo cancellation to lean on.

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AudioLines,
  Camera,
  CameraOff,
  Captions,
  ChevronUp,
  Image,
  Loader2,
  Mic,
  MicOff,
  MonitorUp,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  User,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Square,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';

import { useMedia } from '../context/MediaContext';
import { useMediaShare } from '../context/MediaShareContext';
import { describeAmbientStatus } from '../services/ambientCaptureScheduler';
import { useAuth } from '../context/AuthContext';
import {
  canShareAvatar,
  isAvatarOwnedByUser,
  isSharedAvatarChatPath,
  isValidImageUrl,
} from './utils';
import {
  canUseAvatarSpeechInput,
  canUseAvatarSpeechPlayback,
} from '../services/avatarSpeechPlayback';
import AvatarWorkspaceHeader from './AvatarWorkspaceHeader';
import useInboxCount from '../hooks/useInboxCount';
import LoopingVideo from './ui/LoopingVideo';
import useEmotionMedia, { preloadEmotionMedia } from '../hooks/useEmotionMedia';
import { voiceStageEmotion } from '../hooks/voiceStageEmotion';
import useMessageActions from '../hooks/useMessageActions';
import MessageActionBar from './media/MessageActionBar';
import CreatedArtifacts from './CreatedArtifacts';
import {
  createdArtifactsOf,
  speakableReplyText,
  stripArtifactReferences,
} from '../services/createdArtifacts';
import ConversationSuggestions from './ConversationSuggestions';
import SpeakerScript from './SpeakerScript';
import { editableScriptText, hasSpeakerScript } from './speakerScript';
import { speakerLabelsDefaultOn } from '../config/voiceSpeakerLabels';
import ComposerConnectorsMenu from './connections/ComposerConnectorsMenu';
import ComposerAttachmentStrip from './ComposerAttachmentStrip';
import MessageMedia from './MessageMedia';
import { composerHasSendableDraft } from './composerSendState';
import { canCaptureMicrophone, recordOneTurn } from '../services/voiceSession';
import { startVoiceActivityListening } from '../services/voiceActivity';
import { enqueueLiveUtterance } from '../services/liveUtteranceQueue';
import {
  isAvatarSelfEcho,
  rememberAvatarSpeech,
} from '../services/selfEchoGuard';
import {
  requestLipSyncClip,
  transcribeRecording,
} from '../services/avatarService';
import { showRequestFailureToast } from './requestFailureToast';
import { isConversationSuggestionList } from '../services/conversationSuggestions';
import { findMessageByKey, messageKeyOf } from '../services/messageKey';
import {
  captionForVoiceStage,
  shouldShowVoiceStageText,
  stagePresentationIsClip,
  voiceExchangeHasGeneratingText,
  voiceMessageIsGenerating,
} from './voiceCaptionVisibility';
import {
  collapsedVoiceBarIsSpeaking,
  shouldCollapseVoiceMessageBar,
  voiceComposerDockItemsClass,
  voiceMessageBarHasDraftAttachments,
} from './voiceMessageBar';
import { setSuggestionSheetOpen } from './conversationSuggestionSheet';
import {
  paintedMediaIn,
  portraitWellSizeForConstraint,
} from './voicePortraitBox';
import { voiceStageFace } from '../config/avatarFaceSource';
import useAvatarFaceSource from '../hooks/useAvatarFaceSource';

const PREFERENCES_KEY = 'voice_mode_preferences';

// How long the microphone stays shut after the avatar's audio reports that it
// finished. The report comes from the audio element, not from the speakers:
// a Bluetooth headset is still emitting the last of a sentence a few hundred
// milliseconds after the element says it ended, and opening the microphone
// into that tail records the avatar and sends it back as a turn.
const AVATAR_ECHO_TAIL_MS = 500;

// How long after the avatar stops an utterance is still treated as possibly
// its own voice. Only a verbatim run of the avatar's words is dropped inside
// this window, so a person answering straight away is unaffected.
const AVATAR_ECHO_SUSPICION_MS = 2500;

const readPreferences = () => {
  try {
    return JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}') || {};
  } catch {
    return {};
  }
};

const writePreferences = (preferences) => {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Storage may be unavailable; the toggles then last for the session.
  }
};

const CONTROL_CLASSES =
  'rounded-full text-white/70 hover:text-neutral-100 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-40 disabled:hover:bg-transparent shrink-0';
const ACTIVE_CONTROL_CLASSES = 'bg-white/15 text-neutral-100';
const CLOSE_BUTTON_CLASSES =
  'voice-action shrink-0 rounded-full bg-neutral-200 hover:bg-neutral-100 text-neutral-900 inline-flex items-center justify-center gap-1 transition-colors';
const SEND_BUTTON_CLASSES =
  'voice-action shrink-0 rounded-full bg-neutral-200 hover:bg-neutral-100 text-neutral-900 inline-flex items-center gap-1 transition-colors';
const STAGE_FLASH_IN_ANIMATION = 'voice-stage-flash-in';
const STAGE_FLASH_OUT_ANIMATION = 'voice-stage-flash-out';
const HUMAN_BUBBLE_CLASSES =
  'max-w-[min(100%,28rem)] sm:max-w-[85%] px-4 py-2 rounded-2xl text-[15px] leading-relaxed self-end bg-neutral-800/80 text-neutral-200 whitespace-pre-wrap';
const AVATAR_BUBBLE_CLASSES =
  'max-w-[min(100%,28rem)] sm:max-w-[85%] px-4 py-2 rounded-2xl text-[15px] leading-relaxed self-start bg-black/55 backdrop-blur-md border border-white/15 text-neutral-100 whitespace-pre-wrap';
const CAPTION_DOCK_CLASSES =
  'absolute left-0 right-0 max-h-[min(28vh,16rem)] overflow-y-auto px-3 sm:px-6 pb-2';
const CAPTION_COLUMN_CLASSES = 'mx-auto max-w-3xl flex flex-col gap-3 py-2';
const SPEAKING_BUBBLE_HIGHLIGHT =
  'ring-2 ring-amber-400/80 border-amber-400/50 bg-amber-400/10';

const TypingDots = () => (
  <div className="flex items-center space-x-2" aria-label="Responding">
    <div className="flex space-x-1">
      <div
        className="w-2 h-2 bg-white rounded-full animate-bounce"
        style={{ animationDelay: '0ms' }}
      />
      <div
        className="w-2 h-2 bg-white rounded-full animate-bounce"
        style={{ animationDelay: '150ms' }}
      />
      <div
        className="w-2 h-2 bg-white rounded-full animate-bounce"
        style={{ animationDelay: '300ms' }}
      />
    </div>
  </div>
);

const AssistantActivityLine = ({ activity, stopControl = null }) => {
  if (!activity && !stopControl) return null;
  return (
    <div
      className="self-start flex items-center gap-2 px-2 py-1 text-xs text-white/70 italic pointer-events-auto"
      role="status"
      aria-live="polite"
    >
      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
      <span className="min-w-0 flex-1">
        {activity ? `${activity}…` : 'Responding…'}
      </span>
      {stopControl}
    </div>
  );
};

// Inverse of the composer’s AudioLines “talk out loud” control: same
// waveform, struck through, so leaving voice mode is the obvious pair.
const AudioLinesOffIcon = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M2 10v3" />
    <path d="M6 6v11" />
    <path d="M10 3v18" />
    <path d="M14 8v7" />
    <path d="M18 5v13" />
    <path d="M22 10v3" />
    <path d="M2 2l20 20" />
  </svg>
);

const isHumanMessage = (message) => {
  const type = message?.type || message?.sender;
  return type === 'human' || type === 'user';
};

const isAvatarMessage = (message) => {
  const type = message?.type || message?.sender;
  return type === 'ai' || type === 'assistant' || type === 'avatar';
};

const LiveVoiceMode = ({
  assistantId,
  avatarName,
  avatarPortrait,
  onClose,
  onNavigateTab,
}) => {
  const {
    messages,
    sendSpokenTurn,
    sendSpokenAudioTurn,
    handleFileChange,
    mediaFiles,
    setMediaFiles,
    attachmentsInFlight,
    removeFile,
    setAmbientHold,
    assistantActivity,
    stopAssistantTurn,
  } = useMedia();
  const {
    ambientEnabled,
    ambientStatus,
    ambientNextInMs,
    setAmbientVoiceMode,
    registerAmbientReplyHandler,
  } = useMediaShare();
  const { user, activeAvatar } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const readerIsAnonymous = isSharedAvatarChatPath(location.pathname);
  const canDictate = canUseAvatarSpeechInput(activeAvatar, user, {
    pathname: location.pathname,
  });
  const canPlayAvatarVoice = canUseAvatarSpeechPlayback(activeAvatar, user, {
    pathname: location.pathname,
  });
  const inboxCount = useInboxCount();
  const canOpenAvatarSettings =
    isAvatarOwnedByUser(activeAvatar, user) ||
    canShareAvatar(activeAvatar, user);
  const isPersonalAvatar =
    activeAvatar?.metadata?.is_personal_avatar_of_creator === true;
  const showWorkspaceTabs =
    typeof onNavigateTab === 'function' && !readerIsAnonymous;

  const preferences = useMemo(readPreferences, []);
  const [isAvatarMuted, setIsAvatarMuted] = useState(
    Boolean(preferences.avatarMuted)
  );
  // Opening live voice is asking to be heard. Mute is only something the
  // person chooses after the stage is already up.
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(
    Boolean(preferences.videoEnabled)
  );
  const [showCaptions, setShowCaptions] = useState(
    preferences.showCaptions ?? true
  );
  // Hands-free listening is on whenever live voice mode opens. The in-stage
  // control can still pause the loop for this visit; that choice is not
  // kept so the next open asks for the microphone again.
  const [liveListeningPreferred, setLiveListeningPreferred] = useState(true);
  // Each hands-free utterance is sent as audio and labelled by speaker on the
  // server (the owner by voice, others as Speaker N) so the avatar can tell the
  // owner from other people in the room. This is not something the person is
  // asked about: it applies to a personal avatar, which is the only avatar
  // with the owner's voice to recognise, and is settled by configuration.
  const speakerLabelsOn =
    isPersonalAvatar && !readerIsAnonymous && speakerLabelsDefaultOn();
  useEffect(() => {
    writePreferences({
      avatarMuted: isAvatarMuted,
      micMuted: isMicMuted,
      videoEnabled: isVideoEnabled,
      showCaptions,
      liveListening: liveListeningPreferred,
    });
  }, [
    isAvatarMuted,
    isMicMuted,
    isVideoEnabled,
    showCaptions,
    liveListeningPreferred,
  ]);

  const [isLiveListening, setIsLiveListening] = useState(false);
  const [isHearingSpeech, setIsHearingSpeech] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isWaitingForReply, setIsWaitingForReply] = useState(false);
  const [isPlayingReply, setIsPlayingReply] = useState(false);
  const [draft, setDraft] = useState('');
  const [isComposerMenuOpen, setIsComposerMenuOpen] = useState(false);
  const [isMessageBarCollapsed, setIsMessageBarCollapsed] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [lipSyncClipUrl, setLipSyncClipUrl] = useState(null);
  const [isRenderingClip, setIsRenderingClip] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const listenerRef = useRef(null);
  const dictationRef = useRef(null);
  // What the avatar has most recently said out loud, so a transcript that
  // turns out to be its own voice can be dropped instead of answered.
  const avatarSpokenLinesRef = useRef([]);
  // Whether the avatar is audible now, and until when it counts as having
  // just been audible. Read inside the listener callbacks, which outlive the
  // render that created them.
  const avatarAudioIsActiveRef = useRef(false);
  const avatarEchoSuspicionUntilRef = useRef(0);
  const fileInputRef = useRef(null);
  const mediaFilesRef = useRef(mediaFiles);
  mediaFilesRef.current = mediaFiles;
  const takePendingAttachments = useCallback(() => {
    const files = [...mediaFilesRef.current];
    if (files.length) {
      mediaFilesRef.current = [];
      setMediaFiles([]);
    }
    return files;
  }, [setMediaFiles]);
  const takePendingAttachmentsRef = useRef(takePendingAttachments);
  takePendingAttachmentsRef.current = takePendingAttachments;
  const userTurnsInFlightRef = useRef(0);
  const turnGenerationRef = useRef(0);
  const ambientReplyInFlightRef = useRef(false);
  const transcriptEndRef = useRef(null);
  const composerDockRef = useRef(null);
  const portraitConstraintRef = useRef(null);
  const portraitWellRef = useRef(null);
  const [composerDockHeight, setComposerDockHeight] = useState(120);
  const [portraitWellSize, setPortraitWellSize] = useState(null);

  const { manifest } = useEmotionMedia(assistantId, {
    asAnonymousIdentity: readerIsAnonymous,
  });
  const { showGenerated, setShowGenerated } = useAvatarFaceSource(assistantId);
  const [holdNewCaptions, setHoldNewCaptions] = useState(false);
  const [captionGeneration, setCaptionGeneration] = useState(0);
  const [stageFlash, setStageFlash] = useState(null);
  const pendingStageFlashRef = useRef(null);
  const holdNewCaptionsRef = useRef(false);
  const revealedCaptionIdsRef = useRef(new Set());
  const stagePresentedWaiterRef = useRef(null);
  const stageStillRef = useRef(null);
  const stageLoopRef = useRef(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const {
    speech,
    pendingSendCount,
    loadingSpeechKey,
    copiedKey,
    editingKey,
    setEditingKey,
    editDraft,
    setEditDraft,
    feedbackKey,
    setFeedbackKey,
    feedbackDraft,
    setFeedbackDraft,
    toggleSpeech,
    copyMessage,
    resendFromUserMessage,
    regenerateAvatarReply,
    submitMessageFeedback,
  } = useMessageActions({
    assistantId,
    avatarName,
    asAnonymousIdentity: readerIsAnonymous,
    speechPlaybackEnabled: canPlayAvatarVoice,
  });

  const spokenExchange = messages.filter((message) => {
    if (
      isAvatarMessage(message) &&
      isConversationSuggestionList(message.content)
    ) {
      return false;
    }
    return isHumanMessage(message) || isAvatarMessage(message);
  });
  const textTurnIsGenerating = voiceExchangeHasGeneratingText(spokenExchange);
  const lastCompletedAvatarMessage = [...spokenExchange]
    .reverse()
    .find(
      (message) =>
        isAvatarMessage(message) &&
        !message.isLoading &&
        !message.isPending
    );
  const visibleExchange = useMemo(
    () =>
      spokenExchange.map((message) =>
        captionForVoiceStage(message, {
          holdNewCaptions,
          revealedIds: revealedCaptionIdsRef.current,
        })
      ),
    [spokenExchange, holdNewCaptions, captionGeneration]
  );

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [visibleExchange.length, assistantActivity, showCaptions]);

  useEffect(() => {
    preloadEmotionMedia(manifest);
  }, [manifest]);

  useEffect(() => {
    if (holdNewCaptions) return;
    let added = false;
    for (const message of spokenExchange) {
      if (!isAvatarMessage(message) || !message.id) continue;
      if (revealedCaptionIdsRef.current.has(message.id)) continue;
      revealedCaptionIdsRef.current.add(message.id);
      added = true;
    }
    if (added) setCaptionGeneration((generation) => generation + 1);
  }, [spokenExchange, holdNewCaptions, captionGeneration]);

  const showStageFlash = useCallback((from, text) => {
    const words = text?.trim();
    if (!words) return;
    const next = { id: Date.now(), from, text: words, dismissing: false };
    setStageFlash((current) => {
      if (!current) return next;
      pendingStageFlashRef.current = next;
      if (current.dismissing) return current;
      return { ...current, dismissing: true };
    });
  }, []);

  useEffect(() => {
    if (!showCaptions) return;
    pendingStageFlashRef.current = null;
    if (stageFlash) setStageFlash(null);
  }, [showCaptions, stageFlash]);

  useEffect(() => {
    if (!stageFlash?.dismissing) return undefined;
    const timeout = window.setTimeout(() => {
      const next = pendingStageFlashRef.current;
      pendingStageFlashRef.current = null;
      setStageFlash((current) => {
        if (!current?.dismissing || current.id !== stageFlash.id) {
          return current;
        }
        return next;
      });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [stageFlash]);

  useLayoutEffect(() => {
    const dock = composerDockRef.current;
    if (!dock || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => {
      setComposerDockHeight(dock.getBoundingClientRect().height);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(dock);
    return () => observer.disconnect();
  }, []);

  const measurePortraitWell = useCallback(() => {
    const constraint = portraitConstraintRef.current;
    setPortraitWellSize(
      portraitWellSizeForConstraint(constraint, paintedMediaIn(constraint))
    );
  }, []);

  // Leaving the screen stops everything: speech, listening, dictation.
  useEffect(
    () => () => {
      speech.stop();
      listenerStartGenerationRef.current += 1;
      listenerRef.current?.stop();
      listenerRef.current = null;
      dictationRef.current?.cancel();
      stagePresentedWaiterRef.current?.();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Voice mode is a transparent stage over Vanta. The sidebar stays up as a
  // compact icon rail (`html.voice-stage-open` narrows `--app-rail-width`).
  useEffect(() => {
    document.documentElement.classList.add('voice-stage-open');
    return () => document.documentElement.classList.remove('voice-stage-open');
  }, []);

  // Emotion clips without their own idle stay on a still, then return to
  // the cyclic neutral loop. An emotion that has a loop keeps ping-ponging
  // the same way the carousel does — these files are not cyclic.
  useEffect(() => {
    if (currentEmotion === 'neutral') return;
    if (speech.isSpeaking || lipSyncClipUrl || isRenderingClip) return;
    if (manifest?.emotions?.[currentEmotion]?.idleLoop) return;
    setCurrentEmotion('neutral');
  }, [
    currentEmotion,
    speech.isSpeaking,
    lipSyncClipUrl,
    isRenderingClip,
    manifest,
  ]);

  // --- the stage --------------------------------------------------------------
  // The still and loop of one emotion, never a still of one mixed with the
  // loop of another — that painted two faces.
  const emotionAssets = manifest?.emotions?.[currentEmotion];
  const { still: stageStill, loop: stageLoop } = voiceStageFace({
    showGenerated,
    generatedStill: emotionAssets?.still,
    generatedLoop: emotionAssets?.idleLoop,
    referenceStill: avatarPortrait,
  });
  stageStillRef.current = stageStill;
  stageLoopRef.current = stageLoop;

  useLayoutEffect(() => {
    const constraint = portraitConstraintRef.current;
    if (!constraint || typeof ResizeObserver === 'undefined') return undefined;
    measurePortraitWell();
    const observer = new ResizeObserver(measurePortraitWell);
    observer.observe(constraint);
    return () => observer.disconnect();
  }, [measurePortraitWell, stageStill, stageLoop, lipSyncClipUrl]);
  // Only freeze on a still when this emotion has no loop of its own.
  // Replacing a playing loop with a still was why voice mode never reversed.
  const holdEmotionStill =
    currentEmotion !== 'neutral' &&
    !stageLoop &&
    (speech.isSpeaking || Boolean(lipSyncClipUrl) || isRenderingClip);

  const waitForStagePresented = useCallback((timeoutMs = 4000, match) => {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (presented) => {
        if (settled) return;
        if (match && presented !== undefined && !match(presented)) return;
        settled = true;
        if (stagePresentedWaiterRef.current === finish) {
          stagePresentedWaiterRef.current = null;
        }
        resolve();
      };
      stagePresentedWaiterRef.current = finish;
      window.setTimeout(() => finish(), timeoutMs);
    });
  }, []);

  const revealHeldCaptions = useCallback(() => {
    holdNewCaptionsRef.current = false;
    for (const message of messagesRef.current) {
      if (isAvatarMessage(message) && message.id) {
        revealedCaptionIdsRef.current.add(message.id);
      }
    }
    setHoldNewCaptions(false);
    setCaptionGeneration((generation) => generation + 1);
  }, []);

  const textTurnWasActiveRef = useRef(false);
  useEffect(() => {
    if (textTurnIsGenerating) {
      textTurnWasActiveRef.current = true;
      return;
    }
    if (!textTurnWasActiveRef.current || !holdNewCaptions) return;
    textTurnWasActiveRef.current = false;
    revealHeldCaptions();
  }, [holdNewCaptions, revealHeldCaptions, textTurnIsGenerating]);

  const handleStagePresented = useCallback((presented) => {
    stagePresentedWaiterRef.current?.(presented);
    requestAnimationFrame(() => {
      measurePortraitWell();
      requestAnimationFrame(measurePortraitWell);
    });
  }, [measurePortraitWell]);

  const handleReply = useCallback(
    async (reply, sentiment, generation = turnGenerationRef.current) => {
      const isCurrentTurn = () => generation === turnGenerationRef.current;
      if (!isCurrentTurn()) return;
      const emotion = voiceStageEmotion(sentiment);
      const nextAssets = manifest?.emotions?.[emotion];
      const nextStill =
        nextAssets?.still ?? (emotion === 'neutral' ? avatarPortrait : null);
      const nextLoop = nextAssets?.idleLoop ?? null;
      const mediaChanged =
        nextStill !== stageStillRef.current ||
        nextLoop !== stageLoopRef.current;
      setCurrentEmotion(emotion);
      setLipSyncClipUrl(null);
      // Speak the words, not the markdown: an analysis reply ends with an
      // image reference to its plot, which the captions paint as the plot
      // itself and which read aloud is only a file path.
      const spokenReply = speakableReplyText(reply);
      const wantsVideo =
        Boolean(spokenReply) &&
        isVideoEnabled &&
        Boolean(manifest?.emotions?.[emotion]?.still);

      let clipPromise = null;
      if (wantsVideo) {
        // Start the clip at once so generation overlaps the emotion-stage
        // wait. The finished line stays hidden until that clip is on stage.
        setIsRenderingClip(true);
        clipPromise = requestLipSyncClip(assistantId, spokenReply, emotion, {
          asAnonymousIdentity: readerIsAnonymous,
        }).catch((clipError) => {
          if (clipError?.status === 403) {
            setIsVideoEnabled(false);
            showRequestFailureToast(clipError, {
              fallbackMessage: 'Video replies need a premium plan.',
            });
          } else {
            console.debug('Lip-sync unavailable for this reply:', clipError);
          }
          return null;
        });
      }

      if (!clipPromise && mediaChanged && (nextStill || nextLoop)) {
        await waitForStagePresented();
        if (!isCurrentTurn()) return;
      }

      if (clipPromise) {
        try {
          const clipUrl = await clipPromise;
          if (!isCurrentTurn()) return;
          if (clipUrl) {
            setLipSyncClipUrl(clipUrl);
            await waitForStagePresented(4000, (presented) =>
              stagePresentationIsClip(presented, clipUrl)
            );
            if (!isCurrentTurn()) return;
          } else if (mediaChanged && (nextStill || nextLoop)) {
            await waitForStagePresented();
            if (!isCurrentTurn()) return;
          }
        } finally {
          setIsRenderingClip(false);
        }
      }

      revealHeldCaptions();
      if (!isCurrentTurn()) return;
      if (spokenReply && !showCaptions) {
        showStageFlash('avatar', spokenReply);
      }
      if (!spokenReply || isAvatarMuted) return;
      if (!canPlayAvatarVoice) return;

      // Setting this shuts the microphone through the gate below, before a
      // single byte of the avatar's voice is fetched — the avatar must not be
      // able to hear itself. Remembering the line as well means an echo that
      // reaches the microphone anyway (loud speakers, a lagging headset) is
      // recognised and dropped rather than answered.
      setIsPlayingReply(true);
      avatarSpokenLinesRef.current = rememberAvatarSpeech(
        avatarSpokenLinesRef.current,
        spokenReply
      );
      const replyMessageId =
        [...messagesRef.current]
          .reverse()
          .find(
            (message) =>
              isAvatarMessage(message) &&
              !message.isLoading &&
              !message.isPending
          )?.id ?? 'live-reply';
      try {
        await speech.speak(assistantId, spokenReply, { key: replyMessageId });
      } finally {
        setIsPlayingReply(false);
      }
    },
    [
      assistantId,
      avatarPortrait,
      canPlayAvatarVoice,
      isAvatarMuted,
      isVideoEnabled,
      manifest,
      readerIsAnonymous,
      showCaptions,
      showStageFlash,
      revealHeldCaptions,
      speech,
      waitForStagePresented,
    ]
  );

  const submitTurn = useCallback(
    async (text, attachedFiles) => {
      const words = text?.trim() ?? '';
      const files = Array.isArray(attachedFiles)
        ? attachedFiles
        : takePendingAttachmentsRef.current();
      if (!words && files.length === 0) return;
      // Message view lets another line go out while a reply is still
      // arriving. Voice mode keeps that: this send is not blocked by an
      // earlier turn. A newer send just takes the stage and the older
      // reply is not spoken.
      userTurnsInFlightRef.current += 1;
      const generation = ++turnGenerationRef.current;
      holdNewCaptionsRef.current = true;
      setHoldNewCaptions(true);
      if (speech.isSpeaking) speech.stop();
      setLipSyncClipUrl(null);
      if (!showCaptions && words) {
        showStageFlash('human', words);
      }
      setIsWaitingForReply(true);
      try {
        const { reply, sentiment } = await sendSpokenTurn(words, files);
        if (generation !== turnGenerationRef.current) return;
        await handleReply(reply, sentiment, generation);
      } finally {
        userTurnsInFlightRef.current = Math.max(
          0,
          userTurnsInFlightRef.current - 1
        );
        if (userTurnsInFlightRef.current === 0) {
          holdNewCaptionsRef.current = false;
          setHoldNewCaptions(false);
          setIsWaitingForReply(false);
        }
      }
    },
    [handleReply, sendSpokenTurn, showCaptions, showStageFlash, speech]
  );

  // The same turn lifecycle as submitTurn, for an utterance sent as audio to
  // be labelled by speaker. A triaged turn the avatar ignored yields no reply
  // and nothing is spoken.
  const submitSpokenAudio = useCallback(
    async (recording) => {
      if (!recording) return;
      const extraFiles = takePendingAttachmentsRef.current();
      userTurnsInFlightRef.current += 1;
      const generation = ++turnGenerationRef.current;
      holdNewCaptionsRef.current = true;
      setHoldNewCaptions(true);
      if (speech.isSpeaking) speech.stop();
      setLipSyncClipUrl(null);
      setIsTranscribing(true);
      setIsWaitingForReply(true);
      try {
        const { reply, sentiment, speakers } = await sendSpokenAudioTurn(
          recording,
          extraFiles
        );
        setIsTranscribing(false);
        if (generation !== turnGenerationRef.current) return;
        if (!showCaptions && speakers?.segments?.length) {
          showStageFlash(
            'human',
            speakers.segments
              .map((segment) => `${segment.speaker}: ${segment.text}`)
              .join('\n')
          );
        }
        if (reply) await handleReply(reply, sentiment, generation);
      } finally {
        setIsTranscribing(false);
        userTurnsInFlightRef.current = Math.max(
          0,
          userTurnsInFlightRef.current - 1
        );
        if (userTurnsInFlightRef.current === 0) {
          holdNewCaptionsRef.current = false;
          setHoldNewCaptions(false);
          setIsWaitingForReply(false);
        }
      }
    },
    [handleReply, sendSpokenAudioTurn, showCaptions, showStageFlash, speech]
  );

  // Accept / retry must cut the transcript and then present the new reply
  // on this stage. Calling resend alone updates the bubbles and never
  // speaks; submitTurn would append a second human line instead of
  // replacing the one that was edited.
  const presentResentTurn = useCallback(
    async (messageKey, text) => {
      const words = String(text ?? '').trim();
      if (!words) return;
      if (!findMessageByKey(messages, messageKey)) {
        toast.error('Could not update that message.');
        return;
      }
      setSuggestionSheetOpen(false);
      setEditingKey(null);
      userTurnsInFlightRef.current += 1;
      const generation = ++turnGenerationRef.current;
      holdNewCaptionsRef.current = true;
      setHoldNewCaptions(true);
      if (speech.isSpeaking) speech.stop();
      setLipSyncClipUrl(null);
      if (!showCaptions) {
        showStageFlash('human', words);
      }
      setIsWaitingForReply(true);
      try {
        const result = await resendFromUserMessage(messageKey, words);
        if (generation !== turnGenerationRef.current) return;
        if (result?.reply) {
          await handleReply(result.reply, result.sentiment, generation);
        }
      } finally {
        userTurnsInFlightRef.current = Math.max(
          0,
          userTurnsInFlightRef.current - 1
        );
        if (userTurnsInFlightRef.current === 0) {
          holdNewCaptionsRef.current = false;
          setHoldNewCaptions(false);
          setIsWaitingForReply(false);
        }
      }
    },
    [
      handleReply,
      messages,
      resendFromUserMessage,
      setEditingKey,
      showCaptions,
      showStageFlash,
      speech,
    ]
  );

  // Ambient vision inside voice mode. A reply the avatar volunteers after a
  // look at the webcam or the screen is spoken like any other reply, and no
  // snapshot is sent while either side is talking: the hold is raised while
  // the person speaks or dictates, while speech is being understood, while a
  // reply is awaited, and while the avatar speaks.
  useEffect(() => {
    setAmbientVoiceMode(true);
    const unregister = registerAmbientReplyHandler(async (reply, sentiment) => {
      if (userTurnsInFlightRef.current > 0 || ambientReplyInFlightRef.current) {
        return;
      }
      ambientReplyInFlightRef.current = true;
      const generation = turnGenerationRef.current;
      try {
        await handleReply(reply, sentiment, generation);
      } finally {
        ambientReplyInFlightRef.current = false;
      }
    });
    return () => {
      unregister();
      setAmbientVoiceMode(false);
    };
  }, [handleReply, registerAmbientReplyHandler, setAmbientVoiceMode]);

  useEffect(() => {
    setAmbientHold(
      isHearingSpeech ||
        isDictating ||
        isTranscribing ||
        isWaitingForReply ||
        speech.isSpeaking
    );
  }, [
    isHearingSpeech,
    isDictating,
    isTranscribing,
    isWaitingForReply,
    speech.isSpeaking,
    setAmbientHold,
  ]);

  useEffect(() => () => setAmbientHold(false), [setAmbientHold]);

  const speechInputUnavailableMessage =
    'Sign in to talk to this avatar, or open it from a shared link.';

  const transcribe = useCallback(
    async (file) => {
      if (!canDictate) {
        toast.error(speechInputUnavailableMessage);
        return '';
      }
      setIsTranscribing(true);
      try {
        const result = await transcribeRecording(assistantId, file, {
          asAnonymousIdentity: readerIsAnonymous,
        });
        return result?.text?.trim() ?? '';
      } catch (transcribeError) {
        showRequestFailureToast(transcribeError, {
          fallbackMessage: 'Could not understand that recording.',
        });
        return '';
      } finally {
        setIsTranscribing(false);
      }
    },
    [assistantId, canDictate, readerIsAnonymous]
  );

  // --- live audio (turn-based, voice activity detection) -----------------------
  // The listener lives for the whole visit, but the callbacks it needs are
  // recreated as the avatar, conversation, and speech state change. Calling
  // through refs keeps every utterance on the latest versions; a listener
  // holding the first render's `submitTurn` would send nothing, because the
  // context had no active avatar yet.
  const submitTurnRef = useRef(submitTurn);
  submitTurnRef.current = submitTurn;
  const submitSpokenAudioRef = useRef(submitSpokenAudio);
  submitSpokenAudioRef.current = submitSpokenAudio;
  const speakerLabelsOnRef = useRef(speakerLabelsOn);
  speakerLabelsOnRef.current = speakerLabelsOn;
  const transcribeRef = useRef(transcribe);
  transcribeRef.current = transcribe;
  const liveUtteranceQueueRef = useRef([]);
  const liveUtteranceDrainingRef = useRef(false);

  // Only one listener may exist. A start that is still waiting on the
  // microphone permission when a stop (or a second start) happens is
  // discarded when it resolves; two listeners on one microphone would send
  // every utterance twice.
  const listenerStartGenerationRef = useRef(0);
  const listenerStartInFlightRef = useRef(false);

  const stopLiveListening = useCallback(() => {
    listenerStartGenerationRef.current += 1;
    listenerRef.current?.stop();
    listenerRef.current = null;
    setIsLiveListening(false);
    setIsHearingSpeech(false);
    setMicLevel(0);
  }, []);

  const startLiveListening = useCallback(async () => {
    if (!canDictate) {
      toast.error(speechInputUnavailableMessage);
      return;
    }
    if (!canCaptureMicrophone()) {
      toast.error(
        'This browser cannot record audio here (a secure connection is required).'
      );
      return;
    }
    if (listenerRef.current || listenerStartInFlightRef.current) return;
    listenerStartInFlightRef.current = true;
    const startGeneration = ++listenerStartGenerationRef.current;
    try {
      const listener = await startVoiceActivityListening({
        onLevel: (level) => setMicLevel(level),
        onSpeechStart: () => {
          setIsHearingSpeech(true);
        },
        onUtterance: (file) => {
          setIsHearingSpeech(false);
          liveUtteranceQueueRef.current = enqueueLiveUtterance(
            liveUtteranceQueueRef.current,
            {
              file,
              // Judged now, while it is still true. By the time the words come
              // back from transcription the avatar has long since stopped.
              followedAvatarSpeech:
                avatarAudioIsActiveRef.current ||
                Date.now() < avatarEchoSuspicionUntilRef.current,
            }
          );
          const drain = async () => {
            if (liveUtteranceDrainingRef.current) return;
            liveUtteranceDrainingRef.current = true;
            try {
              while (liveUtteranceQueueRef.current.length > 0) {
                const { file: nextFile, followedAvatarSpeech } =
                  liveUtteranceQueueRef.current.shift();
                try {
                  if (speakerLabelsOnRef.current) {
                    // Speaker labelling sends the audio itself, so there are
                    // no words here to compare against the avatar's own; that
                    // path relies on the microphone gate alone.
                    await submitSpokenAudioRef.current(nextFile);
                    continue;
                  }
                  const words = await transcribeRef.current(nextFile);
                  if (!words) continue;
                  if (
                    isAvatarSelfEcho(words, avatarSpokenLinesRef.current, {
                      followedAvatarSpeech,
                    })
                  ) {
                    // The microphone caught the avatar rather than the person.
                    // Answering it would start a conversation with itself.
                    console.debug(
                      "Dropped an echo of the avatar's own voice:",
                      words
                    );
                    continue;
                  }
                  await submitTurnRef.current(words);
                } catch (turnError) {
                  console.error('The live turn failed:', turnError);
                  toast.error('Could not send what you said.');
                }
              }
            } finally {
              liveUtteranceDrainingRef.current = false;
              if (liveUtteranceQueueRef.current.length > 0) {
                drain();
              }
            }
          };
          drain();
        },
        onError: (listenError) => {
          console.error('Live listening failed:', listenError);
          toast.error('Live listening stopped unexpectedly.');
          stopLiveListening();
        },
      });
      if (
        startGeneration !== listenerStartGenerationRef.current ||
        listenerRef.current
      ) {
        listener.stop();
        return;
      }
      listenerRef.current = listener;
      setIsMicMuted(false);
      setIsLiveListening(true);
    } catch (microphoneError) {
      toast.error(
        microphoneError?.name === 'NotAllowedError'
          ? 'Microphone access was refused. Allow it in your browser to speak.'
          : 'Could not start listening.'
      );
    } finally {
      listenerStartInFlightRef.current = false;
    }
  }, [canDictate, stopLiveListening]);

  // --- who may open the microphone ------------------------------------------
  // One gate, derived from state, rather than a pause here and a resume there.
  // Scattered calls made the microphone depend on the order callbacks happened
  // to run in, and one order was reachable: an utterance the person had
  // already talked over reported that it had ended AFTER the reply replacing
  // it had shut the microphone and begun speaking, and its ending re-opened
  // the microphone. The avatar then recorded its own voice, transcribed it,
  // and answered itself. Reading the state instead makes that unreachable —
  // a late callback has nothing to re-open, because nothing re-opens the
  // microphone except the conditions below all being false.
  const avatarAudioIsActive =
    isPlayingReply || speech.isSpeaking || loadingSpeechKey !== null;
  avatarAudioIsActiveRef.current = avatarAudioIsActive;

  // The audio element finishing is not the speakers finishing; hold the
  // microphone shut a moment longer so the tail of a sentence is not recorded.
  const [isInAvatarEchoTail, setIsInAvatarEchoTail] = useState(false);
  const avatarWasAudibleRef = useRef(false);
  useEffect(() => {
    if (avatarAudioIsActive) {
      avatarWasAudibleRef.current = true;
      setIsInAvatarEchoTail(false);
      return undefined;
    }
    if (!avatarWasAudibleRef.current) return undefined;
    avatarWasAudibleRef.current = false;
    avatarEchoSuspicionUntilRef.current = Date.now() + AVATAR_ECHO_SUSPICION_MS;
    setIsInAvatarEchoTail(true);
    const tailTimer = setTimeout(
      () => setIsInAvatarEchoTail(false),
      AVATAR_ECHO_TAIL_MS
    );
    return () => clearTimeout(tailTimer);
  }, [avatarAudioIsActive]);

  const microphoneShouldListen =
    !isMicMuted &&
    !isDictating &&
    !avatarAudioIsActive &&
    !isInAvatarEchoTail;

  useEffect(() => {
    const listener = listenerRef.current;
    if (!listener) return;
    if (microphoneShouldListen) listener.resume();
    else listener.pause();
  }, [microphoneShouldListen, isLiveListening]);

  // Dictation is gated; do not auto-listen when this reader cannot talk.
  useEffect(() => {
    if (!canDictate && isLiveListening) {
      stopLiveListening();
      setLiveListeningPreferred(false);
    }
  }, [
    canDictate,
    isLiveListening,
    stopLiveListening,
  ]);

  // Start listening as soon as the stage opens and the avatar is loaded
  // (once). Opening live voice turns the microphone on; spoken audio being
  // unavailable, or a browser that cannot record, is the only reason not to.
  const autoStartedListeningRef = useRef(false);
  useEffect(() => {
    if (autoStartedListeningRef.current) return;
    if (!activeAvatar || !assistantId) return;
    if (!canDictate) return;
    if (!canCaptureMicrophone()) return;
    autoStartedListeningRef.current = true;
    setIsMicMuted(false);
    setLiveListeningPreferred(true);
    startLiveListening();
  }, [activeAvatar, assistantId, canDictate, startLiveListening]);

  const toggleLiveListening = () => {
    if (isLiveListening) {
      setLiveListeningPreferred(false);
      stopLiveListening();
      return;
    }
    if (!canDictate) {
      toast.error(speechInputUnavailableMessage);
      return;
    }
    setIsMicMuted(false);
    setLiveListeningPreferred(true);
    startLiveListening();
  };

  // --- dictation (one utterance into the text box) ---------------------------------
  const startDictation = async () => {
    if (!canDictate) {
      toast.error(speechInputUnavailableMessage);
      return;
    }
    if (!canCaptureMicrophone()) {
      toast.error(
        'This browser cannot record audio here (a secure connection is required).'
      );
      return;
    }
    if (dictationRef.current) return;
    // The gate closes the live microphone off `isDictating`; dictation opens
    // its own recording of the same input.
    setIsDictating(true);
    try {
      dictationRef.current = await recordOneTurn();
    } catch {
      setIsDictating(false);
      toast.error('Could not start recording.');
    }
  };

  const stopDictation = async () => {
    const recording = dictationRef.current;
    if (!recording) return;
    dictationRef.current = null;
    setIsDictating(false);
    const file = await recording.stop();
    const words = await transcribe(file);
    if (words)
      setDraft((previous) => (previous ? `${previous} ${words}` : words));
  };

  const toggleDictation = () => {
    if (isDictating) stopDictation();
    else startDictation();
  };

  const leaveVoiceMode = () => {
    speech.stop();
    setLipSyncClipUrl(null);
    stopLiveListening();
    dictationRef.current?.cancel?.();
    onClose?.();
  };

  const describeState = () => {
    if (isHearingSpeech) return 'Listening…';
    if (isTranscribing) return 'Understanding…';
    if (isWaitingForReply) {
      // What the avatar is doing while the reply is awaited, from the turn's
      // status frames ("Listing files on linux-pc-dev", "Running analysis
      // code"). A long data-analysis turn is silent for most of its length;
      // without this the stage says only "thinking" for a minute or more.
      const activity = assistantActivity?.trim();
      return activity
        ? `${avatarName ?? 'The avatar'} · ${activity}…`
        : `${avatarName ?? 'The avatar'} is thinking…`;
    }
    if (speech.isSpeaking) return `${avatarName ?? 'The avatar'} is speaking…`;
    if (ambientEnabled && ambientStatus?.inFlight) {
      return `${avatarName ?? 'The avatar'} is looking…`;
    }
    if (isLiveListening)
      return isMicMuted ? 'Mic muted' : 'Live — say something';
    if (ambientEnabled)
      return describeAmbientStatus(ambientStatus, ambientNextInMs);
    return '';
  };

  const isAvatarSpeaking =
    isPlayingReply || speech.isSpeaking || Boolean(lipSyncClipUrl);
  const generatingCaption = visibleExchange.find((message) =>
    voiceMessageIsGenerating(message, { turnActive: textTurnIsGenerating })
  );
  const showGeneratingStopRow = textTurnIsGenerating;
  const headerFace = showGenerated
    ? ((currentEmotion && currentEmotion !== 'neutral' ? stageStill : null) ??
      avatarPortrait)
    : avatarPortrait;

  const leaveLabel = 'Switch to messages';

  const stopVoiceReply = () => {
    // A newer generation so an in-flight handleReply does not start talking
    // after the person already asked it to stop.
    turnGenerationRef.current += 1;
    stopAssistantTurn?.();
    speech.stop();
    setLipSyncClipUrl(null);
    setIsPlayingReply(false);
    setIsRenderingClip(false);
  };

  const renderStopButton = () => (
    <button
      type="button"
      onClick={stopVoiceReply}
      title="Stop generating"
      aria-label="Stop generating"
      className="voice-text-btn shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 text-white/80 text-xs border border-white/10 hover:text-neutral-100 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
    >
      <Square className="w-3 h-3 fill-current" />
      Stop
    </button>
  );

  const generatingStopRow =
    showGeneratingStopRow && !generatingCaption ? (
      <AssistantActivityLine
        activity={assistantActivity}
        stopControl={renderStopButton()}
      />
    ) : (
      <AssistantActivityLine activity={assistantActivity} />
    );

  const renderLeaveVoiceButton = () => (
    <button
      type="button"
      onClick={leaveVoiceMode}
      title={leaveLabel}
      aria-label={leaveLabel}
      className={`${CLOSE_BUTTON_CLASSES} shrink-0`}
    >
      <AudioLinesOffIcon />
    </button>
  );

  const renderMuteControls = () => (
    <div
      data-voice-mute-bar
      className="pointer-events-auto shrink-0 flex items-center gap-0.5 rounded-full bg-black/60 backdrop-blur-lg border border-white/10 p-1"
    >
      <button
        type="button"
        onClick={() => {
          if (!isAvatarMuted) speech.stop();
          setIsAvatarMuted((muted) => !muted);
        }}
        title={isAvatarMuted ? 'Unmute the avatar' : 'Mute the avatar'}
        aria-label={isAvatarMuted ? 'Unmute the avatar' : 'Mute the avatar'}
        aria-pressed={!isAvatarMuted}
        className={`${CONTROL_CLASSES} ${!isAvatarMuted ? ACTIVE_CONTROL_CLASSES : ''}`}
      >
        {isAvatarMuted ? (
          <VolumeX className="w-5 h-5" />
        ) : (
          <Volume2 className="w-5 h-5" />
        )}
      </button>
      <button
        type="button"
        onClick={() => setIsMicMuted((muted) => !muted)}
        title={isMicMuted ? 'Unmute your microphone' : 'Mute your microphone'}
        aria-label={
          isMicMuted ? 'Unmute your microphone' : 'Mute your microphone'
        }
        aria-pressed={!isMicMuted}
        className={`${CONTROL_CLASSES} ${!isMicMuted ? ACTIVE_CONTROL_CLASSES : ''}`}
      >
        {isMicMuted ? (
          <MicOff className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </button>
    </div>
  );

  const statusLine = [describeState(), isRenderingClip ? 'rendering video' : '']
    .filter(Boolean)
    .join(' · ');

  return createPortal(
    // `--app-rail-width` is the collapsed icon rail; `z-30` sits above the
    // page (z-10) and under the sidebar (rail 40, panel 50).
    <div
      className="voice-stage fixed top-0 right-0 bottom-0 left-[var(--app-rail-width)] z-30 bg-transparent overflow-hidden"
      onPointerDown={(event) => {
        if (!shouldCollapseVoiceMessageBar(event.target)) return;
        // A waiting attachment is a draft. Folding the bar would hide the
        // only sign it is there, the same strip message mode keeps in view.
        if (
          voiceMessageBarHasDraftAttachments({
            mediaFileCount: mediaFiles.length,
            inFlightCount: attachmentsInFlight?.length ?? 0,
          })
        ) {
          return;
        }
        setIsMessageBarCollapsed(true);
        setIsComposerMenuOpen(false);
        setSuggestionSheetOpen(false);
      }}
    >
      {/* Portrait fills the stage and does not reflow when chrome toggles. */}
      <div
        ref={portraitConstraintRef}
        className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden p-6 sm:p-10"
      >
        <div
          ref={portraitWellRef}
          className="relative max-w-full max-h-full"
          style={
            portraitWellSize
              ? {
                  width: portraitWellSize.width,
                  height: portraitWellSize.height,
                }
              : {
                  aspectRatio: '1 / 1',
                  width: 'min(100vw, 100dvh)',
                  maxWidth: '100%',
                  maxHeight: '100%',
                }
          }
        >
          {isAvatarSpeaking && (
            <div
              className="voice-speak-glow absolute inset-0 z-10 rounded-2xl"
              aria-hidden
            />
          )}
          <div className="relative w-full h-full overflow-hidden rounded-2xl bg-transparent">
            {lipSyncClipUrl ||
            stageLoop ||
            (stageStill && isValidImageUrl(stageStill)) ? (
              <LoopingVideo
                src={
                  lipSyncClipUrl ?? (holdEmotionStill ? undefined : stageLoop)
                }
                poster={stageStill}
                alt={avatarName ?? 'Avatar'}
                loop={!lipSyncClipUrl}
                pingPong={lipSyncClipUrl ? false : 'auto'}
                onEnded={() => {
                  if (lipSyncClipUrl) {
                    setLipSyncClipUrl(null);
                  }
                }}
                onPresented={handleStagePresented}
                mediaClassName="w-full h-full object-contain"
                className="w-full h-full bg-transparent"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-[40%] h-[40%] max-w-64 max-h-64 text-white/20" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Same workspace tabs as chat / inbox / settings, so those places stay
          reachable while talking. A shared-link visitor has none of those. */}
      <div
        data-voice-stage-header
        className="absolute top-0 left-0 right-0 z-20 bg-black/45 backdrop-blur-md"
      >
        {showWorkspaceTabs ? (
          <>
            <AvatarWorkspaceHeader
              className="px-3 pt-[max(0.5rem,env(safe-area-inset-top))]"
              avatarName={avatarName}
              headerFace={headerFace}
              activeTab="chat"
              isPersonalAvatar={isPersonalAvatar}
              canOpenAvatarSettings={canOpenAvatarSettings}
              inboxCount={inboxCount}
              onTabChange={onNavigateTab}
            />
            {statusLine ? (
              <p className="px-3 pb-1.5 text-white/50 text-[10px] sm:text-center">
                {statusLine}
              </p>
            ) : null}
          </>
        ) : (
          <div className="flex items-center justify-between gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 shrink-0 rounded-full overflow-hidden bg-black/50 border border-white/10 flex items-center justify-center">
                {avatarPortrait && isValidImageUrl(avatarPortrait) ? (
                  <img
                    src={avatarPortrait}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4 text-white/40" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-neutral-200 font-semibold leading-tight truncate">
                  {avatarName ?? 'Your avatar'}
                </p>
                <p className="text-white/50 text-xs h-4 truncate">
                  {statusLine}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* When captions are hidden, the latest line stays in the caption
          dock until the next send or reply fades it out and takes the
          slot. A folded bar with the avatar audible is a clean stage —
          mute, or no voice model, is what puts the words back. */}
      {shouldShowVoiceStageText({
        messageBarCollapsed: isMessageBarCollapsed,
        captionsShown: showCaptions,
        avatarMuted: isAvatarMuted,
        hasVoiceModel:
          canPlayAvatarVoice && !speech.notReady && !speech.blocked,
      }) &&
        (stageFlash || assistantActivity || showGeneratingStopRow) && (
        <div
          className={`${CAPTION_DOCK_CLASSES} z-20 pointer-events-none`}
          style={{ bottom: composerDockHeight }}
        >
          <div
            data-voice-caption-dock
            className={CAPTION_COLUMN_CLASSES}
          >
            {stageFlash && (
              <div
                key={stageFlash.id}
                role="status"
                aria-live="polite"
                className={`${
                  stageFlash.dismissing
                    ? 'voice-stage-flash-out'
                    : 'voice-stage-flash'
                } ${
                  stageFlash.from === 'human'
                    ? HUMAN_BUBBLE_CLASSES
                    : `${AVATAR_BUBBLE_CLASSES} ${
                        isPlayingReply || speech.isSpeaking
                          ? SPEAKING_BUBBLE_HIGHLIGHT
                          : ''
                      }`
                }`}
                onAnimationEnd={(event) => {
                  if (event.animationName === STAGE_FLASH_IN_ANIMATION) return;
                  if (event.animationName !== STAGE_FLASH_OUT_ANIMATION) return;
                  const next = pendingStageFlashRef.current;
                  pendingStageFlashRef.current = null;
                  setStageFlash((current) => {
                    if (!current || current.id !== stageFlash.id) return current;
                    return next;
                  });
                }}
              >
                {stageFlash.text}
              </div>
            )}
            {generatingStopRow}
          </div>
        </div>
      )}

      {/* Captions overlay the lower stage. The message bar is a separate
          dock on the bottom edge so toggling captions never lifts it. */}
      {showCaptions && (
        <div
          className={`${CAPTION_DOCK_CLASSES} pointer-events-none ${
            editingKey ? 'z-40' : 'z-20'
          }`}
          style={{ bottom: composerDockHeight }}
        >
          <div
            data-voice-caption-dock
            className={`${CAPTION_COLUMN_CLASSES} pointer-events-auto`}
          >
            {visibleExchange.map((message) => {
              const messageKey =
                messageKeyOf(message) ??
                `temp-${message.timestamp || Date.now()}`;
              const isHuman = isHumanMessage(message);
              const isFromAvatar = isAvatarMessage(message);
              const isLoading = message.isLoading || message.isPending;
              const isGeneratingThis = voiceMessageIsGenerating(message, {
                turnActive: textTurnIsGenerating,
              });
              const isEditingThis = isHuman && editingKey === messageKey;
              const isCurrentReply =
                isFromAvatar &&
                message.id === lastCompletedAvatarMessage?.id;
              const isSpeakingThis =
                speech.speakingKey === messageKey ||
                (isCurrentReply &&
                  (speech.speakingKey === 'live-reply' || isPlayingReply));
              const captionText = isFromAvatar
                ? stripArtifactReferences(message.content)
                : message.content;
              return (
                <div
                  key={messageKey}
                  className={`${
                    isHuman ? HUMAN_BUBBLE_CLASSES : AVATAR_BUBBLE_CLASSES
                  } ${isSpeakingThis ? SPEAKING_BUBBLE_HIGHLIGHT : ''} ${
                    isEditingThis ? 'relative z-40' : ''
                  }`}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-between gap-3">
                      <TypingDots />
                      {isGeneratingThis && renderStopButton()}
                    </div>
                  ) : isEditingThis ? (
                    <div className="space-y-2 caption-actions pointer-events-auto">
                      <textarea
                        value={editDraft}
                        onChange={(event) => setEditDraft(event.target.value)}
                        rows={3}
                        className="w-full px-2 py-1.5 bg-black/50 border border-white/10 rounded-md text-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={
                            pendingSendCount > 0 ||
                            !String(editDraft ?? '').trim()
                          }
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            presentResentTurn(messageKey, editDraft);
                          }}
                          className="voice-text-btn px-2 py-1 rounded-md bg-amber-400/15 text-amber-300 text-xs border border-amber-400/30 disabled:opacity-40"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => setEditingKey(null)}
                          className="voice-text-btn px-2 py-1 rounded-md bg-white/5 text-white/70 text-xs border border-white/10"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {isHuman && hasSpeakerScript(message) ? (
                        <SpeakerScript
                          speakers={message.speakers}
                          fallback={message.content || '…'}
                        />
                      ) : captionText ? (
                        <div className="whitespace-pre-wrap">{captionText}</div>
                      ) : message.media?.length ? null : (
                        <div className="whitespace-pre-wrap">…</div>
                      )}
                      <MessageMedia media={message.media} />
                      {isFromAvatar && (
                        <CreatedArtifacts
                          artifacts={createdArtifactsOf(message)}
                          compact
                        />
                      )}
                    </>
                  )}
                  {isGeneratingThis && !isLoading && (
                    <div className="mt-2 caption-actions">{renderStopButton()}</div>
                  )}
                  {!isLoading && !isGeneratingThis && (
                    <MessageActionBar
                      message={message}
                      messageKey={messageKey}
                      isFromAvatar={isFromAvatar}
                      isFromUser={isHuman}
                      overlay={false}
                      isSpeaking={isSpeakingThis}
                      isSpeechLoading={loadingSpeechKey === messageKey}
                      canSpeak={canPlayAvatarVoice}
                      copiedKey={copiedKey}
                      feedbackKey={feedbackKey}
                      feedbackDraft={feedbackDraft}
                      editingKey={editingKey}
                      pendingSendCount={pendingSendCount}
                      onCopy={copyMessage}
                      onToggleSpeech={() => {
                        // The gate shuts the microphone off `loadingSpeechKey`
                        // and then off `speech.isSpeaking`, so playing a line
                        // from the transcript cannot be recorded either.
                        if (!isCurrentReply) setLipSyncClipUrl(null);
                        if (isFromAvatar) {
                          avatarSpokenLinesRef.current = rememberAvatarSpeech(
                            avatarSpokenLinesRef.current,
                            speakableReplyText(message.content)
                          );
                        }
                        toggleSpeech(
                          messageKey,
                          isFromAvatar
                            ? speakableReplyText(message.content)
                            : editableScriptText(message),
                          {
                            alsoStopKeys: isCurrentReply ? ['live-reply'] : [],
                          }
                        );
                      }}
                      onRegenerate={(key) => regenerateAvatarReply?.(key)}
                      onLike={() =>
                        submitMessageFeedback?.(messageKey, {
                          type: 'like',
                          comment: message.feedback?.comment,
                        })
                      }
                      onDislike={() =>
                        submitMessageFeedback?.(messageKey, {
                          type: 'dislike',
                          comment: message.feedback?.comment,
                        })
                      }
                      onToggleFeedback={() => {
                        setFeedbackKey((current) =>
                          current === messageKey ? null : messageKey
                        );
                        setFeedbackDraft(message.feedback?.comment ?? '');
                      }}
                      onFeedbackDraftChange={setFeedbackDraft}
                      onSubmitFeedback={() => {
                        submitMessageFeedback?.(messageKey, {
                          type: message.feedback.type,
                          comment: feedbackDraft.trim(),
                        });
                        setFeedbackKey(null);
                      }}
                      onStartEdit={() => {
                        setSuggestionSheetOpen(false);
                        setEditingKey(messageKey);
                        setEditDraft(editableScriptText(message));
                      }}
                      onRetry={(key) =>
                        presentResentTurn(key, editableScriptText(message))
                      }
                    />
                  )}
                </div>
              );
            })}
            {generatingStopRow}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      )}

      {/* Message bar: docked to the bottom. A press on empty stage folds it.
          Mute avatar / mute mic sit beside the box so they stay visible. */}
      <div
        ref={composerDockRef}
        className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-5 sm:pt-3 sm:pb-5"
      >
        <div
          className={`mx-auto max-w-3xl w-full flex gap-2 ${voiceComposerDockItemsClass(isMessageBarCollapsed)}`}
        >
          {renderMuteControls()}
          {isMessageBarCollapsed ? (
          <div className="relative pointer-events-auto flex-1 min-w-0">
            {collapsedVoiceBarIsSpeaking({
              hearingSpeech: isHearingSpeech,
              dictating: isDictating,
            }) && (
              <div
                className="voice-speak-glow absolute inset-0 z-10 rounded-xl"
                aria-hidden
              />
            )}
            <button
              type="button"
              data-voice-message-bar
              onClick={() => setIsMessageBarCollapsed(false)}
              title="Show the message bar"
              aria-label="Show the message bar"
              className="suggestions-handle voice-text-btn relative h-full w-full bg-black/60 backdrop-blur-lg rounded-xl border border-white/10 flex items-center justify-center gap-1.5 text-white/50 hover:text-neutral-200 hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            >
              <ChevronUp className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs">Message</span>
            </button>
          </div>
        ) : (
          <div
            data-voice-message-bar
            className="pointer-events-auto flex-1 min-w-0 bg-black/60 backdrop-blur-lg rounded-xl border border-white/10 p-2 sm:p-3 overflow-visible"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleFileChange?.({
                target: { files: event.dataTransfer?.files ?? [] },
              });
            }}
          >
          <ConversationSuggestions
            overlay
            onSend={(suggestion) => {
              const files = takePendingAttachments();
              setDraft('');
              submitTurn(suggestion, files);
            }}
          />
          <ComposerAttachmentStrip
            mediaFiles={mediaFiles}
            attachmentsInFlight={attachmentsInFlight}
            onRemove={removeFile}
          />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const words = draft;
              const files = takePendingAttachments();
              setDraft('');
              submitTurn(words, files);
            }}
          >
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`Message ${avatarName ?? 'the avatar'}…`}
              className="w-full bg-transparent px-2 py-1.5 text-sm text-neutral-200 placeholder-white/40 focus:outline-none"
            />
          </form>
          <div className="flex items-center gap-1 mt-1 min-w-0">
            <div className="relative shrink-0 flex items-center gap-0.5">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(event) => {
                  handleFileChange?.(event);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach a file"
                aria-label="Attach a file"
                className={CONTROL_CLASSES}
              >
                <Paperclip className="w-5 h-5" />
              </button>
              {isPersonalAvatar && !readerIsAnonymous && (
                <>
                  <button
                    type="button"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={() =>
                      setIsComposerMenuOpen((previous) => !previous)
                    }
                    title="Connectors"
                    aria-label="Connectors"
                    aria-haspopup="menu"
                    aria-expanded={isComposerMenuOpen}
                    aria-controls="voice-composer-menu"
                    className={`${CONTROL_CLASSES} ${
                      isComposerMenuOpen ? ACTIVE_CONTROL_CLASSES : ''
                    }`}
                  >
                    <Plus
                      className={`w-5 h-5 transition-transform ${
                        isComposerMenuOpen ? 'rotate-45' : ''
                      }`}
                    />
                  </button>
                  <ComposerConnectorsMenu
                    open={isComposerMenuOpen}
                    onClose={() => setIsComposerMenuOpen(false)}
                    menuId="voice-composer-menu"
                    showConnectors
                    onManageConnectors={() => {
                      setIsComposerMenuOpen(false);
                      if (assistantId) {
                        navigate(
                          `/chat/${encodeURIComponent(assistantId)}?tab=settings&section=connections`
                        );
                        return;
                      }
                      onNavigateTab?.('avatar-settings');
                    }}
                  />
                </>
              )}
            </div>
            <div className="flex items-center gap-0.5 min-w-0 overflow-x-auto scrollbar-none flex-1">
              <div className="flex items-center rounded-full bg-white/5 border border-white/10">
                <button
                  type="button"
                  onClick={toggleLiveListening}
                  disabled={!canDictate && !isLiveListening}
                  title={
                    !canDictate
                      ? speechInputUnavailableMessage
                      : isLiveListening
                        ? 'Stop live audio'
                        : 'Live audio (hands-free)'
                  }
                  aria-label={
                    !canDictate
                      ? 'Speech input unavailable'
                      : isLiveListening
                        ? 'Stop live audio'
                        : 'Start live audio'
                  }
                  aria-pressed={isLiveListening}
                  className={`${CONTROL_CLASSES} ${isLiveListening ? ACTIVE_CONTROL_CLASSES : ''} disabled:opacity-40 disabled:pointer-events-none`}
                >
                  <span className="relative inline-flex">
                    <AudioLines className="w-5 h-5" />
                    {isLiveListening && (
                      <span
                        aria-hidden="true"
                        className="absolute -right-1 -top-1 w-2 h-2 rounded-full bg-emerald-400"
                        style={{
                          transform: `scale(${1 + Math.min(micLevel * 12, 1.5)})`,
                        }}
                      />
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!canDictate}
                  onClick={toggleDictation}
                  title={
                    !canDictate
                      ? speechInputUnavailableMessage
                      : isDictating
                        ? 'Stop recording and put the words in the message box'
                        : 'Record a message (the words appear in the message box)'
                  }
                  aria-label={
                    !canDictate
                      ? 'Speech input unavailable'
                      : isDictating
                        ? 'Stop recording'
                        : 'Start recording'
                  }
                  aria-pressed={isDictating}
                  className={`${CONTROL_CLASSES} ${isDictating ? 'bg-red-500/30 text-red-200' : ''} disabled:opacity-40 disabled:pointer-events-none`}
                >
                  {isDictating ? (
                    <Square className="w-5 h-5 fill-current" />
                  ) : isTranscribing && !isLiveListening ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>
              </div>

              <div
                role="group"
                aria-label="Avatar face"
                className="flex items-center rounded-full bg-white/5 border border-white/10"
              >
                <button
                  type="button"
                  onClick={() => setShowGenerated(false)}
                  title="Show the original reference photo"
                  aria-label="Show the original reference photo"
                  aria-pressed={!showGenerated}
                  className={`${CONTROL_CLASSES} ${!showGenerated ? ACTIVE_CONTROL_CLASSES : ''}`}
                >
                  <Image className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowGenerated(true)}
                  title="Show generated portraits and idle loops"
                  aria-label="Show generated portraits and idle loops"
                  aria-pressed={showGenerated}
                  className={`${CONTROL_CLASSES} ${showGenerated ? ACTIVE_CONTROL_CLASSES : ''}`}
                >
                  <Sparkles className="w-5 h-5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsVideoEnabled((enabled) => !enabled)}
                title={
                  isVideoEnabled
                    ? 'Disable generative video replies'
                    : 'Enable generative video replies'
                }
                aria-label={
                  isVideoEnabled
                    ? 'Disable generative video replies'
                    : 'Enable generative video replies'
                }
                aria-pressed={isVideoEnabled}
                className={`${CONTROL_CLASSES} ${isVideoEnabled ? ACTIVE_CONTROL_CLASSES : ''}`}
              >
                {isVideoEnabled ? (
                  <Video className="w-5 h-5" />
                ) : (
                  <VideoOff className="w-5 h-5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowCaptions((shown) => !shown)}
                title={showCaptions ? 'Hide captions' : 'Show captions'}
                aria-label={showCaptions ? 'Hide captions' : 'Show captions'}
                aria-pressed={showCaptions}
                className={`${CONTROL_CLASSES} ${showCaptions ? ACTIVE_CONTROL_CLASSES : ''}`}
              >
                <Captions className="w-5 h-5" />
              </button>

            </div>

            {composerHasSendableDraft(draft, mediaFiles.length) ? (
              <button
                type="button"
                onClick={() => {
                  const words = draft;
                  const files = takePendingAttachments();
                  setDraft('');
                  submitTurn(words, files);
                }}
                className={SEND_BUTTON_CLASSES}
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            ) : (
              renderLeaveVoiceButton()
            )}
          </div>
          </div>
        )}
        </div>
        {!user && !isMessageBarCollapsed && (
          <p className="text-center text-white/30 text-xs mt-2">
            Your words are transcribed by the server and kept in this
            conversation.
          </p>
        )}
      </div>
    </div>,
    document.body
  );
};

export default LiveVoiceMode;
