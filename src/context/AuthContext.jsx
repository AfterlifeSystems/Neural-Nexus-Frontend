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

import toast from 'react-hot-toast';
import { X } from 'lucide-react';

import { getAvatars } from '../services/avatarService.jsx';

import { createClient } from '@supabase/supabase-js';

const supabase = await createClient(
  `${import.meta.env.VITE_SUPABASE_URL}`,
  `${import.meta.env.VITE_SUPABASE_PUBLISHABLE_AUTH_KEY}`
);

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
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(event, session);
      if (event === 'INITIAL_SESSION') {
        // handle initial session
        console.log('// handle initial session');
      } else if (event === 'SIGNED_IN') {
        console.log('// handle USER SIGNED IN');
        console.log(session);
        // setUser()
      } else if (event === 'SIGNED_OUT') {
        console.log('// handle USER SIGNED OUT');
        console.log(session);
      } else if (event === 'PASSWORD_RECOVERY') {
        console.log('// handle PASSWORD RECOVERY');
        console.log(session);
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('// handle TOKEN_REFRESH ');
        console.log(session);
      } else if (event === 'USER_UPDATED') {
        console.log('// handle USER UPDATED');
        console.log(session);
      }
    });

    // const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    //   setUser(currentUser);

    //   // setting the user profile

    //   // Give Firestore listener a moment to catch up (common pattern)

    //   if (currentUser) {
    //     const token = await currentUser.getIdToken();
    //     setAccessToken(token);
    //   } else {
    //     setAccessToken(null);
    //   }

    //   setLoading(false);
    // });
    return data.subscription.unsubscribe;
  }, []);

  // sets the profile whenever user changes in auth context
  // useEffect(() => {
  //   console.log('USER HAS CHANGED IN AUTH CONTEXT; CHANGING USER PROFILE');
  //   if (!user) return;
  //   const unsub = onSnapshot(doc(db, 'users', user.id), (snap) => {
  //     setProfile(snap.exists() ? snap.data() : null);
  //   });
  //   return unsub;
  // }, [user]);

  // set user avatars when user state is updated
  useEffect(() => {
    const setAvatarsWhenUserStateIsUpdated = async () => {
      if (!user) {
        setUserAvatars([]);
        return;
      }

      // GET AVATARS
      console.log('USER HAS LOGGED IN; GETING AVATARS FOR USER');
      console.log(`user.id: ${user.id}`);
      const avatars = await getAvatars(user.id);

      console.log('AVATARS LIST SHOULD BE RETRIEVED');
      console.log(`avatars: ${avatars}`);

      setUserAvatars(avatars);
      console.log('SETTING AVATARS FOR USER');
      return avatars;
    };

    setAvatarsWhenUserStateIsUpdated();

    // firebase implementation
    // const ref = collection(db, 'users', user.id, 'avatars');
    // const q = query(ref, orderBy('created_at', 'asc'));

    // const unsub = onSnapshot(q, (snap) => {
    //   const avatars = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    //   setUserAvatars(avatars);
    // });
  }, [user]);

  // Active avatar can be derived in a useMemo or another effect
  // useEffect(() => {
  //   if  (!profile?.last_used_avatar || userAvatars.length === 0) {
  //     setActiveAvatar(null);
  //     return;
  //   }
  //   const match = userAvatars.find((a) => a.id === profile.last_used_avatar);
  //   setActiveAvatar(match || null);
  // }, [profile?.last_used_avatar, userAvatars]);

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
