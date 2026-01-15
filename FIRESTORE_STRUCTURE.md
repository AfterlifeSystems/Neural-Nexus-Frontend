# Firestore Database Structure

This document describes the Firestore database structure for the Neural Nexus application.

## Structure Overview

```
users/{userId}
  ├── user data fields
  └── avatars: [digitalTwinId1, digitalTwinId2, ...]  // Array of digital twin IDs

avatars/{digitalTwinId}
  ├── digital twin data fields
  ├── conversations: [conversationId1, conversationId2, ...]  // Array of conversation IDs
  └── default_conversation: conversationId  // ID of the default conversation
  └── conversations/{conversationId}  // Subcollection
      ├── conversation document (summary, created_at, updated_at, message_count)
      └── messages/{messageId}  // Subcollection
          └── message document (role, content, media)
```

## Collections

### 1. Users Collection (`users/{userId}`)

**Document Structure:**
```javascript
{
  user_id: string,
  username: string,
  email: string,
  created_at: string, // ISO timestamp
  last_login: string, // ISO timestamp
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
  avatars: [string],  // Array of digital twin IDs
  last_used_digital_twin: string | null,  // ID of last used digital twin
  // ... other fields
}
```

### 2. Digital Twins Collection (`avatars/{digitalTwinId}`)

> (formerly called "avatars" in older versions)

**Document Structure:**
```javascript
{
  avatar_id: string,
  user_id: string,
  name: string,
  description: string,
  created_at: string, // ISO timestamp
  icon: {
    url: string,
    storagePath: string,
    name: string,
    size: number,
    type: string
  } | null,
  reference_audio: {
    url: string,
    storagePath: string,
    name: string,
    size: number,
    type: string
  } | null,
  files: [
    {
      id: string,
      url: string,
      storagePath: string,
      name: string,
      size: number,
      type: string,
      uploaded_at: string
    }
  ],
  system_prompt_reference_image_description: string,
  system_prompt_reference_audio_description: string,
  system_prompt_description: string,
  default_conversation: string,  // ID of default conversation
  conversations: [string],  // Array of conversation IDs
  // ... other fields
}
```

**Important:** Every digital twin must have at least one conversation. When a digital twin is created, a default conversation is automatically created.

### 3. Conversations Subcollection (`avatars/{digitalTwinId}/conversations/{conversationId}`)

**Document Structure:**
```javascript
{
  conversation_id: string,
  summary: string,
  created_at: string, // ISO timestamp
  updated_at: string, // ISO timestamp
  message_count: number
}
```

**Rules:**
- Each digital twin must have at least one conversation
- The first conversation created is used as the default (`default_conversation` on the parent digital twin)
- Conversations cannot be deleted if it's the last one remaining (unless migrating)


### 4. Messages Subcollection (`avatars/{digitalTwinId}/conversations/{conversationId}/messages/{messageId}`)

**Document Structure:**
```javascript
{
  message_id: string,
  conversation_id: string,
  avatar_id: string,
  user_id: string,
  role: 'user' | 'assistant',
  content: string | null, // Text content (null if media-only)
  timestamp: string, // ISO timestamp
  type: 'text' | 'media',
  media: [
    {
      id: string,
      type: 'image' | 'audio' | 'file',
      url: string,
      storagePath: string | null,
      name: string,
      size: number,
      mimeType: string,
      uploaded_at: string
    }
  ]
}
```

**Message Types:**
- **Text messages:** `content` field contains text, `type: 'text'`
- **Media messages:** `media` array contains file info, `type: 'media'`
- **Mixed messages:** Both `content` and `media` fields populated

## Service Functions

### Digital Twins (Avatar) Service (`src/services/avatarService.jsx`)

> Note: The service functions are still named `createAvatar` / `getAvatars` for backwards compatibility, but they now operate on the `avatars` collection and return documents shaped like the Digital Twin schema above.

- `createAvatar(userId, name, description, iconFile)` - Creates a digital twin (stored under `avatars/{digitalTwinId}`) with a default conversation
- `getAvatars(userId)` - Gets all digital twins for a user
- `selectAvatar(userId, avatarId)` - Selects a digital twin and loads its default conversation
- `createConversation(userId, avatarId, title)` - Creates a new conversation
- `getConversations(userId, avatarId)` - Gets all conversations for a digital twin
- `getConversation(userId, avatarId, conversationId)` - Gets a specific conversation
- `updateConversation(userId, avatarId, conversationId, updates)` - Updates conversation
- `deleteConversation(userId, avatarId, conversationId)` - Deletes conversation (if not last) (use with care) 

### Message Service (`src/services/messageService.jsx`)

> Messages are stored using canonical fields: `role` + `content` (text), with an optional `media` array of structured media objects (see schema above).

- `sendMessage(userId, avatarId, conversationId, message, mediaFiles, sender, waitForResponse)` - Sends a message (stores `role`=`sender`, `content`=`message`)
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

// Get conversation ID from the digital twin
const conversationId = avatar.default_conversation;

// Send text message (stored as role + content)
await sendMessage(
  userId,
  avatarId,
  conversationId,
  'Hello!',
  [],
  'user',
  true
);

// Send media message (content can be empty when media-only)
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
- Users can only access `avatars` they own
- Users can only access conversations and messages within their own digital twins

See `firestore.rules` for the complete rule set.

## Migration Notes

If you have existing data:
1. Each digital twin needs at least one conversation
2. Existing messages need to be migrated to the new structure (move text from `message` to `content`, move `sender` to `role`, and normalize `media` objects to `{id,type,url,storagePath,name,size,mimeType,uploaded_at}`)
3. The `conversations` array needs to be added to digital twin documents
4. If your data uses the legacy `avatars` collection, migrate those documents to `avatars/{digitalTwinId}` and move message subcollections to `avatars/{digitalTwinId}/conversations/{conversationId}/messages`
