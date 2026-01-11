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
import { db, storage } from '../firebase/config';

export const getUserProfile = async (userId) => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) {
    throw new Error('User not found');
  }

  const userData = userDoc.data();

  // Get avatars
  const avatarsQuery = query(
    collection(db, 'avatars'),
    where('user_id', '==', userId)
  );
  const avatarsSnapshot = await getDocs(avatarsQuery);

  const avatars = await Promise.all(
    avatarsSnapshot.docs.map(async (avatarDoc) => {
      const avatarData = avatarDoc.data();
      let iconUrl = null;

      if (avatarData.icon) {
        try {
          iconUrl = await getDownloadURL(ref(storage, avatarData.icon));
        } catch (error) {
          console.error('Error getting icon URL:', error);
        }
      }

      return {
        avatar_id: avatarDoc.id,
        name: avatarData.name,
        description: avatarData.description,
        icon: iconUrl,
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

  return {
    ...userData,
    avatars,
    personal_image: personalImageUrl,
  };
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
