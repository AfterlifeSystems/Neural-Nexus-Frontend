// services/MessageService.jsx
import { getDbHttpsUrl } from '../context/NgrokAPIStore';

export async function saveMessage(
  avatar_id,
  message,
  mediaFiles,
  accessToken,
  sender
) {
  const formData = new FormData();
  formData.append('avatar_id', avatar_id);
  if (message) formData.append('message', message);
  if (mediaFiles && mediaFiles.length > 0) {
    mediaFiles.forEach((file) => {
      formData.append('media', file);
    });
  }
  formData.append('sender', sender);

  const response = await fetch(`${getDbHttpsUrl()}/avatars/post_message`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to save message');
  }

  return await response.json();
}
export async function getAvatarMessages(avatar_id, accessToken, options = {}) {
  const formData = new FormData();
  formData.append('avatar_id', avatar_id);

  // Add optional parameters to request all messages
  if (options.limit !== undefined) {
    formData.append('limit', options.limit.toString());
  }
  if (options.all === true) {
    formData.append('all', 'true');
  }
  if (options.skip !== undefined) {
    formData.append('skip', options.skip.toString());
  }

  const response = await fetch(`${getDbHttpsUrl()}/avatars/get_messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch messages');
  }

  const data = await response.json();
  return data.messages;
}

/**
 * Fetch all messages using pagination if needed
 * This will attempt to fetch all messages by making multiple requests if necessary
 * Note: Assumes backend returns messages sorted by timestamp (either ascending or descending)
 */
export async function getAllAvatarMessages(
  avatar_id,
  accessToken,
  batchSize = 100
) {
  let allMessages = [];
  let skip = 0;
  let hasMore = true;
  let consecutiveEmptyBatches = 0;

  console.log(
    `Starting pagination to fetch all messages (batch size: ${batchSize})`
  );

  while (hasMore && consecutiveEmptyBatches < 2) {
    try {
      const batch = await getAvatarMessages(avatar_id, accessToken, {
        limit: batchSize,
        skip: skip,
      });

      if (!batch || batch.length === 0) {
        consecutiveEmptyBatches++;
        if (consecutiveEmptyBatches >= 2) {
          console.log(
            'Received 2 consecutive empty batches, stopping pagination'
          );
          hasMore = false;
          break;
        }
        // Try next batch in case of temporary issue
        skip += batchSize;
        continue;
      }

      consecutiveEmptyBatches = 0; // Reset counter on successful fetch
      console.log(
        `Fetched batch ${Math.floor(skip / batchSize) + 1}: ${
          batch.length
        } messages (skip: ${skip})`
      );

      allMessages = [...allMessages, ...batch];

      // If we got fewer messages than requested, we've reached the end
      if (batch.length < batchSize) {
        console.log(
          `Received fewer messages than batch size (${batch.length} < ${batchSize}), reached end`
        );
        hasMore = false;
      } else {
        skip += batchSize;
      }
    } catch (error) {
      console.error(`Error fetching message batch at skip ${skip}:`, error);
      consecutiveEmptyBatches++;
      if (consecutiveEmptyBatches >= 2) {
        hasMore = false;
      } else {
        skip += batchSize; // Try next batch
      }
    }
  }

  console.log(
    `Pagination complete: fetched ${allMessages.length} total messages`
  );
  return allMessages;
}

export const MessageService = {
  saveMessage,
  getAvatarMessages,
  getAllAvatarMessages,
};

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
    const avatarRef = doc(db, 'avatars', avatarId);
    const avatarDoc = await getDoc(avatarRef);
    if (!avatarDoc.exists()) {
      throw new Error('Avatar not found');
    }
    const avatarData = avatarDoc.data();
    finalConversationId =
      avatarData.default_conversation || avatarData.conversations?.[0];
    if (!finalConversationId) {
      throw new Error('No conversation found for avatar');
    }
  }

  const messageId = uuidv4();
  const timestamp = new Date();

  // Upload media files
  const mediaItems = [];
  for (const file of mediaFiles) {
    const mediaId = uuidv4();
    const mediaRef = ref(
      storage,
      `users/${userId}/avatars/${avatarId}/conversations/${finalConversationId}/media/${mediaId}`
    );
    await uploadBytes(mediaRef, file);
    const downloadURL = await getDownloadURL(mediaRef);

    mediaItems.push({
      media_id: mediaId,
      filename: file.name,
      content_type: file.type,
      storage_path: mediaRef.fullPath,
      url: downloadURL,
    });
  }

  // Determine message type
  const messageType = mediaFiles.length > 0 && !message ? 'media' : 'text';

  // Save user message in the conversation's messages subcollection
  const messageRef = await addDoc(
    collection(
      db,
      `avatars/${avatarId}/conversations/${finalConversationId}/messages`
    ),
    {
      message_id: messageId,
      conversation_id: finalConversationId,
      avatar_id: avatarId,
      user_id: userId,
      message: message || null,
      sender: sender,
      timestamp: timestamp,
      type: messageType,
      media: mediaItems,
    }
  );

  // Update conversation's updated_at timestamp
  const conversationRef = doc(
    db,
    `avatars/${avatarId}/conversations`,
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
    message: message || null,
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
      throw new Error('Avatar not found or unauthorized');
    }
    const avatarData = avatarDoc.data();
    finalConversationId =
      avatarData.default_conversation || avatarData.conversations?.[0];
    if (!finalConversationId) {
      throw new Error('No conversation found for avatar');
    }
  }

  const messagesQuery = query(
    collection(
      db,
      `avatars/${avatarId}/conversations/${finalConversationId}/messages`
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
        if (media.storage_path) {
          try {
            return await getDownloadURL(ref(storage, media.storage_path));
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
      content: data.message || '',
      message: data.message || '', // Keep both for compatibility
      timestamp:
        data.timestamp?.toDate().toISOString() || new Date().toISOString(),
      sender: data.sender || 'user',
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
      `avatars/${avatarId}/conversations/${conversationId}/messages`
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
        content: data.message || '',
        message: data.message || '', // Keep both for compatibility
        sender: data.sender || 'user',
        timestamp:
          data.timestamp?.toDate().toISOString() || new Date().toISOString(),
        media: data.media || [],
        type: data.type || 'text',
      };
    });
    callback(messages);
  });
};
