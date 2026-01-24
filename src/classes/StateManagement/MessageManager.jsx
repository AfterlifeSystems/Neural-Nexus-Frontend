import { FieldValue } from 'firebase-admin/firestore';
import { Message, StorageFile } from './Objects.js';
import { StorageManager } from './StorageManager.js';

export class MessageManager {
  constructor(googleCloudDb, storageBucket) {
    this.db = googleCloudDb;
    this.storageManager = new StorageManager(googleCloudDb, storageBucket);
  }

  async createMessage({
    userId,
    avatarId,
    conversationId,
    role,
    content,
    mediaFiles = null
  }) {
    /**
     * Create a message (user or assistant) in Llama API format;
     * Llama response is expected to be the text only from the 
     * response in the content field above.
     * 
     * Args:
     *   userId: User ID
     *   avatarId: Avatar ID
     *   conversationId: Conversation ID
     *   role: "user" or "assistant"
     *   content: Message text content
     *   mediaFiles: Array of file objects (optional)
     * 
     * Returns:
     *   Message object in Llama API format
     */

    const messageId = this.db
      .collection('users').doc(userId)
      .collection('avatars').doc(avatarId)
      .collection('conversations').doc(conversationId)
      .collection('messages').doc().id;

    const mediaObjects = [];
    const llamaContent = [];

    // Add text content to Llama format
    if (content) {
      llamaContent.push({
        type: 'text',
        text: content
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
          messageId
        });

        mediaObjects.push(storageFile);

        // Add media to Llama API content format
        const base64Data = storageFile.metadata.base64 || '';

        // Format based on media type
        if (storageFile.type.startsWith('image/')) {
          // Images use image_url format with data URI
          llamaContent.push({
            type: 'image_url',
            image_url: {
              url: `data:${storageFile.type};base64,${base64Data}`
            }
          });
        }
        // else: SEND TO DATA-LOADING API FOR ANALYSIS, FORMATTING, AND INFERENCE
        // Other media types (for future use)
      }
    }

    // Create message object in Llama API format
    const message = new Message({
      message_id: messageId,
      role,
      content: llamaContent,
      created_at: FieldValue.serverTimestamp(),
      media: mediaObjects
    });

    // Save message to Firestore
    const messageRef = this.db
      .collection('users').doc(userId)
      .collection('avatars').doc(avatarId)
      .collection('conversations').doc(conversationId)
      .collection('messages').doc(messageId);

    await messageRef.set(message.toDict());

    return message;
  }

  getLlamaApiPayload(messages) {
    /**
     * Get Llama API payload from array of Message objects;
     * Creates Trainable adapter format from the user's conversations with 
     * avatars in the neural-nexus.
     * 
     * Args:
     *   messages: Array of Message objects
     * 
     * Returns:
     *   Array ready for Llama API
     */
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }
}