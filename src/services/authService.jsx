import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

export const signup = async (email, password, username) => {
  try {
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Update display name
    await updateProfile(userCredential.user, { displayName: username });

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
      last_used_avatar: null,
      cloud_run_services: {},
      avatar_messaging_api_cpu_endpoint: null,
      avatar_messaging_api_gpu_endpoint: null,
      avatar_data_collection_api_endpoint: null,
      avatar_vectorstore_management_api_endpoint: null,
      avatar_adapter_management_api_endpoint: null,
    };

    await setDoc(doc(db, 'users', userCredential.user.uid), userDoc);

    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

export const login = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Update last_login
    await updateDoc(doc(db, 'users', userCredential.user.uid), {
      last_login: new Date(),
      currently_logged_in: true,
    });

    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

export const logout = async () => {
  try {
    const user = auth.currentUser;
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), {
        currently_logged_in: false,
      });
    }
    await signOut(auth);
  } catch (error) {
    throw error;
  }
};
