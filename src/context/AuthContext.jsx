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
  browserLocalPersistence,
} from 'firebase/auth';

import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  query,
  collection,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db, storage } from '../firebase/config.js';
import { getUserProfile } from '../services/userService';

import toast from 'react-hot-toast';
import { X } from 'lucide-react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // current user auth object
  const [profile, setProfile] = useState(null);

  const [userAvatars, setUserAvatars] = useState([]); // avatars of the user
  const [communityAvatars, setCommunityAvatars] = useState([]); // avatars shared by the community
  const [proprietaryAvatars, setProprietaryAvatars] = useState([]); // avatars created by Afterlife Systems Inc. (businesses, bibles, restaurants, etc.)

  const [activeAvatar, setActiveAvatar] = useState(null);

  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null); // Firebase ID token for backend API

  // TESTING
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      // setting the user profile

      // Give Firestore listener a moment to catch up (common pattern)

      if (currentUser) {
        const token = await currentUser.getIdToken();
        setAccessToken(token);
      } else {
        setAccessToken(null);
      }

      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // sets the profile whenever user changes in auth context
  useEffect(() => {
    console.log('USER HAVE CHANGED IN AUTH CONTEXT; CHANGING USER PROFILE');
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setProfile(snap.exists() ? snap.data() : null);
    });
    return unsub;
  }, [user]);

  // set user avatars when user state is updated
  useEffect(() => {
    if (!user) {
      setUserAvatars([]);
      return;
    }

    const ref = collection(db, 'users', user.uid, 'avatars');
    const q = query(ref, orderBy('created_at', 'asc'));

    const unsub = onSnapshot(q, (snap) => {
      const avatars = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUserAvatars(avatars);
    });
    return unsub;
  }, [user]);

  // Active avatar can be derived in a useMemo or another effect
  useEffect(() => {
    if (!profile?.last_used_avatar || userAvatars.length === 0) {
      setActiveAvatar(null);
      return;
    }
    const match = userAvatars.find((a) => a.id === profile.last_used_avatar);
    setActiveAvatar(match || null);
  }, [profile?.last_used_avatar, userAvatars]);

  // change of the active avatar
  useEffect(() => {
    console.log('ACTIVE AVATAR CHANGED');
    console.log(`${user}`);
    console.log(`${activeAvatar}`);
  }, [activeAvatar]);

  // verify connection to firebase auth emulator
  useEffect(() => {
    if (auth.config) {
      console.log('Full Auth Config:', auth.config);
      // Look for a property called 'emulatorConfig' in the object tree
    }
  }, []);

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
        communityAvatars,
        setCommunityAvatars,
        proprietaryAvatars,
        setProprietaryAvatars,
        profile,
        setProfile,
        activeAvatar,
        setActiveAvatar,
        loading,
        setLoading,
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
