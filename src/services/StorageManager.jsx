// src/services/StorageManager.js
import {
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

export class StorageManager {
  constructor(db, storage) {
    this.db = db;
    this.storage = storage;
  }

  /**
   * Generate storage path based on folder type
   */
  getStoragePath(userId, avatarId, storageFolder, filename) {
    return `users/${userId}/avatars/${avatarId}/${storageFolder}/${filename}`;
  }

  /**
   * Universal upload function for all file types
   *
   * @param {File} file - File object from input
   * @param {string} userId - User ID
   * @param {string} avatarId - Avatar ID
   * @param {string} storageFolder - Folder type (message_media, uploaded_documents, etc.)
   * @param {boolean} uploadedDocumentType - Whether this is an uploaded document
   * @param {string} storageFileId - Optional storage file ID
   * @param {string} conversationId - Optional conversation ID
   * @param {string} messageId - Optional message ID
   * @param {object} additionalMetadata - Optional additional metadata
   * @returns {Promise<object>} StorageFile object
   */
  async uploadToStorage({
    file,
    userId,
    avatarId,
    storageFolder,
    uploadedDocumentType = false,
    storageFileId = null,
    conversationId = null,
    messageId = null,
    additionalMetadata = {},
  }) {
    let base64Content = null;
    let storagePath = null;

    if (!uploadedDocumentType) {
      // Read file as base64
      base64Content = await this.fileToBase64(file);

      // Generate storage file ID and path
      storageFileId = storageFileId || uuidv4();
      const filename = `${storageFileId}_${file.name}`;
      storagePath = this.getStoragePath(
        userId,
        avatarId,
        storageFolder,
        filename
      );

      // Upload to Firebase Storage
      const storageRef = ref(this.storage, storagePath);
      await uploadBytes(storageRef, file, {
        contentType: file.type,
      });
    } else {
      // For uploaded documents, generate ID without uploading
      // (will be sent to data-loading API)
      storageFileId = storageFileId || uuidv4();
    }

    // Build metadata
    const metadata = {
      user_id: userId,
      avatar_id: avatarId,
      insights: [],
      ...additionalMetadata,
    };

    if (conversationId) metadata.conversation_id = conversationId;
    if (messageId) metadata.message_id = messageId;
    if (storageFolder === 'message_media' && base64Content) {
      metadata.base64 = base64Content;
    }

    // Create StorageFile object
    const storageFile = {
      storage_file_id: storageFileId,
      storagePath: storagePath,
      name: file.name,
      size: file.size,
      type: file.type,
      created_at: serverTimestamp(),
      metadata,
    };

    return storageFile;
  }

  /**
   * Upload file from URL
   * NOTE: CORS restrictions may prevent direct URL fetching in browser.
   * Consider using a backend proxy for production.
   *
   * @param {string} url - URL to fetch
   * @param {string} userId - User ID
   * @param {string} avatarId - Avatar ID
   * @param {string} storageFolder - Storage folder
   * @returns {Promise<object>} StorageFile object
   */
  async uploadFromUrl(
    url,
    userId,
    avatarId,
    storageFolder = 'uploaded_documents'
  ) {
    // WARNING: Browser CORS restrictions may block this
    // Consider using a backend proxy in production
    try {
      const response = await fetch(url);
      const blob = await response.blob();

      const contentType =
        response.headers.get('content-type') || 'application/octet-stream';
      const filename = url.split('/').pop() || 'downloaded_file';

      const file = new File([blob], filename, { type: contentType });

      const storageFileId = uuidv4();
      const storageFilename = `${storageFileId}_${filename}`;
      const storagePath = this.getStoragePath(
        userId,
        avatarId,
        storageFolder,
        storageFilename
      );

      const storageRef = ref(this.storage, storagePath);
      await uploadBytes(storageRef, blob, { contentType });

      return {
        storage_file_id: storageFileId,
        storagePath,
        name: filename,
        size: blob.size,
        type: contentType,
        created_at: serverTimestamp(),
        metadata: {
          user_id: userId,
          avatar_id: avatarId,
          source_url: url,
          insights: [],
        },
      };
    } catch (error) {
      console.error('Error uploading from URL:', error);
      throw new Error('CORS or network error. Consider using backend proxy.');
    }
  }

  /**
   * Update insights metadata for a storage file
   *
   * @param {string} userId - User ID
   * @param {string} avatarId - Avatar ID
   * @param {string} storageFileId - Storage file ID
   * @param {string} collection - Collection name
   * @param {array} insights - Insights array
   */
  async updateInsights(userId, avatarId, storageFileId, collection, insights) {
    const docRef = doc(
      this.db,
      'users',
      userId,
      'avatars',
      avatarId,
      collection,
      storageFileId
    );

    await updateDoc(docRef, {
      'metadata.insights': insights,
      updated_at: serverTimestamp(),
    });
  }

  /**
   * Helper: Convert File to base64
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Remove data URL prefix (e.g., "data:image/png;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Delete file from storage
   *
   * @param {string} storagePath - Path in storage
   */
  async deleteFile(storagePath) {
    const storageRef = ref(this.storage, storagePath);
    await deleteObject(storageRef);
  }
}
