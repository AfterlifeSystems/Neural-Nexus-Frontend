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
  const [user, setUser] = useState(null); // current user auth object
  const [profile, setProfile] = useState(null);

  const [userAvatars, setUserAvatars] = useState([]); // avatars of the user
  const [communityAvatars, setCommunityAvatars] = useState([]); // avatars shared by the community
  const [proprietaryAvatars, setProprietaryAvatars] = useState([]); // avatars created by Afterlife Systems Inc. (businesses, bibles, restaurants, etc.)

  const [activeAvatar, setActiveAvatar] = useState(null);

  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null); // Firebase ID token for backend API

  const [messages, setMessages] = useState(null);

  // TESTING
  useEffect(() => {
    auth.setPersistence(browserLocalPersistence);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      console.log(
        'XXXXXXXXXXXXXXXXXXXXXX CURRENT USER AUTH CONTEXT USE EFFECT XXXXXXXXXXXXXXXXXXXXXXXXXXX'
      );
      // console.log(currentUser);
      // console.log(currentUser.uid);

      if (!currentUser) {
        setProfile([]); // object that will contain current avatar
        setUserAvatars([]); // list of avatars each with current conversation
        setCommunityAvatars([]);
        setProprietaryAvatars([]);
        setMessages([]); // messages of the current conversation
        setActiveAvatar(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    let unsubscribeProfile = () => {};
    let unsubscribeAvatars = () => {};
    let unsubscribeMessages = () => {};

    if (user) {
      // user profile data in firestore
      const profileRef = doc(db, 'users', user.uid); // contains current avatar
      const unsubscribeProfile = onSnapshot(profileRef, (profileSnap) => {
        setProfile(profileSnap.exists() ? profileSnap.data() : null);
        console.log(
          'XXXXXXXXXXXXXXXXXXXXXX CURRENT USER PROFILE AUTH CONTEXT USE EFFECT XXXXXXXXXXXXXXXXXX'
        );
        console.log(profileSnap);
      });

      // user avatar list in firestore
      const avatarsRef = collection(db, `users/${user.uid}/avatars`); //contains current_conversation for each avatar
      const unsubscribeAvatars = onSnapshot(avatarsRef, (avatarSnap) => {
        const list = avatarSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUserAvatars(list);

        // and set it as activeAvatar (full object, not just id)
        if (profile?.last_used_avatar) {
          const matchingAvatar = list.find(
            (avatar) => avatar.id === profile.last_used_avatar
          );

          if (matchingAvatar) {
            setActiveAvatar(matchingAvatar);
            console.log('Active avatar set:', matchingAvatar.id);
          } else {
            console.log('No matching avatar found for last_used_avatar');
            setActiveAvatar(null);
          }
        } else {
          setActiveAvatar(null);
        }
        console.log('User avatars count:', list.length);
        console.log(
          'XXXXXXXXXXXXXXXXXXXXXXXXX USER AVATARS AUTH CONTEXT USE EFFECT XXXXXXXXXXXXXXXXXXXXXX'
        );
        console.log(avatarSnap);
      });
      //
      // messages from the default_conversation of the user's current avatar
      if (activeAvatar) {
        const messagesRef = collection(
          db,
          `avatars/${profile.last_used_avatar}/conversations/${activeAvatar.default_conversation}/messages`
        );
        unsubscribeMessages = onSnapshot(messagesRef, (messageSnap) => {
          setMessages(
            messageSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
          );
          console.log(
            'XXXXXXXXXXXXXXXXXXXXXXXXXXX PROFILE.LAST_USED_AVATAR MESSAGE XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
          );
          console.log(messageSnap);
        });
      }
      //
      return () => {
        unsubscribeProfile();
        unsubscribeAvatars();
        unsubscribeMessages();
      };
    }
  }, [user]);

  // verify connection to firebase auth emulator
  useEffect(() => {
    if (auth.config) {
      console.log('Full Auth Config:', auth.config);
      // Look for a property called 'emulatorConfig' in the object tree
    }
  }, []);

  // LEGACY - DEPRECATED
  // Inside your AuthContext.jsx Live Update Avatars
  useEffect(() => {
    if (!user) {
      setUserAvatars([]);
      return;
    }

    // 1. Define the Query
    const q = query(
      collection(db, 'avatars'),
      where('user_id', '==', user.uid),
      orderBy('created_at', 'asc')
    );

    // 2. Establish the Listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedAvatars = snapshot.docs.map((doc) => ({
          avatar_id: doc.id,
          ...doc.data(),
        }));

        // This updates the global state automatically when
        // an avatar is added, deleted, or edited!
        setUserAvatars(fetchedAvatars);
        console.log(
          'XXXXXXXXXXXXXXXXXXX ON AVATAR TRIGGER XXXXXXXXXXXXXXXXXXXX'
        );
      },
      (error) => {
        console.error('Snapshot listener error:', error);
      }
    );

    // 3. CLEANUP: This is critical for memory management
    return () => unsubscribe();
  }, [user]);

  // Live Update Users
  // useEffect(() => {
  //   if (!user) {
  //     setUserProfile(null);
  //     return;
  //   }

  //   // 1. Reference the specific User Document
  //   const userDocRef = doc(db, 'users', user.uid);

  //   // 2. Establish the Document Listener
  //   const unsubscribe = onSnapshot(
  //     userDocRef,
  //     (docSnapshot) => {
  //       if (docSnapshot.exists()) {
  //         const data = docSnapshot.data();

  //         // Update global user profile state
  //         setUserProfile(data);
  //         console.log(
  //           'XXXXXXXXXXXXXXXXXXX ON USER TRIGGER XXXXXXXXXXXXXXXXXXXX'
  //         );

  //         // OPTIONAL: Sync specific logic, like updating localStorage
  //         // with the most recent last_used_avatar
  //         if (data.last_used_avatar) {
  //           localStorage.setItem('last_used_avatar_id', data.last_used_avatar);
  //         }
  //       } else {
  //         console.warn('User profile document does not exist.');
  //       }
  //     },
  //     (error) => {
  //       console.error('User profile snapshot error:', error);
  //     }
  //   );

  //   // 3. Cleanup listener on unmount
  //   return () => unsubscribe();
  // }, [user]);

  // Listen to Firebase auth state changes

  // useEffect(() => {
  //   const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
  //     console.log(
  //       'XXXXXXXXXXXXXXXXXXX ON AUTH STATE TRIGGER XXXXXXXXXXXXXXXXXXXX'
  //     );
  //     if (firebaseUser) {
  //       setUser(firebaseUser); // This triggers the onSnapshot useEffects!
  //       try {
  //         const token = await firebaseUser.getIdToken(
  //           /* foreceRefresh = */ true
  //         );
  //         setAccessToken(token);
  //       } catch (err) {
  //         console.error('Failed to get fresh ID token', err);
  //         setAccessToken(null);
  //       }
  //     } else {
  //       setUser(null);
  //       setAccessToken(null);
  //     }
  //     setLoading(false); // Move this here to ensure it only flips once
  //   });

  //   return unsubscribeAuth;
  // }, []);

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
