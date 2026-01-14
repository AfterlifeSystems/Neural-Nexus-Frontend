import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage } from '../firebase/config.js';

export const getUserProfile = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      // User document is missing - return null so the caller can create it if desired
      return null;
    }

    const userData = userDoc.data();

    // Get digital twins (replace old avatars collection)
    const twinsQuery = query(
      collection(db, 'digital_twins'),
      where('user_id', '==', userId)
    );
    const twinsSnapshot = await getDocs(twinsQuery);

    const digitalTwins = await Promise.all(
      twinsSnapshot.docs.map(async (twinDoc) => {
        const twinData = twinDoc.data();

        // Resolve icon URL if icon is stored as an object or a storage path string
        let iconUrl = null;
        try {
          const storagePath =
            twinData.icon?.storagePath || twinData.icon || null;
          if (storagePath) {
            iconUrl = await getDownloadURL(ref(storage, storagePath));
          }
        } catch (error) {
          console.error('Error getting twin icon URL:', error);
        }

        return {
          avatar_id: twinDoc.id,
          name: twinData.name,
          description: twinData.description,
          icon: {
            url: iconUrl,
            storagePath: twinData.icon?.storagePath || twinData.icon || null,
            name: twinData.icon?.name || null,
            size: twinData.icon?.size || null,
            type: twinData.icon?.type || null,
          },
        };
      })
    );

    // Get personal image URL
    let personalImageUrl = null;
    if (userData.personal_image) {
      try {
        personalImageUrl = await getDownloadURL(
          ref(storage, userData.personal_image)
        );
      } catch (error) {
        console.error('Error getting personal image URL:', error);
      }
    }

    // Provide both the new `digital_twins` info and a legacy `avatars` shape for compatibility
    return {
      ...userData,
      digital_twins: digitalTwins.map((t) => t.avatar_id),
      avatars: digitalTwins.map((t) => ({
        avatar_id: t.avatar_id,
        name: t.name,
        description: t.description,
        icon: t.icon.url,
      })),
      personal_image: personalImageUrl,
    };
  } catch (error) {
    console.error(
      'getUserProfile error',
      error?.code || error?.message || error
    );
    if (error?.code === 'permission-denied') {
      throw new Error(
        'Insufficient Firestore permissions. Check your security rules and project configuration.'
      );
    }
    throw error;
  }
};

export const updateUserProfile = async (userId, updates) => {
  await updateDoc(doc(db, 'users', userId), updates);
};

export const uploadPersonalImage = async (userId, file) => {
  const storageRef = ref(storage, `users/${userId}/image/${file.name}`);
  await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(storageRef);

  await updateDoc(doc(db, 'users', userId), {
    personal_image: storageRef.fullPath,
  });

  return downloadURL;
};

export const deletePersonalImage = async (userId, imagePath) => {
  if (imagePath) {
    try {
      await deleteObject(ref(storage, imagePath));
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  }
};
