// src/context/MediaContext.jsx
//
// Conversation state and the message-sending path, over the Neural Nexus API.
// Flow:
//   The ChatArea holds the InputBar and the MessageList.
//   The InputBar sends a message through this context.
//   This context POSTs to /message/{assistant_id} with stream=true and grows
//   the assistant message token-by-token as server-sent events arrive.
//   The MessageList renders the messages array on every update.

import React, {
  createContext,
  useContext,
  useState,
  useRef,
} from 'react';

import { useAuth } from './AuthContext';

import { toast } from 'react-hot-toast';
import { requestJson, streamServerSentEvents } from '../services/neuralNexusApiClient';

const MediaContext = createContext();

/**
 * The API's assistant records carry `assistant_id`, while older parts of this
 * frontend passed around `avatar_id` or nested the id under `metadata`. This
 * resolves whichever shape an avatar object arrives in.
 *
 * @param {Object} avatar An avatar/assistant record.
 * @returns {string|undefined} The assistant identifier.
 */
function resolveAssistantId(avatar) {
  return (
    avatar?.assistant_id ?? avatar?.avatar_id ?? avatar?.metadata?.assistant_id
  );
}

export const MediaProvider = ({ children }) => {
  const { activeAvatar, user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversationList, setConversationList] = useState([]);
  // Set when the graph pauses for human approval (an `interrupt` frame). A
  // future approval interface resumes via POST /message/{assistant_id}/resume.
  const [pendingInterrupt, setPendingInterrupt] = useState(null);

  const [inputMessage, setInputMessage] = useState('');

  const [type, setType] = useState('user');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isThoughtToImageEnabled, setIsThoughtToImageEnabled] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024;

  const [dataExchangeTypes] = useState({
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

  /**
   * Load every conversation thread for this user + avatar, newest first.
   * GET /conversations
   *
   * @param {Object} _user Unused; kept for the existing call signature.
   * @param {Object} avatarForConversations The avatar whose threads to list.
   * @returns {Promise<Array>} Thread records.
   */
  async function getConversationList(_user, avatarForConversations) {
    const threads = await requestJson('/conversations', {
      query: { assistant_id: resolveAssistantId(avatarForConversations) },
    });
    const threadList = Array.isArray(threads) ? threads : [];
    setConversationList(threadList);
    return threadList;
  }

  /**
   * Make a thread the active conversation.
   *
   * @param {Object} _avatarForConversation Unused; kept for the existing call signature.
   * @param {string} threadId The thread to activate.
   * @returns {Promise<string>} The activated thread identifier.
   */
  async function switchActiveConveration(_avatarForConversation, threadId) {
    setActiveConversation(threadId);
    return threadId;
  }

  /**
   * Load the message history of the active conversation into state.
   * GET /conversations/{thread_id}/messages
   *
   * @param {Object} _user Unused; kept for the existing call signature.
   * @param {Object} avatarForMessages The avatar the thread belongs to.
   * @param {string} [threadId] Thread to load; defaults to the active conversation.
   */
  async function getActiveConversationMessages(_user, avatarForMessages, threadId) {
    const conversationThreadId =
      threadId ??
      activeConversation ??
      avatarForMessages?.metadata?.active_conversation ??
      conversationList[0]?.thread_id;

    if (!conversationThreadId) {
      setMessages([]);
      return;
    }

    const messagesResponse = await requestJson(
      `/conversations/${encodeURIComponent(conversationThreadId)}/messages`,
      { query: { assistant_id: resolveAssistantId(avatarForMessages) } }
    );
    setMessages(messagesResponse?.messages ?? []);
  }

  /**
   * Send one message and stream the reply into the messages array.
   * POST /message/{assistant_id} with stream=true.
   *
   * The server-sent event sequence is: an optional `usage_estimate` frame,
   * `assistant_token` frames that each carry a text fragment, and a terminal
   * `done` frame with the authoritative full content and the thread_id (the
   * server creates the thread when none is passed) — or an `interrupt` frame
   * when the graph pauses for human approval.
   *
   * @param {Object} _user Unused; kept for the existing call signature.
   * @param {Object} avatarForMessage The avatar to message.
   * @param {string} threadId Thread to continue, or null to start a new one.
   * @param {string} messageContent The user's message text.
   * @param {File[]} [attachedFiles] Files to attach to this turn.
   */
  async function sendMessageAwaitResponseUpdateMessages(
    _user,
    avatarForMessage,
    threadId,
    messageContent,
    attachedFiles = []
  ) {
    const assistantId = resolveAssistantId(avatarForMessage);
    const streamingMessageId = `streaming-${Date.now()}`;

    const formData = new FormData();
    formData.append('message', messageContent);
    formData.append('stream', 'true');
    if (threadId) {
      formData.append('thread_id', threadId);
    }
    for (const attachedFile of attachedFiles) {
      formData.append('files', attachedFile);
    }
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (userTimezone) {
      formData.append('user_timezone', userTimezone);
    }

    // The assistant message that the token stream grows. isLoading drives the
    // MessageList's typing indicator until the first token lands.
    setMessages((previousMessages) => [
      ...previousMessages,
      {
        id: streamingMessageId,
        type: 'ai',
        content: '',
        isLoading: true,
        timestamp: new Date().toISOString(),
      },
    ]);

    const appendTokenToStreamingMessage = (tokenText) => {
      setMessages((previousMessages) =>
        previousMessages.map((message) =>
          message.id === streamingMessageId
            ? {
                ...message,
                isLoading: false,
                content: message.content + tokenText,
              }
            : message
        )
      );
    };

    let terminalFrame = null;

    await streamServerSentEvents(
      `/message/${encodeURIComponent(assistantId)}`,
      {
        method: 'POST',
        formData,
        onEvent: (streamEvent) => {
          if (streamEvent.type === 'assistant_token') {
            appendTokenToStreamingMessage(streamEvent.text ?? '');
          } else if (
            streamEvent.type === 'done' ||
            streamEvent.type === 'interrupt'
          ) {
            terminalFrame = streamEvent;
          }
          // `usage_estimate` and `keep_alive` frames need no rendering today.
        },
      }
    );

    if (terminalFrame?.type === 'interrupt') {
      setPendingInterrupt({
        threadId: terminalFrame.thread_id,
        assistantId,
        interrupt: terminalFrame.interrupt,
      });
    }

    if (terminalFrame?.type === 'done') {
      // Adopt the authoritative content and metadata from the terminal frame;
      // the token stream is a preview, `done.content` is the record.
      setMessages((previousMessages) =>
        previousMessages.map((message) =>
          message.id === streamingMessageId
            ? {
                ...message,
                isLoading: false,
                content: terminalFrame.content ?? message.content,
                usage: terminalFrame.usage,
              }
            : message
        )
      );
      if (terminalFrame.thread_id) {
        setActiveConversation(terminalFrame.thread_id);
      }
    } else if (!terminalFrame) {
      // The stream ended without a terminal frame — surface whatever tokens
      // arrived, but warn, because the reply may be truncated.
      setMessages((previousMessages) =>
        previousMessages.map((message) =>
          message.id === streamingMessageId
            ? { ...message, isLoading: false }
            : message
        )
      );
      toast.error('The response stream ended unexpectedly.');
    }

    return { success: terminalFrame != null };
  }

  async function handleSendMessageMediaContext() {
    if (
      !activeAvatar ||
      (!inputMessage.trim() && mediaFiles.length === 0)
    ) {
      console.log('Missing required data for sending message');
      return;
    }

    const messageContent = inputMessage;
    const attachedFiles = mediaFiles;
    const temporaryUserMessageId = `temp-${Date.now()}`;

    try {
      // Optimistically render the user's message immediately.
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          id: temporaryUserMessageId,
          content: messageContent,
          type: 'human',
          timestamp: new Date().toISOString(),
          media: attachedFiles.map((attachedFile) => ({
            filename: attachedFile.name,
            content_type: attachedFile.type,
          })),
          content_type:
            attachedFiles.length > 0 && !messageContent ? 'media' : 'text',
        },
      ]);
      setInputMessage('');
      setMediaFiles([]);

      await sendMessageAwaitResponseUpdateMessages(
        user,
        activeAvatar,
        activeConversation,
        messageContent,
        attachedFiles
      );
    } catch (sendError) {
      console.error('Failed to send message:', sendError);

      // Remove the optimistic user message and any unfinished assistant
      // message so the failed turn leaves no half-rendered artifacts.
      setMessages((previousMessages) =>
        previousMessages.filter(
          (message) =>
            message.id !== temporaryUserMessageId &&
            !message.id?.startsWith('streaming-')
        )
      );

      if (sendError.status === 413) {
        toast.error('One or more files exceed the maximum upload size of 1 MB.');
      } else {
        toast.error(sendError.message || 'Failed to send message');
      }
    }
  }

  const handleFileUpload = (event) => {
    if (!activeAvatar || !dataExchangeTypes.fileUpload) return;
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const validFiles = files.filter(
      (candidateFile) => candidateFile.size <= MAX_FILE_SIZE_BYTES
    );
    if (validFiles.length < files.length) {
      alert('Some files exceed the 1 MB limit and were ignored.');
    }

    setMediaFiles((previousFiles) => [...previousFiles, ...validFiles]);
    event.target.value = '';
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files).filter(
      (candidateFile) => candidateFile.size <= MAX_FILE_SIZE_BYTES
    );
    setMediaFiles((previousFiles) => [...previousFiles, ...files]);
  };

  const removeFile = (index) => {
    setMediaFiles((previousFiles) =>
      previousFiles.filter((_, fileIndex) => fileIndex !== index)
    );
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
        type,
        setType,
        isTranscribing,
        startTranscription,
        stopTranscription,
        isThoughtToImageEnabled,
        startThoughtToImage,
        stopThoughtToImage,
        getConversationList,
        conversationList,
        getActiveConversationMessages,
        switchActiveConveration,
        sendMessageAwaitResponseUpdateMessages,
        setActiveConversation,
        activeConversation,
        pendingInterrupt,
        setPendingInterrupt,
      }}
    >
      {children}
    </MediaContext.Provider>
  );
};

export const useMedia = () => useContext(MediaContext);
