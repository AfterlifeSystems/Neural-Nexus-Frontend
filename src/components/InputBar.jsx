import { useRef, useEffect, useState } from 'react';
import {
  AudioLines,
  FileAudio,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Image as ImageIcon,
  Paperclip,
} from 'lucide-react';
import { useMedia } from '../context/MediaContext';
import Dock from './Dock';
import { HiXMark } from 'react-icons/hi2';
import { describeDocumentKind } from './AvatarDocumentRow';

// How an attachment is drawn in the composer before it is sent. An image shows
// itself; everything else shows what kind of file it is, because a document has
// no thumbnail and an <img> pointed at one renders a broken tile.
const ATTACHMENT_PRESENTATION = {
  image: { Icon: ImageIcon, label: 'Image', tileClassName: 'bg-purple-500' },
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
  avatar_id,
  accessToken,
  setShowDataExchangeDropdown,
  showDataExchangeDropdown,
  dropdownRef,
  onActivateLiveChat,
}) => {
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const [messageHistory, setMessageHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempMessage, setTempMessage] = useState('');
  const [editingCaption, setEditingCaption] = useState(null);
  const [captions, setCaptions] = useState({});
  const [isHovered, setIsHovered] = useState(false);

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

  // Files alone are a message worth sending, so the button must offer to send
  // them rather than reading an empty text box and offering live mode instead.
  const hasSomethingToSend =
    inputMessage.trim().length > 0 || mediaFiles.length > 0;

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
    // handle live chat activation
    // if (!inputMessage.trim() && mediaFiles.length === 0) {
    //   if (isLiveChatView && onActivateLiveChat) {
    //     onActivateLiveChat();
    //   }
    //   return;
    // }

    console.log(`handle send message`);
    if (
      inputMessage.trim() &&
      (messageHistory.length === 0 ||
        messageHistory[messageHistory.length - 1] !== inputMessage.trim())
    ) {
      setMessageHistory((prev) => [...prev, inputMessage.trim()]);
    }

    setHistoryIndex(-1);
    setTempMessage('');
    setType('user');
    handleSendMessageMediaContext(mediaFiles, () => {});
    setMediaFiles([]);
    setInputMessage('');
    setCaptions({});
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
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

  return (
    <div
      className="w-full max-w-3xl mx-auto rounded-xl flex flex-col"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        handleFileSelect(e);
      }}
    >
      {/* Input Bar + Send Button on Same Row */}
      <div className="flex flex-row items-center gap-2 flex-col mb-2">
        {/* Input Container */}
        <div className="flex-1 relative border border-gray-700 rounded-lg bg-black/35 focus-within:border-teal-400 transition-colors">
          {composerAttachments.length > 0 && (
            <div className="p-3 border-b border-gray-700/50">
              <div className="flex gap-3 overflow-x-auto scrollbar-thin scrollbar-thumb-teal-400">
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
                            className="h-16 w-16 object-cover rounded-lg border border-gray-600 group-hover:border-teal-400 transition-colors"
                          />
                          {isBeingSent && (
                            <span className="absolute inset-x-0 bottom-0 rounded-b-lg bg-black/70 text-[10px] text-center text-white py-0.5">
                              Sending…
                            </span>
                          )}
                          {!isBeingSent && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(index)}
                              aria-label={`Remove ${file.name}`}
                              className="absolute top-1 right-1 p-0! w-4 h-4 rounded-full flex items-center justify-center bg-black/70 text-white hover:bg-red-500 transition-colors z-20"
                            >
                              <HiXMark className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <div
                          title={file.name}
                          className="h-16 flex items-center gap-2 pl-2 pr-2 rounded-lg border border-gray-600 bg-white/5 group-hover:border-teal-400 transition-colors"
                        >
                          <span
                            className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${tileClassName}`}
                          >
                            <Icon size={18} className="text-white" />
                          </span>
                          <span className="min-w-0">
                            <span className="block max-w-[10rem] truncate text-sm text-white">
                              {file.name}
                            </span>
                            <span className="block text-xs text-gray-400">
                              {isBeingSent ? 'Sending…' : label}
                            </span>
                          </span>
                          {!isBeingSent && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(index)}
                              aria-label={`Remove ${file.name}`}
                              className="shrink-0 p-0! w-5 h-5 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-500 transition-colors"
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
            className="w-full resize-none overflow-y-auto max-h-40 px-4 py-3 text-white bg-transparent placeholder-gray-400 scrollbar-thin scrollbar-thumb-teal-400 focus:outline-none border-none"
            placeholder="Type your message... (Ctrl+↑ or ↓ for sent message history) (Shift+Enter for Newline)"
            value={inputMessage}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            spellCheck={false}
          />

          {/* The picker below has always been here, hidden, with nothing to
              open it — so images and documents could only be attached by
              dragging them onto the composer. This is that same input, finally
              given a control, matching the paperclip in the Streamlit app. */}
          <div className="flex items-center px-3 pb-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach images or documents"
              aria-label="Attach images or documents"
              className="p-1.5 rounded-lg text-gray-400 hover:text-teal-300 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
            >
              <Paperclip className="w-5 h-5" />
            </button>
          </div>

          {historyIndex !== -1 && (
            <div className="absolute right-2 top-2 text-xs text-teal-400 bg-black/50 px-2 py-1 rounded">
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
          onClick={() => {
            if (!hasSomethingToSend) {
              onActivateLiveChat?.();
            } else {
              handleSendMessage();
            }
          }}
          title={hasSomethingToSend ? 'Send message' : 'Talk out loud'}
          aria-label={hasSomethingToSend ? 'Send message' : 'Enter live mode'}
          className="transition-transform duration-300 hover:scale-105 px-6 rounded-xl text-white bg-black/35 border border-gray-700 hover:border-teal-400 flex items-center justify-center gap-2 whitespace-nowrap self-stretch"
        >
          {hasSomethingToSend ? (
            'Send'
          ) : (
            <>
              <AudioLines className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default InputBar;
