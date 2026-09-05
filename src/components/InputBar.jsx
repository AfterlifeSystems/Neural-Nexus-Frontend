import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AudioLines,
  FileAudio,
  Square,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Image as ImageIcon,
  Paperclip,
  Plus,
} from 'lucide-react';
import { useMedia } from '../context/MediaContext';
import { useAuth } from '../context/AuthContext';
import ComposerConnectorsMenu from './connections/ComposerConnectorsMenu';
import { composerHasSendableDraft } from './composerSendState';
import ConversationSuggestions from './ConversationSuggestions';
import Dock from './Dock';
import { HiXMark } from 'react-icons/hi2';
import { describeDocumentKind } from './AvatarDocumentRow';

// How an attachment is drawn in the composer before it is sent. An image shows
// itself; everything else shows what kind of file it is, because a document has
// no thumbnail and an <img> pointed at one renders a broken tile.
const ATTACHMENT_PRESENTATION = {
  image: { Icon: ImageIcon, label: 'Image', tileClassName: 'bg-neutral-500' },
  audio: { Icon: FileAudio, label: 'Audio', tileClassName: 'bg-emerald-500' },
  video: { Icon: FileVideo, label: 'Video', tileClassName: 'bg-rose-500' },
  data: { Icon: FileSpreadsheet, label: 'Data', tileClassName: 'bg-lime-600' },
  text: { Icon: FileText, label: 'Document', tileClassName: 'bg-blue-500' },
  document: { Icon: FileText, label: 'Document', tileClassName: 'bg-blue-500' },
};

/**
 * Say what an attachment is, for the chip that stands in for it.
 *
 * The browser's own media type is trusted first and the filename consulted only
 * when it says nothing useful: a .csv arrives as text/csv from one operating
 * system and application/octet-stream from another, and the extension is the
 * only thing both have in common.
 *
 * @param {File} attachedFile A file waiting in the composer.
 * @returns {{Icon: Function, label: string, tileClassName: string}} How to draw it.
 */
const describeAttachment = (attachedFile) => {
  const mediaType = attachedFile.type || '';
  const kindFromMediaType = mediaType.startsWith('image/')
    ? 'image'
    : mediaType.startsWith('audio/')
      ? 'audio'
      : mediaType.startsWith('video/')
        ? 'video'
        : null;
  const kind =
    kindFromMediaType ?? describeDocumentKind(attachedFile.name) ?? 'document';
  return ATTACHMENT_PRESENTATION[kind] ?? ATTACHMENT_PRESENTATION.document;
};

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
  const [isNarrowViewport, setIsNarrowViewport] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
  );
  useEffect(() => {
    const narrowViewportQuery = window.matchMedia('(max-width: 640px)');
    const updateViewport = (event) => setIsNarrowViewport(event.matches);
    narrowViewportQuery.addEventListener('change', updateViewport);
    return () => narrowViewportQuery.removeEventListener('change', updateViewport);
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
    stopAssistantTurn,
    stoppableTurnCount,
  } = useMedia();
  // While the avatar is answering, the send button is a Stop button. Enter
  // still sends — a second message can be queued behind the reply — but the
  // button's one job during a reply is to end it.
  const isReplyStoppable = (stoppableTurnCount ?? 0) > 0;

  // One object URL per attached image, minted when the attachment list changes
  // and revoked when it changes again. These used to be created inline while
  // rendering, which minted a fresh URL for every image on every keystroke and
  // released none of them.
  // Files still being composed come first, then the files of a turn that is
  // already sent and still running; the two lists are shown as one strip so an
  // attachment never blinks out of existence between pressing send and the
  // reply arriving.
  const composerAttachments = [...mediaFiles, ...(attachmentsInFlight ?? [])];
  const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState([]);
  useEffect(() => {
    const createdUrls = [...mediaFiles, ...(attachmentsInFlight ?? [])].map(
      (attachedFile) =>
        (attachedFile.type || '').startsWith('image/')
          ? URL.createObjectURL(attachedFile)
          : null
    );
    setAttachmentPreviewUrls(createdUrls);
    return () => {
      createdUrls.forEach(
        (objectUrl) => objectUrl && URL.revokeObjectURL(objectUrl)
      );
    };
  }, [mediaFiles, attachmentsInFlight]);

  // Typed text or an attached file is a message. A live webcam or screen
  // share is not: those stay on while talking, so an empty box still offers
  // voice mode.
  const hasSomethingToSend = composerHasSendableDraft(
    inputMessage,
    mediaFiles.length
  );

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

  const submitComposer = () => {
    if (isReplyStoppable) {
      stopAssistantTurn?.();
    } else if (!hasSomethingToSend) {
      onActivateLiveChat?.();
    } else {
      handleSendMessage();
    }
  };

  const composerButtonTitle = isReplyStoppable
    ? 'Stop generating'
    : hasSomethingToSend
      ? 'Send message'
      : 'Talk out loud';
  const composerButtonLabel = isReplyStoppable
    ? 'Stop generating'
    : hasSomethingToSend
      ? 'Send message'
      : 'Enter live mode';
  const emptyComposerControl = (
    <AudioLines className="w-4 h-4 sm:w-5 sm:h-5" />
  );
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
          {composerAttachments.length > 0 && (
            <div className="p-3 border-b border-neutral-700/50">
              <div className="flex gap-3 overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-600">
                {composerAttachments.map((file, index) => {
                  // Anything past the composed files belongs to a turn already
                  // under way: it is shown, but cannot be taken back.
                  const isBeingSent = index >= mediaFiles.length;
                  const imagePreviewUrl = attachmentPreviewUrls[index];
                  const { Icon, label, tileClassName } =
                    describeAttachment(file);
                  return (
                    <div
                      key={`${file.name}-${file.lastModified}-${index}`}
                      className={`relative flex-shrink-0 group ${
                        isBeingSent ? 'opacity-60' : ''
                      }`}
                    >
                      {imagePreviewUrl ? (
                        <>
                          <img
                            src={imagePreviewUrl}
                            alt={file.name}
                            title={file.name}
                            className="h-16 w-16 object-cover rounded-lg border border-neutral-600 group-hover:border-neutral-200 transition-colors"
                          />
                          {isBeingSent && (
                            <span className="absolute inset-x-0 bottom-0 rounded-b-lg bg-black/70 text-[10px] text-center text-neutral-200 py-0.5">
                              Sending…
                            </span>
                          )}
                          {!isBeingSent && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(index)}
                              aria-label={`Remove ${file.name}`}
                              className="absolute top-1 right-1 p-0! w-4 h-4 rounded-full flex items-center justify-center bg-black/70 text-neutral-200 hover:bg-red-500 transition-colors z-20"
                            >
                              <HiXMark className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <div
                          title={file.name}
                          className="h-16 flex items-center gap-2 pl-2 pr-2 rounded-lg border border-neutral-600 bg-black/60 group-hover:border-neutral-200 transition-colors"
                        >
                          <span
                            className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${tileClassName}`}
                          >
                            <Icon size={18} className="text-neutral-200" />
                          </span>
                          <span className="min-w-0">
                            <span className="block max-w-[10rem] truncate text-sm text-neutral-200">
                              {file.name}
                            </span>
                            <span className="block text-xs text-neutral-400">
                              {isBeingSent ? 'Sending…' : label}
                            </span>
                          </span>
                          {!isBeingSent && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(index)}
                              aria-label={`Remove ${file.name}`}
                              className="shrink-0 p-0! w-5 h-5 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-red-500 transition-colors"
                            >
                              <HiXMark className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
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
              data-composer-action={isReplyStoppable ? 'stop' : 'send'}
              className="chat-send ml-auto sm:hidden shrink-0 rounded-lg text-neutral-200 bg-black/60 border border-neutral-700"
            >
              {isReplyStoppable ? (
                <Square className="w-4 h-4 fill-current" />
              ) : hasSomethingToSend ? (
                'Send'
              ) : (
                emptyComposerControl
              )}
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
          data-composer-action={isReplyStoppable ? 'stop' : 'send'}
          className="chat-send hidden sm:flex shrink-0 rounded-xl text-neutral-200 bg-black/60 border border-neutral-700 hover:border-neutral-200 items-center justify-center gap-2 whitespace-nowrap self-stretch"
        >
          {isReplyStoppable ? (
            <>
              <Square className="w-4 h-4 fill-current" />
              Stop
            </>
          ) : hasSomethingToSend ? (
            'Send'
          ) : (
            emptyComposerControl
          )}
        </button>
      </div>
    </div>
  );
};

export default InputBar;
