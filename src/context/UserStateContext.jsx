// src/contexts/UserStateContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, storage, auth } from '../firebase/config';
import { UserStateManager } from '../services/UserStateManager';

const UserStateContext = createContext(null);

export const useUserState = () => {
  const context = useContext(UserStateContext);
  if (!context) {
    throw new Error('useUserState must be used within UserStateProvider');
  }
  return context;
};

export const UserStateProvider = ({ children }) => {
  const [manager] = useState(() => new UserStateManager(db, storage, auth));
  const [currentUser, setCurrentUser] = useState(null); // auth information
  const [loading, setLoading] = useState(true);

  // Real-time states
  const [activeUser, setActiveUser] = useState(null); // firestore metadata
  const [activeAvatar, setActiveAvatar] = useState(null);
  const [allAvatars, setAllAvatars] = useState([]);
  const [allConversations, setAllConversations] = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [allUploadedAvatarDocuments, setAllUploadedAvatarDocuments] = useState(
    []
  );
  const [allAvatarAdapterTrainingData, setAllAvatarAdapterTrainingData] =
    useState([]);

  // ── All actions as top-level hooks ──────────────────────────────────────
  const signup = useCallback(
    (email, pw, name) => manager.signupUser(email, pw, name),
    [manager]
  );
  const login = useCallback(
    (email, pw) => manager.loginUser(email, pw),
    [manager]
  );
  const logout = useCallback(() => manager.logoutUser(), [manager]);
  const updateUser = useCallback(
    (payload) => manager.updateUser(payload),
    [manager]
  );
  const deleteUser = useCallback(() => manager.deleteUser(), [manager]);

  const createAvatar = useCallback(
    (uid, name, desc) => manager.createAvatar(uid, name, desc),
    [manager]
  );
  const updateAvatar = useCallback(
    (uid, aid, payload) => manager.updateAvatar(uid, aid, payload),
    [manager]
  );
  const updateAvatarMetadata = useCallback(
    (uid, aid, meta) => manager.updateAvatarMetadata(uid, aid, meta),
    [manager]
  );
  const deleteAvatar = useCallback(
    (aid, delUser) => manager.deleteAvatar(aid, delUser),
    [manager]
  );
  const changeActiveAvatar = useCallback(
    (aid) => manager.changeActiveAvatar(aid),
    [manager]
  );

  const createConversation = useCallback(
    (uid, aid) => manager.createConversation(uid, aid),
    [manager]
  );
  const changeCurrentConversation = useCallback(
    (cid) => manager.changeCurrentConversation(cid),
    [manager]
  );
  const deleteConversation = useCallback(
    (cid, delUser) => manager.deleteConversation(cid, delUser),
    [manager]
  );

  const createMessage = useCallback(
    (...args) => manager.messageManager.createMessage(...args),
    [manager]
  );
  const editMessage = useCallback(
    (...args) => manager.editMessage(...args),
    [manager]
  );
  const getLlamaApiPayload = useCallback(
    (msgs) => manager.messageManager.getLlamaApiPayload(msgs),
    [manager]
  );

  const uploadDocument = useCallback(
    (file, uid, aid) =>
      manager.avatarDocumentManager.uploadDocument(file, uid, aid),
    [manager]
  );
  const saveTrainingData = useCallback(
    (data, uid, aid, name) =>
      manager.avatarDocumentManager.saveTrainingData(data, uid, aid, name),
    [manager]
  );
  const updateAvatarIcon = useCallback(
    (file, uid, aid) =>
      manager.avatarDocumentManager.updateAvatarIcon(file, uid, aid),
    [manager]
  );
  const updateAvatarReferenceAudio = useCallback(
    (file, uid, aid) =>
      manager.avatarDocumentManager.updateAvatarReferenceAudio(file, uid, aid),
    [manager]
  );
  const updateAvatarAdapter = useCallback(
    (file, uid, aid) =>
      manager.avatarDocumentManager.updateAvatarAdapter(file, uid, aid),
    [manager]
  );

  // 1. Auth listener + top-level user & avatars
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(!!user);

      if (!user) {
        setActiveUser(null);
        setActiveAvatar(null);
        setAllAvatars([]);
        setAllConversations([]);
        setAllMessages([]);
        setAllUploadedAvatarDocuments([]);
        setAllAvatarAdapterTrainingData([]);
        return;
      }

      // User document
      const userUnsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        setActiveUser(snap.exists() ? snap.data() : null);
      });

      // All avatars collection
      const avatarsQ = query(
        collection(db, 'users', user.uid, 'avatars'),
        orderBy('created_at')
      );
      const avatarsUnsub = onSnapshot(avatarsQ, (snap) => {
        setAllAvatars(snap.docs.map((d) => d.data()));
      });

      return () => {
        userUnsub();
        avatarsUnsub();
      };
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Active avatar + dependent collections
  useEffect(() => {
    if (!currentUser?.uid || !activeUser?.last_used_avatar_id) return;

    const userId = currentUser.uid;
    const avatarId = activeUser.last_used_avatar_id;

    // Active avatar document
    const avatarUnsub = onSnapshot(
      doc(db, 'users', userId, 'avatars', avatarId),
      (snap) => setActiveAvatar(snap.exists() ? snap.data() : null)
    );

    // Conversations
    const convsQ = query(
      collection(db, 'users', userId, 'avatars', avatarId, 'conversations'),
      orderBy('created_at')
    );
    const convsUnsub = onSnapshot(convsQ, (snap) =>
      setAllConversations(snap.docs.map((d) => d.data()))
    );

    // Uploaded documents
    const docsQ = query(
      collection(
        db,
        'users',
        userId,
        'avatars',
        avatarId,
        'uploaded_documents'
      ),
      orderBy('created_at')
    );
    const docsUnsub = onSnapshot(docsQ, (snap) =>
      setAllUploadedAvatarDocuments(snap.docs.map((d) => d.data()))
    );

    // Training data
    const trainingQ = query(
      collection(
        db,
        'users',
        userId,
        'avatars',
        avatarId,
        'training_documents'
      ),
      orderBy('created_at')
    );
    const trainingUnsub = onSnapshot(trainingQ, (snap) =>
      setAllAvatarAdapterTrainingData(snap.docs.map((d) => d.data()))
    );

    // Messages — depends on current conversation id
    let messagesUnsub = () => {};
    if (activeAvatar?.current_conversation_id) {
      const messagesQ = query(
        collection(
          db,
          'users',
          userId,
          'avatars',
          avatarId,
          'conversations',
          activeAvatar.current_conversation_id,
          'messages'
        ),
        orderBy('created_at')
      );
      messagesUnsub = onSnapshot(messagesQ, (snap) =>
        setAllMessages(snap.docs.map((d) => d.data()))
      );
    }

    return () => {
      avatarUnsub();
      convsUnsub();
      docsUnsub();
      trainingUnsub();
      messagesUnsub();
    };
  }, [
    currentUser?.uid,
    activeUser?.last_used_avatar_id,
    activeAvatar?.current_conversation_id,
  ]);

  const value = useMemo(
    () => ({
      manager,
      currentUser,
      loading,
      activeUser,
      activeAvatar,
      allAvatars,
      allConversations,
      allMessages,
      allUploadedAvatarDocuments,
      allAvatarAdapterTrainingData,
      signup,
      login,
      logout,
      updateUser,
      deleteUser,
      createAvatar,
      updateAvatar,
      updateAvatarMetadata,
      deleteAvatar,
      changeActiveAvatar,
      createConversation,
      changeCurrentConversation,
      deleteConversation,
      createMessage,
      editMessage,
      getLlamaApiPayload,
      uploadDocument,
      saveTrainingData,
      updateAvatarIcon,
      updateAvatarReferenceAudio,
      updateAvatarAdapter,
    }),
    [
      manager,
      currentUser,
      loading,
      activeUser,
      activeAvatar,
      allAvatars,
      allConversations,
      allMessages,
      allUploadedAvatarDocuments,
      allAvatarAdapterTrainingData,
      signup,
      login,
      logout,
      updateUser,
      deleteUser,
      createAvatar,
      updateAvatar,
      updateAvatarMetadata,
      deleteAvatar,
      changeActiveAvatar,
      createConversation,
      changeCurrentConversation,
      deleteConversation,
      createMessage,
      editMessage,
      getLlamaApiPayload,
      uploadDocument,
      saveTrainingData,
      updateAvatarIcon,
      updateAvatarReferenceAudio,
      updateAvatarAdapter,
    ]
  );

  return (
    <UserStateContext.Provider value={value}>
      {children}
    </UserStateContext.Provider>
  );
};
