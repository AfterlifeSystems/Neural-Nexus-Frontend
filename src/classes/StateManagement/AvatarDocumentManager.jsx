import { FieldValue } from 'firebase-admin/firestore';
import { StorageFile } from './Objects.js';
import { StorageManager } from './StorageManager.js';

export class AvatarDocumentManager {
  constructor(googleCloudDb, storageBucket) {
    this.db = googleCloudDb;
    this.storageManager = new StorageManager(googleCloudDb, storageBucket);
  }

  async uploadDocument({ file, userId, avatarId }) {
    /**
     * Upload document and create Firestore reference in uploaded_documents collection
     * This document will be sent to data-loading API for processing
     */

    const storageFileId = this.db
      .collection('users').doc(userId)
      .collection('avatars').doc(avatarId)
      .collection('uploaded_documents').doc().id;

    // Upload to storage
    const storageFile = await this.storageManager.uploadToStorage({
      file,
      userId,
      avatarId,
      storageFolder: 'uploaded_documents',
      uploadedDocumentType: true,
      storageFileId
    });

    // Save to Firestore uploaded_documents collection
    await this.db
      .collection('users').doc(userId)
      .collection('avatars').doc(avatarId)
      .collection('uploaded_documents').doc(storageFile.storage_file_id)
      .set(storageFile.toDict());

    return storageFile;
  }

  async saveTrainingData({
    processedData,
    userId,
    avatarId,
    originalDocName
  }) {
    /**
     * Save processed training data to storage and Firestore training_documents collection
     * Called after data-loading API processes the uploaded document
     */

    const jsonContent = JSON.stringify(processedData);
    const jsonBuffer = Buffer.from(jsonContent, 'utf-8');

    const storageFileId = this.db
      .collection('users').doc(userId)
      .collection('avatars').doc(avatarId)
      .collection('training_documents').doc().id;

    const storagePath = this.storageManager._getStoragePath(
      userId,
      avatarId,
      'adapter/training_data',
      `${storageFileId}.json`
    );

    // Upload to storage
    const blob = this.storageManager.bucket.file(storagePath);
    await blob.save(jsonBuffer, { contentType: 'application/json' });

    // Create StorageFile object
    const storageFile = new StorageFile({
      storage_file_id: storageFileId,
      storagePath,
      name: `${originalDocName}_training.json`,
      size: jsonBuffer.length,
      type: 'application/json',
      metadata: {
        user_id: userId,
        avatar_id: avatarId,
        original_document_name: originalDocName,
        insights: []
      }
    });

    // Save to Firestore training_documents collection
    await this.db
      .collection('users').doc(userId)
      .collection('avatars').doc(avatarId)
      .collection('training_documents').doc(storageFile.storage_file_id)
      .set(storageFile.toDict());

    return storageFile;
  }

  async updateAvatarIcon({ file, userId, avatarId }) {
    /**
     * Upload icon, save to storage, and update avatar document
     */

    const storageFile = await this.storageManager.uploadToStorage({
      file,
      userId,
      avatarId,
      storageFolder: 'icon'
    });

    // Update avatar document with icon
    await this.db
      .collection('users').doc(userId)
      .collection('avatars').doc(avatarId)
      .update({
        icon: storageFile.toDict(),
        updated_at: FieldValue.serverTimestamp()
      });

    return storageFile;
  }

  async updateAvatarReferenceAudio({ file, userId, avatarId }) {
    /**
     * Upload reference audio, save to storage, and update avatar document
     */

    const storageFile = await this.storageManager.uploadToStorage({
      file,
      userId,
      avatarId,
      storageFolder: 'reference_audio'
    });

    // Update avatar document with reference audio
    await this.db
      .collection('users').doc(userId)
      .collection('avatars').doc(avatarId)
      .update({
        reference_audio: storageFile.toDict(),
        updated_at: FieldValue.serverTimestamp()
      });

    return storageFile;
  }

  async updateAvatarAdapter({ file, userId, avatarId }) {
    /**
     * Upload adapter, save to storage, and update avatar document
     */

    const storageFile = await this.storageManager.uploadToStorage({
      file,
      userId,
      avatarId,
      storageFolder: 'adapter'
    });

    // Update avatar document with adapter
    await this.db
      .collection('users').doc(userId)
      .collection('avatars').doc(avatarId)
      .update({
        adapter: storageFile.toDict(),
        updated_at: FieldValue.serverTimestamp()
      });

    return storageFile;
  }
}