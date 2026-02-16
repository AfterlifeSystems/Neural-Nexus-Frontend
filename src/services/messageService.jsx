// services/MessageService — NGROK HTTP API removed; Firestore-backed functions below will be used

// NOTE: Use the Firestore implementations below: sendMessageService

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

// Add these functions to avatarService.jsx

// ChromaDB configuration

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
 * @param {string} type - Sender type ('user' or 'assistant')
 * @param {boolean} waitForResponse - Whether to wait for AI response
 */
// Updated sendMessageService: use doc() + setDoc instead of addDoc → document ID = message_id
export const sendMessageService = async (
  userId,
  avatarId,
  conversationId = null,
  message = '',
  mediaFiles = [],
  type = 'user',
  waitForResponse = true
) => {
  let currentConversationId = conversationId;
  if (!currentConversationId) {
    const avatarRef = doc(db, 'users', userId, 'avatars', avatarId); // fixed user_id → userId
    const avatarDoc = await getDoc(avatarRef);
    if (!avatarDoc.exists()) throw new Error('Digital twin not found');

    const avatarData = avatarDoc.data();
    currentConversationId =
      avatarData.active_conversation || avatarData.conversations?.[0];
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
    type,
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
  // console.log (user message is populated here but the loading message is not populated)

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
    type: 'assistant',
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
    user_message: messageData,
    ai_response: aiResponseData,
  };
};
