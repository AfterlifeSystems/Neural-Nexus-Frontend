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
  const { activeAvatar, user, context, setContext } = useAuth();

  const [messages, setMessages] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversationList, setConversationList] = useState([]);

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

  // Get the list of avatar conversations for the current user and avatar

  // useEffect(async () => {
  //   if (activeAvatar && user) {
  //     activeAvatarConversations()
  //   }
  // });

  async function getConversationList(user, activeAvatar) {
    const thread_search_response = await fetch(
      `${import.meta.env.VITE_LANGGRAPH_API_SERVER_URL}/threads/search`,
      {
        method: 'POST',
        headers: {
          Accept: '*/*',
        },
        body: JSON.stringify({
          metadata: {
            user_id: user.id,
            assistant_id: activeAvatar.avatar_id,
          },
          limit: 10,
          offset: 0,
          sort_by: 'created_at',
          sort_order: 'desc',
        }),
      }
    );

    const thread_search_response_json = await thread_search_response.json();

    console.log(`${JSON.stringify(thread_search_response_json)}`);
    setConversationList(thread_search_response_json);
    return thread_search_response_json;
  }

  async function switchActiveConveration(activeAvatar, thread_id) {
    // update the active_conversation on the activeAvatar TODO: update in database
    activeAvatar.active_conversation = thread_id;
    if (activeAvatar.active_conversation) {
      let active_conversation = activeAvatar.active_conversation;
    } else {
      active_conversation = conversationList[0];
      console.log(`active_conversation: ${active_conversation}`);
    }

    setActiveConversation(active_conversation);
    return active_conversation;
  }

  async function getActiveConversationMessages(user, activeAvatar) {
    let active_conversation = activeAvatar.metadata.active_conversation;
    if (!active_conversation) {
      if (conversationList) {
        active_conversation = conversationList[0];
      } else {
        console.log(
          `error no activeAvatar.metadata.active_conversation; no conversationList`
        );
      }
    }

    const thread_get_response = await fetch(
      `${import.meta.env.VITE_LANGGRAPH_API_SERVER_URL}/threads/${active_conversation}`,
      {
        headers: {
          Accept: '*/*',
        },
      }
    );

    const thread_get_response_json = await thread_get_response.json();

    console.log(`thread_get_response_json: ${thread_get_response_json}`);
    if (thread_get_response_json['values'] != null) {
      let response_messages = thread_get_response_json['values']['messages'];
      console.log(response_messages);
      setMessages(response_messages);
    } else {
      setMessages([]);
    }

    // return response_messages;
  }

  async function sendMessageAwaitResponseUpdateMessages(
    user,
    activeAvatar,
    thread_id,
    message_content
  ) {
    let input = { messages: [{ role: 'user' }, { content: message_content }] };
    let url = `${import.meta.env.VITE_LANGGRAPH_API_SERVER_URL}`;
    let api_key = `${import.meta.env.VITE_LANGGRAPH_API_SERVER_KEY}`;

    console.log(`context: ${context}`);

    const thread_run_await_response = await fetch(
      `${url}/threads/${thread_id}/runs/wait`,
      {
        method: 'POST',
        headers: {
          'x-api-header': api_key,
        },
        body: JSON.stringify({
          assistant_id: activeAvatar.metadata.assistant_id,
          input: input,
          metadata: {
            user_id: user.id,
            assistant_id: activeAvatar.metadata.assistant_id,
            thread_id: thread_id,
            context: context,
          },
        }),
      }
    );

    const thread_run_await_response_json =
      await thread_run_await_response.json();

    console.log(
      `thread_run_await_response_json: ${thread_run_await_response_json}`
    );

    response_message = thread_run_await_response_json['values']['messages'][-1];

    // Transform messages to use id, role, content format
    // const transformedMessages = newMessages.map((msg) => ({
    //   id: msg.id || msg._id || msg.message_id,
    //   role: msg.role || msg.role || 'user',
    //   content: msg.content || msg.message || '',
    //   timestamp: msg.timestamp,
    //   media: msg.media || [],
    //   type: msg.type || 'text',
    // }));
    return response_message;
  }

  // handleSendMessageMediaContext
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
        role: 'ai',
        isLoading: true,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, loadingMessage]);

      const response_message = await sendMessageAwaitResponseUpdateMessages(
        user,
        activeAvatar,
        activeAvatar.metadata.active_conversation,
        inputMessage
      );

      console.log(`response message: ${response_message}`);

      // update the response message
      const responseMessage = {
        id: 'TEMP-ID-XXXXXXXXXXXXXXXXXXXXXXXX',
        role: 'ai',
        isLoading: true,
        timestamp: new Date().toISOString(),
        content: response_message['content'],
      };

      // filter the loading message
      setMessages((prev) => prev.filter((msg) => !msg.isLoading));

      // insert the new message response
      setMessages((prev) => [...prev, responseMessage]);
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
        getConversationList,
        getActiveConversationMessages,
        switchActiveConveration,
        sendMessageAwaitResponseUpdateMessages,
        setActiveConversation,
        activeConversation,
      }}
    >
      {children}
    </MediaContext.Provider>
  );
};

export const useMedia = () => useContext(MediaContext);
