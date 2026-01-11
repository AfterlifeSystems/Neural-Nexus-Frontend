# API Endpoint Mapping: Python FastAPI → React Firebase

This document maps the old FastAPI endpoints to the new React Firebase services.

## Authentication

| FastAPI Endpoint | React Service | File |
|-----------------|---------------|------|
| `POST /signup` | `signup(email, password, username)` | `src/services/authService.js` |
| `POST /login` | `login(email, password)` | `src/services/authService.js` |
| `POST /logout` | `logout()` | `src/services/authService.js` |
| `POST /auth/callback` | Handled by Firebase Auth | N/A |

## User Management

| FastAPI Endpoint | React Service | File |
|-----------------|---------------|------|
| `GET /profile` | `getUserProfile(userId)` | `src/services/userService.js` |
| `POST /update-profile` | `updateUserProfile(userId, updates)` | `src/services/userService.js` |
| `POST /update-profile` (with image) | `uploadPersonalImage(userId, file)` | `src/services/userService.js` |
| `DELETE /user/{user_id}` | `deleteUser(userId)` | ⚠️ Not implemented (use Firebase Console) |

## Avatar Management

| FastAPI Endpoint | React Service | File |
|-----------------|---------------|------|
| `POST /management/avatars/create` | `createAvatar(userId, name, description, iconFile)` | `src/services/avatarService.js` |
| `POST /management/avatars/update` | `updateAvatarWithIcon(userId, avatarId, name, description, iconFile)` | `src/services/avatarService.js` |
| `POST /management/avatars/delete` | `deleteAvatar(userId, avatarId)` | `src/services/avatarService.js` |
| `GET /management/avatars/get_all` | `getAvatars(userId, limit, skip)` | `src/services/avatarService.js` |
| `POST /management/avatars/select_avatar` | `selectAvatar(userId, avatarId)` | `src/services/avatarService.js` |

## Message Persistence

| FastAPI Endpoint | React Service | File |
|-----------------|---------------|------|
| `POST /avatars/post_message` | `sendMessage(userId, avatarId, message, mediaFiles, waitForResponse)` | `src/services/messageService.js` |
| `POST /avatars/get_messages` | `getMessages(userId, avatarId, maxMessages)` | `src/services/messageService.js` |
| Real-time updates | `onSnapshot()` listener | `src/components/Chat.jsx` |

## Billing

| FastAPI Endpoint | React Service | Status |
|-----------------|---------------|--------|
| `GET /usage` | ⚠️ Not implemented | TODO |
| `GET /get_billing` | ⚠️ Not implemented | TODO |
| `POST /create-setup-intent` | ⚠️ Not implemented | TODO |
| `POST /cancel` | ⚠️ Not implemented | TODO |
| `POST /update-card` | ⚠️ Not implemented | TODO |
| `POST /delete-card` | ⚠️ Not implemented | TODO |

## Usage Examples

### Authentication

**Before (Python/FastAPI):**
```python
response = requests.post('https://api.example.com/signup', json={
    'email': 'user@example.com',
    'password': 'password123',
    'username': 'username'
})
```

**After (React/Firebase):**
```javascript
import { signup } from './services/authService';

await signup('user@example.com', 'password123', 'username');
```

### Get User Profile

**Before:**
```python
response = requests.get('https://api.example.com/profile', 
    headers={'Authorization': 'Bearer token'})
```

**After:**
```javascript
import { getUserProfile } from './services/userService';
import { useAuth } from './contexts/AuthContext';

const { currentUser } = useAuth();
const profile = await getUserProfile(currentUser.uid);
```

### Create Avatar

**Before:**
```python
files = {'icon': open('icon.png', 'rb')}
data = {'name': 'My Avatar', 'description': 'Description'}
response = requests.post('https://api.example.com/management/avatars/create',
    files=files, data=data, headers={'Authorization': 'Bearer token'})
```

**After:**
```javascript
import { createAvatar } from './services/avatarService';

const fileInput = document.querySelector('input[type="file"]');
const iconFile = fileInput.files[0];
const avatar = await createAvatar(userId, 'My Avatar', 'Description', iconFile);
```

### Send Message

**Before:**
```python
response = requests.post('https://api.example.com/avatars/post_message',
    data={'avatar_id': avatarId, 'message': 'Hello'},
    headers={'Authorization': 'Bearer token'})
```

**After:**
```javascript
import { sendMessage } from './services/messageService';

const result = await sendMessage(userId, avatarId, 'Hello', [], true);
```

### Real-time Messages (New Feature!)

**Before:** Had to poll or use WebSockets

**After:**
```javascript
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from './firebase/config';

const messagesQuery = query(
  collection(db, `avatars/${avatarId}/conversations`),
  where('user_id', '==', userId),
  orderBy('timestamp', 'asc')
);

const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
  const messages = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  setMessages(messages);
});
```

## Key Differences

1. **No HTTP Requests**: Direct SDK calls instead of HTTP REST API
2. **Real-time Built-in**: Firestore listeners provide real-time updates automatically
3. **Client-side**: Most operations happen in the browser
4. **Security Rules**: Firestore/Storage rules replace backend validation
5. **Offline Support**: Firestore can work offline (when enabled)

## Migration Notes

- All endpoints now use Firebase SDK instead of HTTP requests
- Authentication is handled by Firebase Auth (no JWT tokens to manage)
- File uploads use Firebase Storage SDK
- Real-time updates are automatic with Firestore listeners
- Error handling is done with try-catch blocks instead of HTTP status codes
