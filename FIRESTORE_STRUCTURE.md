# Firestore Database Structure

This document describes the Firestore database structure for the Neural Nexus application.

## Structure Overview

```
users/{userId}
  ├── user data fields
  └── avatars: [avatarId1, avatarId2, ...]  // Array of avatar IDs

avatars/{avatarId}
  ├── avatar data fields
  ├── conversations: [conversationId1, conversationId2, ...]  // Array of conversation IDs
  └── default_conversation: conversationId  // ID of the default conversation
  └── conversations/{conversationId}  // Subcollection
      ├── conversation document
      └── messages/{messageId}  // Subcollection
          └── message document (either text or media)
```

## Collections

### 1. Users Collection (`users/{userId}`)

**Document Structure:**
```javascript
{
  user_id: string,
  username: string,
  email: string,
  created_at: Timestamp,
  last_login: Timestamp,
  currently_logged_in: boolean,
  personal_image: string | null,
  neural_nexus_api_key: string | null,
  grok_api_key: string | null,
  enable_grok_imagine: boolean,
  elevenlabs_api_key: string | null,
  enable_elevenlabs: boolean,
  api_usage: {
    requests_made: number,
    tokens_used: number
  },
  billing_history: array,
  credit_card: object | null,
  avatars: [string],  // Array of avatar IDs
  last_used_avatar: string | null,  // ID of last used avatar
  // ... other fields
}
```

### 2. Avatars Collection (`avatars/{avatarId}`)

**Document Structure:**
```javascript
{
  avatar_id: string,
  user_id: string,
  name: string,
  description: string,
  created_at: Timestamp,
  icon: string | null,  // Storage path
  files: array,
  conversations: [string],  // Array of conversation IDs
  default_conversation: string,  // ID of default conversation
  // ... other fields
}
```

**Important:** Every avatar must have at least one conversation. When an avatar is created, a default conversation is automatically created.

### 3. Conversations Subcollection (`avatars/{avatarId}/conversations/{conversationId}`)

**Document Structure:**
```javascript
{
  conversation_id: string,
  avatar_id: string,
  user_id: string,
  title: string,
  created_at: Timestamp,
  updated_at: Timestamp,
  is_default: boolean
}
```

**Rules:**
- Each avatar must have at least one conversation
- The first conversation created is marked as `is_default: true`
- Conversations cannot be deleted if it's the last one remaining

### 4. Messages Subcollection (`avatars/{avatarId}/conversations/{conversationId}/messages/{messageId}`)

**Document Structure:**
```javascript
{
  message_id: string,
  conversation_id: string,
  avatar_id: string,
  user_id: string,
  message: string | null,  // Text content (null if media-only)
  sender: 'user' | 'assistant',
  timestamp: Timestamp,
  type: 'text' | 'media',
  media: [
    {
      media_id: string,
      filename: string,
      content_type: string,
      storage_path: string,
      url: string
    }
  ]
}
```

**Message Types:**
- **Text messages:** `message` field contains text, `type: 'text'`
- **Media messages:** `media` array contains file info, `type: 'media'`
- **Mixed messages:** Both `message` and `media` fields populated

## Service Functions

### Avatar Service (`src/services/avatarService.jsx`)

- `createAvatar(userId, name, description, iconFile)` - Creates avatar with default conversation
- `getAvatars(userId)` - Gets all avatars for a user
- `selectAvatar(userId, avatarId)` - Selects an avatar and loads its default conversation
- `createConversation(userId, avatarId, title)` - Creates a new conversation
- `getConversations(userId, avatarId)` - Gets all conversations for an avatar
- `getConversation(userId, avatarId, conversationId)` - Gets a specific conversation
- `updateConversation(userId, avatarId, conversationId, updates)` - Updates conversation
- `deleteConversation(userId, avatarId, conversationId)` - Deletes conversation (if not last)

### Message Service (`src/services/messageService.jsx`)

- `sendMessage(userId, avatarId, conversationId, message, mediaFiles, sender, waitForResponse)` - Sends a message
- `getMessages(userId, avatarId, conversationId, maxMessages)` - Gets messages from a conversation
- `subscribeToMessages(avatarId, conversationId, callback)` - Real-time message subscription

## Usage Examples

### Creating an Avatar

```javascript
import { createAvatar } from '../services/avatarService';

const avatar = await createAvatar(
  userId,
  'My Avatar',
  'Avatar description',
  iconFile // optional
);
// Avatar is created with a default conversation automatically
```

### Sending a Message

```javascript
import { sendMessage } from '../services/messageService';

// Get conversation ID from avatar
const conversationId = avatar.default_conversation;

// Send text message
await sendMessage(
  userId,
  avatarId,
  conversationId,
  'Hello!',
  [],
  'user',
  true
);

// Send media message
await sendMessage(
  userId,
  avatarId,
  conversationId,
  '',
  [file1, file2],
  'user',
  true
);
```

### Getting Messages

```javascript
import { getMessages } from '../services/messageService';

const messages = await getMessages(
  userId,
  avatarId,
  conversationId,
  50 // max messages
);
```

### Creating a New Conversation

```javascript
import { createConversation } from '../services/avatarService';

const conversation = await createConversation(
  userId,
  avatarId,
  'New Chat Session'
);
```

## Firestore Security Rules

The security rules ensure:
- Users can only access their own user documents
- Users can only access avatars they own
- Users can only access conversations and messages within their own avatars

See `firestore.rules` for the complete rule set.

## Migration Notes

If you have existing data:
1. Each avatar needs at least one conversation
2. Existing messages need to be migrated to the new structure
3. The `conversations` array needs to be added to avatar documents
4. Messages need to be moved from `avatars/{avatarId}/conversations` to `avatars/{avatarId}/conversations/{conversationId}/messages`
