I need to send messages to a local api for inference. the messages start in the chat area, go to the input bar are sent with the messageService, the message is added to the firestore at users/user_id/avatars/avatar_id/conversations/conversation_id/messages/message_id before reachine the inference endpoint that computes inference and responds. The response will be a streaming response in the future. the response needs to be saved in the firestore as a new message and displayed in the Message List. The user's message must also have been displayed in the Message list. There should be a loading icon until the response of the inference endpoint is received. I need the code to integrate this as well as an explanation of how this was successfully performed please.


// src/components/ChatArea.jsx

import React, { useEffect } from 'react';
import { User, AudioLines } from 'lucide-react';
import LiveTranscriptionTicker from './LiveTranscriptionTicker';
import MessageList from './MessageList';
import InputBar from './InputBar';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import AvatarSettings from './AvatarSettings';
import AvatarSelectionComponent from './AvatarSelectionComponent';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
const ChatArea = ({
  showDataExchangeDropdown,
  setShowDataExchangeDropdown,
  dropdownRef,
  onActivateLiveChat,
  setShowCreateModal,
  onEndLiveChat,
  className,
}) => {
  const { isLoggedIn, accessToken, activeAvatar, setActiveAvatar } = useAuth();
  const { messages, setMessages, fetchMessages, messagesEndRef } = useMedia();
  const { avatarId } = useParams(); // from /chat/:avatarId
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('chat');
  // const { messages, fetchMessages, messagesEndRef } = useMedia();

  // Load messages when avatarId changes
  useEffect(() => {
    if (avatarId) {
      fetchMessages(avatarId);
    }
  }, [avatarId, fetchMessages]);

  // Send message handler (passed to InputBar)
  const handleSendMessage = (text) => {
    if (!avatarId || !text.trim()) return;
    sendMessage(avatarId, text); // Sends to correct avatar's conversation
  };

  // Simple tab switcher (no setActiveTab prop needed)
  const handleTabChange = (tab) => {
    if (tab === 'avatar-selection') {
      navigate('/avatars'); // Go back to selection screen
    } else if (tab === 'avatar-settings') {
      setActiveTab('avatar-settings');
    } else if (tab === 'chat') {
      setActiveTab('chat');
    } else {
      // Just update local tab state or do nothing (keep single chat view)
      console.log('Tab changed to:', tab);
    }
  };

  return (
    <div
      className={`flex flex-row flex-grow w-full h-full bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden relative ${className}`}
    >
      {/* Background Image or User Icon - only show when not logged in or no active avatar */}
      <>
        {/* {activeAvatar?.icon ? (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${activeAvatar.icon})`,
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <User className="w-64 h-64 text-gray-400 opacity-20" />
          </div>
        )} */}
        {/* Overlay for better contrast */}
        {/* <div className="absolute inset-0 bg-black/30" /> */}
      </>

      {/* Main Chat Section */}
      <div className="flex flex-col flex-grow p-2 sm:p-4 relative z-10">
        {/* Tabs */}
        {
          <div className="flex justify-center mb-2 border-b border-white/20 gap-4">
            <button
              className={`px-4 py-2 ${
                activeTab === 'chat'
                  ? 'border-b-2 border-white font-semibold'
                  : ''
              } text-white`}
              onClick={() => handleTabChange('chat')}
            >
              {activeAvatar?.name
                ? `A.I. ${activeAvatar.name} Chat`
                : 'A.I. Chat'}
            </button>
            <button
              className={`px-4 py-2 ${
                activeTab === 'avatar-settings'
                  ? 'border-b-2 border-white font-semibold'
                  : ''
              } text-white`}
              onClick={() => handleTabChange('avatar-settings')}
            >
              Avatar Settings
            </button>
            <button
              className={`px-4 py-2 ${
                activeTab === 'avatar-selection'
                  ? 'border-b-2 border-white font-semibold'
                  : ''
              } text-white`}
              onClick={() => navigate('/avatars')}
            >
              Avatar Selection
            </button>
          </div>
        }

        {activeTab === 'chat' && (
          <div className="flex flex-col flex-grow overflow-hidden">
            <div className="flex-grow overflow-y-auto p-2 sm:p-4 relative">
              <MessageList
                messages={messages[activeAvatar.avatar_id] || []}
                messagesEndRef={messagesEndRef}
              />
            </div>

            <div className="flex-shrink-0 items-center mt-2">
              <InputBar
                avatarId={activeAvatar.avatar_id}
                accessToken={accessToken}
                dropdownRef={dropdownRef}
                isLiveChatView={false}
                onActivateLiveChat={onActivateLiveChat}
              />
            </div>
          </div>
        )}

        {activeTab === 'avatar-settings' && (
          <div className="flex flex-col flex-grow p-2 sm:p-4 relative overflow-y-auto">
            <AvatarSettings
              avatarId={activeAvatar.avatar_id}
              accessToken={accessToken}
              onAvatarDeleted={() => {
                // Switch to avatar selection tab after deletion
                setActiveTab('avatar-selection');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
export default ChatArea;
##########################################
import { useRef, useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { AudioLines } from 'lucide-react';
import { useMedia } from '../context/MediaContext';
import Dock from './Dock';
import { HiXMark } from 'react-icons/hi2';
import thoughtToImageService from '../services/ThoughtToImageService';

const InputBar = ({
  avatar_id,
  accessToken,
  setShowDataExchangeDropdown,
  showDataExchangeDropdown,
  dropdownRef,
  isLiveChatView = false,
  onActivateLiveChat,
}) => {
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const [messageHistory, setMessageHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempMessage, setTempMessage] = useState('');
  const [editingCaption, setEditingCaption] = useState(null);
  const [captions, setCaptions] = useState({});
  const [isHovered, setIsHovered] = useState(false);

  const {
    sendMessage,
    inputMessage,
    setInputMessage,
    mediaFiles,
    setMediaFiles,
    handleFileChange,
    removeFile,
    sender,
    setSender,
    isTranscribing,
    startTranscription,
    stopTranscription,
    isThoughtToImageEnabled,
    startThoughtToImage,
    stopThoughtToImage,
    dataExchangeTypes,
  } = useMedia();

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === 'ArrowUp' && e.ctrlKey) {
      e.preventDefault();
      navigateHistory('up');
    } else if (e.key === 'ArrowDown' && e.ctrlKey) {
      e.preventDefault();
      navigateHistory('down');
    }
  };

  const navigateHistory = (direction) => {
    if (messageHistory.length === 0) return;
    if (direction === 'up') {
      if (historyIndex === -1) {
        setTempMessage(inputMessage);
        setHistoryIndex(messageHistory.length - 1);
        setInputMessage(messageHistory[messageHistory.length - 1]);
      } else if (historyIndex > 0) {
        setHistoryIndex(historyIndex - 1);
        setInputMessage(messageHistory[historyIndex - 1]);
      }
    } else if (direction === 'down') {
      if (historyIndex === messageHistory.length - 1) {
        setHistoryIndex(-1);
        setInputMessage(tempMessage);
        setTempMessage('');
      } else if (historyIndex > -1) {
        setHistoryIndex(historyIndex + 1);
        setInputMessage(messageHistory[historyIndex + 1]);
      }
    }
  };

  const handleInput = (e) => {
    setInputMessage(e.target.value);
    if (historyIndex !== -1) {
      setHistoryIndex(-1);
      setTempMessage('');
    }
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim() && mediaFiles.length === 0) {
      if (isLiveChatView && onActivateLiveChat) {
        onActivateLiveChat();
      }
      return;
    }

    if (
      inputMessage.trim() &&
      (messageHistory.length === 0 ||
        messageHistory[messageHistory.length - 1] !== inputMessage.trim())
    ) {
      setMessageHistory((prev) => [...prev, inputMessage.trim()]);
    }

    setHistoryIndex(-1);
    setTempMessage('');
    setSender('user');
    sendMessage(mediaFiles, () => {});
    setMediaFiles([]);
    setInputMessage('');
    setCaptions({});
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || e.dataTransfer?.files || []);
    handleFileChange({ target: { files } });
  };

  const handleRemoveFile = (index) => {
    removeFile(index);
    setCaptions((prev) => {
      const newCaptions = { ...prev };
      delete newCaptions[index];
      const reindexed = {};
      Object.keys(newCaptions).forEach((key) => {
        const keyIndex = parseInt(key);
        if (keyIndex > index) reindexed[keyIndex - 1] = newCaptions[key];
        else reindexed[key] = newCaptions[key];
      });
      return reindexed;
    });
  };

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, [inputMessage]);

  useEffect(() => {
    thoughtToImageService.onReconstructedImage = ({ file }) => {
      setMediaFiles((prevFiles) => [...prevFiles, file]);
    };
    return () => {
      thoughtToImageService.onReconstructedImage = null;
    };
  }, [mediaFiles.length]);

  return (
    <div
      className="w-full max-w-3xl mx-auto rounded-xl flex flex-col"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        handleFileSelect(e);
      }}
    >
      {/* Input Bar + Send Button on Same Row */}
      <div className="flex flex-row items-center gap-2 flex-col mb-2">
        {/* Input Container */}
        <div className="flex-1 relative border border-gray-700 rounded-lg bg-black/35 focus-within:border-teal-400 transition-colors">
          {mediaFiles.length > 0 && (
            <div className="p-3 border-b border-gray-700/50">
              <div className="flex gap-3 overflow-x-auto scrollbar-thin scrollbar-thumb-teal-400">
                {mediaFiles.map((file, index) => (
                  <div key={index} className="relative flex-shrink-0 group">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`preview-${index}`}
                      className="h-16 w-16 object-cover rounded-lg border border-gray-600 group-hover:border-teal-400 transition-colors"
                    />
                    <HiXMark
                      onClick={() => handleRemoveFile(index)}
                      className="absolute -top-0 -right-1 bg-red-900 hover:bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center transition-colors z-20 cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            rows={1}
            style={{ lineHeight: '1.5rem', maxHeight: '9rem' }}
            className="w-full resize-none overflow-y-auto max-h-40 px-4 py-3 text-white bg-transparent placeholder-gray-400 scrollbar-thin scrollbar-thumb-teal-400 focus:outline-none border-none"
            placeholder="Type your message... (Ctrl+↑ or ↓ for sent message history)"
            value={inputMessage}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            spellCheck={false}
          />

          {historyIndex !== -1 && (
            <div className="absolute right-2 top-2 text-xs text-teal-400 bg-black/50 px-2 py-1 rounded">
              {messageHistory.length - historyIndex}/{messageHistory.length}
            </div>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleFileSelect}
        />

        {/* Send Button */}
        <button
          onClick={() => {
            if (!inputMessage.trim() && mediaFiles.length === 0) {
              if (onActivateLiveChat) onActivateLiveChat();
            } else {
              handleSendMessage();
            }
          }}
          className="transition-transform duration-300 hover:scale-105 px-6 rounded-xl text-white bg-black/35 border border-gray-700 hover:border-teal-400 flex items-center justify-center gap-2 whitespace-nowrap self-stretch"
        >
          {inputMessage.trim().length > 0 ? (
            'Send'
          ) : (
            <>
              <AudioLines className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default InputBar;
##########################################

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  updatePassword as firebaseUpdatePassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  browserLocalPersistence,
} from 'firebase/auth';

import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  query,
  collection,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db, storage } from '../firebase/config.js';
import { getUserProfile } from '../services/userService';

import {
  getAvatars,
  createAvatar,
  deleteAvatar,
  selectAvatar,
} from '../services/avatarService.jsx';

import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { signup, login, logout } from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // current user auth object
  const [profile, setProfile] = useState(null);

  const [userAvatars, setUserAvatars] = useState([]); // avatars of the user
  const [communityAvatars, setCommunityAvatars] = useState([]); // avatars shared by the community
  const [proprietaryAvatars, setProprietaryAvatars] = useState([]); // avatars created by Afterlife Systems Inc. (businesses, bibles, restaurants, etc.)

  const [activeAvatar, setActiveAvatar] = useState(null);

  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null); // Firebase ID token for backend API

  const [messages, setMessages] = useState(null);

  // TESTING
  useEffect(() => {
    auth.setPersistence(browserLocalPersistence);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      console.log(
        'XXXXXXXXXXXXXXXXXXXXXX CURRENT USER AUTH CONTEXT USE EFFECT XXXXXXXXXXXXXXXXXXXXXXXXXXX'
      );
      // console.log(currentUser);
      // console.log(currentUser.uid);

      if (!currentUser) {
        setProfile([]); // object that will contain current avatar
        setUserAvatars([]); // list of avatars each with current conversation
        setCommunityAvatars([]);
        setProprietaryAvatars([]);
        setMessages([]); // messages of the current conversation
        setActiveAvatar(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setProfile(snap.exists() ? snap.data() : null);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUserAvatars([]);
      return;
    }

    const ref = collection(db, 'users', user.uid, 'avatars');
    const q = query(ref, orderBy('created_at', 'asc'));

    const unsub = onSnapshot(q, (snap) => {
      const avatars = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUserAvatars(avatars);
    });
    return unsub;
  }, [user]);

  // Active avatar can be derived in a useMemo or another effect
  useEffect(() => {
    if (!profile?.last_used_avatar || userAvatars.length === 0) {
      setActiveAvatar(null);
      return;
    }
    const match = userAvatars.find((a) => a.id === profile.last_used_avatar);
    setActiveAvatar(match || null);
  }, [profile?.last_used_avatar, userAvatars]);

  // verify connection to firebase auth emulator
  useEffect(() => {
    if (auth.config) {
      console.log('Full Auth Config:', auth.config);
      // Look for a property called 'emulatorConfig' in the object tree
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        // User state
        accessToken, // Firebase ID token for backend API calls
        setAccessToken,
        user,
        setUser,
        userAvatars,
        setUserAvatars,
        communityAvatars,
        setCommunityAvatars,
        proprietaryAvatars,
        setProprietaryAvatars,
        activeAvatar,
        setActiveAvatar,
        loading,
        setLoading,
        // Firebase instances (for advanced use)
        firebaseAuth: auth,
        firestore: db,
        firebaseStorage: storage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

###################################
// services/avatarService.jsx
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { v4 as uuidv4 } from 'uuid';

export const createAvatar = async (user, name, description, iconFile) => {
  if (!user) throw new Error('No authenticated user');

  const userId = user.uid;
  const avatarId = uuidv4();
  const conversationId = uuidv4(); // Create default conversation ID

  console.log(
    'XXXXXXXXXXXXXXXXXXXXXXXXXX USER XXXXXXXXXXXXXXXXXXXXXXXXXXX avatarService'
  );
  console.log(user);
  // Create directory structure in Storage (using .keep files)
  const directories = [
    `users/${userId}/.keep`,
    `users/${userId}/avatars/${avatarId}/adapters/.keep`,
    `users/${userId}/avatars/${avatarId}/adapters/training_data/.keep`,
  ];

  for (const dirPath of directories) {
    try {
      const dirRef = ref(storage, dirPath);
      await uploadBytes(dirRef, new Blob([''], { type: 'text/plain' }));
    } catch (error) {
      console.warn(`Failed to create directory ${dirPath}:`, error);
    }
  }

  // Generate download URLs
  const qloraAdapterUrl = await getDownloadURL(
    ref(storage, `users/${userId}/avatars/${avatarId}/adapters/.keep`)
  );
  const qloraTrainingUrl = await getDownloadURL(
    ref(
      storage,
      `users/${userId}/avatars/${avatarId}/adapters/training_data/.keep`
    )
  );
  // Store as a Digital Twin document following firestore_structure.md
  const avatarData = {
    avatar_id: avatarId,
    user_id: user.uid,
    name: name,
    description: (description || '').trim(),
    created_at: new Date().toISOString(),
    icon: null, // will be an object {url, storagePath, name, size, type}
    reference_audio: null,
    files: [],
    system_prompt_reference_image_description: '',
    system_prompt_reference_audio_description: '',
    system_prompt_description: '',
    default_conversation: conversationId,
    conversations: [conversationId],
    qloraAdapterUrl: qloraAdapterUrl,
    qloraTrainingUrl: qloraTrainingUrl,
  };

  // Upload icon if provided and store metadata + URL
  if (iconFile) {
    if (iconFile.size > 4 * 1024 * 1024) {
      throw new Error('Icon exceeds 4 MB limit');
    }
    const iconRef = ref(
      storage,
      `users/${userId}/avatars/${avatarId}/icon/${uuidv4()}_${iconFile.name}`
    );
    await uploadBytes(iconRef, iconFile);
    const iconUrl = await getDownloadURL(iconRef);
    avatarData.icon = {
      url: iconUrl,
      storagePath: iconRef.fullPath,
      name: iconFile.name,
      size: iconFile.size,
      type: iconFile.type,
    };
  }
  // Create default conversation document (store summary and counts)
  const conversationRef = doc(
    db,
    'users',
    userId,
    'avatars',
    avatarId,
    'conversations',
    conversationId
  );
  await setDoc(conversationRef, {
    conversation_id: conversationId,
    summary: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    message_count: 0,
  });

  // Create avatar (digital twin) document with avatarId as document ID
  const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);
  await setDoc(avatarRef, avatarData);

  // Update user's avatars list
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  const avatars = userDoc.data().avatars || [];
  await updateDoc(userRef, {
    avatars: [...avatars, avatarId],
    last_used_avatar: avatarId,
  });

  return {
    avatarData,
  };
};

export const getAvatars = async (userId, limitCount = 50, skip = 0) => {
  const avatarsQuery = query(
    collection(db, 'users', userId, 'avatars'),
    where('user_id', '==', userId),
    orderBy('created_at', 'asc')
  );

  const snapshot = await getDocs(avatarsQuery);
  const avatars = [];

  for (const docSnapshot of snapshot.docs.slice(skip, skip + limitCount)) {
    const data = docSnapshot.data();
    let iconUrl = null;

    if (data.icon) {
      try {
        const storagePath = data.icon.storagePath || data.icon;
        if (storagePath) {
          iconUrl = await getDownloadURL(ref(storage, storagePath));
        } else if (data.icon.url) {
          iconUrl = data.icon.url;
        }
      } catch (error) {
        console.error('Error getting icon URL:', error);
      }
    }

    avatars.push({
      avatar_id: docSnapshot.id,
      name: data.name,
      description: data.description,
      icon: iconUrl,
    });
  }

  return avatars;
};

export const updateAvatar = async (userId, avatarId, updates) => {
  const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Digital twin not found or unauthorized');
  }

  const updateData = {
    updated_at: new Date().toISOString(),
    ...updates,
  };

  // If updating icon path/object, normalize to object shape
  if (updateData.icon && typeof updateData.icon === 'string') {
    // assume it's a storage path string; try to resolve URL
    try {
      const url = await getDownloadURL(ref(storage, updateData.icon));
      updateData.icon = {
        url,
        storagePath: updateData.icon,
      };
    } catch (e) {
      // leave as-is
    }
  }

  await updateDoc(avatarRef, updateData);

  // If icon was updated, return the new URL
  if (updateData.icon) {
    return { icon_url: updateData.icon.url || null };
  }

  return {};
};

export const updateAvatarWithIcon = async (
  userId,
  avatarId,
  name,
  description,
  iconFile
) => {
  const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Digital twin not found or unauthorized');
  }

  const updates = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) {
    updates.name = name.trim();
  }
  if (description !== undefined) {
    updates.description = (description || '').trim();
  }

  let iconUrl = null;
  if (iconFile) {
    if (iconFile.size > 4 * 1024 * 1024) {
      throw new Error('Icon exceeds 4 MB limit');
    }

    // Delete old icon if exists (support object or string)
    const oldIcon = avatarDoc.data().icon;
    const oldStoragePath =
      oldIcon?.storagePath || (typeof oldIcon === 'string' ? oldIcon : null);
    if (oldStoragePath) {
      try {
        await deleteObject(ref(storage, oldStoragePath));
      } catch (error) {
        console.warn('Failed to delete old icon:', error);
      }
    }

    // Upload new icon and store as object
    const iconRef = ref(
      storage,
      `users/${userId}/avatars/${avatarId}/icon/${uuidv4()}_${iconFile.name}`
    );
    await uploadBytes(iconRef, iconFile);
    const url = await getDownloadURL(iconRef);
    updates.icon = {
      url,
      storagePath: iconRef.fullPath,
      name: iconFile.name,
      size: iconFile.size,
      type: iconFile.type,
    };
    iconUrl = url;
  }

  await updateDoc(avatarRef, updates);

  return {
    status: 'success',
    avatar_id: avatarId,
    updated_fields: Object.keys(updates),
    icon_url: iconUrl,
  };
};

export const deleteAvatar = async (userId, avatarId) => {
  const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  // Delete all files in Storage
  const avatarStorageRef = ref(storage, `users/${userId}/avatars/${avatarId}`);
  try {
    const files = await listAll(avatarStorageRef);
    await Promise.all(files.items.map((file) => deleteObject(file)));
  } catch (error) {
    console.warn('Error deleting avatar files:', error);
  }

  // Delete avatar document
  await deleteDoc(avatarRef);

  // Remove from user's avatar list
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  const avatars = userDoc.data().avatars || [];
  await updateDoc(userRef, {
    avatars: avatars.filter((id) => id !== avatarId),
  });

  return {
    status: 'success',
    avatar_id: avatarId,
    deleted: true,
  };
};

export const selectAvatar = async (userId, avatarId) => {
  userId = getAuth().currentUser.id;
  const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const avatarData = avatarDoc.data();

  // Update last_used_avatar
  await updateDoc(doc(db, 'users', userId), {
    last_used_avatar: avatarId,
  });

  // Get default conversation ID (or first conversation)
  const defaultConversationId = avatarData.default_conversation;

  // Get messages from the default conversation
  const messagesQuery = query(
    collection(
      db,
      `avatars/${avatarId}/conversations/${defaultConversationId}/messages`
    ),
    orderBy('timestamp', 'asc'),
    limit(50)
  );

  const messagesSnapshot = await getDocs(messagesQuery);
  const messages = messagesSnapshot.docs.map((doc) => ({
    _id: doc.id,
    ...doc.data(),
    timestamp:
      doc.data().timestamp?.toDate().toISOString() || new Date().toISOString(),
  }));

  return {};
};

// Conversation management functions

/**
 * Create a new conversation for an avatar
 */
export const createConversation = async (
  userId,
  avatarId,
  title = 'New Conversation'
) => {
  const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const conversationId = uuidv4();
  const conversationRef = doc(
    db,
    `avatars/${avatarId}/conversations`,
    conversationId
  );

  await setDoc(conversationRef, {
    conversation_id: conversationId,
    avatar_id: avatarId,
    user_id: userId,
    title: title.trim(),
    created_at: new Date(),
    updated_at: new Date(),
    is_default: false,
  });

  // Update avatar's conversations list
  const avatarData = avatarDoc.data();
  const conversations = avatarData.conversations || [];
  await updateDoc(avatarRef, {
    conversations: [...conversations, conversationId],
    updated_at: new Date(),
  });

  return {
    conversation_id: conversationId,
    title,
    created_at: new Date().toISOString(),
  };
};

/**
 * Get all conversations for an avatar
 */
export const getConversations = async (userId, avatarId) => {
  const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const conversationsQuery = query(
    collection(db, `users/${user_id}/avatars/${avatarId}/conversations`),
    orderBy('updated_at', 'desc')
  );

  const snapshot = await getDocs(conversationsQuery);
  return snapshot.docs.map((doc) => ({
    conversation_id: doc.id,
    ...doc.data(),
    created_at: doc.data().created_at?.toDate().toISOString(),
    updated_at: doc.data().updated_at?.toDate().toISOString(),
  }));
};

/**
 * Get a specific conversation
 */
export const getConversation = async (userId, avatarId, conversationId) => {
  const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const conversationRef = doc(
    db,
    `avatars/${avatarId}/conversations`,
    conversationId
  );
  const conversationDoc = await getDoc(conversationRef);

  if (!conversationDoc.exists()) {
    throw new Error('Conversation not found');
  }

  return {
    conversation_id: conversationId,
    ...conversationDoc.data(),
    created_at: conversationDoc.data().created_at?.toDate().toISOString(),
    updated_at: conversationDoc.data().updated_at?.toDate().toISOString(),
  };
};

/**
 * Update conversation title
 */
export const updateConversation = async (
  userId,
  avatarId,
  conversationId,
  updates
) => {
  const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const conversationRef = doc(
    db,
    `avatars/${avatarId}/conversations`,
    conversationId
  );

  await updateDoc(conversationRef, {
    ...updates,
    updated_at: new Date(),
  });

  return { status: 'success', conversation_id: conversationId };
};

/**
 * Delete a conversation (but ensure at least one remains)
 */
export const deleteConversation = async (userId, avatarId, conversationId) => {
  const avatarRef = doc(db, 'users', userId, 'avatars', avatarId);
  const avatarDoc = await getDoc(avatarRef);

  if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
    throw new Error('Avatar not found or unauthorized');
  }

  const avatarData = avatarDoc.data();
  const conversations = avatarData.conversations || [];

  // Ensure at least one conversation remains
  if (conversations.length <= 1) {
    throw new Error(
      'Cannot delete the last conversation. Each avatar must have at least one conversation.'
    );
  }

  // Delete conversation document (this will also delete all messages in subcollection)
  const conversationRef = doc(
    db,
    `avatars/${avatarId}/conversations`,
    conversationId
  );
  await deleteDoc(conversationRef);

  // Update avatar's conversations list
  const updatedConversations = conversations.filter(
    (id) => id !== conversationId
  );
  const updateData = {
    conversations: updatedConversations,
    updated_at: new Date(),
  };

  // If deleted conversation was default, set first remaining as default
  if (avatarData.default_conversation === conversationId) {
    updateData.default_conversation = updatedConversations[0];
  }

  await updateDoc(avatarRef, updateData);

  return { status: 'success', conversation_id: conversationId };
};
####################################
// services/MessageService — NGROK HTTP API removed; Firestore-backed functions below will be used

// Legacy HTTP-based functions removed (no external NGROK endpoints)

// NOTE: Use the Firestore implementations below: sendMessage, getMessages, subscribeToMessages

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config.js';
import { v4 as uuidv4 } from 'uuid';

// services/api.js
/**
 * Call local Neural Nexus messaging API
 * @param {string} userId
 * @param {string} avatarId
 * @param {string} userInput
 * @param {File[]} mediaFiles
 * @param {boolean} [useContext=false]
 * @param {number} [maxNewTokens=150]
 * @returns {Promise<{response: string, context_used: boolean, ...}>}
 */
export const callLocalQueryApi = async (
  userId,
  avatarId,
  userInput,
  mediaFiles = [],
  useContext = false, // vectorstore logic
  maxNewTokens = 150
) => {
  const formData = new FormData();
  formData.append('user_id', userId);
  formData.append('avatar_id', avatarId || '');
  formData.append('user_input', userInput || '');
  formData.append('use_context', useContext.toString());
  formData.append('max_new_tokens', maxNewTokens.toString());

  mediaFiles.forEach((file) => {
    formData.append('image', file); // API accepts one image; adjust if multiple needed
  });

  const response = await fetch('http://localhost:8090/query', {
    method: 'POST',
    body: formData,
    // no headers → browser sets multipart boundary automatically
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail?.[0]?.msg || 'Query API failed');
  }

  return response.json(); // → { response, context_used, device, model_type, ... }
};

/**
 * Send a message to a conversation
 * @param {string} userId - User ID
 * @param {string} avatarId - Avatar ID
 * @param {string} conversationId - Conversation ID (if not provided, uses default)
 * @param {string} message - Message text (optional if mediaFiles provided)
 * @param {File[]} mediaFiles - Media files (optional)
 * @param {string} sender - Sender type ('user' or 'assistant')
 * @param {boolean} waitForResponse - Whether to wait for AI response
 */
export const sendMessage = async (
  userId,
  avatarId,
  conversationId = null,
  message = '',
  mediaFiles = [],
  sender = 'user',
  waitForResponse = true
) => {
  // Get conversation ID (use default if not provided)
  let currentConversationId = conversationId;
  if (!currentConversationId) {
    const avatarRef = doc(db, 'users', user_id, 'avatars', avatarId);
    const avatarDoc = await getDoc(avatarRef);
    if (!avatarDoc.exists()) {
      throw new Error('Digital twin not found');
    }
    const avatarData = avatarDoc.data();
    currentConversationId =
      avatarData.default_conversation || avatarData.conversations?.[0];
    if (!currentConversationId) {
      throw new Error('No conversation found for digital twin');
    }
  }

  const messageId = uuidv4();
  const timestamp = new Date();

  // Upload media files and store structured metadata
  const mediaItems = [];
  for (const file of mediaFiles) {
    const mediaId = uuidv4();
    const mediaRef = ref(
      storage,
      `users/${userId}/avatars/${avatarId}/conversations/${currentConversationId}/messages/${messageId}/${file.name}`
    );
    await uploadBytes(mediaRef, file);
    const downloadURL = await getDownloadURL(mediaRef);

    mediaItems.push({
      id: mediaId,
      type: file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('audio/')
        ? 'audio'
        : 'file',
      url: downloadURL,
      storagePath: mediaRef.fullPath,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      uploaded_at: new Date().toISOString(),
    });
  }

  // Determine message type
  const messageType = mediaFiles.length > 0 && !message ? 'media' : 'text';

  // Save user message in the conversation's messages subcollection using canonical fields
  const messageRef = await addDoc(
    collection(
      db,
      'users',
      userId,
      'avatars',
      avatarId,
      'conversations',
      currentConversationId,
      'messages'
    ),
    {
      message_id: messageId,
      conversation_id: currentConversationId,
      avatar_id: avatarId,
      user_id: userId,
      role: sender, // 'user' or 'assistant'
      content: message || null,
      timestamp: timestamp,
      type: messageType,
      media: mediaItems,
    }
  );

  // Update conversation's updated_at timestamp
  const conversationRef = doc(
    db,
    'users',
    userId,
    'avatars',
    avatarId,
    'conversations',
    currentConversationId
  );
  await updateDoc(conversationRef, {
    updated_at: timestamp,
  });

  const userMessage = {
    message_id: messageId,
    _id: messageId,
    id: messageId,
    timestamp: timestamp.toISOString(),
    content: message || null,
    message: message || null, // legacy compatibility
    role: sender,
    sender: sender,
    media: mediaItems,
    type: messageType,
  };

  if (waitForResponse) {
    return {
      status: 'success',
      user_message: userMessage,
      ai_response: null, // Replace with actual AI response
    };
  }

  return {
    status: 'success',
    user_message: userMessage,
    ai_response: null,
  };
};

/**
 * Get messages from a specific conversation
 * @param {string} userId - User ID
 * @param {string} avatarId - Avatar ID
 * @param {string} conversationId - Conversation ID (if not provided, uses default)
 * @param {number} maxMessages - Maximum number of messages to retrieve
 */
export const getMessages = async (
  userId,
  avatarId,
  conversationId = null,
  maxMessages = 50
) => {
  // Get conversation ID (use default if not provided)
  let currentConversationId = conversationId;
  if (!currentConversationId) {
    const avatarRef = doc(db, 'users', user_id, 'avatars', avatarId);
    const avatarDoc = await getDoc(avatarRef);
    if (!avatarDoc.exists() || avatarDoc.data().user_id !== userId) {
      throw new Error('Digital twin not found or unauthorized');
    }
    const avatarData = avatarDoc.data();
    currentConversationId =
      avatarData.default_conversation || avatarData.conversations?.[0];
    if (!currentConversationId) {
      throw new Error('No conversation found for digital twin');
    }
  }

  const messagesQuery = query(
    collection(
      db,
      'avatars',
      avatarId,
      'conversations',
      currentConversationId,
      'messages'
    ),
    orderBy('timestamp', 'asc'),
    firestoreLimit(maxMessages)
  );

  const snapshot = await getDocs(messagesQuery);
  const messages = [];

  for (const docSnapshot of snapshot.docs) {
    const data = docSnapshot.data();
    const mediaUrls = await Promise.all(
      (data.media || []).map(async (media) => {
        const storagePath = media.storagePath || media.storage_path || null;
        if (storagePath) {
          try {
            return await getDownloadURL(ref(storage, storagePath));
          } catch (error) {
            console.error('Error getting media URL:', error);
            return media.url || null;
          }
        }
        return media.url || null;
      })
    );

    messages.push({
      _id: docSnapshot.id,
      id: docSnapshot.id,
      message_id: data.message_id || docSnapshot.id,
      type: data.type || 'text',
      content: data.content || data.message || '',
      message: data.content || data.message || '', // Keep both for compatibility
      timestamp:
        (data.timestamp?.toDate && data.timestamp.toDate().toISOString()) ||
        data.timestamp ||
        new Date().toISOString(),
      sender: data.role || data.sender || 'user',
      media: mediaUrls
        .map((url, idx) => ({
          ...(data.media[idx] || {}),
          url,
        }))
        .filter((media) => media.url),
    });
  }

  return messages;
};

/**
 * Subscribe to messages in real-time for a conversation
 * @param {string} avatarId - Avatar ID
 * @param {string} conversationId - Conversation ID
 * @param {Function} callback - Callback function for new messages
 * @returns {Function} Unsubscribe function
 */
export const subscribeToMessages = (avatarId, conversationId, callback) => {
  const messagesQuery = query(
    collection(
      db,
      'avatars',
      avatarId,
      'conversations',
      conversationId,
      'messages'
    ),
    orderBy('timestamp', 'asc')
  );

  // Return unsubscribe function
  return onSnapshot(messagesQuery, (snapshot) => {
    const messages = snapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data();
      return {
        _id: docSnapshot.id,
        id: docSnapshot.id,
        message_id: data.message_id || docSnapshot.id,
        content: data.content || data.message || '',
        message: data.content || data.message || '', // Keep both for compatibility
        sender: data.role || data.sender || 'user',
        timestamp:
          (data.timestamp?.toDate && data.timestamp.toDate().toISOString()) ||
          data.timestamp ||
          new Date().toISOString(),
        media: data.media || [],
        type: data.type || 'text',
      };
    });
    callback(messages);
  });
};


##########################
// src/components/MessageList.jsx
import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import SecureImage from './SecureImage';

const MessageList = ({ messages, messagesEndRef }) => {
  const { accessToken } = useAuth();
  const { getMediaUrl } = useMedia();

  useEffect(() => {
    if (messagesEndRef?.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, messagesEndRef]);

  // Debug: Log message count and timestamp info
  useEffect(() => {
    const validMessages = messages.filter((msg) => msg?.sender);
    if (validMessages.length > 0) {
      const timestamps = validMessages
        .map((m) => (m.timestamp ? new Date(m.timestamp).getTime() : null))
        .filter((t) => t !== null)
        .sort((a, b) => a - b);

      if (timestamps.length > 0) {
        const oldest = new Date(timestamps[0]);
        const newest = new Date(timestamps[timestamps.length - 1]);
        console.log(
          `MessageList: Rendering ${validMessages.length} of ${messages.length} total messages | ` +
            `Time range: ${oldest.toLocaleString()} to ${newest.toLocaleString()}`
        );
      } else {
        console.log(
          `MessageList: Rendering ${validMessages.length} of ${messages.length} total messages`
        );
      }
    } else {
      console.log(
        `MessageList: Rendering ${validMessages.length} of ${messages.length} total messages`
      );
    }
  }, [messages]);

  return (
    <div className="flex-grow mb-4 space-y-2 px-2 flex flex-col">
      {messages
        .filter((msg) => msg?.sender) // Filter out messages without sender before mapping
        .map((msg) => {
          const isLoading = msg.isLoading || msg.isPending;
          // Generate a unique key - use _id, id, or fallback to index-based key
          const messageKey =
            msg._id || msg.id || `msg-${msg.timestamp}-${Math.random()}`;

          return (
            <div
              key={messageKey}
              className={`max-w-[70%] p-2 rounded-lg break-words transition-all duration-150 ${
                msg.sender === 'user'
                  ? 'bg-teal-600 self-end text-white'
                  : msg.sender === 'avatar'
                  ? 'bg-indigo-700 self-start text-white'
                  : 'bg-indigo-700 self-center italic text-gray-300'
              }`}
            >
              {/* LOADING INDICATOR */}
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div
                      className="w-2 h-2 bg-white rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-white rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-white rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    ></div>
                  </div>
                </div>
              ) : (
                <>
                  {/* TEXT CONTENT */}
                  {(msg.content || msg.message) && (
                    <div className="whitespace-pre-wrap">
                      {msg.content || msg.message}
                    </div>
                  )}

                  {/* MEDIA CONTENT */}
                  {msg.media &&
                    Array.isArray(msg.media) &&
                    msg.media.map((media, index) => (
                      <div
                        key={media.media_id || media.filename || index}
                        className="mt-2"
                      >
                        {media.content_type?.startsWith('image/') ? (
                          <SecureImage
                            mediaUrl={media.url}
                            filename={media.filename}
                          />
                        ) : media.content_type?.startsWith('audio/') ? (
                          <audio controls src={media.url} />
                        ) : media.content_type?.startsWith('video/') ? (
                          <video
                            controls
                            className="max-w-full max-h-64"
                            src={media.url}
                          />
                        ) : (
                          <a
                            href={media.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-blue-300"
                          >
                            {media.filename || 'Download file'}
                          </a>
                        )}
                      </div>
                    ))}

                  {/* TIMESTAMP */}
                  <div className="text-xs text-white-400 mt-1 text-right select-none">
                    {msg.timestamp &&
                      new Date(msg.timestamp).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
#####################################
<!-- .env -->
VITE_FIREBASE_API_KEY=AIzaSyDqgvPAVnqZxlK_HVxke80huIm78-OEDv0
VITE_FIREBASE_AUTH_DOMAIN=neuralnexus-467517.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=neuralnexus-467517
VITE_FIREBASE_STORAGE_BUCKET=neuralnexus-467517.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=915579649879
VITE_FIREBASE_APP_ID=1:915579649879:web:70a78270d904da8bd14812
VITE_FIREBASE_MEASUREMENT_ID=G-GC0GRR5B32
VITE_USE_EMULATORS=true
VITE_FIRESTORE_EMULATOR_HOST=firestore:8070
VITE_ALLOW_UNVERIFIED_LOGIN=true
VITE_USE_FIREBASE_EMULATOR=true

#######################

{"openapi":"3.1.0","info":{"title":"Neural Nexus Messaging API","description":"API for AI messaging with LoRA context support","version":"1.0.0"},"paths":{"/health":{"get":{"summary":"Health Check","description":"Health check endpoint.","operationId":"health_check_health_get","responses":{"200":{"description":"Successful Response","content":{"application/json":{"schema":{"$ref":"#/components/schemas/HealthResponse"}}}}}}},"/query":{"post":{"summary":"Query","description":"Unified query endpoint supporting multiple input modes:\n\n1. Text only: Provide user_input without image\n2. Image only: Provide image without user_input (or empty string)\n3. Image + text: Provide both user_input and image\n\nAdditional features:\n- If avatar_id is provided: attempts to use adapter\n- If use_context=True: retrieves context from vectorstore\n- Works gracefully even if features are unavailable\n\nExamples:\n    Text only:\n        curl -X POST -F \"user_input=What is AI?\" -F \"user_id=123\"\n    \n    Image only:\n        curl -X POST -F \"user_id=123\" -F \"image=@photo.jpg\"\n    \n    Image + text:\n        curl -X POST -F \"user_input=What's in this image?\" -F \"user_id=123\" -F \"image=@photo.jpg\"","operationId":"query_query_post","requestBody":{"content":{"multipart/form-data":{"schema":{"$ref":"#/components/schemas/Body_query_query_post"}}},"required":true},"responses":{"200":{"description":"Successful Response","content":{"application/json":{"schema":{"$ref":"#/components/schemas/QueryResponse"}}}},"422":{"description":"Validation Error","content":{"application/json":{"schema":{"$ref":"#/components/schemas/HTTPValidationError"}}}}}}}},"components":{"schemas":{"Body_query_query_post":{"properties":{"user_input":{"anyOf":[{"type":"string"},{"type":"null"}],"title":"User Input"},"user_id":{"type":"string","title":"User Id"},"avatar_id":{"anyOf":[{"type":"string"},{"type":"null"}],"title":"Avatar Id"},"use_context":{"type":"boolean","title":"Use Context","default":false},"max_new_tokens":{"type":"integer","title":"Max New Tokens","default":150},"image":{"anyOf":[{"type":"string","format":"binary"},{"type":"null"}],"title":"Image"}},"type":"object","required":["user_id"],"title":"Body_query_query_post"},"HTTPValidationError":{"properties":{"detail":{"items":{"$ref":"#/components/schemas/ValidationError"},"type":"array","title":"Detail"}},"type":"object","title":"HTTPValidationError"},"HealthResponse":{"properties":{"status":{"type":"string","title":"Status"},"device":{"type":"string","title":"Device"},"model_loaded":{"type":"boolean","title":"Model Loaded"}},"type":"object","required":["status","device","model_loaded"],"title":"HealthResponse"},"QueryResponse":{"properties":{"response":{"type":"string","title":"Response"},"context_used":{"type":"boolean","title":"Context Used"},"device":{"type":"string","title":"Device"},"model_type":{"type":"string","title":"Model Type"},"user_id":{"type":"string","title":"User Id"},"avatar_id":{"anyOf":[{"type":"string"},{"type":"null"}],"title":"Avatar Id"},"vectorstore_url":{"anyOf":[{"type":"string"},{"type":"null"}],"title":"Vectorstore Url"},"error":{"anyOf":[{"type":"string"},{"type":"null"}],"title":"Error"}},"type":"object","required":["response","context_used","device","model_type","user_id"],"title":"QueryResponse"},"ValidationError":{"properties":{"loc":{"items":{"anyOf":[{"type":"string"},{"type":"integer"}]},"type":"array","title":"Location"},"msg":{"type":"string","title":"Message"},"type":{"type":"string","title":"Error Type"}},"type":"object","required":["loc","msg","type"],"title":"ValidationError"}}}}

###########################

# docker compose.yml - GPU Version of Messaging API

services:
  messaging-api:
    build:
      context: .
      dockerfile: Dockerfile
    image: evdev3/nn-messaging-api-gpu
    container_name: nn-messaging-api-gpu
    env_file:
      - .env
    ports:
      - "8090:8090"
    volumes:
      # Hot reload - mount source code
      - ./app:/app
      - ./.env:/.env
    restart: unless-stopped
    network_mode: host
    
    # GPU configuration
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 16G  # Increased for GPU workloads + model caching
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    
    # Environment variables for GPU usage
    environment:
      - FORCE_CPU=0
      - NVIDIA_VISIBLE_DEVICES=all
      - NVIDIA_DRIVER_CAPABILITIES=compute,utility
      # Hot reload specific
      - PYTHONDONTWRITEBYTECODE=1
      - PYTHONUNBUFFERED=1
      # Development mode
      - PYTHON_ENV=development
      - FASTAPI_ENV=development
      # API endpoints for local testing
      - FIRESTORE_EMULATOR_HOST=firebase-emulator:8070
      - FIREBASE_AUTH_EMULATOR_HOST=firebase-emulator:9099
      - FIREBASE_STORAGE_EMULATOR_HOST=firebase-emulator:9199
    # Health check
    healthcheck:
      test: ["CMD", "python3", "-c", "import torch; import requests; torch.cuda.is_available() and requests.get('http://localhost:8090/health').status_code == 200"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s  # Increased start period for model loading

# ADD: Connect to the external network
networks:
  neural-nexus-network:
    external: true


#############################

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: react-vite-dev
    ports:
      - "5173:5173"
    volumes:
      - ./:/app:cached
      - /app/node_modules
    env_file:
      - .env.development
    environment:
      - CHOKIDAR_USEPOLLING=true
      - CHOKIDAR_INTERVAL=100
      # Connect to emulator service in docker network
      - FIRESTORE_EMULATOR_HOST=firebase-emulator:8070
      - FIREBASE_AUTH_EMULATOR_HOST=firebase-emulator:9099
      - FIREBASE_STORAGE_EMULATOR_HOST=firebase-emulator:9199  # ✅ Add this
    depends_on:
      - firebase-emulator
    stdin_open: true
    tty: true
    restart: unless-stopped
    command: ["npm", "run", "dev", "--", "--host"]
    networks:
      - neural-nexus-network

  firebase-emulator:
    image: andreysenov/firebase-tools:latest
    container_name: firebase-emulator
    ports:
      - "4000:4000"   # Emulator UI
      - "8070:8070"   # Firestore
      - "9099:9099"   # Auth
      - "9000:9000"   # Realtime DB
      - "9199:9199"   # Storage
      - "5001:5001"   # Functions
    volumes:
      - ./:/firebase:cached
    working_dir: /firebase
    command: >
      sh -c "firebase emulators:start --project neuralnexus-467517 --only firestore,auth,database,storage,functions"
    networks:
      - neural-nexus-network
    restart: unless-stopped

networks:
  neural-nexus-network:
    driver: bridge
