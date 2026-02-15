// services/avatarService.jsx
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
  arrayUnion,
  arrayRemove,
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
import { createClient } from '@supabase/supabase-js';

// Add this function to your avatarService.jsx file

/**
 * Upload documents to the data-loading API
 * @param {string} userId - User ID
 * @param {string} avatarId - Avatar ID
 * @param {string} targetAvatarName - Target avatar name
 * @param {FileList|File[]} files - Files to upload
 * @param {boolean} isReferenceImage - Whether the file is a reference image
 * @param {boolean} isReferenceAudio - Whether the file is reference audio
 * @returns {Promise<Object>} Upload response
 */
export const uploadToDataLoadingApi = async (
  // UPLOAD MEDIA
  userId,
  avatarId,
  targetAvatarName,
  files,
  isReferenceImage = false,
  isReferenceAudio = false
) => {
  const results = [];

  // Upload each file separately as the API expects single file uploads
  for (const file of files) {
    //   const formData = new FormData();
    //   formData.append('file', file);
    //   formData.append('target_avatar_name', targetAvatarName);
    //   formData.append('user_id', userId);
    //   formData.append('avatar_id', avatarId);
    //   formData.append('is_reference_image', isReferenceImage);
    //   formData.append('is_reference_audio', isReferenceAudio);

    const formData = new FormData();
    formData.append('files', '@filename');
    formData.append('user_id', 'test_user_1234');
    formData.append('assistant_id', 'default_assistant');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_ANUBIS_API_URL}` + '/upload-media',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'multipart/form-data',
            'x-api-key': `${import.meta.env.VITE_LANGGRAPH_API_SERVER_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.detail || `Upload failed with status ${response.status}`
        );
      }

      // update the uploaded file list
      const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);

      await updateDoc(avatarRef, {
        files: arrayUnion(file.name),
      });

      const result = await response.json();
      results.push({
        file: file.name,
        success: true,
        data: result,
      });
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error);
      results.push({
        file: file.name,
        success: false,
        error: error.message,
      });
    }
  }
  return results;
};

export const createAvatar = async (user, name, description, iconFile) => {
  // CREATE ASSISTANT CREATE AVATAR
  if (!user) throw new Error('No authenticated user');

  const userId = user.id;
  const avatarId = uuidv4();
  const conversationId = uuidv4(); // Create default conversation ID

  console.log(
    'XXXXXXXXXXXXXXXXXXXXXXXXXX USER XXXXXXXXXXXXXXXXXXXXXXXXXXX avatarService'
  );

  console.log(user);
  // Create directory structure in Storage (using .keep files)

  // const directories = [
  //   `users/${userId}/.keep`,
  //   `users/${userId}/avatars/${avatarId}/adapters/.keep`,
  //   `users/${userId}/avatars/${avatarId}/adapters/training_data/.keep`,
  // ];

  // for (const dirPath of directories) {
  //   try {
  //     const dirRef = ref(storage, dirPath);
  //     await uploadBytes(dirRef, new Blob([''], { type: 'text/plain' }));
  //   } catch (error) {
  //     console.warn(`Failed to create directory ${dirPath}:`, error);
  //   }
  // }

  // Generate download URLs
  // const qloraAdapterUrl = await getDownloadURL(
  //   ref(storage, `users/${userId}/avatars/${avatarId}/adapters/.keep`)
  // );
  // const qloraTrainingUrl = await getDownloadURL(
  //   ref(
  //     storage,
  //     `users/${userId}/avatars/${avatarId}/adapters/training_data/.keep`
  //   )
  // );

  // Store as a Digital Twin document following firestore_structure.md
  const avatarData = {
    avatar_id: avatarId,
    user_id: user.id,
    name: name,
    description: (description || '').trim(),
    created_at: new Date().toISOString(),
    icon: null, // will be an object {url, storagePath, name, size, type}
    reference_audio: null,
    active_conversation: conversationId,
  };

  // // LANGGRAPH API SERVER CLIENT
  const create_assistant_promise = await fetch(
    `${import.meta.env.VITE_LANGGRAPH_API_SERVER_URL}/assistants`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistant_id: avatarId,
        graph_id: 'Anubis',
        metadata: { user_id: user.id, assistant_id: avatarId },
        if_exists: 'raise',
        description: description,
        name: name,
      }),
    }
  );

  const create_assistant_promise_json = await create_assistant_promise.json();

  console.log(
    `create_assistant_promise_json: ${create_assistant_promise_json}`
  );

  // Update user's avatars list
  console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXX I CREATED AN AVATAR');

  //  create initial conversation
  const create_thread_response = await fetch(
    `${import.meta.env.VITE_LANGGRAPH_API_SERVER_URL}/threads`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': `${import.meta.env.VITE_LANGGRAPH_API_SERVER_KEY}`,
      },
      body: JSON.stringify({
        metadata: { user_id: userId, avatar_id: avatarId },
        if_exists: 'raise',
        graph_id: 'Anubis',
        thread_id: conversationId,
        // ttl: {
        //   strategy: 'delete',
        //   ttl: 1,
        // },
        // supersteps: [
        //   {
        //     updates: [
        //       {
        //         values: [{}],
        //         command: {
        //           update: null,
        //           resume: null,
        //           goto: {
        //             node: '',
        //             input: null,
        //           },
        //         },
        //         as_node: '',
        //       },
        //     ],
        //   },
        // ],
      }),
    }
  );

  const create_thread_response_json = await create_thread_response.json();

  console.log(`create_thread_response_json: ${create_thread_response_json}`);

  return {
    avatarData,
  };
};

export const getAvatars = async (userId, limitCount = 50, skip = 0) => {
  // SEARCH ASSISTANTS

  // LANGGRAPH API SERVER CLIENT
  console.log(
    `VITE_LANGGRAPH_API_SERVER_URL: ${import.meta.env.VITE_LANGGRAPH_API_SERVER_URL}`
  );

  // LIST AVATARS SEARCH ASSISTANTS
  const assistants_search_promise = await fetch(
    `${import.meta.env.VITE_ANUBIS_API_URL}/assistants/search`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': `${import.meta.env.VITE_LANGGRAPH_API_SERVER_KEY}`,
      },
      body: JSON.stringify({
        graph_id: 'Anubis',
        metadata: {
          user_id: 'xVvtmkUhwwE6CZ6V6y8IojlYKy5C',
        },
        if_exists: 'raise',
        limit: 100,
        offset: 0,
        sort_by: 'assistant_id',
        sort_order: 'asc',
      }),
    }
  );

  // Example body call
  // {
  //   "graph_id": "Anubis",
  //   "metadata": {
  //     "user_id": "xVvtmkUhwwE6CZ6V6y8IojlYKy5C"
  //   },
  //   "if_exists": "raise",
  //   "limit": 100,
  //   "offset": 0,
  //   "sort_by":"assistant_id",
  //   "sort_order": "asc"
  // }

  // xVvtmkUhwwE6CZ6V6y8IojlYKy5C
  console.log(`userId: ${userId}`);
  // 3d2b5ea8-69b7-48f0-bf90-b5948be8ac8f

  const assistants_search_promise_json = await assistants_search_promise.json();
  console.log(
    'assistants_search_promise_json:',
    JSON.stringify(assistants_search_promise_json)
  );

  console.log(
    `assistants_search_promise_json: ${assistants_search_promise_json}`
  );

  // const snapshot = await getDocs(avatarsQuery);
  // const avatars = [];

  const avatars = assistants_search_promise_json.assistants?.map(
    (assistant) => ({
      avatar_id: assistant.assistant_id,
      name: assistant.name || assistants_search_promise.context?.name,
      description:
        assistant.context?.description || assistant.metadata?.description,
      icon: null, // Add icon logic if stored in context/metadata
    })
  );

  console.log(`GET AVATRARS ${avatars})`);

  // for (const docSnapshot of snapshot.docs.slice(skip, skip + limitCount)) {
  //   const data = docSnapshot.data();
  //   let iconUrl = null;

  //   if (data.icon) {
  //     try {
  //       const storagePath = data.icon.storagePath || data.icon;
  //       if (storagePath) {
  //         iconUrl = await getDownloadURL(ref(storage, storagePath));
  //       } else if (data.icon.url) {
  //         iconUrl = data.icon.url;
  //       }
  //     } catch (error) {
  //       console.error('Error getting icon URL:', error);
  //     }
  //   }

  //   avatars.push({
  //     avatar_id: docSnapshot.id,
  //     name: data.name,
  //     description: data.description,
  //     icon: iconUrl,
  //   });
  // }

  // Add the icon to the avatars
  // for (const avatar in assistants_search_promise) {
  //   avatars.push({
  //     avatar_id: avatar.avatar_id,
  //     name: avatar.name,
  //     description: avatar.description,
  //     icon: iconUrl,
  //   });
  // }

  return avatars;
};

export const updateAvatar = async (userId, avatarId, updates) => {
  const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);
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

export const updateAvatarWithIcon = async (userId, avatarId, iconFile) => {
  const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const updates = {
    updated_at: new Date().toISOString(),
  };

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
  // this needs to be updated to recursively delete all messages in the conversation collection,
  // all conversations in the avatar collection,
  // and the avatar
  // currently deletes the avatar from the array list in the users document
  const userRef = doc(db, 'users', userId);
  const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);

  // Delete all files in Storage
  const avatarStorageRef = ref(storage, `users/${userId}/avatars/${avatarId}`);
  try {
    const files = await listAll(avatarStorageRef);
    await Promise.all(files.items.map((file) => deleteObject(file)));
  } catch (error) {
    console.warn('Error deleting avatar files:', error);
  }

  // Delete avatar document
  const avatarDoc = await getDoc(avatarRef);
  if (!avatarDoc.exists()) {
    throw new Error('Avatar not found or unauthorized');
  }

  await deleteDoc(avatarRef);

  // Remove from user's avatar list
  await updateDoc(userRef, { avatars: arrayRemove(avatarId) });

  // LANGSMITH API SERVER
  client = Client(`${import.meta.env.VITE_LANGGRAPH_API_SERVER_KEY}`);
  await client.assistants.delete({ assistant_id: avatarId });

  // SUPABASE POSTGRES_DB_STORE
  const supabase = createClient(
    `${import.meta.env.VITE_LANGGRAPH_API_SERVER_URL}`,
    `${import.meta.env.VITE_LANGGRAPH_API_SERVER_KEY}`
  );

  // DELETE VECTORSTORE DOCUMENTS
  const { data_vectorstore, error_vectorstore } = await supabase
    .from('langchain_pg_embedding')
    .delete()
    .eq('user_id', userId)
    .eq('assistant_id', avatarId);

  // DELETE POSTGRES DB STORE ENTRIES
  const { data_pgdb_store, error_pgdb_store } = await supabase
    .from('store')
    .delete()
    .eq('prefix', `${userId}.${assistantId}`);

  return {
    status: 'success',
    avatar_id: avatarId,
    deleted: true,
  };
};

export const deleteDocument = async (userId, avatarId, filename) => {
  // update document file list
  avatarRef = doc(db, 'users', userId, 'avatars', avatarId);
  try {
  } catch (error) {
    console.error(`error removing file ${filename} from array: `, error);
    throw error;
  }
  updateDoc(avatarRef, { files: arrayRemove(filename) });

  // SUPABASE POSTGRES_DB_STORE
  const supabase = createClient(
    `${import.meta.env.VITE_LANGGRAPH_API_SERVER_URL}`,
    `${import.meta.env.VITE_LANGGRAPH_API_SERVER_KEY}`
  );

  // DELETE VECTOR STORE DOCUMENT MEDIA UPLOAD
  const { data_vectorstore, error_vectorstore } = await supabase
    .from('langchain_pg_embedding')
    .delete()
    .eq('user_id', userId)
    .eq('assistant_id', avatarId)
    .eq('filename', filename);
};

export const selectAvatar = async (user, userId, avatarId) => {
  const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  // CREATE LANGGRAPH API CLIENT
  client = new Client({ url: import.meta.env.VITE_LANGGRAPH_API_SERVER_URL });

  // GET ASSISTANT
  assistant = await client.assistants.get({ assistant_id: avatarId });

  //   {
  //   "assistant_id": "9aee271d-ccce-40db-874a-d70529560c77",
  //   "graph_id": "Anubis",
  //   "config": {},
  //   "context": {},
  //   "metadata": {
  //     "user_id": "2feaa9d8-50c0-4550-81fa-9fb79bfe23f0",
  //     "assistant_id": "9aee271d-ccce-40db-874a-d70529560c77"
  //   },
  //   "name": "testing_assistant",
  //   "created_at": "2026-02-12T21:03:37.526944+00:00",
  //   "updated_at": "2026-02-12T21:03:37.526944+00:00",
  //   "version": 1,
  //   "description": null
  // }
  // if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
  //   throw new Error('Avatar not found or unauthorized');
  // }

  const avatarData = avatarDoc.data();

  // Update last_used_avatar
  // await updateDoc(doc(db, 'users', userId), {
  //   last_used_avatar: avatarId,
  // });

  // Get default conversation ID (or first conversation)
  const defaultConversationId = avatarData.default_conversation;

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

  return {};
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
  const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);
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
  const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const conversationsQuery = query(
    collection(db, `users/${user_id}/avatars/${avatarId}/conversations`),
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
  const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);
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
  const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);
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
  const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);
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
