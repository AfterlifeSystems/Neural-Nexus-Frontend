// src/context/MediaContext.jsx
// Used to subscribe to the firestore message for real-time state of messages;
// calls messageService to send new messages;
// the messages are displayed in the MessageList Component
// flow:
// The Chat Area holds the input bar and the Message list
// the input bar sends a message through the media context
// the media context will call the message service
// the message is displayed in the message list
// the response is displayed in the message list
// all messages for the current conversation are displayed in the message list as per the subscription to the messages collection for the current conversation of the active avatar

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';
import {
  sendMessageService,
  subscribeToMessages,
} from '../services/messageService';
import { useAuth } from './AuthContext';

const MediaContext = createContext();

export const MediaProvider = ({ children }) => {
  const { activeAvatar, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [inputMessage, setInputMessage] = useState('');
  const [role, setRole] = useState('user');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isThoughtToImageEnabled, setIsThoughtToImageEnabled] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const unsubscribeRef = useRef(null); // Store unsubscribe function

  const MAX_FILE_SIZE_MB = 1 * 1024 * 1024;

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

  const startThoughtToImage = async () => {
    if (!user?.enable_grok_imagine) return;
    setIsThoughtToImageEnabled(true);
  };

  const stopThoughtToImage = () => {
    setIsThoughtToImageEnabled(false);
  };

  const startTranscription = () => {
    setIsTranscribing(true);
  };

  const stopTranscription = () => {
    setIsTranscribing(false);
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
      setMessages([]); // Clear messages when no avatar
    }
  }, [activeAvatar]);

  // Subscribe to Firestore messages in real-time
  useEffect(() => {
    // Cleanup previous subscription
    if (unsubscribeRef.current) {
      console.log('Unsubscribing from previous conversation');
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // Clear messages when switching conversations
    setMessages([]);

    // Only subscribe if we have all required data
    if (!activeAvatar?.avatar_id || !activeConversation || !user?.uid) {
      console.log('Missing required data for subscription:', {
        avatarId: activeAvatar?.avatar_id,
        conversationId: activeConversation,
        userId: user?.uid,
      });
      return;
    }

    console.log(
      `Subscribing to messages for avatar ${activeAvatar.avatar_id}, conversation ${activeConversation}`
    );
    console.log('user.id' + user.id);
    // Set up real-time subscription
    try {
      const unsubscribe = subscribeToMessages(
        user.id,
        activeAvatar.avatar_id,
        activeConversation,
        (newMessages) => {
          console.log(
            `Received ${newMessages.length} messages from subscription`
          );

          // Transform messages to use id, role, content format
          const transformedMessages = newMessages.map((msg) => ({
            id: msg.id || msg._id || msg.message_id,
            role: msg.role || msg.role || 'user',
            content: msg.content || msg.message || '',
            timestamp: msg.timestamp,
            media: msg.media || [],
            type: msg.type || 'text',
          }));

          // Sort by timestamp
          const sortedMessages = transformedMessages.sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeA - timeB;
          });

          // Update messages state directly (no cache key)
          setMessages(sortedMessages);
        }
      );

      // Store unsubscribe function
      unsubscribeRef.current = unsubscribe;
      console.log('Successfully subscribed to messages');
    } catch (error) {
      console.error('Failed to subscribe to messages:', error);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (unsubscribeRef.current) {
        console.log('Cleaning up subscription');
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [activeAvatar?.avatar_id, activeConversation, user?.uid]);

  // handleSendMessageMediaContext - Updated to use Firestore structure
  async function handleSendMessageMediaContext() {
    console.log('MediaContext: handleSendMessageMediaContext called');

    if (
      !activeAvatar ||
      !activeConversation ||
      !user ||
      (!inputMessage.trim() && mediaFiles.length === 0)
    ) {
      console.log('Missing required data for sending message');
      return;
    }

    try {
      const tempId = `temp-${Date.now()}`;
      const loadingId = `loading-${Date.now()}`;

      // Optimistically add user message to UI
      const tempMessage = {
        id: tempId,
        content: inputMessage,
        role: role,
        timestamp: new Date().toISOString(),
        media: mediaFiles.map((f) => ({
          filename: f.name,
          content_type: f.type,
        })),
        type: mediaFiles.length > 0 && !inputMessage ? 'media' : 'text',
      };

      setMessages((prev) => [...prev, tempMessage]);

      // Add loading message for AI response
      const loadingMessage = {
        id: loadingId,
        role: 'assistant',
        isLoading: true,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, loadingMessage]);

      // Send to Firestore - this will trigger the subscription to update
      const firestoreResponse = await sendMessageService(
        user.id,
        activeAvatar.avatar_id,
        activeConversation,
        inputMessage,
        mediaFiles,
        role,
        true // Wait for AI response
      );

      console.log('Message sent successfully:', firestoreResponse);

      // Remove loading message after response is received
      // The actual messages will come through the subscription
      // setMessages((prev) => prev.filter((msg) => msg.id !== loadingId));

      // Clear input
      // setInputMessage('');
      // setMediaFiles([]);
      // if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Failed to send message:', err);

      // Remove optimistic and loading messages on error
      setMessages((prev) =>
        prev.filter((msg) => !msg.id?.startsWith('temp-') && !msg.isLoading)
      );

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
        messagesEndRef,
        inputMessage,
        setInputMessage,
        handleSendMessageMediaContext,
        dataExchangeTypes,
        fileInputRef,
        handleFileUpload,
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
      }}
    >
      {children}
    </MediaContext.Provider>
  );
};

export const useMedia = () => useContext(MediaContext);
