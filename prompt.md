<!-- Avatar messaging -->
This is my localhost query endpoint; I need to send messages from the react frontend chat area, persist the messages in the firestore (media persists in storage), hit a local messaging api endpoint, receive the response and store the response in the firestore messages, and display the message response in the chat area (update with the new response).

http://localhost:8090/docs#/default/query_query_post

{"openapi":"3.1.0","info":{"title":"Neural Nexus Messaging API","description":"API for AI messaging with LoRA context support","version":"1.0.0"},"paths":{"/health":{"get":{"summary":"Health Check","description":"Health check endpoint.","operationId":"health_check_health_get","responses":{"200":{"description":"Successful Response","content":{"application/json":{"schema":{"$ref":"#/components/schemas/HealthResponse"}}}}}}},"/query":{"post":{"summary":"Query","description":"Unified query endpoint supporting multiple input modes:\n\n1. Text only: Provide user_input without image\n2. Image only: Provide image without user_input (or empty string)\n3. Image + text: Provide both user_input and image\n\nAdditional features:\n- If avatar_id is provided: attempts to use adapter\n- If use_context=True: retrieves context from vectorstore\n- Works gracefully even if features are unavailable\n\nExamples:\n    Text only:\n        curl -X POST -F \"user_input=What is AI?\" -F \"user_id=123\"\n    \n    Image only:\n        curl -X POST -F \"user_id=123\" -F \"image=@photo.jpg\"\n    \n    Image + text:\n        curl -X POST -F \"user_input=What's in this image?\" -F \"user_id=123\" -F \"image=@photo.jpg\"","operationId":"query_query_post","requestBody":{"content":{"multipart/form-data":{"schema":{"$ref":"#/components/schemas/Body_query_query_post"}}},"required":true},"responses":{"200":{"description":"Successful Response","content":{"application/json":{"schema":{"$ref":"#/components/schemas/QueryResponse"}}}},"422":{"description":"Validation Error","content":{"application/json":{"schema":{"$ref":"#/components/schemas/HTTPValidationError"}}}}}}}},"components":{"schemas":{"Body_query_query_post":{"properties":{"user_input":{"anyOf":[{"type":"string"},{"type":"null"}],"title":"User Input"},"user_id":{"type":"string","title":"User Id"},"avatar_id":{"anyOf":[{"type":"string"},{"type":"null"}],"title":"Avatar Id"},"use_context":{"type":"boolean","title":"Use Context","default":false},"max_new_tokens":{"type":"integer","title":"Max New Tokens","default":150},"image":{"anyOf":[{"type":"string","format":"binary"},{"type":"null"}],"title":"Image"}},"type":"object","required":["user_id"],"title":"Body_query_query_post"},"HTTPValidationError":{"properties":{"detail":{"items":{"$ref":"#/components/schemas/ValidationError"},"type":"array","title":"Detail"}},"type":"object","title":"HTTPValidationError"},"HealthResponse":{"properties":{"status":{"type":"string","title":"Status"},"device":{"type":"string","title":"Device"},"model_loaded":{"type":"boolean","title":"Model Loaded"}},"type":"object","required":["status","device","model_loaded"],"title":"HealthResponse"},"QueryResponse":{"properties":{"response":{"type":"string","title":"Response"},"context_used":{"type":"boolean","title":"Context Used"},"device":{"type":"string","title":"Device"},"model_type":{"type":"string","title":"Model Type"},"user_id":{"type":"string","title":"User Id"},"avatar_id":{"anyOf":[{"type":"string"},{"type":"null"}],"title":"Avatar Id"},"vectorstore_url":{"anyOf":[{"type":"string"},{"type":"null"}],"title":"Vectorstore Url"},"error":{"anyOf":[{"type":"string"},{"type":"null"}],"title":"Error"}},"type":"object","required":["response","context_used","device","model_type","user_id"],"title":"QueryResponse"},"ValidationError":{"properties":{"loc":{"items":{"anyOf":[{"type":"string"},{"type":"integer"}]},"type":"array","title":"Location"},"msg":{"type":"string","title":"Message"},"type":{"type":"string","title":"Error Type"}},"type":"object","required":["loc","msg","type"],"title":"ValidationError"}}}}


-------------------------

// src/components/ChatArea.jsx

import React, { useEffect } from 'react';
import { User, AudioLines } from 'lucide-react';
import LiveTranscriptionTicker from './LiveTranscriptionTicker';
import MessageList from './MessageList';
import InputBar from './InputBar';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import AvatarSettings from './AvatarSettings';
import AvatarSelectionComponent from './AvatarSelectionComponent';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
const ChatArea = ({
  showDataExchangeDropdown,
  setShowDataExchangeDropdown,
  dropdownRef,
  onActivateLiveChat,
  setShowCreateModal,
  onEndLiveChat,
  className,
}) => {
  const { isLoggedIn, accessToken, activeAvatar, setActiveAvatar } = useAuth();
  const { messages, setMessages, fetchMessages, messagesEndRef } = useMedia();
  const { avatarId } = useParams(); // from /chat/:avatarId
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('chat');
  // const { messages, fetchMessages, messagesEndRef } = useMedia();

  // Load messages when avatarId changes
  useEffect(() => {
    if (avatarId) {
      fetchMessages(avatarId);
    }
  }, [avatarId, fetchMessages]);

  // Send message handler (passed to InputBar)
  const handleSendMessage = (text) => {
    if (!avatarId || !text.trim()) return;
    sendMessage(avatarId, text); // Sends to correct avatar's conversation
  };

  // Simple tab switcher (no setActiveTab prop needed)
  const handleTabChange = (tab) => {
    if (tab === 'avatar-selection') {
      navigate('/avatars'); // Go back to selection screen
    } else if (tab === 'avatar-settings') {
      setActiveTab('avatar-settings');
    } else if (tab === 'chat') {
      setActiveTab('chat');
    } else {
      // Just update local tab state or do nothing (keep single chat view)
      console.log('Tab changed to:', tab);
    }
  };

  return (
    <div
      className={`flex flex-row flex-grow w-full h-full bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden relative ${className}`}
    >
      {/* Background Image or User Icon - only show when not logged in or no active avatar */}
      <>
        {/* {activeAvatar?.icon ? (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${activeAvatar.icon})`,
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <User className="w-64 h-64 text-gray-400 opacity-20" />
          </div>
        )} */}
        {/* Overlay for better contrast */}
        {/* <div className="absolute inset-0 bg-black/30" /> */}
      </>

      {/* Main Chat Section */}
      <div className="flex flex-col flex-grow p-2 sm:p-4 relative z-10">
        {/* Tabs */}
        {
          <div className="flex justify-center mb-2 border-b border-white/20 gap-4">
            <button
              className={`px-4 py-2 ${
                activeTab === 'chat'
                  ? 'border-b-2 border-white font-semibold'
                  : ''
              } text-white`}
              onClick={() => handleTabChange('chat')}
            >
              {activeAvatar?.name
                ? `A.I. ${activeAvatar.name} Chat`
                : 'A.I. Chat'}
            </button>
            <button
              className={`px-4 py-2 ${
                activeTab === 'avatar-settings'
                  ? 'border-b-2 border-white font-semibold'
                  : ''
              } text-white`}
              onClick={() => handleTabChange('avatar-settings')}
            >
              Avatar Settings
            </button>
            <button
              className={`px-4 py-2 ${
                activeTab === 'avatar-selection'
                  ? 'border-b-2 border-white font-semibold'
                  : ''
              } text-white`}
              onClick={() => navigate('/avatars')}
            >
              Avatar Selection
            </button>
          </div>
        }

        {activeTab === 'chat' && (
          <div className="flex flex-col flex-grow overflow-hidden">
            <div className="flex-grow overflow-y-auto p-2 sm:p-4 relative">
              <MessageList
                messages={messages[activeAvatar.avatar_id] || []}
                messagesEndRef={messagesEndRef}
              />
            </div>

            <div className="flex-shrink-0 items-center mt-2">
              <InputBar
                avatarId={activeAvatar.avatar_id}
                accessToken={accessToken}
                dropdownRef={dropdownRef}
                isLiveChatView={false}
                onActivateLiveChat={onActivateLiveChat}
              />
            </div>
          </div>
        )}

        {activeTab === 'avatar-settings' && (
          <div className="flex flex-col flex-grow p-2 sm:p-4 relative overflow-y-auto">
            <AvatarSettings
              avatarId={activeAvatar.avatar_id}
              accessToken={accessToken}
              onAvatarDeleted={() => {
                // Switch to avatar selection tab after deletion
                setActiveTab('avatar-selection');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
export default ChatArea;
----------------_

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
  isLiveChatView = false,
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
    sendMessage,
    inputMessage,
    setInputMessage,
    mediaFiles,
    setMediaFiles,
    handleFileChange,
    removeFile,
    sender,
    setSender,
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
    if (!inputMessage.trim() && mediaFiles.length === 0) {
      if (isLiveChatView && onActivateLiveChat) {
        onActivateLiveChat();
      }
      return;
    }

    if (
      inputMessage.trim() &&
      (messageHistory.length === 0 ||
        messageHistory[messageHistory.length - 1] !== inputMessage.trim())
    ) {
      setMessageHistory((prev) => [...prev, inputMessage.trim()]);
    }

    setHistoryIndex(-1);
    setTempMessage('');
    setSender('user');
    sendMessage(mediaFiles, () => {});
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
              if (onActivateLiveChat) onActivateLiveChat();
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
----------------

// services/MessageService — NGROK HTTP API removed; Firestore-backed functions below will be used

// Legacy HTTP-based functions removed (no external NGROK endpoints)

// NOTE: Use the Firestore implementations below: sendMessage, getMessages, subscribeToMessages

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Send a message to a conversation
 * @param {string} userId - User ID
 * @param {string} avatarId - Avatar ID
 * @param {string} conversationId - Conversation ID (if not provided, uses default)
 * @param {string} message - Message text (optional if mediaFiles provided)
 * @param {File[]} mediaFiles - Media files (optional)
 * @param {string} sender - Sender type ('user' or 'assistant')
 * @param {boolean} waitForResponse - Whether to wait for AI response
 */
export const sendMessage = async (
  userId,
  avatarId,
  conversationId = null,
  message = '',
  mediaFiles = [],
  sender = 'user',
  waitForResponse = true
) => {
  // Get conversation ID (use default if not provided)
  let finalConversationId = conversationId;
  if (!finalConversationId) {
    const avatarRef = doc(db, 'avatars', avatarId);
    const avatarDoc = await getDoc(avatarRef);
    if (!avatarDoc.exists()) {
      throw new Error('Digital twin not found');
    }
    const avatarData = avatarDoc.data();
    finalConversationId =
      avatarData.default_conversation || avatarData.conversations?.[0];
    if (!finalConversationId) {
      throw new Error('No conversation found for digital twin');
    }
  }

  const messageId = uuidv4();
  const timestamp = new Date();

  // Upload media files and store structured metadata
  const mediaItems = [];
  for (const file of mediaFiles) {
    const mediaId = uuidv4();
    const mediaRef = ref(
      storage,
      `users/${userId}/avatars/${avatarId}/conversations/${finalConversationId}/messages/${messageId}/${file.name}`
    );
    await uploadBytes(mediaRef, file);
    const downloadURL = await getDownloadURL(mediaRef);

    mediaItems.push({
      id: mediaId,
      type: file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('audio/')
        ? 'audio'
        : 'file',
      url: downloadURL,
      storagePath: mediaRef.fullPath,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      uploaded_at: new Date().toISOString(),
    });
  }

  // Determine message type
  const messageType = mediaFiles.length > 0 && !message ? 'media' : 'text';

  // Save user message in the conversation's messages subcollection using canonical fields
  const messageRef = await addDoc(
    collection(
      db,
      'avatars',
      avatarId,
      'conversations',
      finalConversationId,
      'messages'
    ),
    {
      message_id: messageId,
      conversation_id: finalConversationId,
      avatar_id: avatarId,
      user_id: userId,
      role: sender, // 'user' or 'assistant'
      content: message || null,
      timestamp: timestamp,
      type: messageType,
      media: mediaItems,
    }
  );

  // Update conversation's updated_at timestamp
  const conversationRef = doc(
    db,
    'avatars',
    avatarId,
    'conversations',
    finalConversationId
  );
  await updateDoc(conversationRef, {
    updated_at: timestamp,
  });

  const userMessage = {
    message_id: messageId,
    _id: messageId,
    id: messageId,
    timestamp: timestamp.toISOString(),
    content: message || null,
    message: message || null, // legacy compatibility
    role: sender,
    sender: sender,
    media: mediaItems,
    type: messageType,
  };

  if (waitForResponse) {
    // TODO: Call your messaging API (Cloud Run) here
    // Example:
    // const aiResponse = await callMessagingAPI(userId, avatarId, message);
    // Save AI response to Firestore
    // Return both messages

    return {
      status: 'success',
      user_message: userMessage,
      ai_response: null, // Replace with actual AI response
    };
  }

  return {
    status: 'success',
    user_message: userMessage,
    ai_response: null,
  };
};

/**
 * Get messages from a specific conversation
 * @param {string} userId - User ID
 * @param {string} avatarId - Avatar ID
 * @param {string} conversationId - Conversation ID (if not provided, uses default)
 * @param {number} maxMessages - Maximum number of messages to retrieve
 */
export const getMessages = async (
  userId,
  avatarId,
  conversationId = null,
  maxMessages = 50
) => {
  // Get conversation ID (use default if not provided)
  let finalConversationId = conversationId;
  if (!finalConversationId) {
    const avatarRef = doc(db, 'avatars', avatarId);
    const avatarDoc = await getDoc(avatarRef);
    if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
      throw new Error('Digital twin not found or unauthorized');
    }
    const avatarData = avatarDoc.data();
    finalConversationId =
      avatarData.default_conversation || avatarData.conversations?.[0];
    if (!finalConversationId) {
      throw new Error('No conversation found for digital twin');
    }
  }

  const messagesQuery = query(
    collection(
      db,
      'avatars',
      avatarId,
      'conversations',
      finalConversationId,
      'messages'
    ),
    orderBy('timestamp', 'asc'),
    firestoreLimit(maxMessages)
  );

  const snapshot = await getDocs(messagesQuery);
  const messages = [];

  for (const docSnapshot of snapshot.docs) {
    const data = docSnapshot.data();
    const mediaUrls = await Promise.all(
      (data.media || []).map(async (media) => {
        const storagePath = media.storagePath || media.storage_path || null;
        if (storagePath) {
          try {
            return await getDownloadURL(ref(storage, storagePath));
          } catch (error) {
            console.error('Error getting media URL:', error);
            return media.url || null;
          }
        }
        return media.url || null;
      })
    );

    messages.push({
      _id: docSnapshot.id,
      id: docSnapshot.id,
      message_id: data.message_id || docSnapshot.id,
      type: data.type || 'text',
      content: data.content || data.message || '',
      message: data.content || data.message || '', // Keep both for compatibility
      timestamp:
        (data.timestamp?.toDate && data.timestamp.toDate().toISOString()) ||
        data.timestamp ||
        new Date().toISOString(),
      sender: data.role || data.sender || 'user',
      media: mediaUrls
        .map((url, idx) => ({
          ...(data.media[idx] || {}),
          url,
        }))
        .filter((media) => media.url),
    });
  }

  return messages;
};

/**
 * Subscribe to messages in real-time for a conversation
 * @param {string} avatarId - Avatar ID
 * @param {string} conversationId - Conversation ID
 * @param {Function} callback - Callback function for new messages
 * @returns {Function} Unsubscribe function
 */
export const subscribeToMessages = (avatarId, conversationId, callback) => {
  const messagesQuery = query(
    collection(
      db,
      'avatars',
      avatarId,
      'conversations',
      conversationId,
      'messages'
    ),
    orderBy('timestamp', 'asc')
  );

  // Return unsubscribe function
  return onSnapshot(messagesQuery, (snapshot) => {
    const messages = snapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data();
      return {
        _id: docSnapshot.id,
        id: docSnapshot.id,
        message_id: data.message_id || docSnapshot.id,
        content: data.content || data.message || '',
        message: data.content || data.message || '', // Keep both for compatibility
        sender: data.role || data.sender || 'user',
        timestamp:
          (data.timestamp?.toDate && data.timestamp.toDate().toISOString()) ||
          data.timestamp ||
          new Date().toISOString(),
        media: data.media || [],
        type: data.type || 'text',
      };
    });
    callback(messages);
  });
};


----------------------__


import React, { useState, useEffect, useRef } from 'react';
import { User, Mic, MicOff, CircleX } from 'lucide-react';

const LiveChat = ({ avatarIcon, onEndLiveChat, onSendVoice }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [toasts, setToasts] = useState([]);
  const mediaRecorderRef = useRef(null);

  // Add a toast message
  const addToast = (message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000); // disappear after 3s
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    mediaRecorderRef.current.start();
    setIsRecording(true);
    mediaRecorderRef.current.ondataavailable = (event) => {
      onSendVoice(event.data);
      // Example: simulate avatar response after sending voice
      addToast('Avatar is thinking...');
      setTimeout(() => {
        addToast('Hello, this is the avatar speaking!');
        setIsAvatarSpeaking(true);
        setTimeout(() => setIsAvatarSpeaking(false), 2000);
      }, 1000);
    };
    mediaRecorderRef.current.onstop = () => {
      setIsRecording(false);
    };
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  // Push-to-talk using spacebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') startRecording();
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') stopRecording();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-end h-full w-full overflow-hidden">
      {/* Background Image or User Icon - Large circular image like loginCard but bigger */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/5">
        {avatarIcon ? (
          // Desktop: Large circular image (4x loginCard size), Mobile: full background
          <div className="hidden md:flex w-80 h-80 bg-white/20 rounded-full items-center justify-center">
            <img
              src={avatarIcon}
              alt="Avatar Icon"
              className="w-80 h-80 object-cover rounded-full"
              onError={(e) => {
                console.error('Avatar image load failed:', e.target.src);
                e.target.style.display = 'none';
              }}
            />
          </div>
        ) : (
          // Fallback User icon - larger circular container
          <div className="w-80 h-80 bg-white/10 rounded-full flex items-center justify-center border-4 border-white/20">
            <User className="w-40 h-40 text-gray-400 opacity-20" />
          </div>
        )}

        {/* Mobile: Full background image */}
        {avatarIcon && (
          <div
            className="md:hidden absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${avatarIcon})`,
            }}
          />
        )}
      </div>

      {/* Overlay for better contrast - lighter on desktop to show the circumscribed image better */}
      <div className="absolute inset-0 bg-black/30 md:bg-black/20" />

      {/* Toast container */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex flex-col gap-2 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="px-4 py-2 bg-black/70 text-white rounded-lg shadow-lg animate-slide-down backdrop-blur-sm"
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Speaking indicator overlay - circumscribed on desktop */}
      {isAvatarSpeaking && (
        <div className="absolute inset-0 border-4 border-green-500 animate-pulse  z-10" />
      )}

      {/* Recording indicator overlay - circumscribed on desktop */}
      {isRecording && (
        <div className="absolute inset-0 border-4 border-blue-500 animate-pulse  z-10" />
      )}

      {/* Control buttons at bottom */}
      <div className="relative z-20 flex gap-4 mb-8">
        {/* Microphone button - shows mic when not recording, mic-off when recording */}
        <button
          className={`p-4 rounded-full transition-all duration-300 backdrop-blur-sm ${
            isRecording
              ? 'bg-red-500/80 hover:bg-red-600/80 text-white'
              : 'bg-blue-500/80 hover:bg-blue-600/80 text-white'
          }`}
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
        >
          {isRecording ? (
            <MicOff className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </button>
        {/* End button with CircleX icon */}
        <button
          className="p-4 rounded-full bg-gray-500/80 hover:bg-red-600/80 text-white transition-all duration-300 backdrop-blur-sm"
          onClick={onEndLiveChat}
        >
          <CircleX className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default LiveChat;
-----------------------
// services/avatar_Service.jsx
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { v4 as uuidv4 } from 'uuid';
import { getAuth } from 'firebase/auth';

export const createAvatar = async (name, description, iconFile) => {
  const user = getAuth().currentUser;
  if (!user) throw new Error('No authenticated user');

  const userId = user.uid;
  const avatarId = uuidv4();
  const conversationId = uuidv4(); // Create default conversation ID

  console.log(
    'XXXXXXXXXXXXXXXXXXXXXXXXXX USER XXXXXXXXXXXXXXXXXXXXXXXXXXX AVATAR_SERVICE'
  );
  console.log(user);
  // Create directory structure in Storage (using .keep files)
  const directories = [
    `users/${userId}/.keep`,
    `users/${userId}/avatars/${avatarId}/adapters/.keep`,
    `users/${userId}/avatars/${avatarId}/adapters/training_data/.keep`,
  ];

  for (const dirPath of directories) {
    try {
      const dirRef = ref(storage, dirPath);
      await uploadBytes(dirRef, new Blob([''], { type: 'text/plain' }));
    } catch (error) {
      console.warn(`Failed to create directory ${dirPath}:`, error);
    }
  }

  // Generate download URLs
  const qloraAdapterUrl = await getDownloadURL(
    ref(storage, `users/${userId}/avatars/${avatarId}/adapters/.keep`)
  );
  const qloraTrainingUrl = await getDownloadURL(
    ref(
      storage,
      `users/${userId}/avatars/${avatarId}/adapters/training_data/.keep`
    )
  );
  // Store as a Digital Twin document following firestore_structure.md
  const avatarData = {
    avatar_id: avatarId,
    user_id: user.uid,
    name: name,
    description: (description || '').trim(),
    created_at: new Date().toISOString(),
    icon: null, // will be an object {url, storagePath, name, size, type}
    reference_audio: null,
    files: [],
    system_prompt_reference_image_description: '',
    system_prompt_reference_audio_description: '',
    system_prompt_description: '',
    default_conversation: conversationId,
    conversations: [conversationId],
    qloraAdapterUrl: qloraAdapterUrl,
    qloraTrainingUrl: qloraTrainingUrl,
  };

  // Upload icon if provided and store metadata + URL
  if (iconFile) {
    if (iconFile.size > 4 * 1024 * 1024) {
      throw new Error('Icon exceeds 4 MB limit');
    }
    const iconRef = ref(
      storage,
      `users/${userId}/avatars/${avatarId}/icon/${uuidv4()}_${iconFile.name}`
    );
    await uploadBytes(iconRef, iconFile);
    const iconUrl = await getDownloadURL(iconRef);
    avatarData.icon = {
      url: iconUrl,
      storagePath: iconRef.fullPath,
      name: iconFile.name,
      size: iconFile.size,
      type: iconFile.type,
    };
  }
  // Create default conversation document (store summary and counts)
  const conversationRef = doc(
    db,
    'avatars',
    avatarId,
    'conversations',
    conversationId
  );
  await setDoc(conversationRef, {
    conversation_id: conversationId,
    summary: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    message_count: 0,
  });

  // Create avatar (digital twin) document with avatarId as document ID
  const avatarRef = doc(db, 'avatars', avatarId);
  await setDoc(avatarRef, avatarData);

  // Update user's avatars list
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  const avatars = userDoc.data().avatars || [];
  await updateDoc(userRef, {
    avatars: [...avatars, avatarId],
    last_used_avatar: avatarId,
  });

  return {
    avatarData,
  };
};

export const getAvatars = async (userId, limitCount = 50, skip = 0) => {
  const avatarsQuery = query(
    collection(db, 'avatars'),
    where('user_id', '==', userId),
    orderBy('created_at', 'asc')
  );

  const snapshot = await getDocs(avatarsQuery);
  const avatars = [];

  for (const docSnapshot of snapshot.docs.slice(skip, skip + limitCount)) {
    const data = docSnapshot.data();
    let iconUrl = null;

    if (data.icon) {
      try {
        const storagePath = data.icon.storagePath || data.icon;
        if (storagePath) {
          iconUrl = await getDownloadURL(ref(storage, storagePath));
        } else if (data.icon.url) {
          iconUrl = data.icon.url;
        }
      } catch (error) {
        console.error('Error getting icon URL:', error);
      }
    }

    avatars.push({
      avatar_id: docSnapshot.id,
      name: data.name,
      description: data.description,
      icon: iconUrl,
    });
  }

  return avatars;
};

export const updateAvatar = async (userId, avatarId, updates) => {
  const avatarRef = doc(db, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Digital twin not found or unauthorized');
  }

  const updateData = {
    updated_at: new Date().toISOString(),
    ...updates,
  };

  // If updating icon path/object, normalize to object shape
  if (updateData.icon && typeof updateData.icon === 'string') {
    // assume it's a storage path string; try to resolve URL
    try {
      const url = await getDownloadURL(ref(storage, updateData.icon));
      updateData.icon = {
        url,
        storagePath: updateData.icon,
      };
    } catch (e) {
      // leave as-is
    }
  }

  await updateDoc(avatarRef, updateData);

  // If icon was updated, return the new URL
  if (updateData.icon) {
    return { icon_url: updateData.icon.url || null };
  }

  return {};
};

export const updateAvatarWithIcon = async (
  userId,
  avatarId,
  name,
  description,
  iconFile
) => {
  const avatarRef = doc(db, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Digital twin not found or unauthorized');
  }

  const updates = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) {
    updates.name = name.trim();
  }
  if (description !== undefined) {
    updates.description = (description || '').trim();
  }

  let iconUrl = null;
  if (iconFile) {
    if (iconFile.size > 4 * 1024 * 1024) {
      throw new Error('Icon exceeds 4 MB limit');
    }

    // Delete old icon if exists (support object or string)
    const oldIcon = avatarDoc.data().icon;
    const oldStoragePath =
      oldIcon?.storagePath || (typeof oldIcon === 'string' ? oldIcon : null);
    if (oldStoragePath) {
      try {
        await deleteObject(ref(storage, oldStoragePath));
      } catch (error) {
        console.warn('Failed to delete old icon:', error);
      }
    }

    // Upload new icon and store as object
    const iconRef = ref(
      storage,
      `users/${userId}/avatars/${avatarId}/icon/${uuidv4()}_${iconFile.name}`
    );
    await uploadBytes(iconRef, iconFile);
    const url = await getDownloadURL(iconRef);
    updates.icon = {
      url,
      storagePath: iconRef.fullPath,
      name: iconFile.name,
      size: iconFile.size,
      type: iconFile.type,
    };
    iconUrl = url;
  }

  await updateDoc(avatarRef, updates);

  return {
    status: 'success',
    avatar_id: avatarId,
    updated_fields: Object.keys(updates),
    icon_url: iconUrl,
  };
};

export const deleteAvatar = async (userId, avatarId) => {
  const avatarRef = doc(db, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  // Delete all files in Storage
  const avatarStorageRef = ref(storage, `users/${userId}/avatars/${avatarId}`);
  try {
    const files = await listAll(avatarStorageRef);
    await Promise.all(files.items.map((file) => deleteObject(file)));
  } catch (error) {
    console.warn('Error deleting avatar files:', error);
  }

  // Delete avatar document
  await deleteDoc(avatarRef);

  // Remove from user's avatar list
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  const avatars = userDoc.data().avatars || [];
  await updateDoc(userRef, {
    avatars: avatars.filter((id) => id !== avatarId),
  });

  return {
    status: 'success',
    avatar_id: avatarId,
    deleted: true,
  };
};

export const selectAvatar = async (userId, avatarId) => {
  userId = getAuth().currentUser.id;
  const avatarRef = doc(db, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const avatarData = avatarDoc.data();

  // Update last_used_avatar
  await updateDoc(doc(db, 'users', userId), {
    last_used_avatar: avatarId,
  });

  // Get default conversation ID (or first conversation)
  const defaultConversationId = avatarData.default_conversation;

  // Get messages from the default conversation
  const messagesQuery = query(
    collection(
      db,
      `avatars/${avatarId}/conversations/${defaultConversationId}/messages`
    ),
    orderBy('timestamp', 'asc'),
    limit(50)
  );

  const messagesSnapshot = await getDocs(messagesQuery);
  const messages = messagesSnapshot.docs.map((doc) => ({
    _id: doc.id,
    ...doc.data(),
    timestamp:
      doc.data().timestamp?.toDate().toISOString() || new Date().toISOString(),
  }));

  return {};
};

// Conversation management functions

/**
 * Create a new conversation for an avatar
 */
export const createConversation = async (
  userId,
  avatarId,
  title = 'New Conversation'
) => {
  const avatarRef = doc(db, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const conversationId = uuidv4();
  const conversationRef = doc(
    db,
    `avatars/${avatarId}/conversations`,
    conversationId
  );

  await setDoc(conversationRef, {
    conversation_id: conversationId,
    avatar_id: avatarId,
    user_id: userId,
    title: title.trim(),
    created_at: new Date(),
    updated_at: new Date(),
    is_default: false,
  });

  // Update avatar's conversations list
  const avatarData = avatarDoc.data();
  const conversations = avatarData.conversations || [];
  await updateDoc(avatarRef, {
    conversations: [...conversations, conversationId],
    updated_at: new Date(),
  });

  return {
    conversation_id: conversationId,
    title,
    created_at: new Date().toISOString(),
  };
};

/**
 * Get all conversations for an avatar
 */
export const getConversations = async (userId, avatarId) => {
  const avatarRef = doc(db, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const conversationsQuery = query(
    collection(db, `avatars/${avatarId}/conversations`),
    orderBy('updated_at', 'desc')
  );

  const snapshot = await getDocs(conversationsQuery);
  return snapshot.docs.map((doc) => ({
    conversation_id: doc.id,
    ...doc.data(),
    created_at: doc.data().created_at?.toDate().toISOString(),
    updated_at: doc.data().updated_at?.toDate().toISOString(),
  }));
};

/**
 * Get a specific conversation
 */
export const getConversation = async (userId, avatarId, conversationId) => {
  const avatarRef = doc(db, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const conversationRef = doc(
    db,
    `avatars/${avatarId}/conversations`,
    conversationId
  );
  const conversationDoc = await getDoc(conversationRef);

  if (!conversationDoc.exists()) {
    throw new Error('Conversation not found');
  }

  return {
    conversation_id: conversationId,
    ...conversationDoc.data(),
    created_at: conversationDoc.data().created_at?.toDate().toISOString(),
    updated_at: conversationDoc.data().updated_at?.toDate().toISOString(),
  };
};

/**
 * Update conversation title
 */
export const updateConversation = async (
  userId,
  avatarId,
  conversationId,
  updates
) => {
  const avatarRef = doc(db, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const conversationRef = doc(
    db,
    `avatars/${avatarId}/conversations`,
    conversationId
  );

  await updateDoc(conversationRef, {
    ...updates,
    updated_at: new Date(),
  });

  return { status: 'success', conversation_id: conversationId };
};

/**
 * Delete a conversation (but ensure at least one remains)
 */
export const deleteConversation = async (userId, avatarId, conversationId) => {
  const avatarRef = doc(db, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const avatarData = avatarDoc.data();
  const conversations = avatarData.conversations || [];

  // Ensure at least one conversation remains
  if (conversations.length <= 1) {
    throw new Error(
      'Cannot delete the last conversation. Each avatar must have at least one conversation.'
    );
  }

  // Delete conversation document (this will also delete all messages in subcollection)
  const conversationRef = doc(
    db,
    `avatars/${avatarId}/conversations`,
    conversationId
  );
  await deleteDoc(conversationRef);

  // Update avatar's conversations list
  const updatedConversations = conversations.filter(
    (id) => id !== conversationId
  );
  const updateData = {
    conversations: updatedConversations,
    updated_at: new Date(),
  };

  // If deleted conversation was default, set first remaining as default
  if (avatarData.default_conversation === conversationId) {
    updateData.default_conversation = updatedConversations[0];
  }

  await updateDoc(avatarRef, updateData);

  return { status: 'success', conversation_id: conversationId };
};
----------------------
import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  updatePassword as firebaseUpdatePassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';

import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  query,
  collection,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db, storage } from '../firebase/config.js';
import { getUserProfile } from '../services/userService';

import {
  getAvatars,
  createAvatar,
  deleteAvatar,
  selectAvatar,
} from '../services/avatar_Service.jsx';

import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { signup, login, logout } from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userAvatars, setUserAvatars] = useState([]);
  const [sharedAvatars, setSharedAvatars] = useState([]);
  const [proprietaryAvatars, setProprietaryAvatars] = useState([]);
  const [activeAvatar, setActiveAvatar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null); // Firebase ID token for backend API

  // verify connection to firebase auth emulator
  useEffect(() => {
    if (auth.config) {
      console.log('Full Auth Config:', auth.config);
      // Look for a property called 'emulatorConfig' in the object tree
    }
  }, []);

  // Inside your AuthContext.jsx Live Update Avatars
  useEffect(() => {
    if (!user) {
      setUserAvatars([]);
      return;
    }

    // 1. Define the Query
    const q = query(
      collection(db, 'avatars'),
      where('user_id', '==', user.uid),
      orderBy('created_at', 'asc')
    );

    // 2. Establish the Listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedAvatars = snapshot.docs.map((doc) => ({
          avatar_id: doc.id,
          ...doc.data(),
        }));

        // This updates the global state automatically when
        // an avatar is added, deleted, or edited!
        setUserAvatars(fetchedAvatars);
        console.log(
          'XXXXXXXXXXXXXXXXXXX ON AVATAR TRIGGER XXXXXXXXXXXXXXXXXXXX'
        );
      },
      (error) => {
        console.error('Snapshot listener error:', error);
      }
    );

    // 3. CLEANUP: This is critical for memory management
    return () => unsubscribe();
  }, [user]);

  // Inside your AuthContext.jsx
  const [userProfile, setUserProfile] = useState(null);

  // Live Update Users
  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }

    // 1. Reference the specific User Document
    const userDocRef = doc(db, 'users', user.uid);

    // 2. Establish the Document Listener
    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();

          // Update global user profile state
          setUserProfile(data);
          console.log(
            'XXXXXXXXXXXXXXXXXXX ON USER TRIGGER XXXXXXXXXXXXXXXXXXXX'
          );

          // OPTIONAL: Sync specific logic, like updating localStorage
          // with the most recent last_used_avatar
          if (data.last_used_avatar) {
            localStorage.setItem('last_used_avatar_id', data.last_used_avatar);
          }
        } else {
          console.warn('User profile document does not exist.');
        }
      },
      (error) => {
        console.error('User profile snapshot error:', error);
      }
    );

    // 3. Cleanup listener on unmount
    return () => unsubscribe();
  }, [user]);

  // Listen to Firebase auth state changes

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log(
        'XXXXXXXXXXXXXXXXXXX ON AUTH STATE TRIGGER XXXXXXXXXXXXXXXXXXXX'
      );
      if (firebaseUser) {
        setUser(firebaseUser); // This triggers the onSnapshot useEffects!
        try {
          const token = await firebaseUser.getIdToken(
            /* foreceRefresh = */ true
          );
          setAccessToken(token);
        } catch (err) {
          console.error('Failed to get fresh ID token', err);
          setAccessToken(null);
        }
      } else {
        setUser(null);
        setAccessToken(null);
      }
      setLoading(false); // Move this here to ensure it only flips once
    });

    return unsubscribeAuth;
  }, []);

  // useEffect(() => {
  //   const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
  //     console.log(
  //       'XXXXXXXXXXXXXXXXXXX ON AUTH STATE TRIGGER XXXXXXXXXXXXXXXXXXXX'
  //     );
  //     if (firebaseUser) {
  //       console.log(firebaseUser);
  //       setUser(firebaseUser);

  //       try {
  //         // Debug: ensure uid and token are available
  //         console.log('Auth state changed for uid:', firebaseUser.uid);

  //         // Get Firebase ID token for backend API calls
  //         // Firebase automatically refreshes tokens when needed
  //         let token;
  //         try {
  //           token = await firebaseUser.getIdToken();
  //           setAccessToken(token);
  //           localStorage.setItem('access_token', token);
  //         } catch (tokenErr) {
  //           console.error('Error obtaining ID token:', tokenErr);
  //         }

  //         // Get Firestore user profile (returns null if missing)
  //         let profile = null;
  //         try {
  //           profile = await getUserProfile(firebaseUser.uid);
  //         } catch (err) {
  //           console.error('Error fetching user profile:', err);
  //           if (
  //             err.message &&
  //             err.message.includes('Insufficient Firestore permissions')
  //           ) {
  //             toast.error(
  //               'Firestore permissions error: please check rules and project configuration.'
  //             );
  //           } else {
  //             throw err;
  //           }
  //         }

  //         // localStorage.setItem('user', user);

  //         // Store user data in localStorage
  //         // localStorage.setItem('user', JSON.stringify(profile));
  //         // localStorage.setItem('firebase_user_id', firebaseUser.uid);

  //         // Load userAvatars from Firestore
  //         const loadedAvatars = await loadAvatars(firebaseUser.uid);

  //         // Set active avatar if user has last_used_avatar
  //         if (profile.last_used_avatar && loadedAvatars.length > 0) {
  //           const lastUsed = loadedAvatars.find(
  //             (a) => a.avatar_id === profile.last_used_avatar
  //           );
  //           if (lastUsed) {
  //             setActiveAvatar(lastUsed);
  //           }
  //         }
  //       } catch (error) {
  //         console.error('Error loading user profile:', error);
  //         setUser(null);
  //         setAccessToken(null);
  //       }
  //     } else {
  //       // User signed out
  //       setUser(null);
  //       setUserAvatars([]);
  //       setSharedAvatars([]);
  //       setProprietaryAvatars([]);
  //       setActiveAvatar(null);
  //       setAccessToken(null);
  //       localStorage.removeItem('user');
  //     }

  //     setLoading(false);
  //   });

  //   return () => unsubscribeAuth();
  // }, []);

  // Load userAvatars from Firestore
  const loadAvatars = async (userId) => {
    try {
      const fetchedAvatars = await getAvatars(userId);
      setUserAvatars(fetchedAvatars);
      localStorage.setItem('userAvatars', JSON.stringify(fetchedAvatars));
      return fetchedAvatars;
    } catch (error) {
      console.error('Error loading userAvatars:', error);
      return [];
    }
  };

  // const resendVerification = async (email) => {
  //   try {
  //     // Firebase doesn't have a direct resend verification for email
  //     // We need to get the current user and resend
  //     if (auth.currentUser && auth.currentUser.email === email) {
  //       await sendEmailVerification(auth.currentUser);
  //       toast.success(
  //         (t) => (
  //           <div className="relative flex flex-col gap-2 p-4">
  //             <div className="flex justify-between items-start">
  //               <p className="pr-4">Verification email sent!</p>
  //               <button
  //                 onClick={() => toast.dismiss(t.id)}
  //                 className="p-1 bg-red-600 hover:bg-red-500 rounded text-sm"
  //               >
  //                 <X size={16} />
  //               </button>
  //             </div>
  //           </div>
  //         ),
  //         { duration: Infinity }
  //       );
  //     } else {
  //       throw new Error('Please log in first to resend verification email');
  //     }
  //   } catch (error) {
  //     console.error('Resend verification error:', error);
  //     toast.error(
  //       (t) => (
  //         <div className="relative flex flex-col gap-2 p-4">
  //           <div className="flex justify-between items-start">
  //             <p className="pr-4">
  //               {error.message || 'Failed to send verification email'}
  //             </p>
  //             <button
  //               onClick={() => toast.dismiss(t.id)}
  //               className="p-1 bg-red-600 hover:bg-red-500 rounded text-sm"
  //             >
  //               <X size={16} />
  //             </button>
  //           </div>
  //         </div>
  //       ),
  //       { duration: Infinity }
  //     );
  //     throw error;
  //   }
  // };

  // const forgotPassword = async (email) => {
  //   try {
  //     await sendPasswordResetEmail(auth, email, {
  //       url: `${window.location.origin}/auth/reset-password`,
  //     });
  //     // Don't show toast here - let AuthComponent handle it
  //   } catch (error) {
  //     console.error('Forgot password error:', error);
  //     throw error;
  //   }
  // };

  // const updatePassword = async (newPassword) => {
  //   try {
  //     if (!auth.currentUser) {
  //       throw new Error('No user logged in');
  //     }
  //     await firebaseUpdatePassword(auth.currentUser, newPassword);
  //     toast.success('Password updated successfully!');
  //   } catch (error) {
  //     console.error('Update password error:', error);
  //     throw error;
  //   }
  // };

  // // Social login with Google
  // const signInWithProvider = async (provider) => {
  //   try {
  //     if (provider === 'google') {
  //       const googleProvider = new GoogleAuthProvider();
  //       // Use redirect for better UX
  //       await signInWithRedirect(auth, googleProvider);
  //     } else {
  //       throw new Error(`Provider ${provider} is not supported`);
  //     }
  //   } catch (error) {
  //     console.error(`${provider} login error:`, error);
  //     toast.error(`${provider} login failed`);
  //     throw error;
  //   }
  // };

  // const getAvatars = async () => {
  //   if (!currentUser) return;

  //   try {
  //     const fetchedAvatars = await loadAvatars(currentUser.uid);
  //     return fetchedAvatars;
  //   } catch (error) {
  //     console.error('Get userAvatars error:', error);
  //     return [];
  //   }
  // };

  // const createAvatar = async ({ name, description = '', iconFile = null }) => {
  //   if (!currentUser) {
  //     throw new Error('User must be logged in to create avatar');
  //   }

  //   try {
  //     const created = await createAvatarInFirestore(
  //       currentUser.uid,
  //       name,
  //       description,
  //       iconFile
  //     );

  //     // Reload userAvatars and wait for state update
  //     const fetchedAvatars = await loadAvatars(currentUser.uid);

  //     // Find the created avatar in the fetched list (should be there)
  //     const createdAvatar =
  //       fetchedAvatars.find((a) => a.avatar_id === created.avatar_id) ||
  //       created; // Fallback to created object if not found

  //     // Set as active avatar
  //     setActiveAvatar(createdAvatar);

  //     // Update Firestore to mark as last_used_avatar
  //     await updateDoc(doc(db, 'users', currentUser.uid), {
  //       last_used_avatar: created.avatar_id,
  //       avatars: [...(user?.avatars || []), created.avatar_id],
  //     });

  //     // Update local user state
  //     if (user) {
  //       const updatedUser = {
  //         ...user,
  //         last_used_avatar: created.avatar_id,
  //         avatars: [...(user.avatars || []), created.avatar_id],
  //       };
  //       setUser(updatedUser);
  //       localStorage.setItem('user', JSON.stringify(updatedUser));
  //     }

  //     return created;
  //   } catch (error) {
  //     console.error('Create avatar failed:', error);
  //     throw error;
  //   }
  // };

  // const deleteAvatar = async (avatarId) => {
  //   if (!currentUser) return;

  //   try {
  //     await deleteAvatarFromFirestore(currentUser.uid, avatarId);
  //     await loadAvatars(currentUser.uid);

  //     if (activeAvatar?.avatar_id === avatarId) {
  //       setActiveAvatar(null);
  //     }
  //   } catch (error) {
  //     console.error('Delete avatar failed:', error);
  //     throw error;
  //   }
  // };

  // const selectAvatar = async (avatarId) => {
  //   if (!currentUser) return;

  //   try {
  //     const response = await selectAvatarInFirestore(currentUser.uid, avatarId);

  //     if (response.status === 'success') {
  //       const selectedAvatar = userAvatars.find((a) => a.avatar_id === avatarId);
  //       if (selectedAvatar) {
  //         setActiveAvatar(selectedAvatar);
  //       }

  //       // Update user profile
  //       await updateDoc(doc(db, 'users', currentUser.uid), {
  //         last_used_avatar: avatarId,
  //       });

  //       // Update local user state
  //       if (user) {
  //         const updatedUser = { ...user, last_used_avatar: avatarId };
  //         setUser(updatedUser);
  //         setUserProfile(updatedUser);
  //         localStorage.setItem('user', JSON.stringify(updatedUser));
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Select avatar failed:', error);
  //     throw error;
  //   }
  // };

  // const updateActiveAvatarField = (field, value) => {
  //   setActiveAvatar((prev) => ({
  //     ...prev,
  //     [field]: value,
  //   }));
  // };

  // // Handle OAuth redirect result
  // useEffect(() => {
  //   getRedirectResult(auth)
  //     .then((result) => {
  //       if (result) {
  //         // User signed in via redirect
  //         // toast.success('Login successful!');
  //       }
  //     })
  //     .catch((error) => {
  //       console.error('OAuth redirect error:', error);
  //       toast.error('Authentication failed');
  //     });
  // }, []);

  // if (loading) {
  //   return <div>Loading...</div>;
  // }

  return (
    <AuthContext.Provider
      value={{
        // User state
        accessToken, // Firebase ID token for backend API calls
        setAccessToken,
        user,
        setUser,
        userAvatars,
        setUserAvatars,
        sharedAvatars,
        setSharedAvatars,
        proprietaryAvatars,
        setProprietaryAvatars,
        activeAvatar,
        setActiveAvatar,
        loading,
        setLoading,
        // Auth methods
        // login,
        // signup,
        // logout,
        // resendVerification,
        // forgotPassword,
        // updatePassword,
        // signInWithProvider,

        // Avatar methods
        // getAvatars,
        // createAvatar,
        // deleteAvatar,
        // selectAvatar,
        // updateActiveAvatarField,

        // Firebase instances (for advanced use)
        firebaseAuth: auth,
        firestore: db,
        firebaseStorage: storage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
------------------
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: react-vite-dev
    ports:
      - "5173:5173"
    volumes:
      - ./:/app:cached
      - /app/node_modules
    env_file:
      - .env.development
    environment:
      - CHOKIDAR_USEPOLLING=true
      - CHOKIDAR_INTERVAL=100
      # Connect to emulator service in docker network
      - FIRESTORE_EMULATOR_HOST=firebase-emulator:8070
      - FIREBASE_AUTH_EMULATOR_HOST=firebase-emulator:9099
      - FIREBASE_STORAGE_EMULATOR_HOST=firebase-emulator:9199  # ✅ Add this
    depends_on:
      - firebase-emulator
    stdin_open: true
    tty: true
    restart: unless-stopped
    command: ["npm", "run", "dev", "--", "--host"]
    networks:
      - neural-nexus-network

  firebase-emulator:
    image: andreysenov/firebase-tools:latest
    container_name: firebase-emulator
    ports:
      - "4000:4000"   # Emulator UI
      - "8070:8070"   # Firestore
      - "9099:9099"   # Auth
      - "9000:9000"   # Realtime DB
      - "9199:9199"   # Storage
      - "5001:5001"   # Functions
    volumes:
      - ./:/firebase:cached
    working_dir: /firebase
    command: >
      sh -c "firebase emulators:start --project neuralnexus-467517 --only firestore,auth,database,storage,functions"
    networks:
      - neural-nexus-network
    restart: unless-stopped

networks:
  neural-nexus-network:
    driver: bridge

-------------------------

VITE_FIREBASE_API_KEY=AIzaSyDqgvPAVnqZxlK_HVxke80huIm78-OEDv0
VITE_FIREBASE_AUTH_DOMAIN=neuralnexus-467517.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=neuralnexus-467517
VITE_FIREBASE_STORAGE_BUCKET=neuralnexus-467517.firebasestorage.app

VITE_FIREBASE_MESSAGING_SENDER_ID=915579649879
VITE_FIREBASE_APP_ID=1:915579649879:web:70a78270d904da8bd14812
VITE_FIREBASE_MEASUREMENT_ID=G-GC0GRR5B32
VITE_USE_FIREBASE_EMULATOR=false


--------------

