// src/services/MessageManager.js
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { StorageManager } from './StorageManager';

export class MessageManager {
  constructor(db, storage) {
    this.db = db;
    this.storageManager = new StorageManager(db, storage);
  }

  /**
   * Create a message (user or assistant) in Llama API format
   *
   * @param {string} userId - User ID
   * @param {string} avatarId - Avatar ID
   * @param {string} conversationId - Conversation ID
   * @param {string} role - "user" or "assistant"
   * @param {string} content - Message text content
   * @param {Array<File>} mediaFiles - Array of File objects (optional)
   * @returns {Promise<object>} Message object in Llama API format
   */
  async createMessage({
    userId,
    avatarId,
    conversationId,
    role,
    content,
    mediaFiles = null,
  }) {
    // Generate message ID
    const messagesRef = collection(
      this.db,
      'users',
      userId,
      'avatars',
      avatarId,
      'conversations',
      conversationId,
      'messages'
    );
    const messageDoc = doc(messagesRef);
    const messageId = messageDoc.id;

    const mediaObjects = [];
    const llamaContent = [];

    // Add text content to Llama format
    if (content) {
      llamaContent.push({
        type: 'text',
        text: content,
      });
    }

    // Upload each media file to storage if provided
    if (mediaFiles && mediaFiles.length > 0) {
      for (const file of mediaFiles) {
        const storageFile = await this.storageManager.uploadToStorage({
          file,
          userId,
          avatarId,
          storageFolder: 'message_media',
          conversationId,
          messageId,
        });

        mediaObjects.push(storageFile);

        // Add media to Llama API content format
        const base64Data = storageFile.metadata?.base64 || '';

        // Format based on media type
        if (storageFile.type.startsWith('image/')) {
          // Images use image_url format with data URI
          llamaContent.push({
            type: 'image_url',
            image_url: {
              url: `data:${storageFile.type};base64,${base64Data}`,
            },
          });
        }
        // NOTE: For other media types, send to data-loading API
        // else {
        //   llamaContent.push({
        //     type: 'file',
        //     file: {
        //       type: storageFile.type,
        //       data: base64Data
        //     }
        //   });
        // }
      }
    }

    // Create message object in Llama API format
    const message = {
      message_id: messageId,
      role,
      content: llamaContent,
      media: mediaObjects,
      created_at: serverTimestamp(),
    };

    // Save message to Firestore
    await setDoc(messageDoc, message);

    // NOTE: Message count increment is handled by onSnapshot watcher
    // in the Python version. In JS, you'll handle this in your
    // UserStateManager's message collection listener

    return message;
  }

  /**
   * Get Llama API payload from list of Message objects
   * Creates trainable adapter format from conversations
   *
   * @param {Array<object>} messages - Array of Message objects
   * @returns {Array<object>} List ready for Llama API
   */
  getLlamaApiPayload(messages) {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }
}
