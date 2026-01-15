# Connect messaging api to chromadb & firebase
# connect data loading api to chromadb & firebase
# Connect Frontend to firebase
# Connect frontend to data loading api
# Connect frontend to messaging api
# wrap messaging-api with langsmith for analytics
# create lex, elon, place-for-prayers
# create shareable avatars
# rename avatars to digital twins
# rename neural nexus to anubis
# purchase anubis.com



# Firestore collection hierarchy
users/{userId}
avatars/{digitalTwinId}
  └── conversations/{conversationId}
      └── messages/{messageId}
# Firestore security rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Digital Twins
    match /avatars/{digitalTwinId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.user_id;
      
      // Conversations subcollection
      match /conversations/{conversationId} {
        allow read, write: if request.auth != null && 
          request.auth.uid == get(/databases/$(database)/documents/avatars/$(digitalTwinId)).data.user_id;
        
        // Messages subcollection
        match /messages/{messageId} {
          allow read, write: if request.auth != null && 
            request.auth.uid == get(/databases/$(database)/documents/avatars/$(digitalTwinId)).data.user_id;
        }
      }
    }
  }
}

# Firebase Storage Hierarchy
users/{userId}/
  └── avatars/{digitalTwinId}/
      ├── icon/
      │   └── {digitalTwinId}_icon.{ext}
      ├── reference_audio/
      │   └── {digitalTwinId}_audio.{ext}
      ├── files/
      │   └── {fileId}.{ext}
      └── conversations/{conversationId}/
          └── messages/{messageId}/
              └── {mediaId}.{ext}

# Storage Rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/avatars/{digitalTwinId}/{allPaths=**} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}

# User Object
{
  "user_id": "27df12d9-9881-4369-bd75-e5c9538b0ea2",
  "username": "string",
  "email": "user@example.com",
  "created_at": "2025-08-23T04:43:30.342Z",
  "last_login": "2025-11-28T19:36:25.964Z",
  "currently_logged_in": false,
  "avatars": [
    "03631b03-2607-4a64-a3a6-f6ada35adf6c",
    "d838b7b2-c6db-4569-853d-309327a8ecbf"
  ],
  "last_used_digital_twin": "03631b03-2607-4a64-a3a6-f6ada35adf6c"
}

# Digital Twin Object
<!-- Location: avatars/{digitalTwinId} -->
{
  "avatar_id": "03631b03-2607-4a64-a3a6-f6ada35adf6c",
  "user_id": "27df12d9-9881-4369-bd75-e5c9538b0ea2",
  "name": "Shivon Zilis",
  "description": "Great Mother, Partner to Elon, Very Intelligent, Kind, Friendly, Good-Heart, Leader",
  "created_at": "2025-08-23T05:28:58.285Z",
  "icon": {
    "url": "https://firebasestorage.googleapis.com/...",
    "storagePath": "users/27df12d9.../avatars/03631b03.../icon/icon.png",
    "name": "icon.png",
    "size": 123456,
    "type": "image/png"
  },
  "reference_audio": {
    "url": "https://firebasestorage.googleapis.com/...",
    "storagePath": "users/27df12d9.../avatars/03631b03.../reference_audio/audio.mp3",
    "name": "audio.mp3",
    "size": 234567,
    "type": "audio/mpeg"
  },
  "files": [
    {
      "id": "file-uuid-1",
      "url": "https://firebasestorage.googleapis.com/...",
      "storagePath": "users/27df12d9.../avatars/03631b03.../files/document.pdf",
      "name": "document.pdf",
      "size": 345678,
      "type": "application/pdf",
      "uploaded_at": "2025-08-23T06:00:00.000Z"
    }
  ],
  "system_prompt_reference_image_description": "",
  "system_prompt_reference_audio_description": "",
  "system_prompt_description": "",
  "default_conversation": "conversationId1",
  "conversations": ["conversationId1", "conversationId2",...]
}

# Conversation Object
<!-- Location: avatars/{digitalTwinId}/conversations/{conversationId} -->
{
  "summary": "Discussion about AI and technology",
  "created_at": "2025-01-10T08:00:00.000Z",
  "updated_at": "2025-01-11T10:30:00.000Z",
  "message_count": 2
}


# Message Document
<!-- Location: avatars/{digitalTwinId}/conversations/{conversationId}/messages/{messageId} -->
{
  "role": "user",
  "content": "Hello there",
  "media": [
    {
      "id": "media-uuid-1",
      "type": "image",
      "url": "https://firebasestorage.googleapis.com/...",
      "storagePath": "users/27df12d9.../avatars/03631b03.../conversations/conv123/messages/msg456/image.jpg",
      "name": "photo.jpg",
      "size": 456789,
      "mimeType": "image/jpeg",
      "uploaded_at": "2025-01-10T08:00:00.000Z"
    }
  ],
  "timestamp": "2025-01-10T08:00:00.000Z"
}
<!-- message document response example -->
{
  "role": "assistant",
  "content": "Hello there response",
  "media": [
    {
      "id": "media-uuid-1",
      "type": "image",
      "url": "https://firebasestorage.googleapis.com/...",
      "storagePath": "users/27df12d9.../avatars/03631b03.../conversations/conv123/messages/msg456/image.jpg",
      "name": "photo.jpg",
      "size": 456789,
      "mimeType": "image/jpeg",
      "uploaded_at": "2025-01-10T08:00:00.000Z"
    }
  ],
  "timestamp": "2025-01-10T08:00:00.000Z"
}

# Freemium model: you've hit your limit: upgrade to pro: $20

# Digital Twin Object in Firestore
digital_twin/{avatar_id}
{
  "avatar_id": "03631b03-2607-4a64-a3a6-f6ada35adf6c",
  "user_id": "27df12d9-9881-4369-bd75-e5c9538b0ea2",
  "name": "Shivon Zilis",
  "description": "Great Mother, Partner to Elon, Very Intelligent, Kind, Friendly, Good-Heart, Leader",
  "created_at": "2025-08-23T05:28:58.285Z",
  "icon": null,
  "reference_audio": null
  "files": [],
  "system_prompt_reference_image_description": "",
  "system_prompt_reference_audio_description": "",
  "system_prompt_description": "",
  "default_conversation": "conversationId1",
  "conversations": [
    {
      "conversationId": "conversationId1",
      "summary": "",
      "created_at": "2025-01-10T08:00:00.000Z",
      "updated_at": "2025-01-11T10:30:00.000Z",
      "message_count": 2,
      "messages": [
        {
          "messageId": "messageId1",
          "role": "user",
          "content": "Hello there",
          "media": [
            {
              "type": "image",
              "url": "https://..."
            }
          ]
        },
        {
          "messageId": "messageId2",
          "role": "assistant",
          "content": "How are you?",
          "media": []
        }
      ]
    },
  ]
}

