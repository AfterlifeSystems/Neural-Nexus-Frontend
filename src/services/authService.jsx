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

export const signup = async (username, email, password) => {
  try {
    console.log(email);
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const uid = userCredential.user.uid;

    // Send email verification
    // await sendEmailVerification(userCredential.user);

    // Update display name
    // await updateProfile(userCredential.user, { displayName: username });

    // Create Firestore profile
    const userDoc = {
      user_id: userCredential.user.uid,
      username,
      email,
      created_at: new Date(),
      last_login: new Date(),
      currently_logged_in: true,
      avatars: [],
      last_used_avatar: null,
    };

    // 3. Write to Firestore
    // Using doc(db, 'collection', ID) ensures the document ID matches the Auth UID
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, userDoc);
    console.log(`✅ Profile created in Firestore for UID: ${uid}`);
    // return userCredential.user;

    // await setDoc(doc(db, 'users', userCredential.user.uid), userDoc);
    // toast.success(
    //   'Signup successful! Please check your email to verify your account.',
    //   { duration: Infinity }
    // );
    localStorage.setItem(user, userCredential.user);

    return userCredential.user;
  } catch (error) {
    console.error('Signup error:', error);
    console.error('Signup error:', error);
    toast.error(error.message);
    // throw error;
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

export const login = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    console.log(
      'XXXXXXXXXXXXXXXXXXXXXX   USE EFFECT LOGIN FROM AUTH SERVICE XXXXXXXXXXXXXXXXXXXXXXXXXXX'
    );
    console.log(userCredential);

    // Allow unverified emails if we are using the emulator
    const isEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

    // Check if email is verified
    // if (!userCredential.user.emailVerified && !isEmulator) {
    //   await signOut(auth);
    //   throw new Error('Please verify your email before logging in');
    // }

    // Update last_login in Firestore
    await updateDoc(doc(db, 'users', userCredential.user.uid), {
      last_login: new Date(),
      currently_logged_in: true,
    });

    console.log(
      'XXXXXXXXXXXXXXXXXXXXXXXXX userCredential: ' +
        JSON.stringify(userCredential)
    );
    console.log(
      'XXXXXXXXXXXXXXXXXXXXXXXXX userCredential.user: ' +
        JSON.stringify(userCredential.user)
    );

    localStorage.setItem(user, userCredential.user);
    toast.success('Login successful!');

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

// export const logout = async () => {
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
// };

export const logout = async () => {
  try {
    localStorage.clear();
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
