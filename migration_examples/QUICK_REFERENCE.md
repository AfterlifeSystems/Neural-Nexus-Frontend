# Quick Reference: MongoDB → Firestore Migration

## Key Differences

| Feature | MongoDB (Current) | Firestore (Target) |
|---------|------------------|-------------------|
| **Database** | MongoDB Atlas | Cloud Firestore |
| **Client Library** | Motor (async) | Firebase JS SDK |
| **Collections** | `db.collection` | `collection(db, 'collection')` |
| **Documents** | `collection.find_one()` | `getDoc(doc(db, 'collection', id))` |
| **Queries** | `.find({field: value})` | `query(collection, where('field', '==', value))` |
| **Real-time** | Change Streams (complex) | `onSnapshot()` (built-in) |
| **Subcollections** | Not native | Native support |
| **Storage** | AWS S3 | Firebase Storage |
| **Auth** | Supabase + Custom | Firebase Auth |

## Code Comparison

### Authentication

**MongoDB + Supabase (Current)**
```python
# Backend (FastAPI)
auth_response = supabase.auth.sign_up({
    "email": email,
    "password": password
})
user_id = auth_response.user.id
await db.users.insert_one({"user_id": user_id, ...})
```

**Firebase (Target)**
```javascript
// Frontend (React)
const userCredential = await createUserWithEmailAndPassword(auth, email, password);
await setDoc(doc(db, 'users', userCredential.user.uid), {...});
```

### Reading Data

**MongoDB (Current)**
```python
user = await db.users.find_one({"user_id": user_id})
avatars = await db.avatars.find({"user_id": user_id}).to_list(length=50)
```

**Firestore (Target)**
```javascript
const userDoc = await getDoc(doc(db, 'users', userId));
const avatarsQuery = query(
  collection(db, 'avatars'),
  where('user_id', '==', userId)
);
const avatarsSnapshot = await getDocs(avatarsQuery);
```

### Writing Data

**MongoDB (Current)**
```python
await db.users.insert_one(user_doc)
await db.users.update_one({"user_id": user_id}, {"$set": updates})
await db.users.delete_one({"user_id": user_id})
```

**Firestore (Target)**
```javascript
await setDoc(doc(db, 'users', userId), userDoc);
await updateDoc(doc(db, 'users', userId), updates);
await deleteDoc(doc(db, 'users', userId));
```

### Real-time Listeners

**MongoDB (Current)**
```python
# Requires change streams setup
pipeline = [{"$match": {"fullDocument.user_id": user_id}}]
async with db.avatars.watch(pipeline) as stream:
    async for change in stream:
        # Handle change
```

**Firestore (Target)**
```javascript
const unsubscribe = onSnapshot(
  doc(db, 'avatars', avatarId),
  (doc) => {
    // Handle update
  }
);
```

### File Storage

**S3 (Current)**
```python
await s3_client.put_object(
    Bucket=BUCKET_NAME,
    Key=s3_key,
    Body=file_content
)
url = await s3_client.generate_presigned_url(
    'get_object',
    Params={'Bucket': BUCKET_NAME, 'Key': s3_key},
    ExpiresIn=3600
)
```

**Firebase Storage (Target)**
```javascript
const storageRef = ref(storage, `users/${userId}/image/${file.name}`);
await uploadBytes(storageRef, file);
const downloadURL = await getDownloadURL(storageRef);
```

## Common Patterns

### 1. Get User Profile with Avatars

**MongoDB**
```python
user = await db.users.find_one({"user_id": user_id})
avatars_cursor = db.avatars.find({"user_id": user_id})
avatars = await avatars_cursor.to_list(length=50)
```

**Firestore**
```javascript
const userDoc = await getDoc(doc(db, 'users', userId));
const avatarsQuery = query(
  collection(db, 'avatars'),
  where('user_id', '==', userId)
);
const avatarsSnapshot = await getDocs(avatarsQuery);
const avatars = avatarsSnapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}));
```

### 2. Pagination

**MongoDB**
```python
avatars = await db.avatars.find({"user_id": user_id})\
    .skip(skip)\
    .limit(limit)\
    .to_list(length=limit)
```

**Firestore**
```javascript
const avatarsQuery = query(
  collection(db, 'avatars'),
  where('user_id', '==', userId),
  orderBy('created_at', 'asc'),
  limit(limit),
  startAfter(lastDoc) // For pagination
);
```

### 3. Subcollections (Messages)

**MongoDB**
```python
messages = await db.avatar_conversations.find({
    "avatar_id": avatar_id,
    "user_id": user_id
}).sort("timestamp", 1).to_list(length=50)
```

**Firestore**
```javascript
const messagesQuery = query(
  collection(db, `avatars/${avatarId}/conversations`),
  where('user_id', '==', userId),
  orderBy('timestamp', 'asc'),
  limit(50)
);
const messagesSnapshot = await getDocs(messagesQuery);
```

### 4. Batch Operations

**MongoDB**
```python
# No native batch, use loop or bulk_write
for item in items:
    await db.collection.insert_one(item)
```

**Firestore**
```javascript
const batch = writeBatch(db);
items.forEach(item => {
  const docRef = doc(db, 'collection', item.id);
  batch.set(docRef, item);
});
await commitBatch(batch);
```

## Security Rules Comparison

### MongoDB (Current)
- No built-in security rules
- Authentication handled in application code
- Supabase JWT verification in FastAPI

### Firestore (Target)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /avatars/{avatarId} {
      allow read, write: if request.auth != null && 
        resource.data.user_id == request.auth.uid;
    }
  }
}
```

## Error Handling

### MongoDB
```python
try:
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
except PyMongoError as e:
    logger.error(f"MongoDB error: {e}")
    raise HTTPException(status_code=500, detail="Database error")
```

### Firestore
```javascript
try {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) {
    throw new Error('User not found');
  }
} catch (error) {
  if (error.code === 'permission-denied') {
    // Handle permission error
  } else {
    // Handle other errors
  }
}
```

## Migration Checklist

### Pre-Migration
- [ ] Set up Firebase project
- [ ] Install Firebase CLI
- [ ] Configure Firebase services
- [ ] Set up Firestore security rules
- [ ] Set up Storage security rules
- [ ] Test Firebase connection

### Data Migration
- [ ] Export MongoDB data
- [ ] Run migration script for users
- [ ] Run migration script for avatars
- [ ] Run migration script for conversations
- [ ] Migrate files from S3 to Firebase Storage
- [ ] Verify data integrity

### Code Migration
- [ ] Create React app structure
- [ ] Set up Firebase config
- [ ] Implement authentication
- [ ] Implement user profile management
- [ ] Implement avatar management
- [ ] Implement message persistence
- [ ] Update Cloud Run services (if needed)

### Testing
- [ ] Test user signup/login
- [ ] Test avatar CRUD operations
- [ ] Test message sending/receiving
- [ ] Test file uploads
- [ ] Test real-time updates
- [ ] Test security rules

### Deployment
- [ ] Deploy React app
- [ ] Deploy Firebase Functions (if any)
- [ ] Update DNS/domain settings
- [ ] Monitor Firebase usage
- [ ] Set up alerts

## Useful Commands

### Firebase CLI
```bash
# Initialize Firebase
firebase init

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage

# Deploy Functions
firebase deploy --only functions

# View logs
firebase functions:log
```

### Migration Script
```bash
# Run migration
python migration_script_template.py

# Migrate specific collection only
# Edit script to comment out other migrations
```

## Performance Considerations

### Firestore Limits
- **Document size**: 1 MB max
- **Collection groups**: Limited query complexity
- **Reads**: Pay per document read
- **Writes**: Pay per document write

### Optimization Tips
1. Use subcollections for large arrays (messages)
2. Use composite indexes for complex queries
3. Implement pagination for large datasets
4. Use batch operations for multiple writes
5. Cache frequently accessed data

## Cost Comparison

### MongoDB Atlas
- Free tier: 512 MB storage
- Paid: Based on cluster size

### Firestore
- Free tier: 50K reads/day, 20K writes/day, 1 GB storage
- Paid: $0.06 per 100K reads, $0.18 per 100K writes

### Firebase Storage
- Free tier: 5 GB storage, 1 GB/day downloads
- Paid: $0.026/GB storage, $0.12/GB downloads

## Support Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Data Modeling](https://firebase.google.com/docs/firestore/data-model)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [React Firebase Hooks](https://github.com/CSFrequency/react-firebase-hooks)
