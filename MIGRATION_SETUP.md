# Migration Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
cd react-firebase-app
npm install
```

### 2. Firebase Setup

1. **Create Firebase Project:**
   - Go to https://console.firebase.google.com
   - Click "Add project"
   - Follow the setup wizard

2. **Enable Services:**
   - **Authentication:**
     - Go to Authentication → Sign-in method
     - Enable "Email/Password"
   
   - **Firestore Database:**
     - Go to Firestore Database
     - Click "Create database"
     - Start in test mode (we'll add rules later)
     - Choose a location
   
   - **Storage:**
     - Go to Storage
     - Click "Get started"
     - Start in test mode (we'll add rules later)
     - Use same location as Firestore

3. **Get Firebase Config:**
   - Go to Project Settings → General
   - Scroll to "Your apps"
   - Click the web icon (`</>`)
   - Register app (name it "Neural Nexus")
   - Copy the config object

4. **Create .env file:**
   ```bash
   cp .env.example .env
   ```
   
   Fill in your Firebase config:
   ```env
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   ```

### 3. Deploy Security Rules

1. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login:**
   ```bash
   firebase login
   ```

3. **Initialize Firebase:**
   ```bash
   firebase init
   ```
   - Select Firestore and Storage
   - Use existing project
   - Use default file names

4. **Deploy Rules:**
   ```bash
   firebase deploy --only firestore:rules,storage
   ```

### 4. Run the App

```bash
npm run dev
```

The app will be available at http://localhost:3000

## Data Migration from MongoDB

If you have existing data in MongoDB, you'll need to migrate it. See the main `MIGRATION_GUIDE.md` for the migration script.

## Testing

1. **Create a test user:**
   - Go to http://localhost:3000/login
   - Click "Sign Up"
   - Create an account

2. **Create an avatar:**
   - After login, click "Create New Avatar"
   - Fill in name and description
   - Optionally upload an icon
   - Click "Create Avatar"

3. **Send messages:**
   - Select an avatar
   - Type a message and send
   - Messages should appear in real-time

## Troubleshooting

### "Firebase: Error (auth/configuration-not-found)"
- Make sure your `.env` file exists and has all required variables
- Restart the dev server after creating/updating `.env`

### "Permission denied" errors
- Check that Firestore and Storage rules are deployed
- Verify rules match the structure in `firestore.rules` and `storage.rules`

### "Module not found" errors
- Run `npm install` again
- Make sure you're in the `react-firebase-app` directory

### Messages not appearing
- Check browser console for errors
- Verify Firestore rules allow read/write for authenticated users
- Check that the avatar document exists in Firestore

## Next Steps

1. **Integrate Cloud Run API:**
   - Update `src/services/messageService.js`
   - Add your Cloud Run messaging endpoint
   - Handle AI responses

2. **Add Stripe:**
   - Install Stripe.js: `npm install @stripe/stripe-js`
   - Create billing components
   - Integrate with Firebase Functions or direct API calls

3. **Enhance UI:**
   - Add better styling (CSS framework or styled-components)
   - Add loading states
   - Add error boundaries
   - Add toast notifications

4. **Deploy:**
   - Build: `npm run build`
   - Deploy to Firebase Hosting or your preferred platform
