import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

class UserStateManager {
  constructor(firebaseConfig, project = 'neuralnexus-467517') {
    // Initialize Firebase
    const app = initializeApp({ ...firebaseConfig, projectId: project });
    this.googleCloudDb = getFirestore(app);

    this.activeUser = null;
    this.activeAvatar = null;
    this.currentConversation = null;
    this.allAvatars = [];
    this.allConversations = [];
    this.allMessages = [];
    this.allAvatarDocuments = [];

    // Stores the listeners: { "user_123": unsubscribe_function, ... }
    this.activeListeners = {};

    // JavaScript doesn't need explicit locking in single-threaded environments
    // but we can implement a simple mutex if needed for async operations
    this.lockQueue = Promise.resolve();
  }

  /**
   * Helper to serialize async operations (mimics Python's lock)
   */
  async _withLock(callback) {
    const previousLock = this.lockQueue;
    let releaseLock;

    this.lockQueue = new Promise((resolve) => {
      releaseLock = resolve;
    });

    await previousLock;
    try {
      return await callback();
    } finally {
      releaseLock();
    }
  }

  /**
   * Returns a closure to handle document snapshot updates
   */
  _onSnapshotDocCallback(docRefId, localDocData) {
    return (snapshot) => {
      this._withLock(async () => {
        if (snapshot.exists()) {
          // Update the reference to localDocData
          Object.assign(localDocData, snapshot.data());
          console.log(`Updated local_doc_data for user_id: ${docRefId}`);
          console.log(localDocData);
        } else {
          console.log(
            `local_doc_data does not exist for doc_ref_id: ${docRefId}`
          );
        }
      });
    };
  }

  /**
   * Returns a closure to handle collection snapshot updates
   */
  _onSnapshotCollCallback(collRefId, localCollList, filterField = null) {
    return (snapshot) => {
      this._withLock(async () => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            console.log('added a new doc to collection');
          } else if (change.type === 'removed') {
            console.log('REMOVED doc in collection');
          } else if (change.type === 'modified') {
            console.log('MODIFIED doc in collection');
          }
        });

        // Update the collection list
        const newData = snapshot.docs.map((doc) => {
          const data = doc.data();
          return filterField ? data[filterField] : data;
        });

        // Clear and repopulate the array
        localCollList.length = 0;
        localCollList.push(...newData);

        console.log(`Updated local_coll_list for coll_ref_id: ${collRefId}`);
        console.log(localCollList);
      });
    };
  }

  /**
   * Starts a listener for a user document if one doesn't exist
   */
  subscribeActiveUser(userId) {
    return this._withLock(async () => {
      if (!this.activeListeners[userId]) {
        console.log(`Starting new listener for ${userId}`);
        const docRef = doc(this.googleCloudDb, 'users', userId);

        const unsubscribe = onSnapshot(
          docRef,
          this._onSnapshotDocCallback(userId, this.activeUser)
        );

        this.activeListeners[userId] = unsubscribe;
      }
    });
  }

  /**
   * Starts a listener for an avatar document
   */
  subscribeActiveAvatar(userId, avatarId) {
    return this._withLock(async () => {
      if (!this.activeListeners[avatarId]) {
        console.log(
          `Starting new listener for user: ${userId}; avatar: ${avatarId}`
        );
        const docRef = doc(
          this.googleCloudDb,
          'users',
          userId,
          'avatars',
          avatarId
        );

        const unsubscribe = onSnapshot(
          docRef,
          this._onSnapshotDocCallback(avatarId, this.activeAvatar)
        );

        this.activeListeners[avatarId] = unsubscribe;
      }
    });
  }

  /**
   * Starts a listener for the avatars collection
   */
  subscribeListOfAvatarsForActiveUser(userId) {
    return this._withLock(async () => {
      const listener = userId + '_coll';

      if (!this.activeListeners[listener]) {
        console.log(`Starting new listener for ${userId} avatar collection`);
        const collRef = collection(
          this.googleCloudDb,
          'users',
          userId,
          'avatars'
        );
        const q = query(collRef, orderBy('created_at'));

        const unsubscribe = onSnapshot(
          q,
          this._onSnapshotCollCallback(userId, this.allAvatars)
        );

        this.activeListeners[listener] = unsubscribe;
      }
    });
  }

  /**
   * Starts a listener for conversations collection
   */
  subscribeListOfConversationsForActiveAvatar(userId, avatarId) {
    return this._withLock(async () => {
      const listener = avatarId + '_conversations_coll';

      if (!this.activeListeners[listener]) {
        console.log(
          `Starting new listener for ${avatarId} conversations collection`
        );
        const collRef = collection(
          this.googleCloudDb,
          'users',
          userId,
          'avatars',
          avatarId,
          'conversations'
        );
        const q = query(collRef, orderBy('created_at'));

        const unsubscribe = onSnapshot(
          q,
          this._onSnapshotCollCallback(
            avatarId,
            this.allConversations,
            'conversation_id'
          )
        );

        this.activeListeners[listener] = unsubscribe;
      }
    });
  }

  /**
   * Starts a listener for documents collection
   */
  subscribeListOfAllUploadedDocumentsForActiveAvatar(userId, avatarId) {
    return this._withLock(async () => {
      const listener = avatarId + '_documents_coll';

      if (!this.activeListeners[listener]) {
        console.log(
          `Starting new listener for ${avatarId} documents collection`
        );
        const collRef = collection(
          this.googleCloudDb,
          'users',
          userId,
          'avatars',
          avatarId,
          'documents'
        );
        const q = query(collRef, orderBy('created_at'));

        const unsubscribe = onSnapshot(
          q,
          this._onSnapshotCollCallback(avatarId, this.allAvatarDocuments)
        );

        this.activeListeners[listener] = unsubscribe;
      }
    });
  }

  /**
   * Starts a listener for messages collection
   */
  subscribeListOfAllMessagesForCurrentConversation(
    userId,
    avatarId,
    conversationId
  ) {
    return this._withLock(async () => {
      const listener = conversationId + '_coll';

      if (!this.activeListeners[listener]) {
        console.log(
          `Starting new listener for ${conversationId} messages collection`
        );
        const collRef = collection(
          this.googleCloudDb,
          'users',
          userId,
          'avatars',
          avatarId,
          'conversations',
          conversationId,
          'messages'
        );
        const q = query(collRef, orderBy('created_at'));

        const unsubscribe = onSnapshot(
          q,
          this._onSnapshotCollCallback(conversationId, this.allMessages)
        );

        this.activeListeners[listener] = unsubscribe;
      }
    });
  }

  /**
   * Creates a new user in Firestore
   */
  async createUser() {
    const userRef = doc(collection(this.googleCloudDb, 'users'));
    const userId = userRef.id;

    const userData = {
      user_id: userId,
      created_at: serverTimestamp(),
    };

    await setDoc(userRef, userData);
    return userId;
  }

  /**
   * Unsubscribe from all listeners - used for cleanup
   */
  unsubscribeAll() {
    Object.values(this.activeListeners).forEach((unsubscribe) => {
      unsubscribe();
    });
    this.activeListeners = {};
    console.log('All listeners unsubscribed');
  }
}

export default UserStateManager;
