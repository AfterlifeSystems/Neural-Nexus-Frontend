import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence } from 'firebase/auth';
// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Connect to emulators in development
const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

if (useEmulators) {
  // Note: Use localhost for browser, not firebase-emulator
  // The docker-compose port mappings make emulators available on localhost
  
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  setPersistence(auth, browserLocalPersistence); // keep user after page reloads

  connectFirestoreEmulator(db, '127.0.0.1', 8070);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  
  console.log('🔥 Connected to Firebase Emulators');
  console.log('   Auth: http://localhost:9099');
  console.log('   Firestore: localhost:8070');
  console.log('   Storage: localhost:9199');
  console.log('   UI: http://localhost:4000');
}

export { app, auth, db, storage };