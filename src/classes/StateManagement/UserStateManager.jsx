import admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { User, Avatar, Conversation, Message } from './Objects.js';
import { MessageManager } from './MessageManager.js';
import { AvatarDocumentManager } from './AvatarDocumentManager.js';

export class UserStateManager {
  constructor(project = 'neuralnexus-467517', useEmulator = null) {
    this.projectId = project;

    this.activeUser = null; // User object
    this.activeAvatar = null; // Avatar object
    this.allAvatars = []; // limited to 50; ordered by created_at; needs pagination
    this.allConversations = []; // limited to 50; ordered by created_at; needs pagination
    this.allMessages = []; // limited to 50 messages; ordered by created_at; needs pagination
    this.allUploadedAvatarDocuments = []; // collection of documents uploaded to data-loading api
    this.allAvatarAdapterTrainingData = []; // processed versions of avatar documents

    // Stores the listeners: { "user_123": unsubscribe_function, ... }
    this.activeListeners = {};

    // Auto-detect environment if not explicitly set
    if (useEmulator === null) {
      useEmulator = process.env.USE_EMULATOR?.toLowerCase() === 'true';
    }
    this.useEmulator = useEmulator;

    // Initialize Firebase Admin
    if (!admin.apps.length) {
      const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (!credentials) {
        throw new Error(
          'GOOGLE_APPLICATION_CREDENTIALS environment variable is required'
        );
      }

      const serviceAccount = require(credentials);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: `${project}.appspot.com`,
      });
    }

    this.auth = admin.auth();
    this.bucket = admin.storage().bucket();

    if (useEmulator) {
      this._initEmulator();
    } else {
      this._initProduction();
    }

    // Initialize managers
    this.messageManager = new MessageManager(this.db, this.bucket);
    this.avatarDocumentManager = new AvatarDocumentManager(
      this.db,
      this.bucket
    );
  }

  _initEmulator() {
    console.log('🔧 Initializing Firebase with EMULATORS');

    process.env.FIRESTORE_EMULATOR_HOST =
      process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST =
      process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
    process.env.FIREBASE_STORAGE_EMULATOR_HOST =
      process.env.FIREBASE_STORAGE_EMULATOR_HOST || 'localhost:9199';

    this.db = admin.firestore();

    console.log(`  - Project: ${this.projectId}`);
    console.log(`  - Firestore: ${process.env.FIRESTORE_EMULATOR_HOST}`);
    console.log(`  - Auth: ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
    console.log(`  - Storage: ${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`);
    console.log(`  - UI: http://localhost:4000`);
  }

  _initProduction() {
    console.log('🚀 Initializing Firebase for PRODUCTION');

    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;

    this.db = admin.firestore();

    console.log(` → Project: ${this.projectId}`);
  }

  _onSnapshotDocCallback(docRefId, localDocData) {
    return (snapshot) => {
      if (snapshot.exists) {
        Object.assign(localDocData, snapshot.data());
        console.log(`Updated local_doc_data for ${docRefId}`);
      } else {
        console.log(`Document does not exist for ${docRefId}`);
      }
    };
  }

  _onSnapshotCollCallback(collRefId, localCollList, filterField = null) {
    return async (snapshot) => {
      const docs = [];
      snapshot.forEach((doc) => {
        if (filterField) {
          docs.push(doc.data()[filterField]);
        } else {
          docs.push(doc.data());
        }
      });

      localCollList.length = 0;
      localCollList.push(...docs);
      console.log(`Updated local_coll_list for ${collRefId}`);
    };
  }

  _onSnapshotMessageCollCallback(collRefId, localCollList, convDocRef) {
    return async (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          convDocRef.update({
            message_count: FieldValue.increment(1),
            updated_at: FieldValue.serverTimestamp(),
          });
        }
      });

      const docs = [];
      snapshot.forEach((doc) => docs.push(doc.data()));

      localCollList.length = 0;
      localCollList.push(...docs);
      console.log(`Updated messages for ${collRefId}`);
    };
  }

  unsubscribeAll() {
    Object.values(this.activeListeners).forEach((unsubscribe) => unsubscribe());
    this.activeListeners = {};
  }

  subscribeActiveUser(userId) {
    if (!this.activeListeners[userId]) {
      console.log(`Starting listener for user ${userId}`);
      const docRef = this.db.collection('users').doc(userId);
      const unsubscribe = docRef.onSnapshot(
        this._onSnapshotDocCallback(userId, this.activeUser)
      );
      this.activeListeners[userId] = unsubscribe;
    }
  }

  subscribeActiveAvatar(userId, avatarId) {
    if (!this.activeListeners[avatarId]) {
      console.log(`Starting listener for avatar ${avatarId}`);
      const docRef = this.db
        .collection('users')
        .doc(userId)
        .collection('avatars')
        .doc(avatarId);
      const unsubscribe = docRef.onSnapshot(
        this._onSnapshotDocCallback(avatarId, this.activeAvatar)
      );
      this.activeListeners[avatarId] = unsubscribe;
    }
  }

  subscribeListOfAvatarsForActiveUser(userId) {
    const listener = `${userId}_coll`;
    if (!this.activeListeners[listener]) {
      console.log(`Starting listener for ${userId} avatar collection`);
      const collRef = this.db
        .collection('users')
        .doc(userId)
        .collection('avatars');
      const unsubscribe = collRef.onSnapshot(
        this._onSnapshotCollCallback(userId, this.allAvatars)
      );
      this.activeListeners[listener] = unsubscribe;
    }
  }

  subscribeListOfConversationsForActiveAvatar(userId, avatarId) {
    const listener = `${avatarId}_conversations_coll`;
    if (!this.activeListeners[listener]) {
      const collRef = this.db
        .collection('users')
        .doc(userId)
        .collection('avatars')
        .doc(avatarId)
        .collection('conversations');
      const unsubscribe = collRef.onSnapshot(
        this._onSnapshotCollCallback(
          avatarId,
          this.allConversations,
          'conversation_id'
        )
      );
      this.activeListeners[listener] = unsubscribe;
    }
  }

  subscribeListOfAllUploadedDocumentsForActiveAvatar(userId, avatarId) {
    const listener = `${avatarId}_uploaded_documents_coll`;
    if (!this.activeListeners[listener]) {
      const collRef = this.db
        .collection('users')
        .doc(userId)
        .collection('avatars')
        .doc(avatarId)
        .collection('uploaded_documents');
      const unsubscribe = collRef.onSnapshot(
        this._onSnapshotCollCallback(avatarId, this.allUploadedAvatarDocuments)
      );
      this.activeListeners[listener] = unsubscribe;
    }
  }

  subscribeListOfAllProcessedTrainingDataForActiveAvatar(userId, avatarId) {
    const listener = `${avatarId}_training_documents_coll`;
    if (!this.activeListeners[listener]) {
      const collRef = this.db
        .collection('users')
        .doc(userId)
        .collection('avatars')
        .doc(avatarId)
        .collection('training_documents');
      const unsubscribe = collRef.onSnapshot(
        this._onSnapshotCollCallback(
          avatarId,
          this.allAvatarAdapterTrainingData
        )
      );
      this.activeListeners[listener] = unsubscribe;
    }
  }

  subscribeListOfAllMessagesForCurrentConversation(
    userId,
    avatarId,
    conversationId
  ) {
    const listener = `${conversationId}_coll`;
    if (!this.activeListeners[listener]) {
      const messagesCollRef = this.db
        .collection('users')
        .doc(userId)
        .collection('avatars')
        .doc(avatarId)
        .collection('conversations')
        .doc(conversationId)
        .collection('messages');

      const conversationDocRef = this.db
        .collection('users')
        .doc(userId)
        .collection('avatars')
        .doc(avatarId)
        .collection('conversations')
        .doc(conversationId);

      const unsubscribe = messagesCollRef.onSnapshot(
        this._onSnapshotMessageCollCallback(
          conversationId,
          this.allMessages,
          conversationDocRef
        )
      );
      this.activeListeners[listener] = unsubscribe;
    }
  }

  async signupUser(email, password, displayName = null) {
    try {
      const userRecord = await this.auth.createUser({
        email,
        password,
        displayName,
      });

      const userData = {
        user_id: userRecord.uid,
        display_name: displayName,
        email,
        currently_logged_in: false,
        created_at: FieldValue.serverTimestamp(),
      };

      await this.db.collection('users').doc(userRecord.uid).set(userData);
      return userData;
    } catch (error) {
      console.error(`Signup failure: ${error}`);
      throw error;
    }
  }

  async loginUser(email) {
    try {
      const authUser = await this.auth.getUserByEmail(email);
      const userDoc = await this.db.collection('users').doc(authUser.uid).get();

      this.subscribeActiveUser(authUser.uid);
      this.subscribeListOfAvatarsForActiveUser(authUser.uid);

      const updateData = {
        updated_at: FieldValue.serverTimestamp(),
        last_login: FieldValue.serverTimestamp(),
        currently_logged_in: true,
      };

      await userDoc.ref.update(updateData);
      return { ...userDoc.data(), ...updateData };
    } catch (error) {
      this.unsubscribeAll();
      console.error(`Login failed: ${error}`);
      throw error;
    }
  }

  async logoutUser() {
    try {
      await this.db.collection('users').doc(this.activeUser.user_id).update({
        updated_at: FieldValue.serverTimestamp(),
        currently_logged_in: false,
      });
      this.unsubscribeAll();
    } catch (error) {
      console.error(`Logout error: ${error}`);
      throw error;
    }
  }

  async updateUser(updatePayload) {
    try {
      const docRef = this.db.collection('users').doc(this.activeUser.user_id);
      const updateData = {
        ...updatePayload,
        updated_at: FieldValue.serverTimestamp(),
      };
      await docRef.update(updateData);
      console.log(`Successfully updated user: ${this.activeUser.user_id}`);
      return updateData;
    } catch (error) {
      console.error(`Error updating user: ${error}`);
      throw error;
    }
  }

  async deleteUser() {
    try {
      const userId = this.activeUser.user_id;
      const avatarColl = await this.db
        .collection('users')
        .doc(userId)
        .collection('avatars')
        .get();

      // Delete all avatars
      for (const doc of avatarColl.docs) {
        await this.deleteAvatar(doc.data().avatar_id, true);
      }

      this.unsubscribeAll();

      // Delete user document
      await this.db.recursiveDelete(this.db.collection('users').doc(userId));
      await this.auth.deleteUser(userId);

      // Delete storage
      await this.bucket.deleteFiles({ prefix: `users/${userId}/` });
      console.log('Successfully deleted all objects for user');
    } catch (error) {
      console.error(`Delete user ${this.activeUser.user_id} failed: ${error}`);
      throw error;
    }
  }

  async createAvatar(userId, name, description = null) {
    const avatarId = this.db
      .collection('users')
      .doc(userId)
      .collection('avatars')
      .doc().id;

    const currentConversationId = this.db
      .collection('users')
      .doc(userId)
      .collection('avatars')
      .doc(avatarId)
      .collection('conversations')
      .doc().id;

    const avatarData = {
      avatar_id: avatarId,
      user_id: userId,
      name,
      description,
      icon: null,
      reference_audio: null,
      current_conversation_id: currentConversationId,
      adapter: null,
      metadatas: {},
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    const conversationData = {
      conversation_id: currentConversationId,
      summary: 'Initial Conversation',
      message_count: 0,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    await this.db
      .collection('users')
      .doc(userId)
      .collection('avatars')
      .doc(avatarId)
      .set(avatarData);

    await this.db
      .collection('users')
      .doc(userId)
      .collection('avatars')
      .doc(avatarId)
      .collection('conversations')
      .doc(currentConversationId)
      .set(conversationData);

    // Create storage directories
    const directories = [
      `users/${userId}/avatars/${avatarId}/adapter/.keep`,
      `users/${userId}/avatars/${avatarId}/adapter/training_data/.keep`,
      `users/${userId}/avatars/${avatarId}/icon/.keep`,
      `users/${userId}/avatars/${avatarId}/reference_audio/.keep`,
      `users/${userId}/avatars/${avatarId}/message_media/.keep`,
    ];

    for (const dirPath of directories) {
      const blob = this.bucket.file(dirPath);
      await blob.save('', { contentType: 'application/x-keep' });
      console.log(`Initialized: ${dirPath}`);
    }
  }

  async updateAvatarMetadata(userId, avatarId, newMetadata) {
    try {
      const docRef = this.db
        .collection('users')
        .doc(userId)
        .collection('avatars')
        .doc(avatarId);

      const updatePayload = {};
      for (const [key, value] of Object.entries(newMetadata)) {
        updatePayload[`metadatas.${key}`] = value;
      }
      updatePayload.updated_at = FieldValue.serverTimestamp();

      await docRef.update(updatePayload);
    } catch (error) {
      console.error(`Error editing avatar metadata: ${error}`);
      throw error;
    }
  }

  async updateAvatar(userId, avatarId, updatePayload) {
    try {
      const docRef = this.db
        .collection('users')
        .doc(userId)
        .collection('avatars')
        .doc(avatarId);

      const updateData = {
        ...updatePayload,
        updated_at: FieldValue.serverTimestamp(),
      };

      await docRef.update(updateData);
    } catch (error) {
      console.error(`Error editing avatar: ${error}`);
      throw error;
    }
  }

  async editMessage(
    userId,
    avatarId,
    conversationId,
    messageId,
    updatePayload
  ) {
    try {
      const docRef = this.db
        .collection('users')
        .doc(userId)
        .collection('avatars')
        .doc(avatarId)
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .doc(messageId);

      const updateData = {
        ...updatePayload,
        updated_at: FieldValue.serverTimestamp(),
      };

      await docRef.update(updateData);
      console.log(`Successfully updated message: ${messageId}`);
      return updateData;
    } catch (error) {
      console.error(`Error editing message: ${error}`);
      throw error;
    }
  }

  async createConversation(userId, avatarId) {
    try {
      const newConversationId = this.db
        .collection('users')
        .doc(userId)
        .collection('avatars')
        .doc(avatarId)
        .collection('conversations')
        .doc().id;

      const conversationData = {
        conversation_id: newConversationId,
        created_at: FieldValue.serverTimestamp(),
      };

      await this.db
        .collection('users')
        .doc(userId)
        .collection('avatars')
        .doc(avatarId)
        .collection('conversations')
        .doc(newConversationId)
        .set(conversationData);

      console.log(`Conversation created successfully ${newConversationId}`);
      return conversationData;
    } catch (error) {
      console.error(`Error creating conversation: ${error}`);
      throw error;
    }
  }

  async changeCurrentConversation(newConversationId) {
    try {
      const listener = `${this.activeAvatar.current_conversation_id}_coll`;
      if (this.activeListeners[listener]) {
        this.activeListeners[listener]();
        delete this.activeListeners[listener];
      }

      await this.db
        .collection('users')
        .doc(this.activeUser.user_id)
        .collection('avatars')
        .doc(this.activeAvatar.avatar_id)
        .update({
          updated_at: FieldValue.serverTimestamp(),
          current_conversation_id: newConversationId,
        });

      this.subscribeListOfAllMessagesForCurrentConversation(
        this.activeUser.user_id,
        this.activeAvatar.avatar_id,
        newConversationId
      );

      console.log(`Successfully changed conversation to ${newConversationId}`);
      return newConversationId;
    } catch (error) {
      console.error(`Error changing conversation: ${error}`);
      throw error;
    }
  }

  async changeActiveAvatar(newActiveAvatarId) {
    try {
      if (this.activeAvatar) {
        const listeners = [
          this.activeAvatar.avatar_id,
          `${this.activeAvatar.avatar_id}_conversations_coll`,
          `${this.activeAvatar.avatar_id}_uploaded_documents_coll`,
          `${this.activeAvatar.avatar_id}_training_documents_coll`,
        ];

        listeners.forEach((listener) => {
          if (this.activeListeners[listener]) {
            this.activeListeners[listener]();
            delete this.activeListeners[listener];
          }
        });
      }

      this.subscribeActiveAvatar(this.activeUser.user_id, newActiveAvatarId);
      this.subscribeListOfConversationsForActiveAvatar(
        this.activeUser.user_id,
        newActiveAvatarId
      );
      this.subscribeListOfAllUploadedDocumentsForActiveAvatar(
        this.activeUser.user_id,
        newActiveAvatarId
      );
      this.subscribeListOfAllProcessedTrainingDataForActiveAvatar(
        this.activeUser.user_id,
        newActiveAvatarId
      );

      console.log(
        `Successfully switched to new active avatar: ${newActiveAvatarId}`
      );
      return newActiveAvatarId;
    } catch (error) {
      console.error(`Error changing active avatar: ${error}`);
      throw error;
    }
  }

  async getConversationMediaStoragePaths(userId, avatarId, conversationId) {
    const messagesRef = this.db
      .collection('users')
      .doc(userId)
      .collection('avatars')
      .doc(avatarId)
      .collection('conversations')
      .doc(conversationId)
      .collection('messages');

    const messages = await messagesRef.get();
    const storagePaths = [];

    messages.forEach((messageDoc) => {
      const messageData = messageDoc.data();
      const mediaList = messageData.media || [];

      mediaList.forEach((mediaItem) => {
        if (mediaItem.storagePath) {
          storagePaths.push(mediaItem.storagePath);
        }
      });
    });

    return storagePaths;
  }

  async deleteConversationMediaFromStorage(userId, avatarId, conversationId) {
    const storagePaths = await this.getConversationMediaStoragePaths(
      userId,
      avatarId,
      conversationId
    );

    if (storagePaths.length === 0) {
      console.log('No storage media found to delete.');
      return { deleted_count: 0, failed_deletions: [] };
    }

    let deletedCount = 0;
    const failedDeletions = [];

    for (const storagePath of storagePaths) {
      try {
        const blob = this.bucket.file(storagePath);
        const [exists] = await blob.exists();
        if (exists) {
          await blob.delete();
          deletedCount++;
        } else {
          failedDeletions.push({
            storage_path: storagePath,
            error: 'Blob does not exist',
          });
        }
      } catch (error) {
        failedDeletions.push({
          storage_path: storagePath,
          error: error.message,
        });
      }
    }

    return { deleted_count: deletedCount, failed_deletions: failedDeletions };
  }

  async deleteConversation(conversationId, deleteUser = false) {
    try {
      if (
        conversationId === this.activeAvatar.current_conversation_id &&
        !deleteUser
      ) {
        console.log('Error: cannot delete current conversation');
        return;
      }

      await this.deleteConversationMediaFromStorage(
        this.activeUser.user_id,
        this.activeAvatar.avatar_id,
        conversationId
      );

      const conversationDocRef = this.db
        .collection('users')
        .doc(this.activeUser.user_id)
        .collection('avatars')
        .doc(this.activeAvatar.avatar_id)
        .collection('conversations')
        .doc(conversationId);

      await this.db.recursiveDelete(conversationDocRef);
    } catch (error) {
      console.error(`Error deleting conversation ${conversationId}: ${error}`);
      throw error;
    }
  }

  async deleteAvatar(avatarId, deleteUser = false) {
    try {
      if (avatarId === this.activeAvatar.avatar_id && !deleteUser) {
        console.log('Error: cannot delete current active avatar');
        return;
      }

      const conversationColl = await this.db
        .collection('users')
        .doc(this.activeUser.user_id)
        .collection('avatars')
        .doc(avatarId)
        .collection('conversations')
        .get();

      for (const doc of conversationColl.docs) {
        await this.deleteConversation(doc.data().conversation_id, deleteUser);
      }

      // Delete training documents
      const trainingColl = await this.db
        .collection('users')
        .doc(this.activeUser.user_id)
        .collection('avatars')
        .doc(avatarId)
        .collection('training_documents')
        .get();

      const pathsToDelete = trainingColl.docs.map(
        (doc) => doc.data().storagePath
      );
      for (const path of pathsToDelete) {
        await this.bucket.file(path).delete();
      }

      await this.db.recursiveDelete(
        this.db
          .collection('users')
          .doc(this.activeUser.user_id)
          .collection('avatars')
          .doc(avatarId)
          .collection('training_documents')
      );

      // Delete uploaded documents
      await this.db.recursiveDelete(
        this.db
          .collection('users')
          .doc(this.activeUser.user_id)
          .collection('avatars')
          .doc(avatarId)
          .collection('uploaded_documents')
      );

      // Delete avatar
      await this.db.recursiveDelete(
        this.db
          .collection('users')
          .doc(this.activeUser.user_id)
          .collection('avatars')
          .doc(avatarId)
      );
    } catch (error) {
      console.error(`Error deleting avatar ${avatarId}: ${error}`);
      throw error;
    }
  }
}
