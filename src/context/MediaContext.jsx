// src/context/MediaContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';
import {
  getMessages as getMessagesFromFirestore,
  sendMessage as sendMessageToFirestore,
} from '../services/messageService';
import { useAuth } from './AuthContext';

const MediaContext = createContext();

export const MediaProvider = ({ children }) => {
  const { accessToken, activeAvatar, user, currentUser } = useAuth();
  const [isThoughtToImageEnabled, setIsThoughtToImageEnabled] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [messages, setMessages] = useState({});
  const [activeConversation, setActiveConversation] = useState(null); // Track active conversation ID
  const [inputMessage, setInputMessage] = useState('');
  const [sender, setSender] = useState('user');
  const [mediaFiles, setMediaFiles] = useState([]);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const MAX_FILE_SIZE_MB = 1 * 1024 * 1024;

  // ==================== CACHES ====================
  // Avatar Cache: Stores avatar metadata
  const [avatarCache, setAvatarCache] = useState({});
  // Message Cache: Stores messages per avatar (max 50 per avatar)
  const [messageCache, setMessageCache] = useState({});
  const MAX_CACHED_MESSAGES = 50;

  const [dataExchangeTypes, setDataExchangeTypes] = useState({
    text: true,
    voice: true,
    fileUpload: true,
    custom: true,
    neuralText: true,
    neuralImage: true,
    neuralMotion: true,
    blueToothControl: true,
    telepathy: true,
  });

  // ==================== CACHE FUNCTIONS ====================

  /**
   * Add avatar to cache
   */
  const cacheAvatar = (avatar) => {
    setAvatarCache((prev) => ({
      ...prev,
      [avatar.avatar_id]: {
        ...avatar,
        cachedAt: new Date().toISOString(),
      },
    }));
  };

  /**
   * Get avatar from cache
   */
  const getCachedAvatar = (avatarId) => {
    return avatarCache[avatarId] || null;
  };

  /**
   * Add message to cache (maintains rolling window of N messages)
   */
  const cacheMessage = (avatarId, message) => {
    setMessageCache((prev) => {
      const currentMessages = prev[avatarId] || [];
      const updatedMessages = [...currentMessages, message];

      // Keep only last N messages (rolling window)
      const trimmedMessages =
        updatedMessages.length > MAX_CACHED_MESSAGES
          ? updatedMessages.slice(-MAX_CACHED_MESSAGES)
          : updatedMessages;

      return {
        ...prev,
        [avatarId]: trimmedMessages,
      };
    });
  };

  /**
   * Get cached messages for an avatar
   */
  const getCachedMessages = (avatarId) => {
    return messageCache[avatarId] || [];
  };

  /**
   * Clear cache for specific avatar
   */
  const clearAvatarCache = (avatarId) => {
    setMessageCache((prev) => {
      const newCache = { ...prev };
      delete newCache[avatarId];
      return newCache;
    });
  };

  /**
   * Populate message cache from database
   */
  const populateMessageCache = async (avatarId) => {
    try {
      const fetched = await MessageService.getAvatarMessages(
        avatarId,
        accessToken
      );

      // Store in cache
      setMessageCache((prev) => ({
        ...prev,
        [avatarId]: fetched.map((msg) => ({
          _id: msg._id, // Preserve _id for key prop
          id: msg._id, // Also set id for consistency
          content: msg.message,
          media: msg.media || [],
          sender: msg.sender,
          timestamp: msg.timestamp,
        })),
      }));

      return fetched;
    } catch (error) {
      console.error('Failed to populate message cache:', error);
      return [];
    }
  };
  // claude.ai/chat/33ca6b04-fb69-486a-9a0d-0780a444f557 working on removing redis
  const startThoughtToImage = async () => {
    if (!accessToken || !user?.enable_grok_imagine) return;
    setIsThoughtToImageEnabled(true);
  };

  const stopThoughtToImage = () => {
    setIsThoughtToImageEnabled(false);
  };

  // Set active conversation when avatar changes
  useEffect(() => {
    if (activeAvatar) {
      // Use default conversation from avatar, or first conversation
      const conversationId =
        activeAvatar.default_conversation || activeAvatar.conversations?.[0];
      setActiveConversation(conversationId);
    } else {
      setActiveConversation(null);
    }
  }, [activeAvatar]);

  useEffect(() => {
    if (activeAvatar && activeConversation && currentUser) {
      console.log(
        `Loading messages for avatar ${activeAvatar.avatar_id}, conversation ${activeConversation}`
      );

      // Check cache first
      const cacheKey = `${activeAvatar.avatar_id}_${activeConversation}`;
      const cachedMessages = getCachedMessages(cacheKey);

      if (cachedMessages.length > 0) {
        console.log(`Loaded ${cachedMessages.length} messages from cache`);
        // Sort cached messages by timestamp
        const sortedCachedMessages = [...cachedMessages].sort((a, b) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeA - timeB;
        });
        setMessages((prev) => ({
          ...prev,
          [cacheKey]: sortedCachedMessages,
        }));
      } else {
        // Fetch from database if cache is empty
        console.log('Cache empty, fetching from database');
        fetchMessages();
      }
    }
  }, [activeAvatar?.avatar_id, activeConversation, currentUser]);

  const fetchMessages = async () => {
    if (!activeAvatar || !activeConversation || !currentUser) return;
    try {
      // Fetch messages from Firestore using the new structure
      const fetched = await getMessagesFromFirestore(
        currentUser.uid,
        activeAvatar.avatar_id,
        activeConversation,
        1000 // Get up to 1000 messages
      );

      console.log(`Fetched ${fetched?.length || 0} messages from Firestore`);

      const transformedMessages = fetched.map((msg) => ({
        _id: msg._id || msg.message_id,
        id: msg.id || msg._id || msg.message_id,
        content: msg.content || msg.message || '',
        message: msg.message || msg.content || '', // Keep both for compatibility
        media: msg.media || [],
        sender: msg.sender || 'user',
        timestamp: msg.timestamp,
      }));

      const cacheKey = `${activeAvatar.avatar_id}_${activeConversation}`;

      // Cache messages
      setMessageCache((prev) => ({
        ...prev,
        [cacheKey]: transformedMessages,
      }));

      setMessages((prev) => ({
        ...prev,
        [cacheKey]: transformedMessages,
      }));
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };
  // sendMessage - Updated to use Firestore structure
  async function sendMessage() {
    if (
      !activeAvatar ||
      !activeConversation ||
      !currentUser ||
      (!inputMessage.trim() && mediaFiles.length === 0)
    )
      return;

    try {
      const tempId = `temp-${Date.now()}`;
      const loadingId = `loading-${Date.now()}`;
      const cacheKey = `${activeAvatar.avatar_id}_${activeConversation}`;

      // Optimistically add user message to UI
      const tempMessage = {
        id: tempId,
        _id: tempId,
        content: inputMessage,
        message: inputMessage, // Keep both for compatibility
        sender: sender,
        timestamp: new Date().toISOString(),
        media: mediaFiles.map((f) => ({
          filename: f.name,
          content_type: f.type,
        })),
      };

      setMessages((prev) => ({
        ...prev,
        [cacheKey]: [...(prev[cacheKey] || []), tempMessage],
      }));

      // Cache the user message
      cacheMessage(cacheKey, tempMessage);

      // Add loading message for AI response
      const loadingMessage = {
        id: loadingId,
        sender: 'avatar',
        isLoading: true,
      };

      setMessages((prev) => ({
        ...prev,
        [cacheKey]: [...(prev[cacheKey] || []), loadingMessage],
      }));

      // Send to Firestore first
      const firestoreResponse = await sendMessageToFirestore(
        currentUser.uid,
        activeAvatar.avatar_id,
        activeConversation, // conversationId
        inputMessage,
        mediaFiles,
        sender,
        false // Don't wait for AI response here
      );

      // Also send to backend API for AI response
      let aiResponse = null;
      try {
        const backendResponse = await MessageService.saveMessage(
          activeAvatar.avatar_id,
          inputMessage,
          mediaFiles,
          accessToken,
          sender
        );

        if (backendResponse?.ai_response) {
          aiResponse = backendResponse.ai_response;
        }
      } catch (backendError) {
        console.warn(
          'Backend API call failed, continuing without AI response:',
          backendError
        );
      }

      // Remove loading message
      setMessages((prev) => ({
        ...prev,
        [cacheKey]: prev[cacheKey].filter((msg) => msg.id !== loadingId),
      }));

      // Update temp message with real ID from Firestore
      const realMessageId =
        firestoreResponse.user_message.message_id ||
        firestoreResponse.user_message._id;
      setMessages((prev) => ({
        ...prev,
        [cacheKey]: prev[cacheKey].map((msg) =>
          msg.id === tempId
            ? {
                ...msg,
                _id: realMessageId,
                id: realMessageId,
                message_id: realMessageId,
              }
            : msg
        ),
      }));

      // If AI response is included, save it to Firestore and add to UI
      if (aiResponse) {
        // Save AI response to Firestore
        await sendMessageToFirestore(
          currentUser.uid,
          activeAvatar.avatar_id,
          activeConversation, // conversationId
          aiResponse.message || '',
          [],
          'assistant',
          false
        );

        const aiMessage = {
          _id: aiResponse.message_id,
          id: aiResponse.message_id,
          message_id: aiResponse.message_id,
          content: aiResponse.message,
          message: aiResponse.message,
          sender: 'assistant',
          timestamp: aiResponse.timestamp || new Date().toISOString(),
          media: [],
        };

        setMessages((prev) => ({
          ...prev,
          [cacheKey]: [...(prev[cacheKey] || []), aiMessage],
        }));

        // Cache AI response
        cacheMessage(cacheKey, aiMessage);
      }

      // Clear input
      setInputMessage('');
      setMediaFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Failed to send message:', err);

      const cacheKey = `${activeAvatar.avatar_id}_${activeConversation}`;
      // Remove both optimistic message and loading message on error
      setMessages((prev) => ({
        ...prev,
        [cacheKey]: (prev[cacheKey] || []).filter(
          (msg) => msg.id !== tempId && !msg.isLoading
        ),
      }));

      if (err.status === 413) {
        alert('One or more files exceed the maximum upload size of 1 MB.');
      } else {
        alert(err.message || 'Failed to send message');
      }
    }
  }

  const handleFileUpload = (event) => {
    if (!activeAvatar || !dataExchangeTypes.fileUpload) return;
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const validFiles = files.filter((f) => f.size <= MAX_FILE_SIZE_MB);
    if (validFiles.length < files.length) {
      alert('Some files exceed the 1 MB limit and were ignored.');
    }

    setMediaFiles((prev) => [...prev, ...validFiles]);
    event.target.value = '';
  };

  const getMediaUrl = (media_id, accessToken) => {
    console.warn(
      'getMediaUrl: NGROK-based media URLs removed. Use media.url or Firebase Storage download URLs instead.'
    );
    return null;
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files).filter(
      (f) => f.size <= MAX_FILE_SIZE_MB
    );
    setMediaFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <MediaContext.Provider
      value={{
        messages,
        setMessages,
        fetchMessages,
        messagesEndRef,
        inputMessage,
        setInputMessage,
        sendMessage,
        dataExchangeTypes,
        fileInputRef,
        handleFileUpload,
        getMediaUrl,
        mediaFiles,
        setMediaFiles,
        handleFileChange,
        removeFile,
        sender,
        setSender,
      }}
    >
      {children}
    </MediaContext.Provider>
  );
};

export const useMedia = () => useContext(MediaContext);
