// src/context/EvanAssistContext.jsx
//
// The Evan help overlay: a conversation with the public Evan avatar that sits
// on top of Neural Nexus. It has its own thread, so the chat the person
// already has open is left alone. Sharing the screen from this overlay sends
// ambient observations to Evan until the overlay is closed or the share ends.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';

import { EVAN_ASSISTANT_ID, EVAN_DISPLAY_NAME } from '../config/evanAssist';
import { DEMO_ASSISTANT_ID } from '../config/demoAvatar';
import { AMBIENT_CAPTURE_INTERVAL_MS } from '../config/ambientCapture';
import { useAuth } from './AuthContext';
import { snapshotStream } from './MediaShareContext';
import {
  canCaptureDisplay,
  requestDisplayMedia,
} from '../services/displayCapture';
import { canCaptureMicrophone } from '../services/voiceSession';
import { startVoiceActivityListening } from '../services/voiceActivity';
import {
  getAvatarReferenceImage,
  listPublicAvatars,
  transcribeRecording,
} from '../services/avatarService';
import {
  INITIAL_AMBIENT_STATUS,
  nextCaptureInMs,
  reduceAmbientEvent,
  retryAfterMillisecondsFromError,
  shouldCaptureNow,
  shouldReportRepeatedFailures,
} from '../services/ambientCaptureScheduler';
import {
  buildEvanMessageRequest,
  buildEvanResumeRequest,
  buildEvanUserMessage,
  createTurnGate,
  isEvanScreenObservationActive,
  pickEvanAvatar,
} from '../services/evanAssistSession';
import {
  loadEvanThreadMessages,
  streamEvanObservation,
  streamEvanTurn,
} from '../services/evanAssistApi';
import {
  assistPanelSize,
  clampAssistPosition,
  collapseFromWindow,
  defaultAssistPosition,
  expandFromPill,
} from '../components/evanAssist/evanAssistGeometry';
import { describeAssistLocation } from '../components/evanAssist/evanAssistLocation';
import { showRequestFailureToast } from '../components/requestFailureToast';
import { resolveAssistantId } from '../components/utils';

const EvanAssistContext = createContext(null);

const AMBIENT_TICK_MS = 1000;

const layoutOptions = () => ({ railWidth: readRailWidth() });
const pillSize = () => assistPanelSize('pill', readViewport(), layoutOptions());
const windowSize = () => assistPanelSize('window', readViewport(), layoutOptions());

const threadStorageKey = (identity) => `evan-assist-thread:${identity}`;

const readStoredThreadId = (identity) => {
  try {
    return sessionStorage.getItem(threadStorageKey(identity)) || null;
  } catch {
    return null;
  }
};

const writeStoredThreadId = (identity, threadId) => {
  try {
    if (threadId) {
      sessionStorage.setItem(threadStorageKey(identity), threadId);
    } else {
      sessionStorage.removeItem(threadStorageKey(identity));
    }
  } catch {
    // Private mode / quota: the thread then lasts only for this page.
  }
};

const readViewport = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

const readRailWidth = () => {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--app-rail-width')
    .trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 56;
  return raw.endsWith('rem') ? value * 16 : value;
};

const userTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children
 */
export function EvanAssistProvider({ children }) {
  const { user, activeAvatar } = useAuth();
  const location = useLocation();
  const identity = user?.id ?? user?.email ?? 'anonymous';
  const asAnonymousIdentity = !user;

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState(() =>
    defaultAssistPosition(readViewport(), pillSize(), layoutOptions())
  );
  const [evan, setEvan] = useState(null);
  const [portrait, setPortrait] = useState(null);
  const [resolveError, setResolveError] = useState('');
  const [messages, setMessages] = useState([]);
  const [threadId, setThreadId] = useState(() => readStoredThreadId(identity));
  const [activity, setActivity] = useState(null);
  const [pendingInterrupt, setPendingInterrupt] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [screenStream, setScreenStream] = useState(null);
  const [ambientStatus, setAmbientStatus] = useState(INITIAL_AMBIENT_STATUS);
  const [ambientNextInMs, setAmbientNextInMs] = useState(0);
  const [isLiveListening, setIsLiveListening] = useState(false);
  const [isHearingSpeech, setIsHearingSpeech] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  const screenStreamRef = useRef(null);
  const listenerRef = useRef(null);
  const threadIdRef = useRef(threadId);
  const evanRef = useRef(evan);
  const resolvePromiseRef = useRef(null);
  const ambientStatusRef = useRef(INITIAL_AMBIENT_STATUS);
  const sendInFlightRef = useRef(false);
  const observationInFlightRef = useRef(false);
  const isExpandedRef = useRef(false);
  const turnGateRef = useRef(createTurnGate());
  const draftRef = useRef('');
  draftRef.current = draft;
  threadIdRef.current = threadId;
  evanRef.current = evan;
  ambientStatusRef.current = ambientStatus;
  isExpandedRef.current = isExpanded;

  const evanId = resolveAssistantId(evan) ?? EVAN_ASSISTANT_ID;
  const evanName = evan?.name || EVAN_DISPLAY_NAME;

  const adoptThreadId = useCallback(
    (nextThreadId) => {
      if (!nextThreadId || nextThreadId === threadIdRef.current) return;
      threadIdRef.current = nextThreadId;
      setThreadId(nextThreadId);
      writeStoredThreadId(identity, nextThreadId);
    },
    [identity]
  );

  useEffect(() => {
    const stored = readStoredThreadId(identity);
    setThreadId(stored);
    threadIdRef.current = stored;
    setMessages([]);
    setPendingInterrupt(null);
  }, [identity]);

  const ensureEvan = useCallback(async () => {
    if (evanRef.current) return evanRef.current;
    if (resolvePromiseRef.current) return resolvePromiseRef.current;

    resolvePromiseRef.current = (async () => {
      try {
        setResolveError('');
        const configuredId = EVAN_ASSISTANT_ID;
        let listing = asAnonymousIdentity
          ? await listPublicAvatars(configuredId)
          : await listPublicAvatars();
        let picked = pickEvanAvatar(listing, {
          configuredId,
          fallbackId: DEMO_ASSISTANT_ID,
          displayName: EVAN_DISPLAY_NAME,
        });
        if (!picked && configuredId) {
          listing = await listPublicAvatars(configuredId);
          picked = pickEvanAvatar(listing, {
            configuredId,
            fallbackId: DEMO_ASSISTANT_ID,
            displayName: EVAN_DISPLAY_NAME,
          });
        }
        if (!picked) {
          throw new Error('Evan is not available right now.');
        }
        evanRef.current = picked;
        setEvan(picked);
        try {
          const image = await getAvatarReferenceImage(
            resolveAssistantId(picked),
            { asAnonymousIdentity }
          );
          setPortrait(image);
        } catch {
          setPortrait(null);
        }
        return picked;
      } catch (resolveFailure) {
        const message =
          resolveFailure?.message || 'Evan is not available right now.';
        setResolveError(message);
        throw resolveFailure;
      } finally {
        resolvePromiseRef.current = null;
      }
    })();

    return resolvePromiseRef.current;
  }, [asAnonymousIdentity]);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
  }, []);

  const stopLiveListening = useCallback(() => {
    listenerRef.current?.stop();
    listenerRef.current = null;
    setIsLiveListening(false);
    setIsHearingSpeech(false);
    setMicLevel(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    isExpandedRef.current = false;
    setIsExpanded(false);
    stopLiveListening();
    stopScreenShare();
    setActivity(null);
  }, [stopLiveListening, stopScreenShare]);

  useEffect(
    () => () => {
      listenerRef.current?.stop();
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    []
  );

  const open = useCallback(async () => {
    setIsOpen(true);
    setIsExpanded(false);
    setPosition(
      defaultAssistPosition(readViewport(), pillSize(), layoutOptions())
    );
    try {
      const resolved = await ensureEvan();
      const storedThread = threadIdRef.current;
      if (storedThread && resolved) {
        try {
          const history = await loadEvanThreadMessages(
            resolveAssistantId(resolved),
            storedThread,
            { asAnonymousIdentity }
          );
          setMessages(history);
        } catch {
          threadIdRef.current = null;
          setThreadId(null);
          writeStoredThreadId(identity, null);
        }
      }
    } catch (openError) {
      toast.error(openError?.message || 'Evan is not available right now.');
    }
  }, [asAnonymousIdentity, ensureEvan, identity]);

  const toggle = useCallback(() => {
    if (isOpen) close();
    else open();
  }, [close, isOpen, open]);

  const expand = useCallback(() => {
    if (isExpandedRef.current) {
      setIsExpanded(true);
      return;
    }
    isExpandedRef.current = true;
    setIsExpanded(true);
    setPosition((current) =>
      expandFromPill(
        current,
        pillSize(),
        windowSize(),
        readViewport(),
        layoutOptions()
      )
    );
  }, []);

  const collapse = useCallback(() => {
    isExpandedRef.current = false;
    setIsExpanded(false);
    setPosition((current) =>
      collapseFromWindow(
        current,
        windowSize(),
        pillSize(),
        readViewport(),
        layoutOptions()
      )
    );
  }, []);

  useEffect(() => {
    const onResize = () => {
      const size = isExpanded ? windowSize() : pillSize();
      setPosition((current) =>
        clampAssistPosition(current, size, readViewport(), layoutOptions())
      );
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isExpanded]);

  const moveTo = useCallback(
    (next) => {
      const size = isExpanded ? windowSize() : pillSize();
      setPosition(
        clampAssistPosition(next, size, readViewport(), layoutOptions())
      );
    },
    [isExpanded]
  );

  const captureScreenStill = useCallback(async () => {
    const still = await snapshotStream(screenStreamRef.current, 'screen.jpg');
    return still ? [still] : [];
  }, []);

  const sendTurn = useCallback(
    async (text) => {
      const words = String(text ?? '').trim();
      if (sendInFlightRef.current) return;
      sendInFlightRef.current = true;
      setIsSending(true);
      setActivity(
        ambientStatusRef.current.inFlight
          ? 'Sending when this look finishes'
          : 'Thinking'
      );
      setDraft('');

      try {
        await turnGateRef.current.run(async () => {
          let resolved;
          try {
            resolved = await ensureEvan();
          } catch {
            return;
          }
          const assistantId = resolveAssistantId(resolved);
          const stills = await captureScreenStill();
          const composed = buildEvanUserMessage({
            text: words,
            locationLabel: describeAssistLocation(
              location.pathname,
              location.search,
              activeAvatar?.name
            ),
            screenShared: stills.length > 0,
          });
          if (!composed.apiText.trim()) return;

          const humanId = `evan-human-${Date.now()}`;
          const streamingId = `evan-ai-${Date.now()}`;
          setMessages((current) => [
            ...current,
            {
              id: humanId,
              type: 'human',
              content: composed.displayText,
              timestamp: new Date().toISOString(),
            },
            {
              id: streamingId,
              type: 'ai',
              content: '',
              isLoading: true,
              timestamp: new Date().toISOString(),
            },
          ]);
          setActivity('Thinking');

          try {
            const request = buildEvanMessageRequest(assistantId, {
              message: composed.apiText,
              threadId: threadIdRef.current,
              files: stills,
              userTimezone: userTimezone(),
            });
            const outcome = await streamEvanTurn(request, {
              asAnonymousIdentity,
              onUpdate: (state) => {
                setActivity(state.activity);
                if (state.streamedText) {
                  setMessages((current) =>
                    current.map((message) =>
                      message.id === streamingId
                        ? {
                            ...message,
                            isLoading: false,
                            content: state.streamedText,
                          }
                        : message
                    )
                  );
                }
              },
            });
            adoptThreadId(outcome.threadId);
            if (outcome.interrupt) {
              setPendingInterrupt({
                threadId: outcome.threadId ?? threadIdRef.current,
                assistantId,
                interrupt: outcome.interrupt,
              });
            }
            setMessages((current) =>
              current
                .map((message) =>
                  message.id === streamingId
                    ? {
                        ...message,
                        isLoading: false,
                        content: outcome.streamedText || message.content,
                        ambient: outcome.ambientDecision
                          ? {
                              decision: outcome.ambientDecision,
                              summary: outcome.ambientSummary,
                              observation_id: outcome.observationId,
                            }
                          : message.ambient,
                      }
                    : message
                )
                .filter(
                  (message) =>
                    message.id !== streamingId ||
                    (message.content ?? '').trim() !== '' ||
                    outcome.interrupt
                )
            );
            if (outcome.streamedText) {
              expand();
            }
          } catch (turnError) {
            setMessages((current) =>
              current.filter(
                (message) =>
                  message.id !== humanId && message.id !== streamingId
              )
            );
            showRequestFailureToast(turnError, {
              fallbackMessage: 'Evan could not answer just then.',
            });
          }
        });
      } finally {
        sendInFlightRef.current = false;
        setIsSending(false);
        setActivity(null);
      }
    },
    [
      activeAvatar?.name,
      adoptThreadId,
      asAnonymousIdentity,
      captureScreenStill,
      ensureEvan,
      expand,
      location.pathname,
      location.search,
    ]
  );

  const resumeInterrupt = useCallback(
    async (decision) => {
      const paused = pendingInterrupt;
      if (!paused) return;
      setPendingInterrupt(null);
      setIsSending(true);
      setActivity('Thinking');
      try {
        await turnGateRef.current.run(async () => {
          let resolved;
          try {
            resolved = await ensureEvan();
          } catch {
            return;
          }
          const assistantId = resolveAssistantId(resolved);
          const streamingId = `evan-ai-${Date.now()}`;
          setMessages((current) => [
            ...current,
            {
              id: streamingId,
              type: 'ai',
              content: '',
              isLoading: true,
              timestamp: new Date().toISOString(),
            },
          ]);
          try {
            const request = buildEvanResumeRequest(assistantId, {
              threadId: paused.threadId,
              decision,
              userTimezone: userTimezone(),
            });
            const outcome = await streamEvanTurn(request, {
              asAnonymousIdentity,
              onUpdate: (state) => {
                setActivity(state.activity);
                if (state.streamedText) {
                  setMessages((current) =>
                    current.map((message) =>
                      message.id === streamingId
                        ? {
                            ...message,
                            isLoading: false,
                            content: state.streamedText,
                          }
                        : message
                    )
                  );
                }
              },
            });
            adoptThreadId(outcome.threadId);
            if (outcome.interrupt) {
              setPendingInterrupt({
                threadId: outcome.threadId ?? paused.threadId,
                assistantId,
                interrupt: outcome.interrupt,
              });
            }
            setMessages((current) =>
              current
                .map((message) =>
                  message.id === streamingId
                    ? {
                        ...message,
                        isLoading: false,
                        content: outcome.streamedText || message.content,
                      }
                    : message
                )
                .filter(
                  (message) =>
                    message.id !== streamingId ||
                    (message.content ?? '').trim() !== ''
                )
            );
          } catch (resumeError) {
            setPendingInterrupt(paused);
            setMessages((current) =>
              current.filter((message) => message.id !== streamingId)
            );
            showRequestFailureToast(resumeError, {
              fallbackMessage: 'Could not send that decision. Try again.',
            });
          }
        });
      } finally {
        setIsSending(false);
        setActivity(null);
      }
    },
    [adoptThreadId, asAnonymousIdentity, ensureEvan, pendingInterrupt]
  );

  const toggleScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      stopScreenShare();
      return;
    }
    if (!canCaptureDisplay()) {
      toast.error(
        'This browser cannot share the screen. On a phone, try Safari (iOS) or Chrome (Android).'
      );
      return;
    }
    try {
      await ensureEvan();
      const stream = await requestDisplayMedia();
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        screenStreamRef.current = null;
        setScreenStream(null);
      });
      screenStreamRef.current = stream;
      setScreenStream(stream);
      setAmbientStatus({ ...INITIAL_AMBIENT_STATUS });
      expand();
    } catch (screenError) {
      if (
        screenError?.name === 'NotAllowedError' ||
        screenError?.name === 'AbortError'
      ) {
        return;
      }
      toast.error('Could not share the screen.');
    }
  }, [ensureEvan, expand, stopScreenShare]);

  const transcribe = useCallback(
    async (file) => {
      const assistantId = evanId;
      if (!assistantId) return '';
      setIsTranscribing(true);
      try {
        const result = await transcribeRecording(assistantId, file, {
          asAnonymousIdentity,
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
    [asAnonymousIdentity, evanId]
  );

  const startLiveListening = useCallback(async () => {
    if (!canCaptureMicrophone()) {
      toast.error(
        'This browser cannot record audio here (a secure connection is required).'
      );
      return;
    }
    try {
      await ensureEvan();
      listenerRef.current = await startVoiceActivityListening({
        onLevel: (level) => setMicLevel(level),
        onSpeechStart: () => setIsHearingSpeech(true),
        onUtterance: async (file) => {
          setIsHearingSpeech(false);
          const words = await transcribe(file);
          if (words) await sendTurn(words);
        },
        onError: (listenError) => {
          console.error('Evan live listening failed:', listenError);
          toast.error('Live listening stopped unexpectedly.');
          stopLiveListening();
        },
      });
      setIsLiveListening(true);
      expand();
    } catch (microphoneError) {
      toast.error(
        microphoneError?.name === 'NotAllowedError'
          ? 'Microphone access was refused. Allow it in your browser to speak.'
          : 'Could not start listening.'
      );
    }
  }, [ensureEvan, expand, sendTurn, stopLiveListening, transcribe]);

  const toggleMicrophone = useCallback(() => {
    if (isLiveListening) stopLiveListening();
    else startLiveListening();
  }, [isLiveListening, startLiveListening, stopLiveListening]);

  const observationEnabled = isEvanScreenObservationActive({
    windowOpen: isOpen,
    hasScreenShare: Boolean(screenStream),
  });

  const ambientHold =
    isHearingSpeech ||
    isTranscribing ||
    isSending ||
    Boolean(activity) ||
    Boolean(pendingInterrupt) ||
    Boolean(draft.trim());

  const lookConditionsRef = useRef({});
  lookConditionsRef.current = {
    enabled: observationEnabled,
    asAnonymousIdentity,
    evanId,
    isLiveListening,
    pendingInterrupt,
    ambientHold,
    adoptThreadId,
    captureScreenStill,
    expand,
  };

  useEffect(() => {
    if (!observationEnabled) {
      setAmbientNextInMs(0);
      const reset = { ...INITIAL_AMBIENT_STATUS };
      ambientStatusRef.current = reset;
      setAmbientStatus(reset);
      return undefined;
    }
    let cancelled = false;
    const tick = async () => {
      const conditions = lookConditionsRef.current;
      const status = ambientStatusRef.current;
      const now = Date.now();
      setAmbientNextInMs(
        nextCaptureInMs({
          lastCaptureAt: status.lastCapturedAt,
          intervalMs: AMBIENT_CAPTURE_INTERVAL_MS,
          retryAfterUntil: status.retryAfterUntil,
          now,
        })
      );
      if (
        !conditions.enabled ||
        observationInFlightRef.current ||
        sendInFlightRef.current ||
        turnGateRef.current.busy ||
        !shouldCaptureNow({
          enabled: true,
          hasWebcam: false,
          hasScreen: Boolean(screenStreamRef.current),
          inFlight: status.inFlight,
          pendingSendCount: sendInFlightRef.current ? 1 : 0,
          assistantActivity: conditions.ambientHold ? 'hold' : null,
          pendingInterrupt: conditions.pendingInterrupt,
          ambientHold: conditions.ambientHold,
          lastCaptureAt: status.lastCapturedAt,
          intervalMs: AMBIENT_CAPTURE_INTERVAL_MS,
          retryAfterUntil: status.retryAfterUntil,
          now,
        })
      ) {
        return;
      }
      const apply = (event) => {
        const next = reduceAmbientEvent(ambientStatusRef.current, event);
        ambientStatusRef.current = next;
        if (!cancelled) setAmbientStatus(next);
        return next;
      };
      apply({ type: 'capture_started', at: now });
      observationInFlightRef.current = true;
      try {
        await turnGateRef.current.run(async () => {
          if (sendInFlightRef.current || draftRef.current.trim()) {
            apply({ type: 'done' });
            return;
          }
          const stills = await conditions.captureScreenStill();
          if (!stills.length) {
            apply({ type: 'done' });
            return;
          }
          const assistantId =
            resolveAssistantId(evanRef.current) ?? conditions.evanId;
          const outcome = await streamEvanObservation(assistantId, stills, {
            threadId: threadIdRef.current,
            voiceMode: conditions.isLiveListening,
            asAnonymousIdentity: conditions.asAnonymousIdentity,
          });
          conditions.adoptThreadId(outcome.threadId);
          if (outcome.ambientDecision) {
            apply({
              type: 'ambient_decision',
              decision: outcome.ambientDecision,
              summary: outcome.ambientSummary,
              observation_id: outcome.observationId,
            });
          }
          apply({ type: 'done' });
          if (
            outcome.streamedText &&
            (outcome.ambientDecision === 'respond' ||
              outcome.ambientDecision === 'notify')
          ) {
            setMessages((current) => [
              ...current,
              {
                id: `evan-ambient-${Date.now()}`,
                type: 'ai',
                content: outcome.streamedText,
                timestamp: new Date().toISOString(),
                ambient: {
                  decision: outcome.ambientDecision,
                  summary: outcome.ambientSummary,
                  observation_id: outcome.observationId,
                },
              },
            ]);
            conditions.expand();
          }
          if (outcome.interrupt) {
            setPendingInterrupt({
              threadId: outcome.threadId ?? threadIdRef.current,
              assistantId,
              interrupt: outcome.interrupt,
            });
          }
        });
      } catch (observationError) {
        const retryAfterMs = retryAfterMillisecondsFromError(observationError);
        const next = apply({
          type: 'failed',
          error:
            observationError?.message ?? 'The observation could not be sent.',
          retryAfterMs,
          at: Date.now(),
        });
        if (retryAfterMs == null) {
          console.error('Evan observation failed:', observationError);
        }
        if (shouldReportRepeatedFailures(next)) {
          toast.error(
            'Evan cannot see the screen right now. He will keep trying while you share it.'
          );
        }
      } finally {
        observationInFlightRef.current = false;
      }
    };
    const timer = setInterval(tick, AMBIENT_TICK_MS);
    tick();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [observationEnabled]);

  const value = {
    isOpen,
    isExpanded,
    position,
    panelSize: isExpanded ? windowSize() : pillSize(),
    evan,
    evanId,
    evanName,
    portrait,
    resolveError,
    messages,
    activity,
    pendingInterrupt,
    isSending,
    draft,
    setDraft,
    screenStream,
    isSharingScreen: Boolean(screenStream),
    observationEnabled,
    ambientStatus,
    ambientNextInMs,
    isLiveListening,
    isHearingSpeech,
    isTranscribing,
    micLevel,
    open,
    close,
    toggle,
    expand,
    collapse,
    moveTo,
    sendTurn,
    resumeInterrupt,
    toggleScreenShare,
    toggleMicrophone,
  };

  return (
    <EvanAssistContext.Provider value={value}>
      {children}
    </EvanAssistContext.Provider>
  );
}

export function useEvanAssist() {
  const value = useContext(EvanAssistContext);
  if (!value) {
    throw new Error('useEvanAssist must be used inside EvanAssistProvider');
  }
  return value;
}
