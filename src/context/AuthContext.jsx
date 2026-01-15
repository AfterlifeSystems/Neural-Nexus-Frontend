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
  const [user, setUser] = useState(null);
  const [userAvatars, setUserAvatars] = useState([]);
  const [sharedAvatars, setSharedAvatars] = useState([]);
  const [proprietaryAvatars, setProprietaryAvatars] = useState([]);
  const [activeAvatar, setActiveAvatar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null); // Firebase ID token for backend API

  // verify connection to firebase auth emulator
  useEffect(() => {
    if (auth.config) {
      console.log('Full Auth Config:', auth.config);
      // Look for a property called 'emulatorConfig' in the object tree
    }
  }, []);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const firebaseAuthStateChange = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (firebaseUser) {
          console.log(firebaseUser);
          setUser(firebaseUser);
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

            // localStorage.setItem('user', user);

            // Store user data in localStorage
            // localStorage.setItem('user', JSON.stringify(profile));
            // localStorage.setItem('firebase_user_id', firebaseUser.uid);

            // Load userAvatars from Firestore
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
          } catch (error) {
            console.error('Error loading user profile:', error);
            setUser(null);
            setAccessToken(null);
          }
        } else {
          // User signed out
          setUser(null);
          setUserAvatars([]);
          setSharedAvatars([]);
          setProprietaryAvatars([]);
          setActiveAvatar(null);
          setAccessToken(null);
          localStorage.removeItem('user');
        }

        setLoading(false);
      }
    );

    return firebaseAuthStateChange;
  }, []);

  // Load userAvatars from Firestore
  const loadAvatars = async (userId) => {
    try {
      const fetchedAvatars = await getAvatars(userId);
      setUserAvatars(fetchedAvatars);
      localStorage.setItem('userAvatars', JSON.stringify(fetchedAvatars));
      return fetchedAvatars;
    } catch (error) {
      console.error('Error loading userAvatars:', error);
      return [];
    }
  };

  // const resendVerification = async (email) => {
  //   try {
  //     // Firebase doesn't have a direct resend verification for email
  //     // We need to get the current user and resend
  //     if (auth.currentUser && auth.currentUser.email === email) {
  //       await sendEmailVerification(auth.currentUser);
  //       toast.success(
  //         (t) => (
  //           <div className="relative flex flex-col gap-2 p-4">
  //             <div className="flex justify-between items-start">
  //               <p className="pr-4">Verification email sent!</p>
  //               <button
  //                 onClick={() => toast.dismiss(t.id)}
  //                 className="p-1 bg-red-600 hover:bg-red-500 rounded text-sm"
  //               >
  //                 <X size={16} />
  //               </button>
  //             </div>
  //           </div>
  //         ),
  //         { duration: Infinity }
  //       );
  //     } else {
  //       throw new Error('Please log in first to resend verification email');
  //     }
  //   } catch (error) {
  //     console.error('Resend verification error:', error);
  //     toast.error(
  //       (t) => (
  //         <div className="relative flex flex-col gap-2 p-4">
  //           <div className="flex justify-between items-start">
  //             <p className="pr-4">
  //               {error.message || 'Failed to send verification email'}
  //             </p>
  //             <button
  //               onClick={() => toast.dismiss(t.id)}
  //               className="p-1 bg-red-600 hover:bg-red-500 rounded text-sm"
  //             >
  //               <X size={16} />
  //             </button>
  //           </div>
  //         </div>
  //       ),
  //       { duration: Infinity }
  //     );
  //     throw error;
  //   }
  // };

  // const forgotPassword = async (email) => {
  //   try {
  //     await sendPasswordResetEmail(auth, email, {
  //       url: `${window.location.origin}/auth/reset-password`,
  //     });
  //     // Don't show toast here - let AuthComponent handle it
  //   } catch (error) {
  //     console.error('Forgot password error:', error);
  //     throw error;
  //   }
  // };

  // const updatePassword = async (newPassword) => {
  //   try {
  //     if (!auth.currentUser) {
  //       throw new Error('No user logged in');
  //     }
  //     await firebaseUpdatePassword(auth.currentUser, newPassword);
  //     toast.success('Password updated successfully!');
  //   } catch (error) {
  //     console.error('Update password error:', error);
  //     throw error;
  //   }
  // };

  // // Social login with Google
  // const signInWithProvider = async (provider) => {
  //   try {
  //     if (provider === 'google') {
  //       const googleProvider = new GoogleAuthProvider();
  //       // Use redirect for better UX
  //       await signInWithRedirect(auth, googleProvider);
  //     } else {
  //       throw new Error(`Provider ${provider} is not supported`);
  //     }
  //   } catch (error) {
  //     console.error(`${provider} login error:`, error);
  //     toast.error(`${provider} login failed`);
  //     throw error;
  //   }
  // };

  // const getAvatars = async () => {
  //   if (!currentUser) return;

  //   try {
  //     const fetchedAvatars = await loadAvatars(currentUser.uid);
  //     return fetchedAvatars;
  //   } catch (error) {
  //     console.error('Get userAvatars error:', error);
  //     return [];
  //   }
  // };

  // const createAvatar = async ({ name, description = '', iconFile = null }) => {
  //   if (!currentUser) {
  //     throw new Error('User must be logged in to create avatar');
  //   }

  //   try {
  //     const created = await createAvatarInFirestore(
  //       currentUser.uid,
  //       name,
  //       description,
  //       iconFile
  //     );

  //     // Reload userAvatars and wait for state update
  //     const fetchedAvatars = await loadAvatars(currentUser.uid);

  //     // Find the created avatar in the fetched list (should be there)
  //     const createdAvatar =
  //       fetchedAvatars.find((a) => a.avatar_id === created.avatar_id) ||
  //       created; // Fallback to created object if not found

  //     // Set as active avatar
  //     setActiveAvatar(createdAvatar);

  //     // Update Firestore to mark as last_used_digital_twin
  //     await updateDoc(doc(db, 'users', currentUser.uid), {
  //       last_used_digital_twin: created.avatar_id,
  //       avatars: [...(user?.avatars || []), created.avatar_id],
  //     });

  //     // Update local user state
  //     if (user) {
  //       const updatedUser = {
  //         ...user,
  //         last_used_digital_twin: created.avatar_id,
  //         avatars: [...(user.avatars || []), created.avatar_id],
  //       };
  //       setUser(updatedUser);
  //       localStorage.setItem('user', JSON.stringify(updatedUser));
  //     }

  //     return created;
  //   } catch (error) {
  //     console.error('Create avatar failed:', error);
  //     throw error;
  //   }
  // };

  // const deleteAvatar = async (avatarId) => {
  //   if (!currentUser) return;

  //   try {
  //     await deleteAvatarFromFirestore(currentUser.uid, avatarId);
  //     await loadAvatars(currentUser.uid);

  //     if (activeAvatar?.avatar_id === avatarId) {
  //       setActiveAvatar(null);
  //     }
  //   } catch (error) {
  //     console.error('Delete avatar failed:', error);
  //     throw error;
  //   }
  // };

  // const selectAvatar = async (avatarId) => {
  //   if (!currentUser) return;

  //   try {
  //     const response = await selectAvatarInFirestore(currentUser.uid, avatarId);

  //     if (response.status === 'success') {
  //       const selectedAvatar = userAvatars.find((a) => a.avatar_id === avatarId);
  //       if (selectedAvatar) {
  //         setActiveAvatar(selectedAvatar);
  //       }

  //       // Update user profile
  //       await updateDoc(doc(db, 'users', currentUser.uid), {
  //         last_used_digital_twin: avatarId,
  //       });

  //       // Update local user state
  //       if (user) {
  //         const updatedUser = { ...user, last_used_digital_twin: avatarId };
  //         setUser(updatedUser);
  //         setUserProfile(updatedUser);
  //         localStorage.setItem('user', JSON.stringify(updatedUser));
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Select avatar failed:', error);
  //     throw error;
  //   }
  // };

  // const updateActiveAvatarField = (field, value) => {
  //   setActiveAvatar((prev) => ({
  //     ...prev,
  //     [field]: value,
  //   }));
  // };

  // // Handle OAuth redirect result
  // useEffect(() => {
  //   getRedirectResult(auth)
  //     .then((result) => {
  //       if (result) {
  //         // User signed in via redirect
  //         // toast.success('Login successful!');
  //       }
  //     })
  //     .catch((error) => {
  //       console.error('OAuth redirect error:', error);
  //       toast.error('Authentication failed');
  //     });
  // }, []);

  // if (loading) {
  //   return <div>Loading...</div>;
  // }

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
        sharedAvatars,
        setSharedAvatars,
        proprietaryAvatars,
        setProprietaryAvatars,
        activeAvatar,
        setActiveAvatar,
        loading,
        setLoading,
        // Auth methods
        // login,
        // signup,
        // logout,
        // resendVerification,
        // forgotPassword,
        // updatePassword,
        // signInWithProvider,

        // Avatar methods
        // getAvatars,
        // createAvatar,
        // deleteAvatar,
        // selectAvatar,
        // updateActiveAvatarField,

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
