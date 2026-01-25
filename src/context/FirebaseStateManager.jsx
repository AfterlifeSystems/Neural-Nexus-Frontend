// FirebaseStateManager.jsx - Unified Firebase State Management Context
// Consolidates auth, user management, avatars, conversations, messages, and storage
// Provides live data feeds via onSnapshot listeners

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  writeBatch,
  deleteField,
} from 'firebase/firestore';

import {
  getStorage,
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage';

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const FirebaseStateContext = createContext(null);

export const useFirebaseState = () => {
  const context = useContext(FirebaseStateContext);
  if (!context) {
    throw new Error(
      'useFirebaseState must be used within FirebaseStateProvider'
    );
  }
  return context;
};

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export const FirebaseStateProvider = ({ children, firebaseApp }) => {
  // Initialize Firebase services
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);
  const storage = getStorage(firebaseApp);

  // ============================================================================
  // STATE - Mirrors Python UserStateManager attributes
  // ============================================================================

  const [activeUser, setActiveUser] = useState(null); // Full user profile from Firestore
  const [authUser, setAuthUser] = useState(null); // Firebase Auth user object
  const [activeAvatar, setActiveAvatar] = useState(null); // Currently selected avatar
  const [allAvatars, setAllAvatars] = useState([]); // User's avatars (limited to 50)
  const [allConversations, setAllConversations] = useState([]); // Active avatar's conversations
  const [allMessages, setAllMessages] = useState([]); // Current conversation's messages
  const [allUploadedAvatarDocuments, setAllUploadedAvatarDocuments] = useState(
    []
  ); // Uploaded docs
  const [allAvatarAdapterTrainingData, setAllAvatarAdapterTrainingData] =
    useState([]); // Training data

  // Track active listeners for cleanup
  const activeListenersRef = useRef({});

  // Loading states
  const [loading, setLoading] = useState({
    auth: true,
    user: false,
    avatars: false,
    avatar: false,
    conversations: false,
    messages: false,
    documents: false,
    trainingData: false,
  });

  // Access token for backend API calls
  const [accessToken, setAccessToken] = useState(null);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const setLoadingState = useCallback((key, value) => {
    setLoading((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Generate storage path
  const getStoragePath = useCallback(
    (userId, avatarId, storageFolder, filename) => {
      return `users/${userId}/avatars/${avatarId}/${storageFolder}/${filename}`;
    },
    []
  );

  // ============================================================================
  // LISTENER MANAGEMENT
  // ============================================================================

  const unsubscribeListener = useCallback((listenerId) => {
    if (activeListenersRef.current[listenerId]) {
      console.log(`🔌 Unsubscribing listener: ${listenerId}`);
      activeListenersRef.current[listenerId]();
      delete activeListenersRef.current[listenerId];
    }
  }, []);

  const unsubscribeAll = useCallback(() => {
    console.log('🔌 Unsubscribing all listeners');
    Object.keys(activeListenersRef.current).forEach((listenerId) => {
      activeListenersRef.current[listenerId]();
    });
    activeListenersRef.current = {};
  }, []);

  // ============================================================================
  // AUTH STATE LISTENER
  // ============================================================================

  useEffect(() => {
    console.log('🔐 Setting up auth state listener');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔐 Auth state changed:', user ? user.uid : 'null');
      setAuthUser(user);

      if (user) {
        try {
          const token = await user.getIdToken();
          setAccessToken(token);
        } catch (error) {
          console.error('Failed to get access token:', error);
        }
      } else {
        setAccessToken(null);
        // Clear all state when logged out
        setActiveUser(null);
        setActiveAvatar(null);
        setAllAvatars([]);
        setAllConversations([]);
        setAllMessages([]);
        setAllUploadedAvatarDocuments([]);
        setAllAvatarAdapterTrainingData([]);
        unsubscribeAll();
      }

      setLoadingState('auth', false);
    });

    return () => {
      console.log('🔐 Cleaning up auth listener');
      unsubscribe();
    };
  }, [auth, setLoadingState, unsubscribeAll]);

  // ============================================================================
  // DOCUMENT LISTENERS
  // ============================================================================

  // Subscribe to active user document
  const subscribeActiveUser = useCallback(
    (userId) => {
      const listenerId = `user_${userId}`;

      if (activeListenersRef.current[listenerId]) {
        console.log(`✅ User listener already active: ${userId}`);
        return;
      }

      console.log(`👤 Starting user listener: ${userId}`);
      setLoadingState('user', true);

      const userDocRef = doc(db, 'users', userId);

      const unsubscribe = onSnapshot(
        userDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const userData = { id: snapshot.id, ...snapshot.data() };
            console.log(
              '👤 User data updated:',
              userData.username || userData.email
            );
            setActiveUser(userData);
          } else {
            console.warn('👤 User document does not exist');
            setActiveUser(null);
          }
          setLoadingState('user', false);
        },
        (error) => {
          console.error('❌ Error in user listener:', error);
          setLoadingState('user', false);
        }
      );

      activeListenersRef.current[listenerId] = unsubscribe;
    },
    [db, setLoadingState]
  );

  // Subscribe to active avatar document
  const subscribeActiveAvatar = useCallback(
    (userId, avatarId) => {
      const listenerId = `avatar_${avatarId}`;

      if (activeListenersRef.current[listenerId]) {
        console.log(`✅ Avatar listener already active: ${avatarId}`);
        return;
      }

      console.log(`🤖 Starting avatar listener: ${avatarId}`);
      setLoadingState('avatar', true);

      const avatarDocRef = doc(db, 'users', userId, 'avatars', avatarId);

      const unsubscribe = onSnapshot(
        avatarDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const avatarData = { id: snapshot.id, ...snapshot.data() };
            console.log('🤖 Avatar data updated:', avatarData.name);
            setActiveAvatar(avatarData);
          } else {
            console.warn('🤖 Avatar document does not exist');
            setActiveAvatar(null);
          }
          setLoadingState('avatar', false);
        },
        (error) => {
          console.error('❌ Error in avatar listener:', error);
          setLoadingState('avatar', false);
        }
      );

      activeListenersRef.current[listenerId] = unsubscribe;
    },
    [db, setLoadingState]
  );

  // ============================================================================
  // COLLECTION LISTENERS
  // ============================================================================

  // Subscribe to list of avatars for active user
  const subscribeListOfAvatarsForActiveUser = useCallback(
    (userId) => {
      const listenerId = `avatars_coll_${userId}`;

      if (activeListenersRef.current[listenerId]) {
        console.log(`✅ Avatars collection listener already active`);
        return;
      }

      console.log(
        `🤖 Starting avatars collection listener for user: ${userId}`
      );
      setLoadingState('avatars', true);

      const avatarsCollRef = collection(db, 'users', userId, 'avatars');
      const avatarsQuery = query(avatarsCollRef, orderBy('created_at', 'asc'));

      const unsubscribe = onSnapshot(
        avatarsQuery,
        (snapshot) => {
          const avatars = snapshot.docs.map((doc) => ({
            id: doc.id,
            avatar_id: doc.id,
            ...doc.data(),
          }));
          console.log(`🤖 Avatars updated: ${avatars.length} avatars`);
          setAllAvatars(avatars);
          setLoadingState('avatars', false);
        },
        (error) => {
          console.error('❌ Error in avatars listener:', error);
          setLoadingState('avatars', false);
        }
      );

      activeListenersRef.current[listenerId] = unsubscribe;
    },
    [db, setLoadingState]
  );

  // Subscribe to conversations for active avatar
  const subscribeListOfConversationsForActiveAvatar = useCallback(
    (userId, avatarId) => {
      const listenerId = `conversations_coll_${avatarId}`;

      if (activeListenersRef.current[listenerId]) {
        console.log(`✅ Conversations listener already active`);
        return;
      }

      console.log(`💬 Starting conversations listener for avatar: ${avatarId}`);
      setLoadingState('conversations', true);

      const conversationsCollRef = collection(
        db,
        'users',
        userId,
        'avatars',
        avatarId,
        'conversations'
      );
      const conversationsQuery = query(
        conversationsCollRef,
        orderBy('created_at', 'asc')
      );

      const unsubscribe = onSnapshot(
        conversationsQuery,
        (snapshot) => {
          const conversations = snapshot.docs.map((doc) => ({
            id: doc.id,
            conversation_id: doc.id,
            ...doc.data(),
          }));
          console.log(
            `💬 Conversations updated: ${conversations.length} conversations`
          );
          setAllConversations(conversations);
          setLoadingState('conversations', false);
        },
        (error) => {
          console.error('❌ Error in conversations listener:', error);
          setLoadingState('conversations', false);
        }
      );

      activeListenersRef.current[listenerId] = unsubscribe;
    },
    [db, setLoadingState]
  );

  // Subscribe to uploaded documents for active avatar
  const subscribeListOfUploadedDocumentsForActiveAvatar = useCallback(
    (userId, avatarId) => {
      const listenerId = `uploaded_docs_coll_${avatarId}`;

      if (activeListenersRef.current[listenerId]) {
        console.log(`✅ Uploaded documents listener already active`);
        return;
      }

      console.log(
        `📄 Starting uploaded documents listener for avatar: ${avatarId}`
      );
      setLoadingState('documents', true);

      const docsCollRef = collection(
        db,
        'users',
        userId,
        'avatars',
        avatarId,
        'uploaded_documents'
      );
      const docsQuery = query(docsCollRef, orderBy('created_at', 'asc'));

      const unsubscribe = onSnapshot(
        docsQuery,
        (snapshot) => {
          const documents = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          console.log(
            `📄 Uploaded documents updated: ${documents.length} documents`
          );
          setAllUploadedAvatarDocuments(documents);
          setLoadingState('documents', false);
        },
        (error) => {
          console.error('❌ Error in uploaded documents listener:', error);
          setLoadingState('documents', false);
        }
      );

      activeListenersRef.current[listenerId] = unsubscribe;
    },
    [db, setLoadingState]
  );

  // Subscribe to training data for active avatar
  const subscribeListOfTrainingDataForActiveAvatar = useCallback(
    (userId, avatarId) => {
      const listenerId = `training_data_coll_${avatarId}`;

      if (activeListenersRef.current[listenerId]) {
        console.log(`✅ Training data listener already active`);
        return;
      }

      console.log(`📊 Starting training data listener for avatar: ${avatarId}`);
      setLoadingState('trainingData', true);

      const trainingCollRef = collection(
        db,
        'users',
        userId,
        'avatars',
        avatarId,
        'training_documents'
      );
      const trainingQuery = query(
        trainingCollRef,
        orderBy('created_at', 'asc')
      );

      const unsubscribe = onSnapshot(
        trainingQuery,
        (snapshot) => {
          const trainingData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          console.log(`📊 Training data updated: ${trainingData.length} items`);
          setAllAvatarAdapterTrainingData(trainingData);
          setLoadingState('trainingData', false);
        },
        (error) => {
          console.error('❌ Error in training data listener:', error);
          setLoadingState('trainingData', false);
        }
      );

      activeListenersRef.current[listenerId] = unsubscribe;
    },
    [db, setLoadingState]
  );

  // Subscribe to messages for current conversation
  const subscribeListOfMessagesForCurrentConversation = useCallback(
    (userId, avatarId, conversationId) => {
      const listenerId = `messages_coll_${conversationId}`;

      if (activeListenersRef.current[listenerId]) {
        console.log(
          `✅ Messages listener already active for conversation: ${conversationId}`
        );
        return;
      }

      console.log(
        `💬 Starting messages listener for conversation: ${conversationId}`
      );
      setLoadingState('messages', true);

      const messagesCollRef = collection(
        db,
        'users',
        userId,
        'avatars',
        avatarId,
        'conversations',
        conversationId,
        'messages'
      );
      const messagesQuery = query(messagesCollRef, orderBy('timestamp', 'asc'));

      // Reference to conversation document for count updates
      const conversationDocRef = doc(
        db,
        'users',
        userId,
        'avatars',
        avatarId,
        'conversations',
        conversationId
      );

      const unsubscribe = onSnapshot(
        messagesQuery,
        async (snapshot) => {
          const messages = snapshot.docs.map((doc) => ({
            id: doc.id,
            message_id: doc.id,
            ...doc.data(),
          }));

          console.log(`💬 Messages updated: ${messages.length} messages`);
          setAllMessages(messages);

          // Update conversation metadata when new message is added
          // NOTE: In JavaScript SDK, we handle this manually unlike Python's automatic increment
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
              try {
                await updateDoc(conversationDocRef, {
                  message_count: increment(1),
                  updated_at: serverTimestamp(),
                });
              } catch (error) {
                console.error('Failed to update conversation count:', error);
              }
            }
          });

          setLoadingState('messages', false);
        },
        (error) => {
          console.error('❌ Error in messages listener:', error);
          setLoadingState('messages', false);
        }
      );

      activeListenersRef.current[listenerId] = unsubscribe;
    },
    [db, setLoadingState]
  );

  // ============================================================================
  // AUTO-SUBSCRIPTION MANAGEMENT
  // ============================================================================

  // Auto-subscribe to user when auth user changes
  useEffect(() => {
    if (authUser) {
      subscribeActiveUser(authUser.uid);
      subscribeListOfAvatarsForActiveUser(authUser.uid);
    } else {
      unsubscribeListener(`user_${authUser?.uid}`);
      unsubscribeListener(`avatars_coll_${authUser?.uid}`);
    }
  }, [
    authUser,
    subscribeActiveUser,
    subscribeListOfAvatarsForActiveUser,
    unsubscribeListener,
  ]);

  // Auto-subscribe to avatar-related collections when active avatar changes
  useEffect(() => {
    if (authUser && activeAvatar) {
      const avatarId = activeAvatar.avatar_id || activeAvatar.id;

      subscribeActiveAvatar(authUser.uid, avatarId);
      subscribeListOfConversationsForActiveAvatar(authUser.uid, avatarId);
      subscribeListOfUploadedDocumentsForActiveAvatar(authUser.uid, avatarId);
      subscribeListOfTrainingDataForActiveAvatar(authUser.uid, avatarId);

      // Subscribe to messages for current conversation
      const currentConversationId =
        activeAvatar.current_conversation_id ||
        activeAvatar.default_conversation;
      if (currentConversationId) {
        subscribeListOfMessagesForCurrentConversation(
          authUser.uid,
          avatarId,
          currentConversationId
        );
      }
    }
  }, [
    authUser,
    activeAvatar,
    subscribeActiveAvatar,
    subscribeListOfConversationsForActiveAvatar,
    subscribeListOfUploadedDocumentsForActiveAvatar,
    subscribeListOfTrainingDataForActiveAvatar,
    subscribeListOfMessagesForCurrentConversation,
  ]);

  // ============================================================================
  // AUTH FUNCTIONS
  // ============================================================================

  const signupUser = useCallback(
    async (email, password, displayName = null) => {
      try {
        console.log('📝 Creating new user account');

        // Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const uid = userCredential.user.uid;

        // Update display name if provided
        if (displayName) {
          await updateProfile(userCredential.user, { displayName });
        }

        // Create Firestore user document
        const userData = {
          user_id: uid,
          display_name: displayName || email.split('@')[0],
          email: email,
          created_at: serverTimestamp(),
          last_login: serverTimestamp(),
          currently_logged_in: true,
          avatars: [],
          last_used_avatar_id: null,
        };

        await setDoc(doc(db, 'users', uid), userData);

        console.log('✅ User account created successfully');
        return { success: true, user: userCredential.user };
      } catch (error) {
        console.error('❌ Signup failed:', error);
        throw error;
      }
    },
    [auth, db]
  );

  const loginUser = useCallback(
    async (email, password) => {
      try {
        console.log('🔐 Logging in user');

        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

        // Update last login
        await updateDoc(doc(db, 'users', userCredential.user.uid), {
          last_login: serverTimestamp(),
          currently_logged_in: true,
        });

        console.log('✅ Login successful');
        return { success: true, user: userCredential.user };
      } catch (error) {
        console.error('❌ Login failed:', error);
        throw error;
      }
    },
    [auth, db]
  );

  const logoutUser = useCallback(async () => {
    try {
      console.log('🔐 Logging out user');

      if (authUser) {
        await updateDoc(doc(db, 'users', authUser.uid), {
          currently_logged_in: false,
          updated_at: serverTimestamp(),
        });
      }

      unsubscribeAll();
      await signOut(auth);

      console.log('✅ Logout successful');
      return { success: true };
    } catch (error) {
      console.error('❌ Logout failed:', error);
      throw error;
    }
  }, [auth, db, authUser, unsubscribeAll]);

  // ============================================================================
  // USER MANAGEMENT FUNCTIONS
  // ============================================================================

  const updateUser = useCallback(
    async (updatePayload) => {
      try {
        if (!authUser) throw new Error('No authenticated user');

        console.log('👤 Updating user profile');

        const userDocRef = doc(db, 'users', authUser.uid);
        await updateDoc(userDocRef, {
          ...updatePayload,
          updated_at: serverTimestamp(),
        });

        console.log('✅ User updated successfully');
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to update user:', error);
        throw error;
      }
    },
    [db, authUser]
  );

  const deleteUser = useCallback(async () => {
    try {
      if (!authUser) throw new Error('No authenticated user');

      console.log('🗑️ Deleting user account and all data');

      // Delete all avatars (which will cascade delete conversations and messages)
      const avatarDeletions = allAvatars.map((avatar) =>
        deleteAvatar(avatar.avatar_id || avatar.id, true)
      );
      await Promise.all(avatarDeletions);

      // Delete user document
      // NOTE: JavaScript SDK doesn't have recursive_delete like Python
      // We need to manually delete subcollections or use Firebase Functions
      await deleteDoc(doc(db, 'users', authUser.uid));

      // Delete all storage files for user
      const userStorageRef = ref(storage, `users/${authUser.uid}`);
      try {
        const fileList = await listAll(userStorageRef);
        const deletePromises = fileList.items.map((item) => deleteObject(item));
        await Promise.all(deletePromises);
      } catch (error) {
        console.warn('Storage deletion error:', error);
      }

      // Delete auth user
      await authUser.delete();

      console.log('✅ User deleted successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to delete user:', error);
      throw error;
    }
  }, [authUser, allAvatars, db, storage]);

  // ============================================================================
  // AVATAR MANAGEMENT FUNCTIONS
  // ============================================================================

  const createAvatar = useCallback(
    async (name, description = null, iconFile = null) => {
      try {
        if (!authUser) throw new Error('No authenticated user');

        console.log('🤖 Creating new avatar');

        const userId = authUser.uid;
        const avatarId = doc(collection(db, 'users', userId, 'avatars')).id;
        const conversationId = doc(
          collection(db, 'users', userId, 'avatars', avatarId, 'conversations')
        ).id;

        // Upload icon if provided
        let iconData = null;
        if (iconFile) {
          const iconStoragePath = getStoragePath(
            userId,
            avatarId,
            'icon',
            `${Date.now()}_${iconFile.name}`
          );
          const iconRef = ref(storage, iconStoragePath);
          await uploadBytes(iconRef, iconFile);
          const iconUrl = await getDownloadURL(iconRef);

          iconData = {
            url: iconUrl,
            storagePath: iconStoragePath,
            name: iconFile.name,
            size: iconFile.size,
            type: iconFile.type,
          };
        }

        // Create avatar document
        const avatarData = {
          avatar_id: avatarId,
          user_id: userId,
          name,
          description: description || '',
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
          icon: iconData,
          reference_audio: null,
          current_conversation_id: conversationId,
          adapter: null,
          metadatas: {},
        };

        await setDoc(doc(db, 'users', userId, 'avatars', avatarId), avatarData);

        // Create initial conversation
        const conversationData = {
          conversation_id: conversationId,
          summary: 'Initial Conversation',
          message_count: 0,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        };

        await setDoc(
          doc(
            db,
            'users',
            userId,
            'avatars',
            avatarId,
            'conversations',
            conversationId
          ),
          conversationData
        );

        // Create storage directory structure using .keep files
        const directories = [
          getStoragePath(userId, avatarId, 'adapter', '.keep'),
          getStoragePath(userId, avatarId, 'adapter/training_data', '.keep'),
          getStoragePath(userId, avatarId, 'icon', '.keep'),
          getStoragePath(userId, avatarId, 'reference_audio', '.keep'),
          getStoragePath(userId, avatarId, 'message_media', '.keep'),
        ];

        for (const dirPath of directories) {
          try {
            const dirRef = ref(storage, dirPath);
            await uploadString(dirRef, '', 'raw', {
              contentType: 'application/x-keep',
            });
          } catch (error) {
            console.warn(`Failed to create directory ${dirPath}:`, error);
          }
        }

        console.log('✅ Avatar created successfully:', avatarId);
        return { success: true, avatarId, conversationId };
      } catch (error) {
        console.error('❌ Failed to create avatar:', error);
        throw error;
      }
    },
    [authUser, db, storage, getStoragePath]
  );

  const updateAvatar = useCallback(
    async (avatarId, updatePayload) => {
      try {
        if (!authUser) throw new Error('No authenticated user');

        console.log('🤖 Updating avatar:', avatarId);

        const avatarDocRef = doc(
          db,
          'users',
          authUser.uid,
          'avatars',
          avatarId
        );
        await updateDoc(avatarDocRef, {
          ...updatePayload,
          updated_at: serverTimestamp(),
        });

        console.log('✅ Avatar updated successfully');
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to update avatar:', error);
        throw error;
      }
    },
    [db, authUser]
  );

  const updateAvatarMetadata = useCallback(
    async (avatarId, newMetadata) => {
      try {
        if (!authUser) throw new Error('No authenticated user');

        console.log('🤖 Updating avatar metadata:', avatarId);

        const avatarDocRef = doc(
          db,
          'users',
          authUser.uid,
          'avatars',
          avatarId
        );

        // Use dot notation to update specific keys inside the 'metadatas' map
        const updatePayload = {};
        Object.entries(newMetadata).forEach(([key, value]) => {
          updatePayload[`metadatas.${key}`] = value;
        });
        updatePayload.updated_at = serverTimestamp();

        await updateDoc(avatarDocRef, updatePayload);

        console.log('✅ Avatar metadata updated successfully');
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to update avatar metadata:', error);
        throw error;
      }
    },
    [db, authUser]
  );

  const deleteAvatar = useCallback(
    async (avatarId, deleteUserFlag = false) => {
      try {
        if (!authUser) throw new Error('No authenticated user');

        // Prevent deletion of current active avatar unless deleting user
        if (
          !deleteUserFlag &&
          activeAvatar &&
          (activeAvatar.avatar_id === avatarId || activeAvatar.id === avatarId)
        ) {
          throw new Error('Cannot delete currently active avatar');
        }

        console.log('🗑️ Deleting avatar:', avatarId);

        // Delete all conversations for this avatar
        const conversationsSnapshot = await getDocs(
          collection(
            db,
            'users',
            authUser.uid,
            'avatars',
            avatarId,
            'conversations'
          )
        );

        for (const convDoc of conversationsSnapshot.docs) {
          await deleteConversation(convDoc.id, true);
        }

        // Delete training documents
        const trainingDocsSnapshot = await getDocs(
          collection(
            db,
            'users',
            authUser.uid,
            'avatars',
            avatarId,
            'training_documents'
          )
        );

        const trainingStoragePaths = trainingDocsSnapshot.docs.map(
          (doc) => doc.data().storagePath
        );
        for (const path of trainingStoragePaths) {
          try {
            await deleteObject(ref(storage, path));
          } catch (error) {
            console.warn('Failed to delete training file:', error);
          }
        }

        // Delete all training documents from Firestore
        const trainingBatch = writeBatch(db);
        trainingDocsSnapshot.docs.forEach((doc) => {
          trainingBatch.delete(doc.ref);
        });
        await trainingBatch.commit();

        // Delete uploaded documents
        const uploadedDocsSnapshot = await getDocs(
          collection(
            db,
            'users',
            authUser.uid,
            'avatars',
            avatarId,
            'uploaded_documents'
          )
        );

        const uploadedBatch = writeBatch(db);
        uploadedDocsSnapshot.docs.forEach((doc) => {
          uploadedBatch.delete(doc.ref);
        });
        await uploadedBatch.commit();

        // Delete avatar storage folder
        const avatarStorageRef = ref(
          storage,
          `users/${authUser.uid}/avatars/${avatarId}`
        );
        try {
          const fileList = await listAll(avatarStorageRef);
          const deletePromises = fileList.items.map((item) =>
            deleteObject(item)
          );
          await Promise.all(deletePromises);
        } catch (error) {
          console.warn('Avatar storage deletion error:', error);
        }

        // Delete avatar document
        await deleteDoc(doc(db, 'users', authUser.uid, 'avatars', avatarId));

        console.log('✅ Avatar deleted successfully');
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to delete avatar:', error);
        throw error;
      }
    },
    [authUser, activeAvatar, db, storage]
  );

  const changeActiveAvatar = useCallback(
    async (newAvatarId) => {
      try {
        if (!authUser) throw new Error('No authenticated user');

        console.log('🔄 Changing active avatar to:', newAvatarId);

        // Unsubscribe from current avatar's listeners
        if (activeAvatar) {
          const currentAvatarId = activeAvatar.avatar_id || activeAvatar.id;
          unsubscribeListener(`avatar_${currentAvatarId}`);
          unsubscribeListener(`conversations_coll_${currentAvatarId}`);
          unsubscribeListener(`uploaded_docs_coll_${currentAvatarId}`);
          unsubscribeListener(`training_data_coll_${currentAvatarId}`);

          // Unsubscribe from current conversation's messages
          const currentConvId =
            activeAvatar.current_conversation_id ||
            activeAvatar.default_conversation;
          if (currentConvId) {
            unsubscribeListener(`messages_coll_${currentConvId}`);
          }
        }

        // Get the new avatar data
        const newAvatarDoc = await getDoc(
          doc(db, 'users', authUser.uid, 'avatars', newAvatarId)
        );
        if (!newAvatarDoc.exists()) {
          throw new Error('Avatar not found');
        }

        const newAvatarData = { id: newAvatarDoc.id, ...newAvatarDoc.data() };

        // Update active avatar state (this will trigger the useEffect to subscribe to new avatar)
        setActiveAvatar(newAvatarData);

        // Update user's last_used_avatar_id
        await updateDoc(doc(db, 'users', authUser.uid), {
          last_used_avatar_id: newAvatarId,
        });

        console.log('✅ Active avatar changed successfully');
        return { success: true, avatar: newAvatarData };
      } catch (error) {
        console.error('❌ Failed to change active avatar:', error);
        throw error;
      }
    },
    [authUser, activeAvatar, db, unsubscribeListener]
  );

  // ============================================================================
  // CONVERSATION MANAGEMENT FUNCTIONS
  // ============================================================================

  const createConversation = useCallback(
    async (avatarId, summary = '') => {
      try {
        if (!authUser) throw new Error('No authenticated user');

        console.log('💬 Creating new conversation');

        const conversationId = doc(
          collection(
            db,
            'users',
            authUser.uid,
            'avatars',
            avatarId,
            'conversations'
          )
        ).id;

        const conversationData = {
          conversation_id: conversationId,
          summary: summary || 'New Conversation',
          message_count: 0,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        };

        await setDoc(
          doc(
            db,
            'users',
            authUser.uid,
            'avatars',
            avatarId,
            'conversations',
            conversationId
          ),
          conversationData
        );

        console.log('✅ Conversation created successfully:', conversationId);
        return { success: true, conversationId };
      } catch (error) {
        console.error('❌ Failed to create conversation:', error);
        throw error;
      }
    },
    [authUser, db]
  );

  const changeCurrentConversation = useCallback(
    async (newConversationId) => {
      try {
        if (!authUser || !activeAvatar) throw new Error('No active avatar');

        console.log('🔄 Changing current conversation to:', newConversationId);

        const avatarId = activeAvatar.avatar_id || activeAvatar.id;

        // Unsubscribe from current conversation's messages
        const currentConvId =
          activeAvatar.current_conversation_id ||
          activeAvatar.default_conversation;
        if (currentConvId) {
          unsubscribeListener(`messages_coll_${currentConvId}`);
        }

        // Update avatar's current conversation
        await updateDoc(doc(db, 'users', authUser.uid, 'avatars', avatarId), {
          current_conversation_id: newConversationId,
          updated_at: serverTimestamp(),
        });

        // Subscribe to new conversation's messages
        subscribeListOfMessagesForCurrentConversation(
          authUser.uid,
          avatarId,
          newConversationId
        );

        console.log('✅ Current conversation changed successfully');
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to change conversation:', error);
        throw error;
      }
    },
    [
      authUser,
      activeAvatar,
      db,
      unsubscribeListener,
      subscribeListOfMessagesForCurrentConversation,
    ]
  );

  const deleteConversation = useCallback(
    async (conversationId, deleteUserFlag = false) => {
      try {
        if (!authUser || !activeAvatar) throw new Error('No active avatar');

        const avatarId = activeAvatar.avatar_id || activeAvatar.id;
        const currentConvId =
          activeAvatar.current_conversation_id ||
          activeAvatar.default_conversation;

        // Prevent deletion of current conversation unless deleting user/avatar
        if (!deleteUserFlag && conversationId === currentConvId) {
          throw new Error('Cannot delete current conversation');
        }

        console.log('🗑️ Deleting conversation:', conversationId);

        // Get all messages to find media storage paths
        const messagesSnapshot = await getDocs(
          collection(
            db,
            'users',
            authUser.uid,
            'avatars',
            avatarId,
            'conversations',
            conversationId,
            'messages'
          )
        );

        const mediaStoragePaths = [];
        messagesSnapshot.docs.forEach((doc) => {
          const messageData = doc.data();
          if (messageData.media && Array.isArray(messageData.media)) {
            messageData.media.forEach((media) => {
              if (media.storagePath) {
                mediaStoragePaths.push(media.storagePath);
              }
            });
          }
        });

        // Delete all media files from storage
        for (const path of mediaStoragePaths) {
          try {
            await deleteObject(ref(storage, path));
          } catch (error) {
            console.warn('Failed to delete media file:', error);
          }
        }

        // Delete all messages
        const messageBatch = writeBatch(db);
        messagesSnapshot.docs.forEach((doc) => {
          messageBatch.delete(doc.ref);
        });
        await messageBatch.commit();

        // Delete conversation document
        await deleteDoc(
          doc(
            db,
            'users',
            authUser.uid,
            'avatars',
            avatarId,
            'conversations',
            conversationId
          )
        );

        console.log('✅ Conversation deleted successfully');
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to delete conversation:', error);
        throw error;
      }
    },
    [authUser, activeAvatar, db, storage]
  );

  // ============================================================================
  // MESSAGE MANAGEMENT FUNCTIONS
  // ============================================================================

  const createMessage = useCallback(
    async (conversationId, role, content, mediaFiles = []) => {
      try {
        if (!authUser || !activeAvatar) throw new Error('No active avatar');

        console.log('💬 Creating new message');

        const avatarId = activeAvatar.avatar_id || activeAvatar.id;
        const messageId = doc(
          collection(
            db,
            'users',
            authUser.uid,
            'avatars',
            avatarId,
            'conversations',
            conversationId,
            'messages'
          )
        ).id;

        // Upload media files and build media objects
        const mediaObjects = [];
        const llamaContent = [];

        // Add text content to Llama format
        if (content) {
          llamaContent.push({
            type: 'text',
            text: content,
          });
        }

        // Upload each media file
        for (const file of mediaFiles) {
          const mediaStoragePath = getStoragePath(
            authUser.uid,
            avatarId,
            'message_media',
            `${messageId}_${Date.now()}_${file.name}`
          );

          const mediaRef = ref(storage, mediaStoragePath);
          await uploadBytes(mediaRef, file);
          const downloadUrl = await getDownloadURL(mediaRef);

          // Read file as base64 for Llama API format
          const reader = new FileReader();
          const base64Data = await new Promise((resolve) => {
            reader.onload = (e) => {
              const base64 = e.target.result.split(',')[1];
              resolve(base64);
            };
            reader.readAsDataURL(file);
          });

          const mediaObject = {
            storage_file_id: `${messageId}_${Date.now()}`,
            storagePath: mediaStoragePath,
            url: downloadUrl,
            name: file.name,
            size: file.size,
            type: file.type,
            metadata: {
              user_id: authUser.uid,
              avatar_id: avatarId,
              conversation_id: conversationId,
              message_id: messageId,
              base64: base64Data,
            },
          };

          mediaObjects.push(mediaObject);

          // Add to Llama content format
          if (file.type.startsWith('image/')) {
            llamaContent.push({
              type: 'image_url',
              image_url: {
                url: `data:${file.type};base64,${base64Data}`,
              },
            });
          }
        }

        // Create message document
        const messageData = {
          message_id: messageId,
          role: role,
          content: llamaContent,
          timestamp: serverTimestamp(),
          created_at: serverTimestamp(),
          media: mediaObjects,
        };

        await setDoc(
          doc(
            db,
            'users',
            authUser.uid,
            'avatars',
            avatarId,
            'conversations',
            conversationId,
            'messages',
            messageId
          ),
          messageData
        );

        console.log('✅ Message created successfully:', messageId);
        return { success: true, messageId, message: messageData };
      } catch (error) {
        console.error('❌ Failed to create message:', error);
        throw error;
      }
    },
    [authUser, activeAvatar, db, storage, getStoragePath]
  );

  const editMessage = useCallback(
    async (conversationId, messageId, updatePayload) => {
      try {
        if (!authUser || !activeAvatar) throw new Error('No active avatar');

        console.log('✏️ Editing message:', messageId);

        const avatarId = activeAvatar.avatar_id || activeAvatar.id;
        const messageDocRef = doc(
          db,
          'users',
          authUser.uid,
          'avatars',
          avatarId,
          'conversations',
          conversationId,
          'messages',
          messageId
        );

        await updateDoc(messageDocRef, {
          ...updatePayload,
          updated_at: serverTimestamp(),
        });

        console.log('✅ Message edited successfully');
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to edit message:', error);
        throw error;
      }
    },
    [authUser, activeAvatar, db]
  );

  // ============================================================================
  // STORAGE MANAGEMENT FUNCTIONS
  // ============================================================================

  const uploadToStorage = useCallback(
    async (file, avatarId, storageFolder, options = {}) => {
      try {
        if (!authUser) throw new Error('No authenticated user');

        console.log('📤 Uploading to storage:', file.name);

        const {
          storageFileId = null,
          conversationId = null,
          messageId = null,
          additionalMetadata = {},
        } = options;

        const fileId =
          storageFileId ||
          `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const filename = `${fileId}_${file.name}`;
        const storagePath = getStoragePath(
          authUser.uid,
          avatarId,
          storageFolder,
          filename
        );

        // Upload file
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);

        // Build storage file object
        const storageFile = {
          storage_file_id: fileId,
          storagePath: storagePath,
          url: downloadUrl,
          name: file.name,
          size: file.size,
          type: file.type,
          created_at: serverTimestamp(),
          metadata: {
            user_id: authUser.uid,
            avatar_id: avatarId,
            insights: [],
            ...additionalMetadata,
          },
        };

        if (conversationId) {
          storageFile.metadata.conversation_id = conversationId;
        }
        if (messageId) {
          storageFile.metadata.message_id = messageId;
        }

        console.log('✅ File uploaded successfully');
        return storageFile;
      } catch (error) {
        console.error('❌ Failed to upload to storage:', error);
        throw error;
      }
    },
    [authUser, storage, getStoragePath]
  );

  const updateAvatarIcon = useCallback(
    async (avatarId, iconFile) => {
      try {
        if (!authUser) throw new Error('No authenticated user');

        console.log('🖼️ Updating avatar icon');

        const storageFile = await uploadToStorage(iconFile, avatarId, 'icon');

        await updateDoc(doc(db, 'users', authUser.uid, 'avatars', avatarId), {
          icon: storageFile,
          updated_at: serverTimestamp(),
        });

        console.log('✅ Avatar icon updated successfully');
        return storageFile;
      } catch (error) {
        console.error('❌ Failed to update avatar icon:', error);
        throw error;
      }
    },
    [authUser, db, uploadToStorage]
  );

  const updateAvatarReferenceAudio = useCallback(
    async (avatarId, audioFile) => {
      try {
        if (!authUser) throw new Error('No authenticated user');

        console.log('🎵 Updating avatar reference audio');

        const storageFile = await uploadToStorage(
          audioFile,
          avatarId,
          'reference_audio'
        );

        await updateDoc(doc(db, 'users', authUser.uid, 'avatars', avatarId), {
          reference_audio: storageFile,
          updated_at: serverTimestamp(),
        });

        console.log('✅ Avatar reference audio updated successfully');
        return storageFile;
      } catch (error) {
        console.error('❌ Failed to update avatar reference audio:', error);
        throw error;
      }
    },
    [authUser, db, uploadToStorage]
  );

  const uploadDocument = useCallback(
    async (avatarId, file) => {
      try {
        if (!authUser) throw new Error('No authenticated user');

        console.log('📄 Uploading document');

        const storageFileId = doc(
          collection(
            db,
            'users',
            authUser.uid,
            'avatars',
            avatarId,
            'uploaded_documents'
          )
        ).id;

        const storageFile = await uploadToStorage(
          file,
          avatarId,
          'uploaded_documents',
          {
            storageFileId,
          }
        );

        // Save to Firestore uploaded_documents collection
        await setDoc(
          doc(
            db,
            'users',
            authUser.uid,
            'avatars',
            avatarId,
            'uploaded_documents',
            storageFileId
          ),
          storageFile
        );

        console.log('✅ Document uploaded successfully');
        return storageFile;
      } catch (error) {
        console.error('❌ Failed to upload document:', error);
        throw error;
      }
    },
    [authUser, db, uploadToStorage]
  );

  const saveTrainingData = useCallback(
    async (avatarId, processedData, originalDocName) => {
      try {
        if (!authUser) throw new Error('No authenticated user');

        console.log('📊 Saving training data');

        const storageFileId = doc(
          collection(
            db,
            'users',
            authUser.uid,
            'avatars',
            avatarId,
            'training_documents'
          )
        ).id;

        const jsonContent = JSON.stringify(processedData);
        const jsonBlob = new Blob([jsonContent], { type: 'application/json' });

        const storagePath = getStoragePath(
          authUser.uid,
          avatarId,
          'adapter/training_data',
          `${storageFileId}.json`
        );

        const storageRef = ref(storage, storagePath);
        await uploadString(storageRef, jsonContent, 'raw', {
          contentType: 'application/json',
        });
        const downloadUrl = await getDownloadURL(storageRef);

        const storageFile = {
          storage_file_id: storageFileId,
          storagePath: storagePath,
          url: downloadUrl,
          name: `${originalDocName}_training.json`,
          size: jsonContent.length,
          type: 'application/json',
          created_at: serverTimestamp(),
          metadata: {
            user_id: authUser.uid,
            avatar_id: avatarId,
            original_document_name: originalDocName,
            insights: [],
          },
        };

        await setDoc(
          doc(
            db,
            'users',
            authUser.uid,
            'avatars',
            avatarId,
            'training_documents',
            storageFileId
          ),
          storageFile
        );

        console.log('✅ Training data saved successfully');
        return storageFile;
      } catch (error) {
        console.error('❌ Failed to save training data:', error);
        throw error;
      }
    },
    [authUser, db, storage, getStoragePath]
  );

  // ============================================================================
  // UTILITY FUNCTIONS FOR LLAMA API
  // ============================================================================

  const getLlamaApiPayload = useCallback((messages) => {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }, []);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value = {
    // Firebase instances
    auth,
    db,
    storage,

    // State
    authUser,
    activeUser,
    activeAvatar,
    allAvatars,
    allConversations,
    allMessages,
    allUploadedAvatarDocuments,
    allAvatarAdapterTrainingData,
    loading,
    accessToken,

    // State setters (for manual control if needed)
    setActiveAvatar,

    // Auth functions
    signupUser,
    loginUser,
    logoutUser,

    // User management
    updateUser,
    deleteUser,

    // Avatar management
    createAvatar,
    updateAvatar,
    updateAvatarMetadata,
    deleteAvatar,
    changeActiveAvatar,

    // Conversation management
    createConversation,
    changeCurrentConversation,
    deleteConversation,

    // Message management
    createMessage,
    editMessage,

    // Storage management
    uploadToStorage,
    updateAvatarIcon,
    updateAvatarReferenceAudio,
    uploadDocument,
    saveTrainingData,

    // Utilities
    getLlamaApiPayload,
    unsubscribeAll,
  };

  return (
    <FirebaseStateContext.Provider value={value}>
      {children}
    </FirebaseStateContext.Provider>
  );
};

export default FirebaseStateProvider;
