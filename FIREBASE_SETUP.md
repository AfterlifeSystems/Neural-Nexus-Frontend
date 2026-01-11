# Firebase Setup Guide

This application now uses **Firebase Authentication** and **Firestore** instead of Supabase.

## Firebase Configuration

The Firebase configuration is located in `src/firebase/config.js`. Make sure you have the following environment variables set in your `.env` file:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## Connecting to Firestore

Firestore is already configured and exported from `src/firebase/config.js`:

```javascript
import { db } from '../firebase/config';

// Example: Read a document
import { doc, getDoc } from 'firebase/firestore';
const userDoc = await getDoc(doc(db, 'users', userId));
```

### Using Firestore in Components

You can access Firestore through the AuthContext:

```javascript
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { firestore } = useAuth();
  
  // Use firestore directly
  import { collection, getDocs } from 'firebase/firestore';
  const snapshot = await getDocs(collection(firestore, 'users'));
}
```

Or import directly from the config:

```javascript
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';

const snapshot = await getDocs(collection(db, 'users'));
```

## Authentication

### Firebase Auth Methods Available

The `AuthContext` provides the following authentication methods:

- `login(email, password)` - Sign in with email/password
- `signup(username, email, password)` - Create new account
- `logout()` - Sign out current user
- `resendVerification()` - Resend email verification
- `forgotPassword(email)` - Send password reset email
- `updatePassword(newPassword)` - Update user password
- `signInWithProvider(provider)` - OAuth login (currently supports 'google')

### User State

The context provides:
- `currentUser` - Firebase Auth user object
- `user` / `userProfile` - Firestore user profile
- `isLoggedIn` - Boolean indicating auth state
- `accessToken` - Firebase ID token (for backend API calls)

## Firestore Security Rules

**Important**: Your current Firestore rules in `firestore.rules` are very restrictive (allowing nothing). You need to update them to allow authenticated users to read/write their own data.

Example rules:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can read/write their own avatars
    match /avatars/{avatarId} {
      allow read, write: if request.auth != null && 
        resource.data.user_id == request.auth.uid;
    }
    
    // Users can read/write messages in their avatars
    match /avatars/{avatarId}/conversations/{messageId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/avatars/$(avatarId)).data.user_id == request.auth.uid;
    }
  }
}
```

Deploy rules using:
```bash
firebase deploy --only firestore:rules
```

## Services

### User Service (`src/services/userService.jsx`)
- Uses Firestore to manage user profiles
- Functions: `getUserProfile`, `updateUserProfile`, `uploadPersonalImage`, `deletePersonalImage`

### Avatar Service (`src/services/avatarService.jsx`)
- Uses Firestore to manage avatars
- Functions: `createAvatar`, `getAvatars`, `updateAvatar`, `deleteAvatar`, `selectAvatar`

### Message Service (`src/services/messageService.jsx`)
- Currently uses backend API, but Firestore functions are available
- Firestore functions: `sendMessage` (uses Firestore subcollections)

## Migration Notes

- All Supabase references have been removed
- `accessToken` now provides Firebase ID tokens (automatically refreshed)
- User profiles are stored in Firestore `users` collection
- Avatars are stored in Firestore `avatars` collection
- Messages are stored in Firestore subcollections: `avatars/{avatarId}/conversations`

## Next Steps

1. Update Firestore security rules (see above)
2. Configure Firebase Authentication providers in Firebase Console
3. Set up Firebase Storage rules if using file uploads
4. Test authentication flow
5. Verify Firestore read/write permissions
