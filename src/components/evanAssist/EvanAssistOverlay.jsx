// The floating Evan help chat: a large pill that expands into a movable
// message window, with screen share and live voice-activity speech-to-text.
// The share is background context: Evan is sent looks at it on his own timer,
// and a message the person types goes out at once.
//
// The webcam control is hidden on this help overlay for now. Everything it
// needs is left in place and commented out — the icons, the two values read
// from the context, the label, the button, its two placements, and the copy
// that names it — so bringing it back is a matter of uncommenting them. The
// webcam is NOT hidden on the personal avatar, where `SidebarShareControls`
// still offers it, and `EvanAssistContext` still snapshots any live webcam
// stream into a look, so the looks resume the moment the control returns.
// Every browser can drag it around this tab. Desktop pop-out stays off until
// that window hosts a working help chat.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import {
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Loader2,
  Mic,
  MicOff,
  MonitorUp,
  PictureInPicture2,
  PictureInPicture,
  Send,
  // Video,
  // VideoOff,
  X,
} from 'lucide-react';

import { useEvanAssist } from '../../context/EvanAssistContext';
import { describeEvanAmbientStatus } from '../../services/evanAssistSession';
import {
  hasAssistDragMoved,
  isAssistDragHandle,
  positionAfterPointerDelta,
} from './evanAssistGeometry';
import {
  canOfferAssistDesktopPopout,
  closeAssistDesktopWindow,
  openAssistDesktopWindow,
  resizeAssistDesktopWindow,
} from './evanAssistDesktopWindow';
import { isValidImageUrl } from '../utils';

const CONTROL_CLASSES =
  'rounded-full text-white/70 hover:text-neutral-100 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-40 disabled:hover:bg-transparent shrink-0 p-1.5';
const ACTIVE_CONTROL_CLASSES = 'bg-white/15 text-neutral-100';
const HUMAN_BUBBLE =
  'max-w-[90%] self-end px-3 py-2 rounded-2xl text-sm leading-relaxed bg-neutral-800/90 text-neutral-200 whitespace-pre-wrap';
const EVAN_BUBBLE =
  'max-w-[90%] self-start px-3 py-2 rounded-2xl text-sm leading-relaxed bg-black/55 border border-white/15 text-neutral-100 whitespace-pre-wrap';

const Portrait = ({ src, name, sizeClass = 'w-8 h-8' }) => (
  <div
    className={`${sizeClass} shrink-0 rounded-full bg-black/50 border border-white/10 overflow-hidden flex items-center justify-center`}
  >
    {src && isValidImageUrl(src) ? (
      <img
        src={src}
        alt=""
        draggable={false}
        className="w-full h-full object-cover"
      />
    ) : (
      <CircleHelp className="w-4 h-4 text-white/50" />
    )}
    <span className="sr-only">{name}</span>
  </div>
);

const TypingDots = () => (
  <div className="flex items-center space-x-1" aria-label="Responding">
    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" />
    <span
      className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"
      style={{ animationDelay: '150ms' }}
    />
    <span
      className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"
      style={{ animationDelay: '300ms' }}
    />
  </div>
);

const EvanAssistOverlay = () => {
  const {
    isOpen,
    isExpanded,
    position,
    panelSize,
    evanName,
    portrait,
    resolveError,
    messages,
    activity,
    pendingInterrupt,
    isSending,
    draft,
    setDraft,
    isSharingScreen,
    // isSharingWebcam,
    observationEnabled,
    ambientStatus,
    ambientNextInMs,
    isLiveListening,
    isHearingSpeech,
    isTranscribing,
    micLevel,
    close,
    expand,
    collapse,
    moveTo,
    sendTurn,
    resumeInterrupt,
    toggleScreenShare,
    // toggleWebcam,
    toggleMicrophone,
  } = useEvanAssist();
  const transcriptEndRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const desktopWindowRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragSession, setDragSession] = useState(null);
  const [desktopWindow, setDesktopWindow] = useState(null);
  const canFloatOnDesktop = canOfferAssistDesktopPopout();
  const isOnDesktop = Boolean(desktopWindow);

  useEffect(() => {
    desktopWindowRef.current = desktopWindow;
  }, [desktopWindow]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, activity, isExpanded]);

  useEffect(() => {
    if (!desktopWindow) return undefined;
    const onGone = () => {
      if (desktopWindowRef.current === desktopWindow) {
        setDesktopWindow(null);
      }
    };
    desktopWindow.addEventListener('pagehide', onGone);
    return () => desktopWindow.removeEventListener('pagehide', onGone);
  }, [desktopWindow]);

  useEffect(() => {
    if (!desktopWindow) return;
    resizeAssistDesktopWindow(desktopWindow, panelSize);
  }, [desktopWindow, panelSize.width, panelSize.height]);

  useEffect(() => {
    if (isOpen) return undefined;
    const floating = desktopWindowRef.current;
    if (!floating) return undefined;
    closeAssistDesktopWindow(floating);
    setDesktopWindow(null);
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!dragSession || isOnDesktop) return undefined;
    const onMove = (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      const current = { x: event.clientX, y: event.clientY };
      if (!drag.active) {
        if (!hasAssistDragMoved(drag.pointer, current)) return;
        drag.active = true;
        suppressClickRef.current = true;
        setIsDragging(true);
      }
      moveTo(positionAfterPointerDelta(drag.origin, drag.pointer, current));
    };
    const onUp = () => {
      const dragged = Boolean(dragRef.current?.active);
      dragRef.current = null;
      setDragSession(null);
      setIsDragging(false);
      if (dragged) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragSession, isOnDesktop, moveTo]);

  if (!isOpen) return null;

  const status = (() => {
    if (resolveError) return resolveError;
    if (isHearingSpeech) return 'Listening…';
    if (isTranscribing) return 'Understanding…';
    if (activity) return `${activity}…`;
    if (isSending) return `${evanName} is thinking…`;
    if (observationEnabled && ambientStatus?.inFlight) {
      return `${evanName} is looking…`;
    }
    if (isLiveListening) return 'Live — say something';
    if (observationEnabled) {
      return describeEvanAmbientStatus(ambientStatus, ambientNextInMs);
    }
    return 'Ready';
  })();

  const startDrag = (event) => {
    event.stopPropagation();
    if (event.button !== 0) return;
    if (isOnDesktop) return;
    if (!isAssistDragHandle(event.target)) return;
    dragRef.current = {
      origin: position,
      pointer: { x: event.clientX, y: event.clientY },
      active: false,
    };
    setDragSession({ at: Date.now() });
  };

  const onExpandClick = (event) => {
    if (suppressClickRef.current) {
      event.preventDefault();
      return;
    }
    expand();
  };

  const toggleDesktopWindow = async () => {
    if (desktopWindow) {
      closeAssistDesktopWindow(desktopWindow);
      setDesktopWindow(null);
      return;
    }
    if (!canFloatOnDesktop) {
      return;
    }
    try {
      const pipWindow = await openAssistDesktopWindow(panelSize);
      setDesktopWindow(pipWindow);
    } catch (desktopError) {
      if (
        desktopError?.name === 'NotAllowedError' ||
        desktopError?.name === 'AbortError'
      ) {
        return;
      }
      toast.error('Could not move the assistant onto the desktop.');
    }
  };

  const shareLabel = isSharingScreen
    ? 'Stop sharing screen with Evan'
    : 'Share screen with Evan';
  // const webcamLabel = isSharingWebcam
  //   ? 'Stop sharing webcam with Evan'
  //   : 'Share webcam with Evan';
  const micLabel = isLiveListening
    ? 'Turn off microphone'
    : 'Turn on microphone';

  const renderShareButton = () => (
    <button
      type="button"
      data-evan-assist-no-drag
      onClick={toggleScreenShare}
      title={shareLabel}
      aria-label={shareLabel}
      aria-pressed={isSharingScreen}
      className={`${CONTROL_CLASSES} ${isSharingScreen ? ACTIVE_CONTROL_CLASSES : ''}`}
    >
      <MonitorUp className="w-5 h-5" />
    </button>
  );

  // const renderWebcamButton = () => (
  //   <button
  //     type="button"
  //     data-evan-assist-no-drag
  //     onClick={toggleWebcam}
  //     title={webcamLabel}
  //     aria-label={webcamLabel}
  //     aria-pressed={isSharingWebcam}
  //     className={`${CONTROL_CLASSES} ${isSharingWebcam ? ACTIVE_CONTROL_CLASSES : ''}`}
  //   >
  //     {isSharingWebcam ? (
  //       <Video className="w-5 h-5" />
  //     ) : (
  //       <VideoOff className="w-5 h-5" />
  //     )}
  //   </button>
  // );

  const renderMicButton = () => (
    <button
      type="button"
      data-evan-assist-no-drag
      onClick={toggleMicrophone}
      title={micLabel}
      aria-label={micLabel}
      aria-pressed={isLiveListening}
      className={`${CONTROL_CLASSES} ${isLiveListening ? ACTIVE_CONTROL_CLASSES : ''}`}
    >
      <span className="relative inline-flex">
        {isLiveListening ? (
          <Mic className="w-5 h-5" />
        ) : (
          <MicOff className="w-5 h-5" />
        )}
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
  );

  const desktopLabel = isOnDesktop
    ? 'Return assistant to this page'
    : 'Keep assistant on the desktop';

  const renderDesktopButton = () => (
    <button
      type="button"
      data-evan-assist-no-drag
      onClick={toggleDesktopWindow}
      title={
        canFloatOnDesktop || isOnDesktop
          ? desktopLabel
          : 'Keep on desktop (Chrome or Edge)'
      }
      aria-label={
        canFloatOnDesktop || isOnDesktop
          ? desktopLabel
          : 'Keep on desktop. This browser can only move the assistant inside this window.'
      }
      aria-pressed={isOnDesktop}
      className={`${CONTROL_CLASSES} ${isOnDesktop ? ACTIVE_CONTROL_CLASSES : ''}`}
    >
      {isOnDesktop ? (
        <PictureInPicture className="w-5 h-5" />
      ) : (
        <PictureInPicture2 className="w-5 h-5" />
      )}
    </button>
  );

  const interruptQuestion =
    pendingInterrupt?.interrupt?.question ??
    pendingInterrupt?.interrupt?.message ??
    pendingInterrupt?.interrupt?.prompt ??
    `${evanName} wants to do something on your behalf.`;
  const interruptKind = pendingInterrupt?.interrupt?.kind;
  const canApplyInterrupt =
    interruptKind === 'mcp_connect_consent' || !interruptKind;

  const panel = isExpanded ? (
    <div
      data-evan-assist-window
      role="dialog"
      aria-label={`${evanName} help`}
      className="flex flex-col bg-black/75 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      style={{
        width: isOnDesktop ? '100%' : panelSize.width,
        height: isOnDesktop ? '100%' : panelSize.height,
        maxWidth: isOnDesktop ? 'none' : 'calc(100vw - 2rem)',
        maxHeight: isOnDesktop ? 'none' : 'calc(100vh - 2rem)',
      }}
    >
      <div
        data-evan-assist-drag
        className={`flex items-center gap-2 px-3 py-2 border-b border-white/10 select-none touch-none ${isOnDesktop ? '' : isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <Portrait src={portrait} name={evanName} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-100 truncate">
            {evanName}
          </p>
          <p className="text-[11px] text-white/50 truncate">{status}</p>
        </div>
        {canFloatOnDesktop || isOnDesktop ? renderDesktopButton() : null}
        <button
          type="button"
          data-evan-assist-no-drag
          onClick={collapse}
          className={CONTROL_CLASSES}
          aria-label="Collapse to pill"
          title="Collapse"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <button
          type="button"
          data-evan-assist-no-drag
          onClick={close}
          className={CONTROL_CLASSES}
          aria-label="Close Evan help"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 flex flex-col gap-2">
        {messages.length === 0 && !resolveError && (
          <p className="text-sm text-white/50 leading-relaxed">
            {/* With the webcam back, this reads "Share your screen or webcam". */}
            Share your screen and {evanName} watches along in the background.
            Turn on the microphone to talk, or type a question — messages send
            straight away.
          </p>
        )}
        {messages.map((message) => {
          const fromEvan = message.type === 'ai' || message.type === 'assistant';
          return (
            <div
              key={message.id}
              className={`flex ${fromEvan ? 'justify-start' : 'justify-end'}`}
            >
              <div className={fromEvan ? EVAN_BUBBLE : HUMAN_BUBBLE}>
                {fromEvan && message.ambient?.decision && (
                  <p className="text-[10px] uppercase tracking-wide text-amber-300/80 mb-1">
                    Saw your share
                  </p>
                )}
                {message.isLoading && !message.content ? (
                  <TypingDots />
                ) : (
                  message.content
                )}
              </div>
            </div>
          );
        })}
        {activity && !messages.some((message) => message.isLoading) && (
          <p className="text-xs text-white/50 italic">{activity}…</p>
        )}
        {pendingInterrupt && (
          <div className="self-start w-full rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 space-y-2">
            <p className="text-sm text-neutral-100">{interruptQuestion}</p>
            <div className="flex flex-wrap gap-2">
              {canApplyInterrupt && (
                <button
                  type="button"
                  data-evan-assist-text-btn
                  onClick={() => resumeInterrupt('apply')}
                  disabled={isSending}
                  className="px-3 py-1.5 rounded-lg bg-neutral-200 text-neutral-900 text-sm font-semibold disabled:opacity-50"
                >
                  Allow
                </button>
              )}
              <button
                type="button"
                data-evan-assist-text-btn
                onClick={() => resumeInterrupt('cancel')}
                disabled={isSending}
                className="px-3 py-1.5 rounded-lg border border-white/15 text-neutral-200 text-sm disabled:opacity-50"
              >
                Not now
              </button>
            </div>
          </div>
        )}
        <div ref={transcriptEndRef} />
      </div>

      <form
        className="shrink-0 border-t border-white/10 p-2 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const words = draft;
          setDraft('');
          sendTurn(words);
        }}
      >
        {/* With the webcam back, this names whichever shares are live:
            `(isSharingScreen || isSharingWebcam)`, and the text picks between
            "this screen", "your webcam", and "this screen and your webcam". */}
        {isSharingScreen && (
          <p className="px-1 text-[11px] text-emerald-300/80">
            Sharing this screen with {evanName}
          </p>
        )}
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`Message ${evanName}…`}
          className="w-full bg-transparent px-2 py-1.5 text-sm text-neutral-200 placeholder-white/40 focus:outline-none"
        />
        <div className="flex items-center gap-1">
          {renderShareButton()}
          {/* {renderWebcamButton()} */}
          {renderMicButton()}
          <div className="flex-1" />
          <button
            type="submit"
            /* With the webcam back, `&& !isSharingWebcam` joins this test. */
            disabled={isSending || (!draft.trim() && !isSharingScreen)}
            className="rounded-full bg-neutral-200 hover:bg-neutral-100 text-neutral-900 px-3 py-1.5 text-sm font-semibold inline-flex items-center gap-1 disabled:opacity-40"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send
          </button>
        </div>
      </form>
    </div>
  ) : (
    <div
      data-evan-assist-pill
      data-evan-assist-drag
      className={`flex items-center gap-1.5 sm:gap-2 bg-black/75 backdrop-blur-lg border border-white/10 rounded-full shadow-2xl pl-2 pr-1.5 select-none touch-none ${
        isOnDesktop
          ? ''
          : isDragging
            ? 'cursor-grabbing'
            : 'cursor-grab'
      }`}
      style={{
        width: isOnDesktop ? '100%' : 'max-content',
        maxWidth: isOnDesktop ? 'none' : 'calc(100vw - 2rem)',
        height: isOnDesktop ? '100%' : panelSize.height,
      }}
    >
      <button
        type="button"
        onClick={onExpandClick}
        className="flex items-center gap-2 min-w-0 flex-1 text-left px-1 py-1 rounded-full hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        aria-label={`Expand ${evanName} help`}
        title={isOnDesktop ? `Expand ${evanName} help` : 'Drag to move, or click to expand'}
      >
        <Portrait src={portrait} name={evanName} />
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold text-neutral-100 leading-tight whitespace-nowrap">
            Ask {evanName}
          </span>
          <span className="block text-[9px] text-white/50 leading-tight whitespace-nowrap">
            {status}
          </span>
        </span>
      </button>
      <div className="flex items-center gap-0.5 shrink-0">
        {renderShareButton()}
        {/* {renderWebcamButton()} */}
        {renderMicButton()}
        {canFloatOnDesktop || isOnDesktop ? renderDesktopButton() : null}
        <button
          type="button"
          data-evan-assist-no-drag
          onClick={expand}
          className={CONTROL_CLASSES}
          aria-label="Expand help window"
          title="Expand"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          type="button"
          data-evan-assist-no-drag
          onClick={close}
          className={CONTROL_CLASSES}
          aria-label="Close Evan help"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const portalTarget = desktopWindow?.document?.body ?? document.body;

  return createPortal(
    <div
      data-evan-assist-overlay
      onPointerDown={startDrag}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      className={`fixed z-[70] pointer-events-auto ${
        isOnDesktop ? 'inset-0' : ''
      } ${isDragging ? 'select-none' : ''}`}
      style={
        isOnDesktop
          ? { width: '100%', height: '100%' }
          : { left: position.x, top: position.y }
      }
    >
      {panel}
    </div>,
    portalTarget
  );
};

export default EvanAssistOverlay;
