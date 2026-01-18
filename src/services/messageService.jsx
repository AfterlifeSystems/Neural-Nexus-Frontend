// services/MessageService — NGROK HTTP API removed; Firestore-backed functions below will be used

// NOTE: Use the Firestore implementations below: sendMessageService, getMessages, subscribeToMessages

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config.js';
import { v4 as uuidv4 } from 'uuid';

// services/api.js
/**
 * Call local Neural Nexus messaging API
 * @param {string} userId
 * @param {string} avatarId
 * @param {string} userInput
 * @param {File[]} mediaFiles
 * @param {boolean} [useContext=false]
 * @param {number} [maxNewTokens=150]
 * @returns {Promise<{response: string, context_used: boolean, ...}>}
 */
export const callLocalQueryApi = async (
  userId,
  avatarId,
  userInput,
  mediaFiles = [],
  useContext = false, // vectorstore logic
  maxNewTokens = 150
) => {
  const formData = new FormData();
  formData.append('user_id', userId);
  formData.append('avatar_id', avatarId || '');
  formData.append('user_input', userInput || '');
  formData.append('use_context', useContext.toString());
  formData.append('max_new_tokens', maxNewTokens.toString());

  mediaFiles.forEach((file) => {
    formData.append('image', file); // API accepts one image; adjust if multiple needed
  });

  const response = await fetch('http://localhost:8090/query', {
    method: 'POST',
    body: formData,
    // no headers → browser sets multipart boundary automatically
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail?.[0]?.msg || 'Query API failed');
  }

  return response.json(); // → { response, context_used, device, model_type, ... }
};

/**
 * Send a message to a conversation
 * @param {string} userId - User ID
 * @param {string} avatarId - Avatar ID
 * @param {string} conversationId - Conversation ID (if not provided, uses default)
 * @param {string} message - Message text (optional if mediaFiles provided)
 * @param {File[]} mediaFiles - Media files (optional)
 * @param {string} role - Sender type ('user' or 'assistant')
 * @param {boolean} waitForResponse - Whether to wait for AI response
 */
// Updated sendMessageService: use doc() + setDoc instead of addDoc → document ID = message_id
export const sendMessageService = async (
  userId,
  avatarId,
  conversationId = null,
  message = '',
  mediaFiles = [],
  role = 'user',
  waitForResponse = true
) => {
  let currentConversationId = conversationId;
  if (!currentConversationId) {
    const avatarRef = doc(db, 'users', userId, 'avatars', avatarId); // fixed user_id → userId
    const avatarDoc = await getDoc(avatarRef);
    if (!avatarDoc.exists()) throw new Error('Digital twin not found');

    const avatarData = avatarDoc.data();
    currentConversationId =
      avatarData.default_conversation || avatarData.conversations?.[0];
    if (!currentConversationId) throw new Error('No conversation found');
  }

  const messageId = uuidv4();
  const timestamp = new Date();

  const mediaItems = [];
  for (const file of mediaFiles) {
    const mediaId = uuidv4();
    const mediaRef = ref(
      storage,
      `users/${userId}/avatars/${avatarId}/conversations/${currentConversationId}/messages/${messageId}/${file.name}`
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

  const messageType = mediaFiles.length > 0 && !message ? 'media' : 'text';

  const messageData = {
    message_id: messageId,
    conversation_id: currentConversationId,
    avatar_id: avatarId,
    user_id: userId,
    role,
    content: message || null,
    timestamp,
    type: messageType,
    media: mediaItems,
  };

  // Use setDoc with known ID instead of addDoc
  const messageRef = doc(
    collection(
      db,
      'users',
      userId,
      'avatars',
      avatarId,
      'conversations',
      currentConversationId,
      'messages'
    ),
    messageId // ← document ID = message_id
  );

  await setDoc(messageRef, messageData);

  // Update conversation timestamp
  const conversationRef = doc(
    db,
    'users',
    userId,
    'avatars',
    avatarId,
    'conversations',
    currentConversationId
  );
  await updateDoc(conversationRef, { updated_at: timestamp });

  const userMessage = {
    id: messageId, // ← consistent with doc id
    message_id: messageId,
    timestamp: timestamp.toISOString(),
    content: message || null,
    role,
    media: mediaItems,
    type: messageType,
  };

  let aiResponseData;
  try {
    aiResponseData = await callLocalQueryApi(
      userId,
      avatarId,
      message,
      mediaFiles,
      false,
      250
    );
  } catch (err) {
    console.error('AI query failed:', err);
    aiResponseData = { response: '[Error]' };
  }

  const aiMessageId = uuidv4();
  const aiTimestamp = new Date();

  const aiMessageData = {
    message_id: aiMessageId,
    conversation_id: currentConversationId,
    avatar_id: avatarId,
    user_id: userId,
    role: 'assistant',
    content: aiResponseData.response || '[No response]',
    timestamp: aiTimestamp,
    type: 'text',
    metadata: {
      context_used: aiResponseData.context_used,
      device: aiResponseData.device,
      model_type: aiResponseData.model_type,
    },
  };

  const aiMessageRef = doc(
    collection(
      db,
      'users',
      userId,
      'avatars',
      avatarId,
      'conversations',
      currentConversationId,
      'messages'
    ),
    aiMessageId
  );

  await setDoc(aiMessageRef, aiMessageData);

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
  let currentConversationId = conversationId;
  if (!currentConversationId) {
    const avatarRef = doc(db, 'users', user_id, 'avatars', avatarId);
    const avatarDoc = await getDoc(avatarRef);
    if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
      throw new Error('Digital twin not found or unauthorized');
    }
    const avatarData = avatarDoc.data();
    currentConversationId =
      avatarData.default_conversation || avatarData.conversations?.[0];
    if (!currentConversationId) {
      throw new Error('No conversation found for digital twin');
    }
  }

  const messagesQuery = query(
    collection(
      db,
      'users',
      userId,
      'avatars',
      avatarId,
      'conversations',
      currentConversationId,
      'messages'
    ),
    orderBy('timestamp', 'asc'),
    firestoreLimit(maxMessages)
  );
  // ... conversation resolution unchanged ...

  const snapshot = await getDocs(messagesQuery);
  const messages = [];

  for (const docSnapshot of snapshot.docs) {
    const data = docSnapshot.data();
    const mediaUrls = await Promise.all(
      (data.media || []).map(async (media) => {
        const storagePath = media.storagePath || media.storage_path;
        if (storagePath) {
          try {
            return await getDownloadURL(ref(storage, storagePath));
          } catch (e) {
            console.error('Media URL error:', e);
            return media.url || null;
          }
        }
        return media.url || null;
      })
    );

    messages.push({
      id: data.message_id || docSnapshot.id, // ← primary id = message_id
      message_id: data.message_id || docSnapshot.id,
      type: data.type || 'text',
      content: data.content || data.message || '',
      role: data.role || 'user',
      timestamp: data.timestamp?.toDate?.()
        ? data.timestamp.toDate().toISOString()
        : data.timestamp || new Date().toISOString(),
      media: mediaUrls
        .map((url, idx) => (url ? { ...data.media[idx], url } : null))
        .filter(Boolean),
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
export const subscribeToMessages = (
  userId,
  avatarId,
  conversationId,
  callback
) => {
  const messagesQuery = query(
    collection(
      db,
      'users',
      userId,
      'avatars',
      avatarId,
      'conversations',
      conversationId,
      'messages'
    ),
    orderBy('timestamp', 'asc')
  );

  return onSnapshot(messagesQuery, (snapshot) => {
    const messages = snapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data();
      return {
        id: data.message_id || docSnapshot.id, // prefer message_id
        message_id: data.message_id || docSnapshot.id,
        content: data.content || data.message || '',
        role: data.role || 'user',
        timestamp: data.timestamp?.toDate?.()
          ? data.timestamp.toDate().toISOString()
          : data.timestamp || new Date().toISOString(),
        media: data.media || [],
        type: data.type || 'text',
        metadata: data.metadata || {},
      };
    });
    callback(messages);
  });
};
