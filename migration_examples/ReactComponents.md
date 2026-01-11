# React Component Examples for Firebase Migration

## Example React Components

### 1. Authentication Context & Provider

**`src/contexts/AuthContext.js`**
```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { getUserProfile } from '../services/userService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          const profile = await getUserProfile(user.uid);
          setUserProfile(profile);
        } catch (error) {
          console.error('Error fetching user profile:', error);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
```

### 2. Login Component

**`src/components/Login.js`**
```javascript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, signup } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUserProfile } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignup) {
        await signup(email, password, username);
        navigate('/dashboard');
      } else {
        await login(email, password);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2>{isSignup ? 'Sign Up' : 'Login'}</h2>
      <form onSubmit={handleSubmit}>
        {isSignup && (
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : isSignup ? 'Sign Up' : 'Login'}
        </button>
      </form>
      <button onClick={() => setIsSignup(!isSignup)}>
        {isSignup ? 'Already have an account? Login' : 'Need an account? Sign Up'}
      </button>
    </div>
  );
};

export default Login;
```

### 3. Avatar List Component

**`src/components/AvatarList.js`**
```javascript
import React, { useState, useEffect } from 'react';
import { getAvatars, deleteAvatar } from '../services/avatarService';
import { useAuth } from '../contexts/AuthContext';
import AvatarCard from './AvatarCard';

const AvatarList = () => {
  const { currentUser } = useAuth();
  const [avatars, setAvatars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser) {
      loadAvatars();
    }
  }, [currentUser]);

  const loadAvatars = async () => {
    try {
      setLoading(true);
      const avatarList = await getAvatars(currentUser.uid);
      setAvatars(avatarList);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (avatarId) => {
    if (window.confirm('Are you sure you want to delete this avatar?')) {
      try {
        await deleteAvatar(currentUser.uid, avatarId);
        setAvatars(avatars.filter(avatar => avatar.avatar_id !== avatarId));
      } catch (err) {
        setError(err.message);
      }
    }
  };

  if (loading) return <div>Loading avatars...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="avatar-list">
      <h2>Your Avatars</h2>
      <div className="avatar-grid">
        {avatars.map(avatar => (
          <AvatarCard
            key={avatar.avatar_id}
            avatar={avatar}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
};

export default AvatarList;
```

### 4. Avatar Card Component

**`src/components/AvatarCard.js`**
```javascript
import React from 'react';
import { useNavigate } from 'react-router-dom';

const AvatarCard = ({ avatar, onDelete }) => {
  const navigate = useNavigate();

  const handleSelect = () => {
    navigate(`/avatar/${avatar.avatar_id}`);
  };

  return (
    <div className="avatar-card">
      {avatar.icon && (
        <img src={avatar.icon} alt={avatar.name} className="avatar-icon" />
      )}
      <h3>{avatar.name}</h3>
      {avatar.description && <p>{avatar.description}</p>}
      <div className="avatar-actions">
        <button onClick={handleSelect}>Select</button>
        <button onClick={() => onDelete(avatar.avatar_id)}>Delete</button>
      </div>
    </div>
  );
};

export default AvatarCard;
```

### 5. Chat Component

**`src/components/Chat.js`**
```javascript
import React, { useState, useEffect, useRef } from 'react';
import { sendMessage, getMessages } from '../services/messageService';
import { useAuth } from '../contexts/AuthContext';
import { useParams } from 'react-router-dom';

const Chat = () => {
  const { currentUser } = useAuth();
  const { avatarId } = useParams();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (currentUser && avatarId) {
      loadMessages();
    }
  }, [currentUser, avatarId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      const messageList = await getMessages(currentUser.uid, avatarId);
      setMessages(messageList);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const result = await sendMessage(
        currentUser.uid,
        avatarId,
        newMessage
      );
      
      // Add user message to local state
      setMessages(prev => [...prev, result.user_message]);
      
      // Add AI response if available
      if (result.ai_response) {
        setMessages(prev => [...prev, result.ai_response]);
      }
      
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg) => (
          <div
            key={msg._id}
            className={`message ${msg.sender === 'user' ? 'user-message' : 'ai-message'}`}
          >
            <div className="message-content">
              <p>{msg.message}</p>
              {msg.media && msg.media.length > 0 && (
                <div className="message-media">
                  {msg.media.map((media, idx) => (
                    <img key={idx} src={media.url} alt={media.filename} />
                  ))}
                </div>
              )}
            </div>
            <div className="message-timestamp">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSend} className="message-input">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          disabled={sending}
        />
        <button type="submit" disabled={sending || !newMessage.trim()}>
          {sending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
};

export default Chat;
```

### 6. Create Avatar Component

**`src/components/CreateAvatar.js`**
```javascript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAvatar } from '../services/avatarService';
import { useAuth } from '../contexts/AuthContext';

const CreateAvatar = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size > 4 * 1024 * 1024) {
      setError('Icon exceeds 4 MB limit');
      return;
    }
    setIcon(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const avatar = await createAvatar(
        currentUser.uid,
        name,
        description,
        icon
      );
      navigate(`/avatar/${avatar.avatar_id}`);
    } catch (err) {
      setError(err.message || 'Failed to create avatar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-avatar">
      <h2>Create New Avatar</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Avatar Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
        />
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
        />
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
        />
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={loading || !name.trim()}>
          {loading ? 'Creating...' : 'Create Avatar'}
        </button>
      </form>
    </div>
  );
};

export default CreateAvatar;
```

### 7. Protected Route Component

**`src/components/ProtectedRoute.js`**
```javascript
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return currentUser ? children : <Navigate to="/login" />;
};

export default ProtectedRoute;
```

### 8. App Router Setup

**`src/App.js`**
```javascript
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AvatarList from './components/AvatarList';
import CreateAvatar from './components/CreateAvatar';
import Chat from './components/Chat';
import Profile from './components/Profile';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/avatars"
            element={
              <ProtectedRoute>
                <AvatarList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/avatars/create"
            element={
              <ProtectedRoute>
                <CreateAvatar />
              </ProtectedRoute>
            }
          />
          <Route
            path="/avatar/:avatarId"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
```

### 9. Real-time Message Listener (Optional)

**`src/hooks/useMessages.js`**
```javascript
import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase/config';

export const useMessages = (avatarId, userId) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!avatarId || !userId) {
      setLoading(false);
      return;
    }

    const messagesQuery = query(
      collection(db, `avatars/${avatarId}/conversations`),
      where('user_id', '==', userId),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const messageList = snapshot.docs.map(doc => ({
          _id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate().toISOString()
        }));
        setMessages(messageList);
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to messages:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [avatarId, userId]);

  return { messages, loading };
};
```

### 10. Usage in Chat Component with Real-time Updates

**Updated `src/components/Chat.js` with real-time listener:**
```javascript
import React, { useState, useRef } from 'react';
import { sendMessage } from '../services/messageService';
import { useAuth } from '../contexts/AuthContext';
import { useParams } from 'react-router-dom';
import { useMessages } from '../hooks/useMessages';

const Chat = () => {
  const { currentUser } = useAuth();
  const { avatarId } = useParams();
  const { messages, loading } = useMessages(avatarId, currentUser?.uid);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // ... rest of the component remains the same
};
```

---

## Key React Patterns for Firebase

### 1. **Real-time Listeners**
Use `onSnapshot` for real-time updates:
```javascript
useEffect(() => {
  const unsubscribe = onSnapshot(
    doc(db, 'collection', id),
    (doc) => {
      setData(doc.data());
    }
  );
  return () => unsubscribe();
}, [id]);
```

### 2. **Optimistic Updates**
Update UI immediately, then sync with Firestore:
```javascript
const handleUpdate = async (newData) => {
  // Update local state immediately
  setLocalData(newData);
  
  // Then sync with Firestore
  try {
    await updateDoc(doc(db, 'collection', id), newData);
  } catch (error) {
    // Revert on error
    setLocalData(previousData);
  }
};
```

### 3. **Error Handling**
Always handle Firestore errors gracefully:
```javascript
try {
  await addDoc(collection(db, 'avatars'), data);
} catch (error) {
  if (error.code === 'permission-denied') {
    // Handle permission error
  } else {
    // Handle other errors
  }
}
```

### 4. **Loading States**
Show loading indicators during async operations:
```javascript
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchData();
      setData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  loadData();
}, []);
```

---

## Package.json Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "firebase": "^10.0.0",
    "@firebase/firestore": "^4.0.0",
    "@firebase/storage": "^0.10.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0"
  }
}
```
