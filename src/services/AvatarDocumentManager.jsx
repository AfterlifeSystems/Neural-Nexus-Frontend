// src/services/AvatarDocumentManager.js
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadString } from 'firebase/storage';
import { StorageManager } from './StorageManager';

export class AvatarDocumentManager {
  constructor(db, storage) {
    this.db = db;
    this.storage = storage;
    this.storageManager = new StorageManager(db, storage);
  }

  /**
   * Upload document and create Firestore reference in uploaded_documents collection
   * This document will be sent to data-loading API for processing
   *
   * @param {File} file - File to upload
   * @param {string} userId - User ID
   * @param {string} avatarId - Avatar ID
   * @returns {Promise<object>} StorageFile object
   */
  async uploadDocument(file, userId, avatarId) {
    // Generate document ID
    const uploadedDocsRef = collection(
      this.db,
      'users',
      userId,
      'avatars',
      avatarId,
      'uploaded_documents'
    );
    const docRef = doc(uploadedDocsRef);
    const storageFileId = docRef.id;

    // Upload to storage
    const storageFile = await this.storageManager.uploadToStorage({
      file,
      userId,
      avatarId,
      storageFolder: 'uploaded_documents',
      uploadedDocumentType: true,
      storageFileId,
    });

    // Save to Firestore uploaded_documents collection
    await setDoc(docRef, storageFile);

    return storageFile;
  }

  /**
   * Save processed training data to storage and Firestore training_documents collection
   * Called after data-loading API processes the uploaded document
   *
   * @param {object} processedData - Processed data object
   * @param {string} userId - User ID
   * @param {string} avatarId - Avatar ID
   * @param {string} originalDocName - Original document name
   * @returns {Promise<object>} StorageFile object
   */
  async saveTrainingData(processedData, userId, avatarId, originalDocName) {
    // Convert to JSON
    const jsonContent = JSON.stringify(processedData);

    // Generate training document ID
    const trainingDocsRef = collection(
      this.db,
      'users',
      userId,
      'avatars',
      avatarId,
      'training_documents'
    );
    const docRef = doc(trainingDocsRef);
    const storageFileId = docRef.id;

    const storagePath = this.storageManager.getStoragePath(
      userId,
      avatarId,
      'adapter/training_data',
      `${storageFileId}.json`
    );

    // Upload to storage
    const storageRef = ref(this.storage, storagePath);
    await uploadString(storageRef, jsonContent, 'raw', {
      contentType: 'application/json',
    });

    // Create StorageFile object
    const storageFile = {
      storage_file_id: storageFileId,
      storagePath,
      name: `${originalDocName}_training.json`,
      size: new Blob([jsonContent]).size,
      type: 'application/json',
      created_at: serverTimestamp(),
      metadata: {
        user_id: userId,
        avatar_id: avatarId,
        original_document_name: originalDocName,
        insights: [],
      },
    };

    // Save to Firestore training_documents collection
    await setDoc(docRef, storageFile);

    return storageFile;
  }

  /**
   * Upload icon, save to storage, and update avatar document
   *
   * @param {File} file - Icon file
   * @param {string} userId - User ID
   * @param {string} avatarId - Avatar ID
   * @returns {Promise<object>} StorageFile object
   */
  async updateAvatarIcon(file, userId, avatarId) {
    const storageFile = await this.storageManager.uploadToStorage({
      file,
      userId,
      avatarId,
      storageFolder: 'icon',
    });

    // Update avatar document with icon
    const avatarRef = doc(this.db, 'users', userId, 'avatars', avatarId);
    await updateDoc(avatarRef, {
      icon: storageFile,
      updated_at: serverTimestamp(),
    });

    return storageFile;
  }

  /**
   * Upload reference audio, save to storage, and update avatar document
   *
   * @param {File} file - Audio file
   * @param {string} userId - User ID
   * @param {string} avatarId - Avatar ID
   * @returns {Promise<object>} StorageFile object
   */
  async updateAvatarReferenceAudio(file, userId, avatarId) {
    const storageFile = await this.storageManager.uploadToStorage({
      file,
      userId,
      avatarId,
      storageFolder: 'reference_audio',
    });

    // Update avatar document with reference audio
    const avatarRef = doc(this.db, 'users', userId, 'avatars', avatarId);
    await updateDoc(avatarRef, {
      reference_audio: storageFile,
      updated_at: serverTimestamp(),
    });

    return storageFile;
  }

  /**
   * Upload adapter, save to storage, and update avatar document
   *
   * @param {File} file - Adapter file
   * @param {string} userId - User ID
   * @param {string} avatarId - Avatar ID
   * @returns {Promise<object>} StorageFile object
   */
  async updateAvatarAdapter(file, userId, avatarId) {
    const storageFile = await this.storageManager.uploadToStorage({
      file,
      userId,
      avatarId,
      storageFolder: 'adapter',
    });

    // Update avatar document with adapter
    const avatarRef = doc(this.db, 'users', userId, 'avatars', avatarId);
    await updateDoc(avatarRef, {
      adapter: storageFile,
      updated_at: serverTimestamp(),
    });

    return storageFile;
  }
}
