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
      `users/${userId}/digital_twins/${avatarId}/icon/${uuidv4()}_${
        iconFile.name
      }`
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
  const avatarRef = doc(db, 'digital_twins', avatarId);
  await setDoc(avatarRef, avatarData);

  // Create default conversation document (store summary and counts)
  const conversationRef = doc(
    db,
    'digital_twins',
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

  // Update user's digital_twins list
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  const digitalTwins = userDoc.data().digital_twins || [];
  await updateDoc(userRef, {
    digital_twins: [...digitalTwins, avatarId],
    last_used_digital_twin: avatarId,
  });

  // Create directory structure in Storage (using .keep files)
  const directories = [
    `users/${userId}/.keep`,
    `users/${userId}/digital_twins/${avatarId}/adapters/.keep`,
    `users/${userId}/digital_twins/${avatarId}/adapters/training_data/.keep`,
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
    ref(
      storage,
      `users/${userId}/digital_twins/${avatarId}/vectorstore_data/.keep`
    )
  );
  const qloraAdapterUrl = await getDownloadURL(
    ref(storage, `users/${userId}/digital_twins/${avatarId}/adapters/.keep`)
  );
  const qloraTrainingUrl = await getDownloadURL(
    ref(
      storage,
      `users/${userId}/digital_twins/${avatarId}/adapters/training_data/.keep`
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
    collection(db, 'digital_twins'),
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
  const avatarRef = doc(db, 'digital_twins', avatarId);
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
  const avatarRef = doc(db, 'digital_twins', avatarId);
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
      `users/${userId}/digital_twins/${avatarId}/icon/${uuidv4()}_${
        iconFile.name
      }`
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
  const avatarStorageRef = ref(
    storage,
    `users/${userId}/digital_twins/${avatarId}`
  );
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
    ref(
      storage,
      `users/${userId}/digital_twins/${avatarId}/vectorstore_data/.keep`
    )
  );
  const qloraAdapterUrl = await getDownloadURL(
    ref(storage, `users/${userId}/digital_twins/${avatarId}/adapters/.keep`)
  );
  const qloraTrainingUrl = await getDownloadURL(
    ref(
      storage,
      `users/${userId}/digital_twins/${avatarId}/adapters/training_data/.keep`
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
