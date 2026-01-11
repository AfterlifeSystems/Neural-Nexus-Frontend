// services/AvatarService.jsx
import { getDbHttpsUrl } from '../context/NgrokAPIStore';

export const AvatarService = {
  async getAll(accessToken) {
    try {
      const res = await fetch(`${getDbHttpsUrl()}/management/avatars/get_all`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (err) {
      console.error('Failed to fetch avatars:', err);
      return [];
    }
  },

  async createAvatar(accessToken, payload) {
    try {
      // Create FormData instead of JSON
      const formData = new FormData();

      // Add required fields
      formData.append('name', payload.name);

      // Add optional description (only if provided)
      if (payload.description) {
        formData.append('description', payload.description);
      }

      // Add optional icon file
      if (payload.iconFile) {
        formData.append('icon', payload.iconFile);
      }

      const response = await fetch(
        `${getDbHttpsUrl()}/management/avatars/create`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
          body: formData,
        }
      );

      if (!response.ok) throw new Error(await response.text());
      return await response.json();
    } catch (error) {
      console.error('Error creating avatar:', error);
      throw error;
    }
  },

  async deleteAvatar(accessToken, avatar_id) {
    try {
      const response = await fetch(
        `${getDbHttpsUrl()}/management/avatars/delete`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: new URLSearchParams({ avatar_id }),
        }
      );
      const res = await response.json();
      if (res.status !== 'success') throw new Error(JSON.stringify(res));
      return res;
    } catch (error) {
      console.error('Avatar Service: Error deleting avatar:', error);
      throw error;
    }
  },

  async selectAvatar(accessToken, avatar_id) {
    try {
      console.log('update');

      const response = await fetch(
        `${getDbHttpsUrl()}/management/avatars/select_avatar`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: new URLSearchParams({ avatar_id }),
        }
      );
      const res = await response.json();
      // console.log(res);
      if (res.status !== 'success') throw new Error(JSON.stringify(res));
      return res;
    } catch (error) {
      console.error('Avatar Service: Error selecting avatar:', error);
      throw error;
    }
  },
};

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

  const avatarData = {
    avatar_id: avatarId,
    user_id: userId,
    name: name.trim(),
    description: (description || '').trim(),
    created_at: new Date(),
    icon: null,
    files: [],
    conversations: [conversationId], // List of conversation IDs
    default_conversation: conversationId, // Track the default conversation
  };

  // Upload icon if provided
  if (iconFile) {
    if (iconFile.size > 4 * 1024 * 1024) {
      throw new Error('Icon exceeds 4 MB limit');
    }
    const iconRef = ref(
      storage,
      `users/${userId}/avatars/${avatarId}/icon/${uuidv4()}_${iconFile.name}`
    );
    await uploadBytes(iconRef, iconFile);
    avatarData.icon = iconRef.fullPath;
  }

  // Create avatar document with avatarId as document ID
  const avatarRef = doc(db, 'avatars', avatarId);
  await setDoc(avatarRef, avatarData);

  // Create default conversation document
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

  // Update user's avatar list
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  const avatars = userDoc.data().avatars || [];
  await updateDoc(userRef, {
    avatars: [...avatars, avatarId],
    last_used_avatar: avatarId,
  });

  // Create directory structure in Storage (using .keep files)
  const directories = [
    `users/${userId}/vectorstore/.keep`,
    `users/${userId}/avatars/${avatarId}/adapters/.keep`,
    `users/${userId}/avatars/${avatarId}/adapters/training_data/.keep`,
    `users/${userId}/avatars/${avatarId}/vectorstore_data/.keep`,
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
    id: avatarId,
    avatar_id: avatarId,
    user_id: userId,
    name: avatarData.name,
    description: avatarData.description,
    created_at: avatarData.created_at.toISOString(),
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
        iconUrl = await getDownloadURL(ref(storage, data.icon));
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
    throw new Error('Avatar not found or unauthorized');
  }

  const updateData = {
    updated_at: new Date(),
    ...updates,
  };

  await updateDoc(avatarRef, updateData);

  // If icon was updated, return the new URL
  if (updates.icon) {
    const iconUrl = await getDownloadURL(ref(storage, updates.icon));
    return { icon_url: iconUrl };
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
    throw new Error('Avatar not found or unauthorized');
  }

  const updates = {
    updated_at: new Date(),
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

    // Delete old icon if exists
    const oldIcon = avatarDoc.data().icon;
    if (oldIcon) {
      try {
        await deleteObject(ref(storage, oldIcon));
      } catch (error) {
        console.warn('Failed to delete old icon:', error);
      }
    }

    // Upload new icon
    const iconRef = ref(
      storage,
      `users/${userId}/avatars/${avatarId}/icon/${uuidv4()}_${iconFile.name}`
    );
    await uploadBytes(iconRef, iconFile);
    updates.icon = iconRef.fullPath;
    iconUrl = await getDownloadURL(iconRef);
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
