import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AudioLines, Paperclip, Plus } from 'lucide-react';
import { useMedia } from '../context/MediaContext';
import { useAuth } from '../context/AuthContext';
import ComposerConnectorsMenu from './connections/ComposerConnectorsMenu';
import ComposerAttachmentStrip from './ComposerAttachmentStrip';
import ComposerSpeechControls from './ComposerSpeechControls';
import { composerHasSendableDraft } from './composerSendState';
import ConversationSuggestions from './ConversationSuggestions';
import Dock from './Dock';
import useComposerSpeech from '../hooks/useComposerSpeech';
const InputBar = ({
  onActivateLiveChat,
  avatarId,
  suggestionsEnabled = true,
}) => {
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const navigate = useNavigate();
  const { activeAvatar } = useAuth();

  // The "+" menu. Connectors live only on the personal avatar: they carry the
  // owner's own credentials, and a shared or secondary avatar reaches none.
  const [isComposerMenuOpen, setIsComposerMenuOpen] = useState(false);
  const isPersonalAvatar = Boolean(
    activeAvatar?.metadata?.is_personal_avatar_of_creator
  );

  // The keyboard hints in the placeholder wrap to three lines on a phone and
  // push the composer up the screen; a phone has no Ctrl key anyway.
  const [isNarrowViewport, setIsNarrowViewport] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 640px)').matches
  );
  useEffect(() => {
    const narrowViewportQuery = window.matchMedia('(max-width: 640px)');
    const updateViewport = (event) => setIsNarrowViewport(event.matches);
    narrowViewportQuery.addEventListener('change', updateViewport);
    return () =>
      narrowViewportQuery.removeEventListener('change', updateViewport);
  }, []);

  // What this person has sent to this avatar, for Ctrl+↑ / Ctrl+↓ recall. Kept
  // in this browser rather than only in memory, so a reload, a rebuild during
  // development, or a remount of the composer does not empty it.
  const sentMessageHistoryStorageKey = `sent_message_history_${avatarId ?? 'default'}`;
  const [messageHistory, setMessageHistory] = useState(() => {
    try {
      const storedHistory = JSON.parse(
        localStorage.getItem(sentMessageHistoryStorageKey) ?? '[]'
      );
      return Array.isArray(storedHistory) ? storedHistory : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(
        sentMessageHistoryStorageKey,
        JSON.stringify(messageHistory.slice(-100))
      );
    } catch {
      // Storage can be unavailable (private mode, quota); recall then lasts
      // only as long as the composer does, which is what it did before.
    }
  }, [messageHistory, sentMessageHistoryStorageKey]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempMessage, setTempMessage] = useState('');
  const [editingCaption, setEditingCaption] = useState(null);
  const [captions, setCaptions] = useState({});
  const [isHovered, setIsHovered] = useState(false);
  const sendInFlightRef = useRef(false);

  const {
    handleSendMessageMediaContext,
    inputMessage,
    setInputMessage,
    mediaFiles,
    setMediaFiles,
    handleFileChange,
    removeFile,
    type,
    setType,
    isTranscribing,
    startTranscription,
    stopTranscription,
    isThoughtToImageEnabled,
    startThoughtToImage,
    stopThoughtToImage,
    dataExchangeTypes,
    attachmentsInFlight,
  } = useMedia();

  // Typed text or an attached file is a message. A live webcam or screen
  // share is not: those stay on while talking, so an empty box still offers
  // voice mode.
  const hasSomethingToSend = composerHasSendableDraft(
    inputMessage,
    mediaFiles.length
  );
  // Text-to-speech only: the draft can be played in the person's voice, but
  // dictation into this box is not offered — talking belongs to voice mode.
  const { canPlayDraft, isPlayLoading, isPlayingDraft, togglePlayDraft } =
    useComposerSpeech({ text: inputMessage });

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === 'ArrowUp' && e.ctrlKey) {
      e.preventDefault();
      navigateHistory('up');
    } else if (e.key === 'ArrowDown' && e.ctrlKey) {
      e.preventDefault();
      navigateHistory('down');
    }
  };

  const navigateHistory = (direction) => {
    if (messageHistory.length === 0) return;
    if (direction === 'up') {
      if (historyIndex === -1) {
        setTempMessage(inputMessage);
        setHistoryIndex(messageHistory.length - 1);
        setInputMessage(messageHistory[messageHistory.length - 1]);
      } else if (historyIndex > 0) {
        setHistoryIndex(historyIndex - 1);
        setInputMessage(messageHistory[historyIndex - 1]);
      }
    } else if (direction === 'down') {
      if (historyIndex === messageHistory.length - 1) {
        setHistoryIndex(-1);
        setInputMessage(tempMessage);
        setTempMessage('');
      } else if (historyIndex > -1) {
        setHistoryIndex(historyIndex + 1);
        setInputMessage(messageHistory[historyIndex + 1]);
      }
    }
  };

  const handleInput = (e) => {
    setInputMessage(e.target.value);
    if (historyIndex !== -1) {
      setHistoryIndex(-1);
      setTempMessage('');
    }
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  };

  const handleSendMessage = () => {
    if (sendInFlightRef.current) return;
    if (!composerHasSendableDraft(inputMessage, mediaFiles.length)) return;
    sendInFlightRef.current = true;
    const outgoingText = inputMessage;
    const outgoingFiles = [...mediaFiles];
    if (
      outgoingText.trim() &&
      (messageHistory.length === 0 ||
        messageHistory[messageHistory.length - 1] !== outgoingText.trim())
    ) {
      setMessageHistory((prev) => [...prev, outgoingText.trim()]);
    }

    setHistoryIndex(-1);
    setTempMessage('');
    setType('user');
    // Clear first so a second Enter cannot resend this turn. A live webcam or
    // screen share never rides along: the share is background context that the
    // ambient loop sends as hidden observations, so the typed message goes out
    // at once carrying only what the person attached, and nothing from the
    // share is painted into the conversation.
    setInputMessage('');
    setMediaFiles([]);
    setCaptions({});
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    try {
      handleSendMessageMediaContext(outgoingText, outgoingFiles);
    } finally {
      sendInFlightRef.current = false;
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || e.dataTransfer?.files || []);
    handleFileChange({ target: { files } });
  };

  const handleRemoveFile = (index) => {
    removeFile(index);
    setCaptions((prev) => {
      const newCaptions = { ...prev };
      delete newCaptions[index];
      const reindexed = {};
      Object.keys(newCaptions).forEach((key) => {
        const keyIndex = parseInt(key);
        if (keyIndex > index) reindexed[keyIndex - 1] = newCaptions[key];
        else reindexed[key] = newCaptions[key];
      });
      return reindexed;
    });
  };

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, [inputMessage]);

  // useEffect(() => {
  //   thoughtToImageService.onReconstructedImage = ({ file }) => {
  //     setMediaFiles((prevFiles) => [...prevFiles, file]);
  //   };
  //   return () => {
  //     thoughtToImageService.onReconstructedImage = null;
  //   };
  // }, [mediaFiles.length]);

  // The button never turns into Stop while the avatar is replying: an empty
  // box must always be able to open voice mode, even mid-reply.
  const submitComposer = () => {
    if (!hasSomethingToSend) {
      onActivateLiveChat?.();
    } else {
      handleSendMessage();
    }
  };

  const composerButtonTitle = hasSomethingToSend
    ? 'Send message'
    : 'Talk out loud';
  const composerButtonLabel = hasSomethingToSend
    ? 'Send message'
    : 'Enter live mode';
  const emptyComposerControl = <AudioLines className="w-4 h-4 sm:w-5 sm:h-5" />;
  return (
    <div
      className="chat-composer w-full max-w-3xl mx-auto min-w-0 rounded-xl flex flex-col"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        handleFileSelect(e);
      }}
    >
      <ConversationSuggestions enabled={suggestionsEnabled} />
      <div className="flex flex-row items-end gap-2 mb-2 min-w-0">
        {/* Input Container */}
        <div className="flex-1 min-w-0 relative border border-neutral-700 rounded-lg bg-black/60 focus-within:border-neutral-300 transition-colors">
          {isPlayingDraft && (
            <div
              className="voice-speak-glow absolute inset-0 z-10 rounded-lg"
              aria-hidden
            />
          )}
          <ComposerAttachmentStrip
            mediaFiles={mediaFiles}
            attachmentsInFlight={attachmentsInFlight}
            onRemove={handleRemoveFile}
          />

          <textarea
            ref={textareaRef}
            data-composer-input
            rows={1}
            style={{ lineHeight: '1.5rem', maxHeight: '9rem' }}
            className="w-full min-w-0 resize-none overflow-y-auto max-h-40 px-3 py-2 text-neutral-200 bg-transparent placeholder-neutral-400 scrollbar-thin scrollbar-thumb-neutral-600 focus:outline-none border-none"
            placeholder={
              isNarrowViewport
                ? 'Type your message…'
                : 'Type your message... (Ctrl+↑ or ↓ for sent message history) (Shift+Enter for Newline)'
            }
            title="Ctrl+↑ or ↓ recalls sent messages. Shift+Enter inserts a newline."
            value={inputMessage}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            spellCheck={false}
          />

          <div className="relative flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 pb-2 min-w-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach a file"
              aria-label="Attach a file"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <ComposerSpeechControls
              showDictation={false}
              canPlayDraft={canPlayDraft}
              isPlayingDraft={isPlayingDraft}
              isPlayLoading={isPlayLoading}
              hasDraft={Boolean(String(inputMessage ?? '').trim())}
              onTogglePlay={togglePlayDraft}
            />
            {isPersonalAvatar && (
              <>
                <button
                  type="button"
                  onClick={() => setIsComposerMenuOpen((previous) => !previous)}
                  title="Connectors"
                  aria-label="Connectors"
                  aria-haspopup="menu"
                  aria-expanded={isComposerMenuOpen}
                  aria-controls="composer-menu"
                  className={`p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${
                    isComposerMenuOpen ? 'bg-white/10 text-neutral-100' : ''
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
                  showConnectors
                  onManageConnectors={() =>
                    navigate(
                      `/chat/${encodeURIComponent(avatarId)}?tab=settings&section=connections`
                    )
                  }
                />
              </>
            )}
            <button
              type="button"
              onClick={submitComposer}
              title={composerButtonTitle}
              aria-label={composerButtonLabel}
              data-composer-action="send"
              className="chat-send ml-auto sm:hidden shrink-0 rounded-lg text-neutral-200 bg-black/60 border border-neutral-700"
            >
              {hasSomethingToSend ? 'Send' : emptyComposerControl}
            </button>
          </div>

          {historyIndex !== -1 && (
            <div className="absolute right-2 top-2 text-xs text-neutral-400 bg-black/50 px-2 py-1 rounded">
              {messageHistory.length - historyIndex}/{messageHistory.length}
            </div>
          )}
        </div>

        {/* Hidden File Input. No `accept` filter: the message endpoint takes
            documents, audio and video as readily as images, and restricting the
            picker to image/* made everything else unattachable. */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={handleFileSelect}
        />

        {/* One button, two jobs: send what has been typed, or — when there is
            nothing to send — switch to talking. The waveform icon is what the
            button already showed in that state; now it does something. */}
        <button
          type="button"
          onClick={submitComposer}
          title={composerButtonTitle}
          aria-label={composerButtonLabel}
          data-composer-action="send"
          className="chat-send hidden sm:flex shrink-0 rounded-xl text-neutral-200 bg-black/60 border border-neutral-700 hover:border-neutral-200 items-center justify-center gap-2 whitespace-nowrap self-stretch"
        >
          {hasSomethingToSend ? 'Send' : emptyComposerControl}
        </button>
      </div>
    </div>
  );
};

export default InputBar;
