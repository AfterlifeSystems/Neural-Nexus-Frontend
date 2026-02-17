import React, { createContext, useContext, useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';

import { auth, db, storage } from '../firebase/config.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // current user auth object
  const [profile, setProfile] = useState(null); // the user with metadata included

  const [userAvatars, setUserAvatars] = useState([]); // avatars of the user
  const [communityAvatars, setCommunityAvatars] = useState([]); // avatars shared by the community
  const [proprietaryAvatars, setProprietaryAvatars] = useState([]); // avatars created by Afterlife Systems Inc. (businesses, bibles, restaurants, etc.)

  const [activeAvatar, setActiveAvatar] = useState(null);
  const [context, setContext] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [accessToken, setAccessToken] = useState(null); // Firebase ID token for backend API

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
        isLoading,
        setIsLoading,
        context,
        setContext,
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
