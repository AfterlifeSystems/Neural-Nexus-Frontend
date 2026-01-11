# Migration Resources: Python/MongoDB → React/Firebase

This directory contains comprehensive resources for migrating your Neural Nexus application from Python/FastAPI/MongoDB to React/Firebase.

## 📚 Documentation Files

### 1. **MIGRATION_GUIDE.md** (Main Guide)
   - Complete migration strategy and step-by-step instructions
   - Data model mapping (MongoDB → Firestore)
   - Authentication migration (Supabase → Firebase Auth)
   - Storage migration (S3 → Firebase Storage)
   - Firebase Functions examples
   - Security rules configuration
   - **Start here for the full migration overview**

### 2. **ReactComponents.md** (React Examples)
   - Complete React component examples
   - Authentication context and providers
   - User profile management
   - Avatar management components
   - Chat/messaging components
   - Real-time listeners
   - **Use this for frontend implementation**

### 3. **migration_script_template.py** (Data Migration Script)
   - Python script to migrate data from MongoDB to Firestore
   - Migrates users, avatars, and conversations
   - Includes S3 → Firebase Storage migration
   - Error handling and progress tracking
   - **Run this to migrate your existing data**

### 4. **QUICK_REFERENCE.md** (Code Comparison)
   - Side-by-side code comparisons
   - MongoDB vs Firestore patterns
   - Common operations translated
   - Migration checklist
   - **Use as a quick lookup during development**

## 🚀 Quick Start

### Step 1: Read the Main Guide
```bash
# Open the main migration guide
cat MIGRATION_GUIDE.md
```

### Step 2: Set Up Firebase
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Firestore, Authentication, and Storage
3. Download service account key
4. Install Firebase CLI: `npm install -g firebase-tools`

### Step 3: Prepare Migration Script
1. Copy `migration_script_template.py` to your project root
2. Install dependencies:
   ```bash
   pip install pymongo firebase-admin boto3 python-dotenv
   ```
3. Set up `.env` file with your credentials
4. Place service account key as `serviceAccountKey.json`

### Step 4: Run Data Migration
```bash
# Test with a small subset first
python migration_script_template.py
```

### Step 5: Build React Frontend
1. Create React app: `npx create-react-app neural-nexus-frontend`
2. Install Firebase: `npm install firebase`
3. Copy component examples from `ReactComponents.md`
4. Set up Firebase config (see MIGRATION_GUIDE.md)

## 📋 Migration Checklist

Follow this order:

- [ ] **Phase 1: Setup**
  - [ ] Create Firebase project
  - [ ] Enable required services
  - [ ] Configure security rules
  - [ ] Set up Firebase CLI

- [ ] **Phase 2: Data Migration**
  - [ ] Run migration script (test with small dataset)
  - [ ] Verify data integrity
  - [ ] Migrate storage files
  - [ ] Update storage references

- [ ] **Phase 3: Frontend Development**
  - [ ] Set up React app
  - [ ] Implement authentication
  - [ ] Implement user management
  - [ ] Implement avatar management
  - [ ] Implement messaging

- [ ] **Phase 4: Testing**
  - [ ] Test all CRUD operations
  - [ ] Test real-time updates
  - [ ] Test file uploads
  - [ ] Test security rules

- [ ] **Phase 5: Deployment**
  - [ ] Deploy React app
  - [ ] Deploy Firebase Functions (if needed)
  - [ ] Update Cloud Run services
  - [ ] Monitor and verify

## 🔑 Key Concepts

### Data Structure Changes

**MongoDB Collections → Firestore Collections:**
- `users` → `users/{userId}`
- `avatars` → `avatars/{avatarId}`
- `avatar_conversations` → `avatars/{avatarId}/conversations/{messageId}` (subcollection)

### Authentication Flow

**Before (Supabase + MongoDB):**
1. User signs up via Supabase
2. Backend creates MongoDB profile
3. JWT token used for API calls

**After (Firebase):**
1. User signs up via Firebase Auth
2. Frontend creates Firestore profile
3. Firebase Auth token used for Firestore rules

### Storage Paths

**Before (S3):**
- Path: `users/{userId}/avatars/{avatarId}/icon/{filename}`
- Access: Presigned URLs

**After (Firebase Storage):**
- Path: `users/{userId}/avatars/{avatarId}/icon/{filename}` (same structure)
- Access: Download URLs (no expiration by default)

## 🛠️ Tools & Libraries

### Required Packages

**Python (Migration Script):**
```bash
pip install pymongo firebase-admin boto3 python-dotenv
```

**React (Frontend):**
```bash
npm install firebase react-router-dom uuid
```

**Firebase CLI:**
```bash
npm install -g firebase-tools
```

## 📖 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Data Modeling](https://firebase.google.com/docs/firestore/data-model)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [React Firebase Hooks](https://github.com/CSFrequency/react-firebase-hooks)

## ⚠️ Important Notes

1. **Test First**: Always test migration with a small dataset before full migration
2. **Backup Data**: Export MongoDB data before migration
3. **Parallel Run**: Consider running both systems in parallel during transition
4. **Cost Monitoring**: Monitor Firebase usage and costs
5. **Security Rules**: Thoroughly test security rules before production

## 🆘 Troubleshooting

### Common Issues

**Issue: Permission Denied Errors**
- Check Firestore security rules
- Verify authentication tokens
- Check user ownership of documents

**Issue: Migration Script Fails**
- Verify MongoDB connection
- Check Firebase service account permissions
- Review error logs for specific failures

**Issue: Storage Migration Slow**
- Use prefix filters to migrate in batches
- Consider running storage migration separately
- Check network bandwidth

## 📞 Next Steps

1. Review `MIGRATION_GUIDE.md` for complete strategy
2. Set up Firebase project and services
3. Test migration script with sample data
4. Build React frontend using component examples
5. Test thoroughly before production deployment

---

**Good luck with your migration! 🚀**
