import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence, initializeAuth, indexedDBLocalPersistence } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Connect to emulators in development
const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);
// const auth  = initializeAuth(app, {
//   persistence: [ indexedDBLocalPersistence ]
// })

const db = getFirestore(app);
const storage = getStorage(app);


// Connect to emulators if enabled

if (useEmulator) {

  connectFirestoreEmulator(db, '127.0.0.1', 8070);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  
  console.log('🔥 Connected to Firebase Emulators');
  console.log('   Auth: http://localhost:9099');
  console.log('   Firestore: localhost:8070');
  console.log('   Storage: localhost:9199');
  console.log('   UI: http://localhost:4000');
}

export { app, auth, db, storage };

