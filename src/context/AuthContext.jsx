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
} from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db, storage } from '../firebase/config';
import { getUserProfile } from '../services/userService';
import {
  getAvatars as getAvatarsFromFirestore,
  createAvatar as createAvatarInFirestore,
  deleteAvatar as deleteAvatarFromFirestore,
  selectAvatar as selectAvatarInFirestore,
} from '../services/avatarService';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // Firebase Auth user
  const [userProfile, setUserProfile] = useState(null); // Firestore user profile
  const [avatars, setAvatars] = useState([]);
  const [activeAvatar, setActiveAvatar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null); // Firebase ID token for backend API

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setCurrentUser(firebaseUser);

      if (firebaseUser) {
        try {
          // Debug: ensure uid and token are available
          console.log('Auth state changed for uid:', firebaseUser.uid);

          // Get Firebase ID token for backend API calls
          // Firebase automatically refreshes tokens when needed
          let token;
          try {
            token = await firebaseUser.getIdToken();
            setAccessToken(token);
            localStorage.setItem('access_token', token);
          } catch (tokenErr) {
            console.error('Error obtaining ID token:', tokenErr);
          }

          // Get Firestore user profile (returns null if missing)
          let profile = null;
          try {
            profile = await getUserProfile(firebaseUser.uid);
          } catch (err) {
            console.error('Error fetching user profile:', err);
            if (
              err.message &&
              err.message.includes('Insufficient Firestore permissions')
            ) {
              toast.error(
                'Firestore permissions error: please check rules and project configuration.'
              );
            } else {
              throw err;
            }
          }

          // If profile missing, attempt to create a minimal profile document
          if (!profile) {
            try {
              const minimalProfile = {
                user_id: firebaseUser.uid,
                username:
                  firebaseUser.displayName ||
                  (firebaseUser.email || '').split('@')[0],
                email: firebaseUser.email || null,
                created_at: new Date(),
                last_login: new Date(),
                currently_logged_in: true,
                avatars: [],
                digital_twins: [],
              };
              await setDoc(doc(db, 'users', firebaseUser.uid), minimalProfile);
              profile = await getUserProfile(firebaseUser.uid);
              console.log(
                'Created minimal user profile for uid:',
                firebaseUser.uid
              );
            } catch (createErr) {
              console.error(
                'Failed to create minimal user profile:',
                createErr
              );
              if (
                createErr?.message &&
                createErr.message.includes('Insufficient Firestore permissions')
              ) {
                toast.error(
                  'Unable to create user profile due to Firestore permissions.'
                );
              }
            }
          }

          if (profile) {
            setUserProfile(profile);
            setUser(profile);
            setIsLoggedIn(true);

            // Store user data in localStorage
            localStorage.setItem('user', JSON.stringify(profile));
            localStorage.setItem('firebase_user_id', firebaseUser.uid);

            // Load avatars from Firestore
            const loadedAvatars = await loadAvatars(firebaseUser.uid);

            // Set active avatar if user has last_used_digital_twin
            if (profile.last_used_digital_twin && loadedAvatars.length > 0) {
              const lastUsed = loadedAvatars.find(
                (a) => a.avatar_id === profile.last_used_digital_twin
              );
              if (lastUsed) {
                setActiveAvatar(lastUsed);
              }
            }
          } else {
            // Profile unavailable: keep auth state limited
            setUserProfile(null);
            setUser(null);
            setIsLoggedIn(false);
          }
        } catch (error) {
          console.error('Error loading user profile:', error);
          setUserProfile(null);
          setUser(null);
          setIsLoggedIn(false);
          setAccessToken(null);
        }
      } else {
        // User signed out
        setUser(null);
        setUserProfile(null);
        setIsLoggedIn(false);
        setAvatars([]);
        setActiveAvatar(null);
        setAccessToken(null);
        localStorage.removeItem('user');
        localStorage.removeItem('firebase_user_id');
        localStorage.removeItem('avatars');
        localStorage.removeItem('access_token');
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Load avatars from Firestore
  const loadAvatars = async (userId) => {
    try {
      const fetchedAvatars = await getAvatarsFromFirestore(userId);
      setAvatars(fetchedAvatars);
      localStorage.setItem('avatars', JSON.stringify(fetchedAvatars));
      return fetchedAvatars;
    } catch (error) {
      console.error('Error loading avatars:', error);
      return [];
    }
  };

  const signup = async (username, email, password) => {
    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Update display name
      await updateProfile(userCredential.user, { displayName: username });

      // Send email verification
      await sendEmailVerification(userCredential.user);

      // Create Firestore profile
      const userDoc = {
        user_id: userCredential.user.uid,
        username,
        email,
        created_at: new Date(),
        last_login: null,
        currently_logged_in: true,
        personal_image: null,
        neural_nexus_api_key: null,
        grok_api_key: null,
        enable_grok_imagine: false,
        elevenlabs_api_key: null,
        enable_elevenlabs: false,
        api_usage: {
          requests_made: 0,
          tokens_used: 0,
        },
        billing_history: [],
        credit_card: null,
        avatars: [],
        last_used_digital_twin: null,
        digital_twins: [],
        cloud_run_services: {},

        avatar_messaging_api_cpu_endpoint: null,
        avatar_messaging_api_gpu_endpoint: null,
        avatar_data_collection_api_endpoint: null,
        avatar_vectorstore_management_api_endpoint: null,
        avatar_adapter_management_api_endpoint: null,
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), userDoc);

      toast.success(
        'Signup successful! Please check your email to verify your account.',
        { duration: Infinity }
      );

      return userCredential.user;
    } catch (error) {
      console.error('Signup error:', error);

      // Display user-friendly error messages
      let errorMessage = 'Signup failed. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please provide a valid email address';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password must be at least 6 characters';
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Check if email is verified
      if (!userCredential.user.emailVerified) {
        await signOut(auth);
        // throw new Error('Please verify your email before logging in');
      }

      // Update last_login in Firestore
      await updateDoc(doc(db, 'users', userCredential.user.uid), {
        last_login: new Date(),
        currently_logged_in: true,
      });

      // toast.success('Login successful!');
      return userCredential.user;
    } catch (error) {
      console.error('Login error:', error);

      let errorMessage = 'Login failed. Please try again.';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Update Firestore if user is logged in
      if (currentUser) {
        try {
          await updateDoc(doc(db, 'users', currentUser.uid), {
            currently_logged_in: false,
          });
        } catch (error) {
          console.error('Error updating logout status:', error);
        }
      }

      // Sign out from Firebase
      await signOut(auth);

      // Clear local state
      setUser(null);
      setUserProfile(null);
      setIsLoggedIn(false);
      setAvatars([]);
      setActiveAvatar(null);
      setAccessToken(null);
      localStorage.removeItem('user');
      localStorage.removeItem('firebase_user_id');
      localStorage.removeItem('avatars');
      localStorage.removeItem('access_token');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout completed with errors');
    }
  };

  const resendVerification = async (email) => {
    try {
      // Firebase doesn't have a direct resend verification for email
      // We need to get the current user and resend
      if (auth.currentUser && auth.currentUser.email === email) {
        await sendEmailVerification(auth.currentUser);
        toast.success(
          (t) => (
            <div className="relative flex flex-col gap-2 p-4">
              <div className="flex justify-between items-start">
                <p className="pr-4">Verification email sent!</p>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="p-1 bg-red-600 hover:bg-red-500 rounded text-sm"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ),
          { duration: Infinity }
        );
      } else {
        throw new Error('Please log in first to resend verification email');
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      toast.error(
        (t) => (
          <div className="relative flex flex-col gap-2 p-4">
            <div className="flex justify-between items-start">
              <p className="pr-4">
                {error.message || 'Failed to send verification email'}
              </p>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="p-1 bg-red-600 hover:bg-red-500 rounded text-sm"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ),
        { duration: Infinity }
      );
      throw error;
    }
  };

  const forgotPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/auth/reset-password`,
      });
      // Don't show toast here - let AuthComponent handle it
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  };

  const updatePassword = async (newPassword) => {
    try {
      if (!auth.currentUser) {
        throw new Error('No user logged in');
      }
      await firebaseUpdatePassword(auth.currentUser, newPassword);
      toast.success('Password updated successfully!');
    } catch (error) {
      console.error('Update password error:', error);
      throw error;
    }
  };

  // Social login with Google
  const signInWithProvider = async (provider) => {
    try {
      if (provider === 'google') {
        const googleProvider = new GoogleAuthProvider();
        // Use redirect for better UX
        await signInWithRedirect(auth, googleProvider);
      } else {
        throw new Error(`Provider ${provider} is not supported`);
      }
    } catch (error) {
      console.error(`${provider} login error:`, error);
      toast.error(`${provider} login failed`);
      throw error;
    }
  };

  const getAvatars = async () => {
    if (!currentUser) return;

    try {
      const fetchedAvatars = await loadAvatars(currentUser.uid);
      return fetchedAvatars;
    } catch (error) {
      console.error('Get avatars error:', error);
      return [];
    }
  };

  const createAvatar = async ({ name, description = '', iconFile = null }) => {
    if (!currentUser) {
      throw new Error('User must be logged in to create avatar');
    }

    try {
      const created = await createAvatarInFirestore(
        currentUser.uid,
        name,
        description,
        iconFile
      );

      // Reload avatars and wait for state update
      const fetchedAvatars = await loadAvatars(currentUser.uid);

      // Find the created avatar in the fetched list (should be there)
      const createdAvatar =
        fetchedAvatars.find((a) => a.avatar_id === created.avatar_id) ||
        created; // Fallback to created object if not found

      // Set as active avatar
      setActiveAvatar(createdAvatar);

      // Update Firestore to mark as last_used_digital_twin
      await updateDoc(doc(db, 'users', currentUser.uid), {
        last_used_digital_twin: created.avatar_id,
        digital_twins: [...(user?.digital_twins || []), created.avatar_id],
      });

      // Update local user state
      if (user) {
        const updatedUser = {
          ...user,
          last_used_digital_twin: created.avatar_id,
          digital_twins: [...(user.digital_twins || []), created.avatar_id],
        };
        setUser(updatedUser);
        setUserProfile(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }

      return created;
    } catch (error) {
      console.error('Create avatar failed:', error);
      throw error;
    }
  };

  const deleteAvatar = async (avatarId) => {
    if (!currentUser) return;

    try {
      await deleteAvatarFromFirestore(currentUser.uid, avatarId);
      await loadAvatars(currentUser.uid);

      if (activeAvatar?.avatar_id === avatarId) {
        setActiveAvatar(null);
      }
    } catch (error) {
      console.error('Delete avatar failed:', error);
      throw error;
    }
  };

  const selectAvatar = async (avatarId) => {
    if (!currentUser) return;

    try {
      const response = await selectAvatarInFirestore(currentUser.uid, avatarId);

      if (response.status === 'success') {
        const selectedAvatar = avatars.find((a) => a.avatar_id === avatarId);
        if (selectedAvatar) {
          setActiveAvatar(selectedAvatar);
        }

        // Update user profile
        await updateDoc(doc(db, 'users', currentUser.uid), {
          last_used_digital_twin: avatarId,
        });

        // Update local user state
        if (user) {
          const updatedUser = { ...user, last_used_digital_twin: avatarId };
          setUser(updatedUser);
          setUserProfile(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
      }
    } catch (error) {
      console.error('Select avatar failed:', error);
      throw error;
    }
  };

  const updateActiveAvatarField = (field, value) => {
    setActiveAvatar((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle OAuth redirect result
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          // User signed in via redirect
          // toast.success('Login successful!');
        }
      })
      .catch((error) => {
        console.error('OAuth redirect error:', error);
        toast.error('Authentication failed');
      });
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider
      value={{
        // User state
        user,
        userProfile,
        isLoggedIn,
        currentUser, // Firebase Auth user object
        accessToken, // Firebase ID token for backend API calls
        avatars,
        activeAvatar,
        setActiveAvatar,

        // Auth methods
        login,
        signup,
        logout,
        resendVerification,
        forgotPassword,
        updatePassword,
        signInWithProvider,

        // Avatar methods
        getAvatars,
        createAvatar,
        deleteAvatar,
        selectAvatar,
        updateActiveAvatarField,

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
