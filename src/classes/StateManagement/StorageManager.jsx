import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { FieldValue } from 'firebase-admin/firestore';
import { StorageFile } from './Objects.js';

export class StorageManager {
  constructor(googleCloudDb, storageBucket) {
    this.db = googleCloudDb;
    this.bucket = storageBucket;
  }

  _getStoragePath(userId, avatarId, storageFolder, filename) {
    return `users/${userId}/avatars/${avatarId}/${storageFolder}/${filename}`;
  }

  async uploadToStorage({
    file,
    userId,
    avatarId,
    storageFolder,
    uploadedDocumentType = false,
    storageFileId = null,
    conversationId = null,
    messageId = null,
    additionalMetadata = null
  }) {
    /**
     * Universal upload function for all file types
     * 
     * storageFolder options:
     * - "message_media" - media in messages
     * - "uploaded_documents" - raw uploaded documents
     * - "adapter/training_data" - processed training data
     * - "icon" - avatar icon
     * - "reference_audio" - avatar reference audio
     * - "adapter" - avatar adapter
     */

    let content, base64Content, filename, storagePath;

    if (!uploadedDocumentType) {
      // Read file content (assuming file is a buffer or stream)
      if (file.buffer) {
        content = file.buffer;
      } else if (file.path) {
        const fs = require('fs').promises;
        content = await fs.readFile(file.path);
      } else {
        content = file;
      }

      base64Content = content.toString('base64');

      // Generate storage file ID and path
      if (!storageFileId) {
        storageFileId = uuidv4();
      }

      filename = `${storageFileId}_${file.originalname || file.filename || 'file'}`;
      storagePath = this._getStoragePath(userId, avatarId, storageFolder, filename);

      // Upload to Firebase Storage
      const blob = this.bucket.file(storagePath);
      await blob.save(content, {
        contentType: file.mimetype || file.contentType || 'application/octet-stream'
      });
    }

    // Build metadata
    const metadata = {
      user_id: userId,
      avatar_id: avatarId,
      insights: []
    };

    if (conversationId) {
      metadata.conversation_id = conversationId;
    }
    if (messageId) {
      metadata.message_id = messageId;
    }
    if (storageFolder === 'message_media') {
      metadata.base64 = base64Content;
    }
    if (additionalMetadata) {
      Object.assign(metadata, additionalMetadata);
    }

    // Create StorageFile object
    const storageFile = new StorageFile({
      storage_file_id: storageFileId,
      storagePath: storagePath,
      name: file.originalname || file.filename || 'file',
      size: content.length,
      type: file.mimetype || file.contentType || 'application/octet-stream',
      created_at: FieldValue.serverTimestamp(),
      metadata: metadata
    });

    return storageFile;
  }

  async uploadFromUrl({
    url,
    userId,
    avatarId,
    storageFolder = 'uploaded_documents'
  }) {
    // Fetch content from URL
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const content = Buffer.from(response.data);

    // Determine content type and filename
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const urlParts = url.split('/');
    const filename = urlParts[urlParts.length - 1] || 'downloaded_file';

    // Generate storage file ID and path
    const storageFileId = uuidv4();
    const storageFilename = `${storageFileId}_${filename}`;
    const storagePath = this._getStoragePath(userId, avatarId, storageFolder, storageFilename);

    // Upload to Firebase Storage
    const blob = this.bucket.file(storagePath);
    await blob.save(content, { contentType });

    // Create StorageFile object
    const storageFile = new StorageFile({
      storage_file_id: storageFileId,
      storagePath: storagePath,
      name: filename,
      size: content.length,
      type: contentType,
      created_at: FieldValue.serverTimestamp(),
      metadata: {
        user_id: userId,
        avatar_id: avatarId,
        source_url: url,
        insights: []
      }
    });

    return storageFile;
  }

  updateInsights(userId, avatarId, storageFileId, collection, insights) {
    const docRef = this.db
      .collection('users').doc(userId)
      .collection('avatars').doc(avatarId)
      .collection(collection).doc(storageFileId);

    return docRef.update({
      'metadata.insights': insights,
      updated_at: FieldValue.serverTimestamp()
    });
  }
}