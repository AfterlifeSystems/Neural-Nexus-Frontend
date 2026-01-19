import {
  createUserWithEmailAndPassword,
  indexedDBLocalPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, storage } from '../firebase/config.js';
import toast from 'react-hot-toast';

export const logout = async () => {
  try {
    // localStorage.clear();
    const user = auth.currentUser;
    console.log(
      'XXXXXXXXXXXXXXXXXXXXXXXXX auth.currentUser: ' +
        JSON.stringify(auth.currentUser)
    );
    console.log(
      'XXXXXXXXXXXXXXXXXXXXXXXXX auth.currentUser.user: ' +
        JSON.stringify(auth.currentUser.user)
    );
    console.log(
      'XXXXXXXXXXX AUTH SERVICE XXXXXXXXXXXXXXXXX LOGOUT XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' +
        auth.currentUser
    );

    console.log(user);

    if (user) {
      await updateDoc(doc(db, 'users', user.uid), {
        currently_logged_in: false,
      });
    }
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    toast.error('Logout completed with errors');
    // throw error;
  }
};
