// services/AvatarService.jsx
// NGROK / external DB HTTP calls removed — use Firestore-backed helper functions below.

export const AvatarService = {
  async getAll(userId) {
    return await getAvatars(userId);
  },

  async createAvatar(userId, payload) {
    return await createAvatar(
      userId,
      payload.name,
      payload.description,
      payload.iconFile
    );
  },

  async deleteAvatar(userId, avatarId) {
    return await deleteAvatar(userId, avatarId);
  },

  async selectAvatar(userId, avatarId) {
    // Return avatar document with helpful fields (icon_url, documents, socialLogins)
    const avatarRef = doc(db, 'digital_twins', avatarId);
    const avatarSnap = await getDoc(avatarRef);
    if (!avatarSnap.exists() || avatarSnap.data().user_id !== userId) {
      throw new Error('Avatar not found or unauthorized');
    }
    const data = avatarSnap.data();
    // Resolve icon URL if present
    let icon_url = null;
    if (data.icon) {
      try {
        icon_url = await getDownloadURL(ref(storage, data.icon));
      } catch (err) {
        console.warn('Failed to resolve icon URL:', err);
      }
    }

    return {
      ...data,
      avatar_id: avatarId,
      icon_url,
    };
  },

  async uploadDocuments(userId, avatarId, files) {
    // Upload files to storage and append metadata to digital_twins/{avatarId}.files
    const uploaded = [];
    for (const file of files) {
      const fileId = uuidv4();
      const storagePath = `users/${userId}/digital_twins/${avatarId}/files/${fileId}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const meta = {
        id: fileId,
        url,
        storagePath,
        name: file.name,
        size: file.size,
        type: file.type,
        uploaded_at: new Date().toISOString(),
      };
      uploaded.push(meta);
    }

    // Update avatar doc
    const avatarRef = doc(db, 'digital_twins', avatarId);
    const avatarSnap = await getDoc(avatarRef);
    const currentFiles = avatarSnap.exists()
      ? avatarSnap.data().files || []
      : [];
    await updateDoc(avatarRef, { files: [...currentFiles, ...uploaded] });

    return uploaded;
  },

  async uploadUrl(userId, avatarId, url) {
    const fileId = uuidv4();
    const meta = {
      id: fileId,
      url,
      storagePath: null,
      name: url,
      size: 0,
      type: 'link',
      uploaded_at: new Date().toISOString(),
    };

    const avatarRef = doc(db, 'digital_twins', avatarId);
    const avatarSnap = await getDoc(avatarRef);
    const currentFiles = avatarSnap.exists()
      ? avatarSnap.data().files || []
      : [];
    await updateDoc(avatarRef, { files: [...currentFiles, meta] });

    return meta;
  },

  async connectSocial(userId, avatarId, platform, username, password) {
    const avatarRef = doc(db, 'digital_twins', avatarId);
    const avatarSnap = await getDoc(avatarRef);
    const socialLogins = avatarSnap.exists()
      ? avatarSnap.data().socialLogins || []
      : [];
    const login = {
      id: uuidv4(),
      platform,
      username,
      added_at: new Date().toISOString(),
    };
    await updateDoc(avatarRef, { socialLogins: [...socialLogins, login] });
    return login;
  },

  async disconnectSocial(userId, avatarId, loginId) {
    const avatarRef = doc(db, 'digital_twins', avatarId);
    const avatarSnap = await getDoc(avatarRef);
    const socialLogins = avatarSnap.exists()
      ? avatarSnap.data().socialLogins || []
      : [];
    const updated = socialLogins.filter((l) => l.id !== loginId);
    await updateDoc(avatarRef, { socialLogins: updated });
    return { status: 'success' };
  },

  async deleteDocument(userId, avatarId, documentId) {
    const avatarRef = doc(db, 'digital_twins', avatarId);
    const avatarSnap = await getDoc(avatarRef);
    const files = avatarSnap.exists() ? avatarSnap.data().files || [] : [];
    const target = files.find((f) => f.id === documentId);
    if (target && target.storagePath) {
      try {
        await deleteObject(ref(storage, target.storagePath));
      } catch (err) {
        console.warn('Failed to delete storage object:', err);
      }
    }
    const updatedFiles = files.filter((f) => f.id !== documentId);
    await updateDoc(avatarRef, { files: updatedFiles });
    return { status: 'success' };
  },
};
