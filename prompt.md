This is the current AuthContext, AvatarSelection component, and authService and avatarService and userService; The AuthContext maintains global variables and localstorage; the services call the firebase services and the avatar selection component is the main navigation area of the app; I need to create an avatar in addition to the previous requirements;
please list how each of the requirements are met with the lifecycle of the application and how the data is persisted even across browser losing and constantly insync and available to all compenents::


import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, storage } from '../firebase/config.js';
import toast from 'react-hot-toast';

export const signup = async (username, email, password) => {
  try {
    console.log(email);
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const uid = userCredential.user.uid;

    // Send email verification
    // await sendEmailVerification(userCredential.user);

    // Update display name
    // await updateProfile(userCredential.user, { displayName: username });

    // Create Firestore profile
    const userDoc = {
      user_id: userCredential.user.uid,
      username,
      email,
      created_at: new Date(),
      last_login: null,
      currently_logged_in: true,
      avatars: [],
      last_used_avatar: null,
    };

    // 3. Write to Firestore
    // Using doc(db, 'collection', ID) ensures the document ID matches the Auth UID
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, userDoc);
    console.log(`✅ Profile created in Firestore for UID: ${uid}`);
    // return userCredential.user;

    // await setDoc(doc(db, 'users', userCredential.user.uid), userDoc);
    // toast.success(
    //   'Signup successful! Please check your email to verify your account.',
    //   { duration: Infinity }
    // );

    return userCredential.user;
  } catch (error) {
    console.error('Signup error:', error);
    console.error('Signup error:', error);
    toast.error(error.message);
    // throw error;
    // Display user-friendly error messages
    let errorMessage = 'Signup failed. Please try again.';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'This email is already registered';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Please provide a valid email address';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password must be at least 6 characters';
    } else if (error.message) {
      errorMessage = error.message;
    }

    toast.error(errorMessage);
    throw error;
  }
};

export const login = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Allow unverified emails if we are using the emulator
    const isEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

    // Check if email is verified
    // if (!userCredential.user.emailVerified && !isEmulator) {
    //   await signOut(auth);
    //   throw new Error('Please verify your email before logging in');
    // }

    // Update last_login in Firestore
    await updateDoc(doc(db, 'users', userCredential.user.uid), {
      last_login: new Date(),
      currently_logged_in: true,
    });
    localStorage.setItem('user', userCredential.user);
    // toast.success('Login successful!');
    return userCredential.user;
  } catch (error) {
    console.error('Login error:', error);

    let errorMessage = 'Login failed. Please try again.';
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'No account found with this email';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'Incorrect password';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address';
    } else if (error.message) {
      errorMessage = error.message;
    }

    toast.error(errorMessage);
    throw error;
  }
};

// export const logout = async () => {
try {
  const user = auth.currentUser;
  if (user) {
    await updateDoc(doc(db, 'users', user.uid), {
      currently_logged_in: false,
    });
  }
  await signOut(auth);
} catch (error) {
  throw error;
}
// };

export const logout = async () => {
  try {
    const user = auth.currentUser;
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), {
        currently_logged_in: false,
      });
    }
    await signOut(auth);
    localStorage.removeItem('user');
    // Clear local state
    // setUser(null);
    // setUserProfile(null);
    // setIsLoggedIn(false);
    // setUserAvatars([]);
    // setActiveAvatar(null);
    // setAccessToken(null);
    // localStorage.removeItem('user');
    // localStorage.removeItem('firebase_user_id');
    // localStorage.removeItem('avatars');
    // localStorage.removeItem('access_token');
  } catch (error) {
    console.error('Logout error:', error);
    toast.error('Logout completed with errors');
    // throw error;
  }
};


-----------


// services/avatar_Service.jsx
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { v4 as uuidv4 } from 'uuid';

export const createAvatar = async (userId, name, description, iconFile) => {
  const avatarId = uuidv4();
  const conversationId = uuidv4(); // Create default conversation ID

  // Store as a Digital Twin document following firestore_structure.md
  const avatarData = {
    avatar_id: avatarId,
    user_id: userId,
    name: name.trim(),
    description: (description || '').trim(),
    created_at: new Date().toISOString(),
    icon: null, // will be an object {url, storagePath, name, size, type}
    reference_audio: null,
    files: [],
    system_prompt_reference_image_description: '',
    system_prompt_reference_audio_description: '',
    system_prompt_description: '',
    default_conversation: conversationId,
    conversations: [conversationId],
  };

  // Upload icon if provided and store metadata + URL
  if (iconFile) {
    if (iconFile.size > 4 * 1024 * 1024) {
      throw new Error('Icon exceeds 4 MB limit');
    }
    const iconRef = ref(
      storage,
      `users/${userId}/avatars/${avatarId}/icon/${uuidv4()}_${iconFile.name}`
    );
    await uploadBytes(iconRef, iconFile);
    const iconUrl = await getDownloadURL(iconRef);
    avatarData.icon = {
      url: iconUrl,
      storagePath: iconRef.fullPath,
      name: iconFile.name,
      size: iconFile.size,
      type: iconFile.type,
    };
  }

  // Create avatar (digital twin) document with avatarId as document ID
  const avatarRef = doc(db, 'avatars', avatarId);
  await setDoc(avatarRef, avatarData);

  // Create default conversation document (store summary and counts)
  const conversationRef = doc(
    db,
    'avatars',
    avatarId,
    'conversations',
    conversationId
  );
  await setDoc(conversationRef, {
    conversation_id: conversationId,
    summary: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    message_count: 0,
  });

  // Update user's avatars list
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  const avatars = userDoc.data().avatars || [];
  await updateDoc(userRef, {
    avatars: [...avatars, avatarId],
    last_used_avatar: avatarId,
  });

  // Create directory structure in Storage (using .keep files)
  const directories = [
    `users/${userId}/.keep`,
    `users/${userId}/avatars/${avatarId}/adapters/.keep`,
    `users/${userId}/avatars/${avatarId}/adapters/training_data/.keep`,
  ];

  for (const dirPath of directories) {
    try {
      const dirRef = ref(storage, dirPath);
      await uploadBytes(dirRef, new Blob([''], { type: 'text/plain' }));
    } catch (error) {
      console.warn(`Failed to create directory ${dirPath}:`, error);
    }
  }

  // Generate download URLs
  const iconUrl = avatarData.icon
    ? avatarData.icon.url ||
      (await getDownloadURL(ref(storage, avatarData.icon.storagePath)))
    : null;
  const userVectorstoreUrl = await getDownloadURL(
    ref(storage, `users/${userId}/vectorstore/.keep`)
  );
  const avatarVectorstoreUrl = await getDownloadURL(
    ref(storage, `users/${userId}/avatars/${avatarId}/vectorstore_data/.keep`)
  );
  const qloraAdapterUrl = await getDownloadURL(
    ref(storage, `users/${userId}/avatars/${avatarId}/adapters/.keep`)
  );
  const qloraTrainingUrl = await getDownloadURL(
    ref(
      storage,
      `users/${userId}/avatars/${avatarId}/adapters/training_data/.keep`
    )
  );

  return {
    id: avatarId,
    avatar_id: avatarId,
    user_id: userId,
    name: avatarData.name,
    description: avatarData.description,
    created_at: avatarData.created_at,
    icon: avatarData.icon,
    icon_url: iconUrl,
    user_vectorstore_url: userVectorstoreUrl,
    avatar_vectorstore_data_url: avatarVectorstoreUrl,
    qlora_adapter_url: qloraAdapterUrl,
    qlora_training_data_url: qloraTrainingUrl,
    adapter_initialized: true,
    vectorstore_initialized: true,
  };
};

export const getAvatars = async (userId, limitCount = 50, skip = 0) => {
  const avatarsQuery = query(
    collection(db, 'avatars'),
    where('user_id', '==', userId),
    orderBy('created_at', 'asc')
  );

  const snapshot = await getDocs(avatarsQuery);
  const avatars = [];

  for (const docSnapshot of snapshot.docs.slice(skip, skip + limitCount)) {
    const data = docSnapshot.data();
    let iconUrl = null;

    if (data.icon) {
      try {
        const storagePath = data.icon.storagePath || data.icon;
        if (storagePath) {
          iconUrl = await getDownloadURL(ref(storage, storagePath));
        } else if (data.icon.url) {
          iconUrl = data.icon.url;
        }
      } catch (error) {
        console.error('Error getting icon URL:', error);
      }
    }

    avatars.push({
      avatar_id: docSnapshot.id,
      name: data.name,
      description: data.description,
      icon: iconUrl,
    });
  }

  return avatars;
};

export const updateAvatar = async (userId, avatarId, updates) => {
  const avatarRef = doc(db, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Digital twin not found or unauthorized');
  }

  const updateData = {
    updated_at: new Date().toISOString(),
    ...updates,
  };

  // If updating icon path/object, normalize to object shape
  if (updateData.icon && typeof updateData.icon === 'string') {
    // assume it's a storage path string; try to resolve URL
    try {
      const url = await getDownloadURL(ref(storage, updateData.icon));
      updateData.icon = {
        url,
        storagePath: updateData.icon,
      };
    } catch (e) {
      // leave as-is
    }
  }

  await updateDoc(avatarRef, updateData);

  // If icon was updated, return the new URL
  if (updateData.icon) {
    return { icon_url: updateData.icon.url || null };
  }

  return {};
};

export const updateAvatarWithIcon = async (
  userId,
  avatarId,
  name,
  description,
  iconFile
) => {
  const avatarRef = doc(db, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Digital twin not found or unauthorized');
  }

  const updates = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) {
    updates.name = name.trim();
  }
  if (description !== undefined) {
    updates.description = (description || '').trim();
  }

  let iconUrl = null;
  if (iconFile) {
    if (iconFile.size > 4 * 1024 * 1024) {
      throw new Error('Icon exceeds 4 MB limit');
    }

    // Delete old icon if exists (support object or string)
    const oldIcon = avatarDoc.data().icon;
    const oldStoragePath =
      oldIcon?.storagePath || (typeof oldIcon === 'string' ? oldIcon : null);
    if (oldStoragePath) {
      try {
        await deleteObject(ref(storage, oldStoragePath));
      } catch (error) {
        console.warn('Failed to delete old icon:', error);
      }
    }

    // Upload new icon and store as object
    const iconRef = ref(
      storage,
      `users/${userId}/avatars/${avatarId}/icon/${uuidv4()}_${iconFile.name}`
    );
    await uploadBytes(iconRef, iconFile);
    const url = await getDownloadURL(iconRef);
    updates.icon = {
      url,
      storagePath: iconRef.fullPath,
      name: iconFile.name,
      size: iconFile.size,
      type: iconFile.type,
    };
    iconUrl = url;
  }

  await updateDoc(avatarRef, updates);

  return {
    status: 'success',
    avatar_id: avatarId,
    updated_fields: Object.keys(updates),
    icon_url: iconUrl,
  };
};

export const deleteAvatar = async (userId, avatarId) => {
  const avatarRef = doc(db, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  // Delete all files in Storage
  const avatarStorageRef = ref(storage, `users/${userId}/avatars/${avatarId}`);
  try {
    const files = await listAll(avatarStorageRef);
    await Promise.all(files.items.map((file) => deleteObject(file)));
  } catch (error) {
    console.warn('Error deleting avatar files:', error);
  }

  // Delete avatar document
  await deleteDoc(avatarRef);

  // Remove from user's avatar list
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  const avatars = userDoc.data().avatars || [];
  await updateDoc(userRef, {
    avatars: avatars.filter((id) => id !== avatarId),
  });

  return {
    status: 'success',
    avatar_id: avatarId,
    deleted: true,
  };
};

export const selectAvatar = async (userId, avatarId) => {
  const avatarRef = doc(db, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const avatarData = avatarDoc.data();

  // Ensure avatar has at least one conversation
  let conversations = avatarData.conversations || [];
  if (conversations.length === 0) {
    // Create default conversation if none exists
    const conversationId = uuidv4();
    const conversationRef = doc(
      db,
      `avatars/${avatarId}/conversations`,
      conversationId
    );
    await setDoc(conversationRef, {
      conversation_id: conversationId,
      avatar_id: avatarId,
      user_id: userId,
      title: 'Default Conversation',
      created_at: new Date(),
      updated_at: new Date(),
      is_default: true,
    });

    await updateDoc(avatarRef, {
      conversations: [conversationId],
      default_conversation: conversationId,
    });
    conversations = [conversationId];
  }

  // Update last_used_avatar
  await updateDoc(doc(db, 'users', userId), {
    last_used_avatar: avatarId,
  });

  // Get default conversation ID (or first conversation)
  const defaultConversationId =
    avatarData.default_conversation || conversations[0];

  // Get messages from the default conversation
  const messagesQuery = query(
    collection(
      db,
      `avatars/${avatarId}/conversations/${defaultConversationId}/messages`
    ),
    orderBy('timestamp', 'asc'),
    limit(50)
  );

  const messagesSnapshot = await getDocs(messagesQuery);
  const messages = messagesSnapshot.docs.map((doc) => ({
    _id: doc.id,
    ...doc.data(),
    timestamp:
      doc.data().timestamp?.toDate().toISOString() || new Date().toISOString(),
  }));

  // Generate URLs
  const iconUrl = avatarData.icon
    ? await getDownloadURL(ref(storage, avatarData.icon))
    : null;
  const userVectorstoreUrl = await getDownloadURL(
    ref(storage, `users/${userId}/vectorstore/.keep`)
  );
  const avatarVectorstoreUrl = await getDownloadURL(
    ref(storage, `users/${userId}/avatars/${avatarId}/vectorstore_data/.keep`)
  );
  const qloraAdapterUrl = await getDownloadURL(
    ref(storage, `users/${userId}/avatars/${avatarId}/adapters/.keep`)
  );
  const qloraTrainingUrl = await getDownloadURL(
    ref(
      storage,
      `users/${userId}/avatars/${avatarId}/adapters/training_data/.keep`
    )
  );

  return {
    status: 'success',
    avatar_id: avatarId,
    user_id: userId,
    name: avatarData.name,
    description: avatarData.description,
    icon_url: iconUrl,
    user_vectorstore_url: userVectorstoreUrl,
    avatar_vectorstore_data_url: avatarVectorstoreUrl,
    qlora_adapter_url: qloraAdapterUrl,
    qlora_training_data_url: qloraTrainingUrl,
    model_loaded: false,
    vectorstore_loaded: false,
    messages,
    default_conversation: defaultConversationId,
    conversations: conversations,
  };
};

// Conversation management functions

/**
 * Create a new conversation for an avatar
 */
export const createConversation = async (
  userId,
  avatarId,
  title = 'New Conversation'
) => {
  const avatarRef = doc(db, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const conversationId = uuidv4();
  const conversationRef = doc(
    db,
    `avatars/${avatarId}/conversations`,
    conversationId
  );

  await setDoc(conversationRef, {
    conversation_id: conversationId,
    avatar_id: avatarId,
    user_id: userId,
    title: title.trim(),
    created_at: new Date(),
    updated_at: new Date(),
    is_default: false,
  });

  // Update avatar's conversations list
  const avatarData = avatarDoc.data();
  const conversations = avatarData.conversations || [];
  await updateDoc(avatarRef, {
    conversations: [...conversations, conversationId],
    updated_at: new Date(),
  });

  return {
    conversation_id: conversationId,
    title,
    created_at: new Date().toISOString(),
  };
};

/**
 * Get all conversations for an avatar
 */
export const getConversations = async (userId, avatarId) => {
  const avatarRef = doc(db, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const conversationsQuery = query(
    collection(db, `avatars/${avatarId}/conversations`),
    orderBy('updated_at', 'desc')
  );

  const snapshot = await getDocs(conversationsQuery);
  return snapshot.docs.map((doc) => ({
    conversation_id: doc.id,
    ...doc.data(),
    created_at: doc.data().created_at?.toDate().toISOString(),
    updated_at: doc.data().updated_at?.toDate().toISOString(),
  }));
};

/**
 * Get a specific conversation
 */
export const getConversation = async (userId, avatarId, conversationId) => {
  const avatarRef = doc(db, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const conversationRef = doc(
    db,
    `avatars/${avatarId}/conversations`,
    conversationId
  );
  const conversationDoc = await getDoc(conversationRef);

  if (!conversationDoc.exists()) {
    throw new Error('Conversation not found');
  }

  return {
    conversation_id: conversationId,
    ...conversationDoc.data(),
    created_at: conversationDoc.data().created_at?.toDate().toISOString(),
    updated_at: conversationDoc.data().updated_at?.toDate().toISOString(),
  };
};

/**
 * Update conversation title
 */
export const updateConversation = async (
  userId,
  avatarId,
  conversationId,
  updates
) => {
  const avatarRef = doc(db, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const conversationRef = doc(
    db,
    `avatars/${avatarId}/conversations`,
    conversationId
  );

  await updateDoc(conversationRef, {
    ...updates,
    updated_at: new Date(),
  });

  return { status: 'success', conversation_id: conversationId };
};

/**
 * Delete a conversation (but ensure at least one remains)
 */
export const deleteConversation = async (userId, avatarId, conversationId) => {
  const avatarRef = doc(db, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const avatarData = avatarDoc.data();
  const conversations = avatarData.conversations || [];

  // Ensure at least one conversation remains
  if (conversations.length <= 1) {
    throw new Error(
      'Cannot delete the last conversation. Each avatar must have at least one conversation.'
    );
  }

  // Delete conversation document (this will also delete all messages in subcollection)
  const conversationRef = doc(
    db,
    `avatars/${avatarId}/conversations`,
    conversationId
  );
  await deleteDoc(conversationRef);

  // Update avatar's conversations list
  const updatedConversations = conversations.filter(
    (id) => id !== conversationId
  );
  const updateData = {
    conversations: updatedConversations,
    updated_at: new Date(),
  };

  // If deleted conversation was default, set first remaining as default
  if (avatarData.default_conversation === conversationId) {
    updateData.default_conversation = updatedConversations[0];
  }

  await updateDoc(avatarRef, updateData);

  return { status: 'success', conversation_id: conversationId };
};


--------------


import React, { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CircularGallery from './CircularGallery';
import {
  Search,
  Settings,
  CirclePlus,
  LogOut,
  X,
  Edit,
  User,
} from 'lucide-react';
import { FiCircle } from 'react-icons/fi';
import CreateAvatarComponent from './CreateAvatarComponent';
import AvatarCardComponent from './AvatarCardComponent';
import { useMedia } from '../context/MediaContext';
import AuthComponent from './AuthComponent';
import { signup, login, logout } from '../services/authService';

const AvatarSelectionComponent = ({}) => {
  const {
    accessToken,
    user,
    avatars,
    setActiveAvatar,
    lastUsedAvatar,
    selectAvatar,
  } = useAuth();
  const { setMessages, fetchMessages } = useMedia();
  const navigate = useNavigate();
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const galleryRef = useRef(null);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);
  const hasInitialized = useRef(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isValidImageUrl = (url) => {
    if (!url) return false;
    if (url.startsWith('data:image/')) return url.includes('base64,');
    return /^(https?:\/\/|\/)/.test(url);
  };

  const clearOtherAvatarCache = (currentAvatarId) => {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          (key.startsWith('avatar_icon_') ||
            key.startsWith('avatar_position_')) &&
          key !== `avatar_icon_${currentAvatarId}` &&
          key !== `avatar_position_${currentAvatarId}`
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.error('Failed to clear other avatar cache:', error);
    }
  };

  const cacheAvatarPosition = (avatarId, avatarIndex = null) => {
    try {
      localStorage.setItem('last_used_avatar_id', avatarId);
      if (avatarIndex !== null && avatars?.length > 0) {
        const positionData = {
          avatarIndex,
        };
        localStorage.setItem(
          `avatar_position_${avatarId}`,
          JSON.stringify(positionData)
        );
        localStorage.setItem(
          'last_avatar_position',
          JSON.stringify(positionData)
        );
      }
    } catch (error) {
      console.error('Failed to cache avatar position:', error);
    }
  };

  const cacheAvatarIcon = (avatarId, iconUrl, avatarIndex = null) => {
    if (iconUrl) {
      try {
        clearOtherAvatarCache(avatarId);
        localStorage.setItem(`avatar_icon_${avatarId}`, iconUrl);
        localStorage.setItem('last_avatar_icon', iconUrl);
      } catch (error) {
        console.error('Failed to cache avatar icon:', error);
      }
    }
    cacheAvatarPosition(avatarId, avatarIndex);
  };

  const handleClick = async (cardData) => {
    let actualCardData = cardData;
    if (!cardData.type) {
      const matchingCard = authenticatedCards.find(
        (card) =>
          card.id === cardData.id ||
          (cardData.text && card.text === cardData.text)
      );
      if (matchingCard) actualCardData = matchingCard;
    }

    if (actualCardData.type === 'avatar') {
      try {
        const avatarId =
          actualCardData.id ||
          avatars?.find((avatar) => avatar.name === actualCardData.text)
            ?.avatar_id;
        if (!avatarId) {
          toast.error('Avatar ID not found');
          return;
        }

        const avatarIndex = avatars.findIndex(
          (avatar) => avatar.avatar_id === avatarId
        );

        setCurrentCardIndex(avatarIndex);
        if (galleryRef.current) {
          galleryRef.current.setCurrentIndex(avatarIndex);
        }

        // Use AuthContext selectAvatar which updates Firestore
        await selectAvatar(avatarId);

        const selectedAvatar = avatars.find(
          (avatar) => avatar.avatar_id === avatarId
        );

        cacheAvatarPosition(avatarId, avatarIndex);
        if (selectedAvatar?.icon) {
          cacheAvatarIcon(avatarId, selectedAvatar.icon, avatarIndex);
        }

        setActiveAvatar(selectedAvatar);
        // Load messages for this avatar
        await fetchMessages();
        // navigate(/chat:selectedAvatar)
      } catch (error) {
        console.error('Error selecting avatar:', error);
        toast.error('Failed to select avatar');
      }
    } else if (actualCardData.type === 'create') {
      setShowCreateModal(true);
    }
  };

  const handleCustomizeAvatar = async () => {
    if (currentCardIndex === authenticatedCards.length - 1) {
      setShowCreateModal(true);
      return;
    }

    const selectedCard = authenticatedCards[currentCardIndex];
    if (selectedCard.type === 'avatar') {
      try {
        const avatarId =
          selectedCard.id ||
          avatars?.find((avatar) => avatar.name === selectedCard.text)
            ?.avatar_id;
        if (!avatarId) {
          toast.error('Avatar ID not found');
          return;
        }

        // Use AuthContext selectAvatar which updates Firestore
        await selectAvatar(avatarId);

        const selectedAvatar = avatars.find(
          (avatar) => avatar.avatar_id === avatarId
        );
        const avatarIndex = avatars.findIndex(
          (avatar) => avatar.avatar_id === avatarId
        );

        cacheAvatarPosition(avatarId, avatarIndex);

        if (selectedAvatar?.icon) {
          cacheAvatarIcon(avatarId, selectedAvatar.icon, avatarIndex);
        }

        setActiveAvatar(selectedAvatar);
        // Load messages for this avatar and set into media context if needed
        await fetchMessages();
        setActiveTab('documents');
        // navigate(/settings:selectedAvatar)
      } catch (error) {
        console.error('Error selecting avatar for settings:', error);
        toast.error('Failed to open avatar settings');
      }
    }
  };

  const authenticatedCards = useMemo(() => {
    const avatarCards =
      avatars?.map((avatar) => ({
        id: avatar.avatar_id,
        component: (
          <AvatarCardComponent avatar={avatar} onCardClick={handleClick} />
        ),
        type: 'avatar',
        text: avatar.name,
        image: avatar.icon && isValidImageUrl(avatar.icon) ? avatar.icon : null,
        avatar_data: avatar,
      })) || [];

    avatarCards.push({
      id: 'create-avatar',
      component: <CreateAvatarComponent onCardClick={handleClick} />,
      type: 'create',
      text: 'Create Avatar',
      image: null,
    });

    return avatarCards;
  }, [avatars]);

  const getCachedAvatarPosition = (avatarId = null) => {
    try {
      if (avatarId) {
        const cachedPosition = localStorage.getItem(
          `avatar_position_${avatarId}`
        );
        if (cachedPosition) return JSON.parse(cachedPosition);
      }
      const lastPosition = localStorage.getItem('last_avatar_position');
      if (lastPosition) return JSON.parse(lastPosition);
      return null;
    } catch (error) {
      console.error('Error getting cached avatar position:', error);
      return null;
    }
  };

  useEffect(() => {
    if (avatars?.length > 0 && !hasInitialized.current) {
      let targetIndex = 0;

      const cachedLastAvatarId = localStorage.getItem('last_used_avatar_id');
      if (cachedLastAvatarId) {
        const cachedPosition = getCachedAvatarPosition(cachedLastAvatarId);
        if (cachedPosition && cachedPosition.avatarIndex < avatars.length) {
          targetIndex = cachedPosition.avatarIndex;
        }
      } else if (lastUsedAvatar) {
        const lastUsedIndex = avatars.findIndex(
          (avatar) => avatar.avatar_id === lastUsedAvatar
        );
        if (lastUsedIndex !== -1) {
          targetIndex = lastUsedIndex;
        }
      }

      setCurrentCardIndex(targetIndex);
      if (galleryRef.current) {
        galleryRef.current.setCurrentIndex(targetIndex);
      }
      hasInitialized.current = true;
    }
    if (!user || !avatars?.length) {
      hasInitialized.current = false;
    }
  }, [user, avatars]);

  const handleLogout = () => {
    setActiveAvatar(null);
    logout();
    setDropdownOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (user) {
      toast.dismiss();
    }
  }, []);

  useEffect(() => {
    console.log('Avatar Selection Component user: ' + user);
  }, []);

  const currentCards = user ? authenticatedCards : [loginCard];

  const handleDotClick = (index) => {
    setCurrentCardIndex(index);
    if (galleryRef.current) {
      galleryRef.current.setCurrentIndex(index);
    }
  };

  const handleJumpLeft = () => {
    const newIndex = Math.max(0, currentCardIndex - 5);
    setCurrentCardIndex(newIndex);
    if (galleryRef.current) {
      galleryRef.current.setCurrentIndex(newIndex);
    }
  };

  const handleJumpRight = () => {
    const newIndex = Math.min(currentCards.length - 1, currentCardIndex + 5);
    setCurrentCardIndex(newIndex);
    if (galleryRef.current) {
      galleryRef.current.setCurrentIndex(newIndex);
    }
  };
  useEffect(() => {
    const visibleDots = getVisibleDots();

    // Find the index of the currently selected card within the visible dots
    const selectedDotIndex = visibleDots.findIndex(
      (card) => card.originalIndex === currentCardIndex
    );

    console.log('Currently selected visible dot index:', selectedDotIndex);
    console.log('Current Card Index:', currentCardIndex);
  }, [currentCardIndex]);

  // Get the 5 closest avatars to current index (2 before, current, 2 after)
  const getVisibleDots = () => {
    const total = currentCards.length;
    const visibleCount = 5;
    const halfVisible = Math.floor(visibleCount / 2);

    let start = currentCardIndex - halfVisible;
    let end = currentCardIndex + halfVisible;

    // Clamp start/end to valid range
    if (start < 0) {
      end = Math.min(total - 1, end + Math.abs(start));
      start = 0;
    }
    if (end >= total) {
      start = Math.max(0, start - (end - total + 1));
      end = total - 1;
    }

    const slice = currentCards.slice(start, end + 1);

    // Map slice to include visibleIndex
    return slice.map((card, idx) => ({
      ...card,
      originalIndex: start + idx,
      visibleIndex: idx, // index relative to the visible slice
    }));
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setHighlightedIndex(-1);

    const allCards = [
      ...(avatars?.map((avatar, idx) => ({
        id: avatar.avatar_id,
        type: 'avatar',
        text: avatar.name,
        image: avatar.icon && isValidImageUrl(avatar.icon) ? avatar.icon : null,
        originalIndex: idx,
      })) || []),
      {
        id: 'create-avatar',
        type: 'create',
        text: 'Create Avatar',
        image: null,
        originalIndex: authenticatedCards.length - 1,
      },
    ];

    const filteredSuggestions = allCards
      .filter((card) => card.text.toLowerCase().includes(value.toLowerCase()))
      .map((card) => ({
        ...card,
        originalIndex: card.originalIndex ?? authenticatedCards.length - 1,
      }));

    setSuggestions(
      value && filteredSuggestions.length === 0
        ? [
            {
              id: 'create-avatar',
              type: 'create',
              text: 'Create Avatar',
              image: null,
              originalIndex: authenticatedCards.length - 1,
            },
          ]
        : filteredSuggestions
    );
    setIsDropdownOpen(true);
  };

  const handleSearchFocus = () => {
    const allCards = [
      ...(avatars?.map((avatar, idx) => ({
        id: avatar.avatar_id,
        type: 'avatar',
        text: avatar.name,
        image: avatar.icon && isValidImageUrl(avatar.icon) ? avatar.icon : null,
        originalIndex: idx,
      })) || []),
      {
        id: 'create-avatar',
        type: 'create',
        text: 'Create Avatar',
        image: null,
        originalIndex: authenticatedCards.length - 1,
      },
    ];

    setSuggestions(
      searchQuery &&
        allCards.every(
          (card) => !card.text.toLowerCase().includes(searchQuery.toLowerCase())
        )
        ? [
            {
              id: 'create-avatar',
              type: 'create',
              text: 'Create Avatar',
              image: null,
              originalIndex: authenticatedCards.length - 1,
            },
          ]
        : allCards
    );
    setIsDropdownOpen(true);
  };

  const handleSuggestionSelect = (index) => {
    setCurrentCardIndex(index);
    if (galleryRef.current) {
      galleryRef.current.setCurrentIndex(index);
    }
    setSearchQuery(authenticatedCards[index]?.text || '');
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && suggestions.length > 0 && highlightedIndex >= 0) {
      handleSuggestionSelect(suggestions[highlightedIndex].originalIndex);
    } else if (e.key === 'Enter' && suggestions.length > 0) {
      handleSuggestionSelect(suggestions[0].originalIndex);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation for avatar gallery
  useEffect(() => {
    const handleGalleryKeyDown = (e) => {
      // Don't handle if dropdown is open or user is typing in search
      if (
        isDropdownOpen ||
        document.activeElement === searchRef.current?.querySelector('input')
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const newIndex = Math.max(0, currentCardIndex - 1);
        setCurrentCardIndex(newIndex);
        if (galleryRef.current) {
          galleryRef.current.setCurrentIndex(newIndex);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const newIndex = Math.min(
          currentCards.length - 1,
          currentCardIndex + 1
        );
        setCurrentCardIndex(newIndex);
        if (galleryRef.current) {
          galleryRef.current.setCurrentIndex(newIndex);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const currentCard = currentCards[currentCardIndex];
        if (currentCard) {
          handleClick(currentCard);
        }
      }
    };

    if (user) {
      document.addEventListener('keydown', handleGalleryKeyDown);
      return () =>
        document.removeEventListener('keydown', handleGalleryKeyDown);
    }
  }, [user, currentCardIndex, currentCards, isDropdownOpen]);

  return (
    <div className="flex flex-col items-center justify-start p-4 relative mx-auto min-h-screen w-full">
      <div className="w-full h-screen overflow-hidden flex flex-col items-center gap-2">
        <div className="relative w-full max-w-md mt-8 mb-2" ref={searchRef}>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            onFocus={handleSearchFocus}
            onKeyDown={handleKeyDown}
            placeholder="Search avatars..."
            className="w-full bg-white/5 rounded-lg border border-white/20 py-2 pl-10 pr-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/80" />
          {isDropdownOpen && suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-white/10 rounded-lg border border-white/20 mt-1 max-h-60 overflow-auto">
              {suggestions.map((suggestion, idx) => (
                <li
                  key={suggestion.id}
                  onClick={() =>
                    handleSuggestionSelect(suggestion.originalIndex)
                  }
                  className={`px-4 py-2 text-white cursor-pointer ${
                    idx === highlightedIndex
                      ? 'bg-white/20'
                      : 'hover:bg-white/20'
                  }`}
                >
                  {suggestion.text}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="h-full flex flex-col min-h-0 w-full mb-2">
          <CircularGallery
            ref={galleryRef}
            items={authenticatedCards}
            bend={0}
            textColor="#ffffff"
            borderRadius={0.05}
            font="bold 48px system-ui"
            scrollSpeed={2}
            scrollEase={0.3}
            onCardClick={handleClick}
            currentIndex={currentCardIndex}
            onIndexChange={setCurrentCardIndex}
          />
        </div>
        <div
          className="flex flex-col items-center w-full gap-2 z-10"
          ref={dropdownRef}
        >
          {/* <button
              onClick={handleCustomizeAvatar}
              className="bg-white/10 rounded-lg border border-white/20 py-2 px-4 text-white hover:bg-white/15 transition-all duration-300 flex items-center gap-2"
            >
              {currentCardIndex === authenticatedCards.length - 1 ? (
                <>
                  <CirclePlus className="w-5 h-5" />
                  Create Avatar
                </>
              ) : (
                <>
                  <Edit className="w-5 h-5" />
                  Customize Avatar
                </>
              )}
            </button> */}
          <div className="flex gap-2 justify-center items-center">
            {/* Left arrow */}
            <button
              onClick={handleJumpLeft}
              disabled={currentCardIndex === 0}
              className={`p-1 rounded-full transition-all duration-300 ${
                currentCardIndex === 0
                  ? 'text-white/20 cursor-not-allowed'
                  : 'text-white/50 hover:text-white hover:bg-white/10 cursor-pointer'
              }`}
              aria-label="Jump left 5 positions"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            {/* Visible dots */}
            <div
              className="flex gap-2 items-center"
              style={{ minWidth: '200px', justifyContent: 'center' }}
            >
              {getVisibleDots().map((card) => {
                const isCreateAvatar = card.type === 'create';
                const isSelected = currentCardIndex === card.originalIndex;
                const distance = Math.abs(
                  currentCardIndex - card.originalIndex
                );

                // Scale dots based on distance from current index
                const scale = Math.max(0.4, 1 - distance * 0.2);

                return (
                  <div
                    key={card.originalIndex}
                    onClick={() => handleDotClick(card.originalIndex)}
                    className={`rounded-full transition-all duration-300 cursor-pointer hover:scale-110 border-2 ${
                      isSelected
                        ? 'border-white'
                        : 'border-white/30 hover:border-white/60'
                    }`}
                    style={{
                      transform: `scale(${scale})`,
                      width: '32px',
                      height: '32px',
                      flexShrink: 0,
                    }}
                    aria-label={`Go to ${card.text}`}
                  >
                    {isCreateAvatar ? (
                      <div className="w-full h-full flex items-center justify-center bg-white/10 rounded-full">
                        <CirclePlus className="w-5 h-5 text-white" />
                      </div>
                    ) : card.image && isValidImageUrl(card.image) ? (
                      <img
                        src={card.image}
                        alt={card.text}
                        className="w-full h-full object-cover rounded-full"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white/10 rounded-full">
                        <User className="w-4 h-4 text-white/50" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right arrow */}
            <button
              onClick={handleJumpRight}
              disabled={currentCardIndex === currentCards.length - 1}
              className={`p-1 rounded-full transition-all duration-300 ${
                currentCardIndex === currentCards.length - 1
                  ? 'text-white/20 cursor-not-allowed'
                  : 'text-white/50 hover:text-white hover:bg-white/10 cursor-pointer'
              }`}
              aria-label="Jump right 5 positions"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
          <div className="min-h-[40px] w-full flex justify-center items-center gap-2 mb-8">
            <div className="relative w-48">
              <button
                onClick={() => setDropdownOpen((open) => !open)}
                className="bg-white/10 rounded-lg border border-white/20 py-2 px-4 text-white hover:bg-white/15 transition-all duration-300 flex items-center gap-2 w-full"
                aria-haspopup="true"
                aria-expanded={dropdownOpen}
                aria-controls="user-menu"
              >
                <Settings className="w-6 h-6" />
                User Settings
              </button>
              {dropdownOpen && (
                <div
                  id="user-menu"
                  role="menu"
                  className="absolute bottom-[50px] w-full mt-2 right-0 backdrop-blur-lg bg-white/10 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                >
                  <div className="flex justify-between items-center px-4 py-2 border-b border-white/20">
                    <span className="text-white text-sm font-semibold">
                      {user?.username}
                    </span>
                    <button
                      onClick={() => setDropdownOpen(false)}
                      className="text-white hover:text-red-500"
                      aria-label="Close menu"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      // navigate(settings:user)
                      setDropdownOpen(false);
                      1;
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-teal-600 transition"
                    role="menuitem"
                  >
                    Account Settings
                  </button>
                  <button
                    onClick={() => {
                      // navigate(/billing)
                      setDropdownOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-teal-600 transition"
                    role="menuitem"
                  >
                    Billing
                  </button>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left flex flex-row items-center px-4 py-2 text-sm text-red-500 hover:bg-red-900 hover:text-white transition"
                    role="menuitem"
                  >
                    Logout <LogOut className="ml-2 w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {showCreateModal && (
        <CreateAvatarModal setShowCreateModal={setShowCreateModal} />
      )}
    </div>
  );
};

export default AvatarSelectionComponent;


-------------------------
import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  updatePassword as firebaseUpdatePassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';

import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db, storage } from '../firebase/config.js';
import { getUserProfile } from '../services/userService';

import {
  getAvatars,
  createAvatar,
  deleteAvatar,
  selectAvatar,
} from '../services/avatar_Service.jsx';

import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { signup, login, logout } from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userAvatars, setUserAvatars] = useState([]);
  const [sharedAvatars, setSharedAvatars] = useState([]);
  const [proprietaryAvatars, setProprietaryAvatars] = useState([]);
  const [activeAvatar, setActiveAvatar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null); // Firebase ID token for backend API

  // verify connection to firebase auth emulator
  useEffect(() => {
    if (auth.config) {
      console.log('Full Auth Config:', auth.config);
      // Look for a property called 'emulatorConfig' in the object tree
    }
  }, []);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const firebaseAuthStateChange = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (firebaseUser) {
          console.log(firebaseUser);
          setUser(firebaseUser);
          try {
            // Debug: ensure uid and token are available
            console.log('Auth state changed for uid:', firebaseUser.uid);

            // Get Firebase ID token for backend API calls
            // Firebase automatically refreshes tokens when needed
            let token;
            try {
              token = await firebaseUser.getIdToken();
              setAccessToken(token);
              localStorage.setItem('access_token', token);
            } catch (tokenErr) {
              console.error('Error obtaining ID token:', tokenErr);
            }

            // Get Firestore user profile (returns null if missing)
            let profile = null;
            try {
              profile = await getUserProfile(firebaseUser.uid);
            } catch (err) {
              console.error('Error fetching user profile:', err);
              if (
                err.message &&
                err.message.includes('Insufficient Firestore permissions')
              ) {
                toast.error(
                  'Firestore permissions error: please check rules and project configuration.'
                );
              } else {
                throw err;
              }
            }

            // localStorage.setItem('user', user);

            // Store user data in localStorage
            // localStorage.setItem('user', JSON.stringify(profile));
            // localStorage.setItem('firebase_user_id', firebaseUser.uid);

            // Load userAvatars from Firestore
            const loadedAvatars = await loadAvatars(firebaseUser.uid);

            // Set active avatar if user has last_used_avatar
            if (profile.last_used_avatar && loadedAvatars.length > 0) {
              const lastUsed = loadedAvatars.find(
                (a) => a.avatar_id === profile.last_used_avatar
              );
              if (lastUsed) {
                setActiveAvatar(lastUsed);
              }
            }
          } catch (error) {
            console.error('Error loading user profile:', error);
            setUser(null);
            setAccessToken(null);
          }
        } else {
          // User signed out
          setUser(null);
          setUserAvatars([]);
          setSharedAvatars([]);
          setProprietaryAvatars([]);
          setActiveAvatar(null);
          setAccessToken(null);
          localStorage.removeItem('user');
        }

        setLoading(false);
      }
    );

    return firebaseAuthStateChange;
  }, []);

  // Load userAvatars from Firestore
  const loadAvatars = async (userId) => {
    try {
      const fetchedAvatars = await getAvatars(userId);
      setUserAvatars(fetchedAvatars);
      localStorage.setItem('userAvatars', JSON.stringify(fetchedAvatars));
      return fetchedAvatars;
    } catch (error) {
      console.error('Error loading userAvatars:', error);
      return [];
    }
  };

  // const resendVerification = async (email) => {
  //   try {
  //     // Firebase doesn't have a direct resend verification for email
  //     // We need to get the current user and resend
  //     if (auth.currentUser && auth.currentUser.email === email) {
  //       await sendEmailVerification(auth.currentUser);
  //       toast.success(
  //         (t) => (
  //           <div className="relative flex flex-col gap-2 p-4">
  //             <div className="flex justify-between items-start">
  //               <p className="pr-4">Verification email sent!</p>
  //               <button
  //                 onClick={() => toast.dismiss(t.id)}
  //                 className="p-1 bg-red-600 hover:bg-red-500 rounded text-sm"
  //               >
  //                 <X size={16} />
  //               </button>
  //             </div>
  //           </div>
  //         ),
  //         { duration: Infinity }
  //       );
  //     } else {
  //       throw new Error('Please log in first to resend verification email');
  //     }
  //   } catch (error) {
  //     console.error('Resend verification error:', error);
  //     toast.error(
  //       (t) => (
  //         <div className="relative flex flex-col gap-2 p-4">
  //           <div className="flex justify-between items-start">
  //             <p className="pr-4">
  //               {error.message || 'Failed to send verification email'}
  //             </p>
  //             <button
  //               onClick={() => toast.dismiss(t.id)}
  //               className="p-1 bg-red-600 hover:bg-red-500 rounded text-sm"
  //             >
  //               <X size={16} />
  //             </button>
  //           </div>
  //         </div>
  //       ),
  //       { duration: Infinity }
  //     );
  //     throw error;
  //   }
  // };

  // const forgotPassword = async (email) => {
  //   try {
  //     await sendPasswordResetEmail(auth, email, {
  //       url: `${window.location.origin}/auth/reset-password`,
  //     });
  //     // Don't show toast here - let AuthComponent handle it
  //   } catch (error) {
  //     console.error('Forgot password error:', error);
  //     throw error;
  //   }
  // };

  // const updatePassword = async (newPassword) => {
  //   try {
  //     if (!auth.currentUser) {
  //       throw new Error('No user logged in');
  //     }
  //     await firebaseUpdatePassword(auth.currentUser, newPassword);
  //     toast.success('Password updated successfully!');
  //   } catch (error) {
  //     console.error('Update password error:', error);
  //     throw error;
  //   }
  // };

  // // Social login with Google
  // const signInWithProvider = async (provider) => {
  //   try {
  //     if (provider === 'google') {
  //       const googleProvider = new GoogleAuthProvider();
  //       // Use redirect for better UX
  //       await signInWithRedirect(auth, googleProvider);
  //     } else {
  //       throw new Error(`Provider ${provider} is not supported`);
  //     }
  //   } catch (error) {
  //     console.error(`${provider} login error:`, error);
  //     toast.error(`${provider} login failed`);
  //     throw error;
  //   }
  // };

  // const getAvatars = async () => {
  //   if (!currentUser) return;

  //   try {
  //     const fetchedAvatars = await loadAvatars(currentUser.uid);
  //     return fetchedAvatars;
  //   } catch (error) {
  //     console.error('Get userAvatars error:', error);
  //     return [];
  //   }
  // };

  // const createAvatar = async ({ name, description = '', iconFile = null }) => {
  //   if (!currentUser) {
  //     throw new Error('User must be logged in to create avatar');
  //   }

  //   try {
  //     const created = await createAvatarInFirestore(
  //       currentUser.uid,
  //       name,
  //       description,
  //       iconFile
  //     );

  //     // Reload userAvatars and wait for state update
  //     const fetchedAvatars = await loadAvatars(currentUser.uid);

  //     // Find the created avatar in the fetched list (should be there)
  //     const createdAvatar =
  //       fetchedAvatars.find((a) => a.avatar_id === created.avatar_id) ||
  //       created; // Fallback to created object if not found

  //     // Set as active avatar
  //     setActiveAvatar(createdAvatar);

  //     // Update Firestore to mark as last_used_avatar
  //     await updateDoc(doc(db, 'users', currentUser.uid), {
  //       last_used_avatar: created.avatar_id,
  //       avatars: [...(user?.avatars || []), created.avatar_id],
  //     });

  //     // Update local user state
  //     if (user) {
  //       const updatedUser = {
  //         ...user,
  //         last_used_avatar: created.avatar_id,
  //         avatars: [...(user.avatars || []), created.avatar_id],
  //       };
  //       setUser(updatedUser);
  //       localStorage.setItem('user', JSON.stringify(updatedUser));
  //     }

  //     return created;
  //   } catch (error) {
  //     console.error('Create avatar failed:', error);
  //     throw error;
  //   }
  // };

  // const deleteAvatar = async (avatarId) => {
  //   if (!currentUser) return;

  //   try {
  //     await deleteAvatarFromFirestore(currentUser.uid, avatarId);
  //     await loadAvatars(currentUser.uid);

  //     if (activeAvatar?.avatar_id === avatarId) {
  //       setActiveAvatar(null);
  //     }
  //   } catch (error) {
  //     console.error('Delete avatar failed:', error);
  //     throw error;
  //   }
  // };

  // const selectAvatar = async (avatarId) => {
  //   if (!currentUser) return;

  //   try {
  //     const response = await selectAvatarInFirestore(currentUser.uid, avatarId);

  //     if (response.status === 'success') {
  //       const selectedAvatar = userAvatars.find((a) => a.avatar_id === avatarId);
  //       if (selectedAvatar) {
  //         setActiveAvatar(selectedAvatar);
  //       }

  //       // Update user profile
  //       await updateDoc(doc(db, 'users', currentUser.uid), {
  //         last_used_avatar: avatarId,
  //       });

  //       // Update local user state
  //       if (user) {
  //         const updatedUser = { ...user, last_used_avatar: avatarId };
  //         setUser(updatedUser);
  //         setUserProfile(updatedUser);
  //         localStorage.setItem('user', JSON.stringify(updatedUser));
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Select avatar failed:', error);
  //     throw error;
  //   }
  // };

  // const updateActiveAvatarField = (field, value) => {
  //   setActiveAvatar((prev) => ({
  //     ...prev,
  //     [field]: value,
  //   }));
  // };

  // // Handle OAuth redirect result
  // useEffect(() => {
  //   getRedirectResult(auth)
  //     .then((result) => {
  //       if (result) {
  //         // User signed in via redirect
  //         // toast.success('Login successful!');
  //       }
  //     })
  //     .catch((error) => {
  //       console.error('OAuth redirect error:', error);
  //       toast.error('Authentication failed');
  //     });
  // }, []);

  // if (loading) {
  //   return <div>Loading...</div>;
  // }

  return (
    <AuthContext.Provider
      value={{
        // User state
        accessToken, // Firebase ID token for backend API calls
        setAccessToken,
        user,
        setUser,
        userAvatars,
        setUserAvatars,
        sharedAvatars,
        setSharedAvatars,
        proprietaryAvatars,
        setProprietaryAvatars,
        activeAvatar,
        setActiveAvatar,
        loading,
        setLoading,
        // Auth methods
        // login,
        // signup,
        // logout,
        // resendVerification,
        // forgotPassword,
        // updatePassword,
        // signInWithProvider,

        // Avatar methods
        // getAvatars,
        // createAvatar,
        // deleteAvatar,
        // selectAvatar,
        // updateActiveAvatarField,

        // Firebase instances (for advanced use)
        firebaseAuth: auth,
        firestore: db,
        firebaseStorage: storage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

--------------------

