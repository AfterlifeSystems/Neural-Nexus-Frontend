// src/components/LiveVoiceMode.jsx
//
// Talking to the avatar instead of typing to it. Same conversation, different
// medium: every spoken turn lands in the same thread and is readable afterwards
// in the transcript.
//
// The stage is the avatar: its emotion still or idle loop fills the screen, and
// when video is enabled a lip-synced clip of the reply plays between the loops.
// Along the bottom sits the composer pill from the reference design — type, or
// attach; live audio (turn-based, with voice activity detection and barge-in)
// or one-shot dictation; mute the avatar; mute the mic; enable video; show or
// hide the captions; and Stop.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines,
  Captions,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  Send,
  User,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLocation } from 'react-router-dom';

import { useMedia } from '../context/MediaContext';
import { useAuth } from '../context/AuthContext';
import { isSharedAvatarChatPath, isValidImageUrl } from './utils';
import LoopingVideo from './ui/LoopingVideo';
import useEmotionMedia, { idleLoopFor, stillFor } from '../hooks/useEmotionMedia';
import useSpeech from '../hooks/useSpeech';
import { canCaptureMicrophone, recordOneTurn } from '../services/voiceSession';
import { startVoiceActivityListening } from '../services/voiceActivity';
import {
  requestLipSyncClip,
  transcribeRecording,
} from '../services/avatarService';
import { showRequestFailureToast } from './requestFailureToast';

const PREFERENCES_KEY = 'voice_mode_preferences';

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
  'p-2 rounded-full text-white/70 hover:text-neutral-100 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-40 disabled:hover:bg-transparent';
const ACTIVE_CONTROL_CLASSES = 'bg-white/15 text-neutral-100';

const LiveVoiceMode = ({ assistantId, avatarName, avatarPortrait, onClose }) => {
  const { messages, sendSpokenTurn, handleFileChange } = useMedia();
  const { user } = useAuth();
  const location = useLocation();
  const readerIsAnonymous = isSharedAvatarChatPath(location.pathname);

  const preferences = useMemo(readPreferences, []);
  const [isAvatarMuted, setIsAvatarMuted] = useState(Boolean(preferences.avatarMuted));
  const [isMicMuted, setIsMicMuted] = useState(Boolean(preferences.micMuted));
  const [isVideoEnabled, setIsVideoEnabled] = useState(Boolean(preferences.videoEnabled));
  const [showCaptions, setShowCaptions] = useState(
    preferences.showCaptions ?? window.matchMedia('(min-width: 768px)').matches
  );
  useEffect(() => {
    writePreferences({
      avatarMuted: isAvatarMuted,
      micMuted: isMicMuted,
      videoEnabled: isVideoEnabled,
      showCaptions,
    });
  }, [isAvatarMuted, isMicMuted, isVideoEnabled, showCaptions]);

  const [isLiveListening, setIsLiveListening] = useState(false);
  const [isHearingSpeech, setIsHearingSpeech] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isWaitingForReply, setIsWaitingForReply] = useState(false);
  const [draft, setDraft] = useState('');
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [lipSyncClipUrl, setLipSyncClipUrl] = useState(null);
  const [isRenderingClip, setIsRenderingClip] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  const listenerRef = useRef(null);
  const dictationRef = useRef(null);
  const fileInputRef = useRef(null);
  const turnInFlightRef = useRef(false);
  const transcriptEndRef = useRef(null);

  const { manifest } = useEmotionMedia(assistantId, {
    asAnonymousIdentity: readerIsAnonymous,
  });
  const speech = useSpeech({ asAnonymousIdentity: readerIsAnonymous });

  const spokenExchange = messages.filter((message) =>
    ['human', 'ai'].includes(message.type)
  );
  const lastAvatarMessage = [...spokenExchange]
    .reverse()
    .find((message) => message.type === 'ai');

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [spokenExchange.length, showCaptions]);

  // Leaving the screen stops everything: speech, listening, dictation.
  useEffect(
    () => () => {
      speech.stop();
      listenerRef.current?.stop();
      dictationRef.current?.cancel();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (speech.notReady) {
      toast(
        `${avatarName ?? 'This avatar'} has no voice yet — record about two minutes in settings. ` +
          `${Math.round(speech.notReady.collectedSeconds)}s collected so far.`,
        { icon: '🎙', duration: 6000 }
      );
    }
  }, [speech.notReady, avatarName]);

  // --- the stage --------------------------------------------------------------
  const stageStill = stillFor(manifest, currentEmotion) ?? avatarPortrait;
  const stageLoop = idleLoopFor(manifest, currentEmotion);

  const handleReply = useCallback(
    async (reply, sentiment) => {
      const emotion = sentiment?.base_emotion ?? 'neutral';
      setCurrentEmotion(emotion);
      setLipSyncClipUrl(null);
      if (!reply?.trim() || isAvatarMuted) return;

      const wantsVideo = isVideoEnabled && Boolean(stillFor(manifest, emotion));
      if (wantsVideo) {
        // The clip renders in the background while the emotion loop and the
        // spoken audio play; when it is ready it takes over the stage.
        setIsRenderingClip(true);
        requestLipSyncClip(assistantId, reply, emotion, {
          asAnonymousIdentity: readerIsAnonymous,
        })
          .then((clipUrl) => {
            if (clipUrl) setLipSyncClipUrl(clipUrl);
          })
          .catch((clipError) => {
            if (clipError?.status === 403) {
              setIsVideoEnabled(false);
              showRequestFailureToast(clipError, {
                fallbackMessage: 'Video replies need a premium plan.',
              });
            } else {
              console.debug('Lip-sync unavailable for this reply:', clipError);
            }
          })
          .finally(() => setIsRenderingClip(false));
      }
      // Speech starts as soon as the reply is known; listening pauses so the
      // avatar does not hear itself, except at the barge-in threshold.
      listenerRef.current?.pause?.();
      await speech.speak(assistantId, reply, {
        key: 'live-reply',
        onEnd: () => {
          if (!isMicMuted) listenerRef.current?.resume?.();
        },
      });
    },
    [assistantId, isAvatarMuted, isMicMuted, isVideoEnabled, manifest, readerIsAnonymous, speech]
  );

  const submitTurn = useCallback(
    async (text) => {
      const words = text?.trim();
      if (!words || turnInFlightRef.current) return;
      turnInFlightRef.current = true;
      setIsWaitingForReply(true);
      try {
        const { reply, sentiment } = await sendSpokenTurn(words);
        await handleReply(reply, sentiment);
      } finally {
        turnInFlightRef.current = false;
        setIsWaitingForReply(false);
      }
    },
    [handleReply, sendSpokenTurn]
  );

  const transcribe = useCallback(
    async (file) => {
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
    [assistantId, readerIsAnonymous]
  );

  // --- live audio (turn-based, voice activity detection) -----------------------
  const stopLiveListening = useCallback(() => {
    listenerRef.current?.stop();
    listenerRef.current = null;
    setIsLiveListening(false);
    setIsHearingSpeech(false);
    setMicLevel(0);
  }, []);

  const startLiveListening = useCallback(async () => {
    if (!canCaptureMicrophone()) {
      toast.error('This browser cannot record audio here (a secure connection is required).');
      return;
    }
    try {
      listenerRef.current = await startVoiceActivityListening({
        onLevel: (level) => setMicLevel(level),
        onSpeechStart: () => {
          setIsHearingSpeech(true);
          // Barge-in: the person started talking over the avatar.
          if (speech.isSpeaking) speech.stop();
        },
        onUtterance: async (file) => {
          setIsHearingSpeech(false);
          const words = await transcribe(file);
          if (words) await submitTurn(words);
        },
        onError: (listenError) => {
          console.error('Live listening failed:', listenError);
          toast.error('Live listening stopped unexpectedly.');
          stopLiveListening();
        },
      });
      if (isMicMuted) listenerRef.current.pause();
      setIsLiveListening(true);
    } catch (microphoneError) {
      toast.error(
        microphoneError?.name === 'NotAllowedError'
          ? 'Microphone access was refused. Allow it in your browser to speak.'
          : 'Could not start listening.'
      );
    }
  }, [isMicMuted, speech, stopLiveListening, submitTurn, transcribe]);

  useEffect(() => {
    if (!listenerRef.current) return;
    if (isMicMuted) listenerRef.current.pause();
    else if (!speech.isSpeaking) listenerRef.current.resume();
  }, [isMicMuted, speech.isSpeaking]);

  // --- dictation (one utterance into the text box) ---------------------------------
  const startDictation = async () => {
    if (!canCaptureMicrophone()) {
      toast.error('This browser cannot record audio here (a secure connection is required).');
      return;
    }
    try {
      dictationRef.current = await recordOneTurn();
      setIsDictating(true);
    } catch {
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
    if (words) setDraft((previous) => (previous ? `${previous} ${words}` : words));
  };

  const handleStop = () => {
    if (speech.isSpeaking || isWaitingForReply || isTranscribing) {
      speech.stop();
      setLipSyncClipUrl(null);
      return;
    }
    onClose?.();
  };

  const describeState = () => {
    if (isHearingSpeech) return 'Listening…';
    if (isTranscribing) return 'Understanding…';
    if (isWaitingForReply) return `${avatarName ?? 'The avatar'} is thinking…`;
    if (speech.isSpeaking) return `${avatarName ?? 'The avatar'} is speaking…`;
    if (isLiveListening) return isMicMuted ? 'Mic muted' : 'Live — say something';
    return '';
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      {/* The stage: the avatar's emotion loop, a lip-sync clip when one is
          ready, or the portrait. Behind everything. */}
      <div className="absolute inset-0">
        {lipSyncClipUrl ? (
          <LoopingVideo
            src={lipSyncClipUrl}
            poster={stageStill}
            alt={avatarName ?? 'Avatar'}
            loop={false}
            onEnded={() => setLipSyncClipUrl(null)}
            className="w-full h-full"
          />
        ) : stageLoop || (stageStill && isValidImageUrl(stageStill)) ? (
          <LoopingVideo
            src={stageLoop}
            poster={stageStill}
            alt={avatarName ?? 'Avatar'}
            className="w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="w-32 h-32 text-white/20" />
          </div>
        )}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/90 via-black/60 to-transparent" />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-black/50 border border-white/10 flex items-center justify-center">
            {avatarPortrait && isValidImageUrl(avatarPortrait) ? (
              <img src={avatarPortrait} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-white/40" />
            )}
          </div>
          <div>
            <p className="text-neutral-200 font-semibold leading-tight">
              {avatarName ?? 'Your avatar'}
            </p>
            <p className="text-white/50 text-xs h-4">
              {describeState()}
              {isRenderingClip ? ' · rendering video' : ''}
            </p>
          </div>
        </div>
        <span className="text-white/40 text-xs">
          {currentEmotion !== 'neutral' ? currentEmotion : ''}
        </span>
      </div>

      {/* Transcript overlay */}
      <div className="relative z-10 flex-grow overflow-y-auto px-4 sm:px-10">
        {showCaptions && (
          <div className="mx-auto max-w-3xl flex flex-col gap-3 pb-4">
            {spokenExchange.map((message) => {
              const isHuman = message.type === 'human';
              const isCurrent =
                !isHuman && message.id === lastAvatarMessage?.id && speech.isSpeaking;
              return (
                <div
                  key={message.id ?? message.timestamp}
                  className={`max-w-[85%] ${
                    isHuman
                      ? 'self-end px-4 py-2 rounded-2xl bg-neutral-800/80 text-neutral-200'
                      : `self-start text-neutral-100 text-[15px] leading-relaxed drop-shadow ${
                          isCurrent ? 'text-amber-100' : ''
                        }`
                  }`}
                >
                  {message.content || '…'}
                </div>
              );
            })}
            <div ref={transcriptEndRef} />
          </div>
        )}
      </div>

      {/* Composer pill */}
      <div className="relative z-10 p-3 sm:p-5">
        <div className="mx-auto max-w-3xl bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const words = draft;
              setDraft('');
              submitTurn(words);
            }}
          >
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`Message ${avatarName ?? 'the avatar'}…`}
              className="w-full bg-transparent px-2 py-2 text-neutral-200 placeholder-white/40 focus:outline-none"
            />
          </form>
          <div className="flex items-center gap-1.5 mt-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                handleFileChange?.(event);
                toast('Attached to the next message.', { icon: '📎' });
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

            <div className="flex items-center rounded-full bg-white/5 border border-white/10">
              <button
                type="button"
                onClick={() => (isLiveListening ? stopLiveListening() : startLiveListening())}
                title={isLiveListening ? 'Stop live audio' : 'Live audio (hands-free)'}
                aria-label={isLiveListening ? 'Stop live audio' : 'Start live audio'}
                aria-pressed={isLiveListening}
                className={`${CONTROL_CLASSES} ${isLiveListening ? ACTIVE_CONTROL_CLASSES : ''}`}
              >
                <span className="relative inline-flex">
                  <AudioLines className="w-5 h-5" />
                  {isLiveListening && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-1 w-2 h-2 rounded-full bg-emerald-400"
                      style={{ transform: `scale(${1 + Math.min(micLevel * 12, 1.5)})` }}
                    />
                  )}
                </span>
              </button>
              <button
                type="button"
                onMouseDown={startDictation}
                onMouseUp={stopDictation}
                onMouseLeave={() => isDictating && stopDictation()}
                onTouchStart={(event) => {
                  event.preventDefault();
                  startDictation();
                }}
                onTouchEnd={(event) => {
                  event.preventDefault();
                  stopDictation();
                }}
                title="Hold to dictate into the message"
                aria-label="Hold to dictate"
                className={`${CONTROL_CLASSES} ${isDictating ? 'bg-red-500/30 text-red-200' : ''}`}
              >
                {isTranscribing && !isLiveListening ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!isAvatarMuted) speech.stop();
                setIsAvatarMuted((muted) => !muted);
              }}
              title={isAvatarMuted ? 'Unmute the avatar' : 'Mute the avatar'}
              aria-label={isAvatarMuted ? 'Unmute the avatar' : 'Mute the avatar'}
              aria-pressed={isAvatarMuted}
              className={`${CONTROL_CLASSES} ${isAvatarMuted ? ACTIVE_CONTROL_CLASSES : ''}`}
            >
              {isAvatarMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={() => setIsMicMuted((muted) => !muted)}
              title={isMicMuted ? 'Unmute your microphone' : 'Mute your microphone'}
              aria-label={isMicMuted ? 'Unmute your microphone' : 'Mute your microphone'}
              aria-pressed={isMicMuted}
              className={`${CONTROL_CLASSES} ${isMicMuted ? ACTIVE_CONTROL_CLASSES : ''}`}
            >
              {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={() => setIsVideoEnabled((enabled) => !enabled)}
              title={isVideoEnabled ? 'Disable video replies' : 'Enable video replies'}
              aria-label={isVideoEnabled ? 'Disable video replies' : 'Enable video replies'}
              aria-pressed={isVideoEnabled}
              className={`${CONTROL_CLASSES} ${isVideoEnabled ? ACTIVE_CONTROL_CLASSES : ''}`}
            >
              {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
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

            <div className="flex-grow" />

            {draft.trim() ? (
              <button
                type="button"
                onClick={() => {
                  const words = draft;
                  setDraft('');
                  submitTurn(words);
                }}
                className="px-4 py-2 rounded-full bg-neutral-200 hover:bg-neutral-100 text-neutral-900 text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStop}
                className="px-4 py-2 rounded-full bg-neutral-200 hover:bg-neutral-100 text-neutral-900 text-sm font-medium transition-colors"
              >
                {speech.isSpeaking || isWaitingForReply || isTranscribing ? 'Stop' : 'Close'}
              </button>
            )}
          </div>
        </div>
        {!user && (
          <p className="text-center text-white/30 text-xs mt-2">
            Your words are transcribed by the server and kept in this conversation.
          </p>
        )}
      </div>
    </div>
  );
};

export default LiveVoiceMode;
