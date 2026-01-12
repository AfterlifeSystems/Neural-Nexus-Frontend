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
import { db, storage } from '../firebase/config';
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
    const avatarRef = doc(db, 'digital_twins', avatarId);
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
      `users/${userId}/digital_twins/${avatarId}/conversations/${finalConversationId}/messages/${messageId}/${file.name}`
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
      'digital_twins',
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
    'digital_twins',
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
    const avatarRef = doc(db, 'digital_twins', avatarId);
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
      'digital_twins',
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
      'digital_twins',
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
