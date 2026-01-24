import { useRef, useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { AudioLines } from 'lucide-react';
import { useMedia } from '../context/MediaContext';
import Dock from './Dock';
import { HiXMark } from 'react-icons/hi2';
import thoughtToImageService from '../services/ThoughtToImageService';

const InputBar = ({
  avatar_id,
  accessToken,
  setShowDataExchangeDropdown,
  showDataExchangeDropdown,
  dropdownRef,
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
    role,
    setRole,
    isTranscribing,
    startTranscription,
    stopTranscription,
    isThoughtToImageEnabled,
    startThoughtToImage,
    stopThoughtToImage,
    dataExchangeTypes,
  } = useMedia();

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

    if (
      inputMessage.trim() &&
      (messageHistory.length === 0 ||
        messageHistory[messageHistory.length - 1] !== inputMessage.trim())
    ) {
      setMessageHistory((prev) => [...prev, inputMessage.trim()]);
    }

    setHistoryIndex(-1);
    setTempMessage('');
    setRole('user');
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

  useEffect(() => {
    thoughtToImageService.onReconstructedImage = ({ file }) => {
      setMediaFiles((prevFiles) => [...prevFiles, file]);
    };
    return () => {
      thoughtToImageService.onReconstructedImage = null;
    };
  }, [mediaFiles.length]);

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
          {mediaFiles.length > 0 && (
            <div className="p-3 border-b border-gray-700/50">
              <div className="flex gap-3 overflow-x-auto scrollbar-thin scrollbar-thumb-teal-400">
                {mediaFiles.map((file, index) => (
                  <div key={index} className="relative flex-shrink-0 group">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`preview-${index}`}
                      className="h-16 w-16 object-cover rounded-lg border border-gray-600 group-hover:border-teal-400 transition-colors"
                    />
                    <HiXMark
                      onClick={() => handleRemoveFile(index)}
                      className="absolute -top-0 -right-1 bg-red-900 hover:bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center transition-colors z-20 cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            rows={1}
            style={{ lineHeight: '1.5rem', maxHeight: '9rem' }}
            className="w-full resize-none overflow-y-auto max-h-40 px-4 py-3 text-white bg-transparent placeholder-gray-400 scrollbar-thin scrollbar-thumb-teal-400 focus:outline-none border-none"
            placeholder="Type your message... (Ctrl+↑ or ↓ for sent message history)"
            value={inputMessage}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            spellCheck={false}
          />

          {historyIndex !== -1 && (
            <div className="absolute right-2 top-2 text-xs text-teal-400 bg-black/50 px-2 py-1 rounded">
              {messageHistory.length - historyIndex}/{messageHistory.length}
            </div>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleFileSelect}
        />

        {/* Send Button */}
        <button
          onClick={() => {
            if (!inputMessage.trim() && mediaFiles.length === 0) {
              // enable live-chat
            } else {
              handleSendMessage();
            }
          }}
          className="transition-transform duration-300 hover:scale-105 px-6 rounded-xl text-white bg-black/35 border border-gray-700 hover:border-teal-400 flex items-center justify-center gap-2 whitespace-nowrap self-stretch"
        >
          {inputMessage.trim().length > 0 ? (
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
