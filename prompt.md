I need assistance navigating to a protected route (AvatarSelectionComponent.jsx) once logged in.
            
            navigate('/avatars');

// main.jsx

import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';

import './index.css';

import { AuthProvider } from './context/AuthContext';

import { MediaProvider } from './context/MediaContext.jsx';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import 'react-toastify/dist/ReactToastify.css';

import LandingPage from './components/Landing/LandingPage.jsx';

import PrivacyPolicy from './components/Landing/PrivacyPolicy.jsx';

import TermsOfService from './components/Landing/TermsOfService.jsx';

import ProtectedRoute from './components/ProtectedRoute';

import AvatarSelectionComponent from './components/AvatarSelectionComponent';

import AuthComponent from './components/AuthComponent';

import ChatArea from './components/ChatArea';

import AccountSettings from './components/AccountSettings';

import { useAuth } from './context/AuthContext';

import VantaBackground from './components/VantaBackground.jsx';

import { auth, db, storage } from './firebase/config.js';

import { toast, Toaster } from 'react-hot-toast';

createRoot(document.getElementById('root')).render(

<>

<Toaster

position="top-center"

toastOptions={{

duration: 5000,

style: {

background: 'rgba(30,30,40,0.95)',

color: 'white',

border: '1px solid rgba(255,255,255,0.12)',

},

}}

/>

<VantaBackground />

<AuthProvider>

<MediaProvider>

<BrowserRouter>

<Routes>

{/* Public landing pages */}

<Route path="/welcome" element={<LandingPage />} />

<Route path="/privacy" element={<PrivacyPolicy />} />

<Route path="/terms" element={<TermsOfService />} />

{/* Login is public */}

<Route path="/login" element={<AuthComponent />} />

{/* All protected routes under one layout */}

<Route element={<ProtectedRoute />}>

<Route path="/avatars" element={<AvatarSelectionComponent />} />

<Route path="/chat/:avatarId" element={<ChatArea />} />

{/* <Route path="/account" element={<AccountSettings />} /> */}

<Route path="/*" element={<LandingPage />} />

</Route>

</Routes>

</BrowserRouter>

</MediaProvider>

</AuthProvider>

</>

);







<!-- AuthComponent.jsx -->

  const handleAuth = async (e) => {
    console.log(`ENTRYPOINT HANDLE AUTH: isLoading ${isLoading}`);
    e.preventDefault();
    setIsLoading(true);
    if (!isLoading) {
      console.log(`is loading is false: ${isLoading}`);
    }

    try {
      if (modalView === 'signup') {
        // await signup(username, email, password);
        try {
          console.log(email);

          console.log('signup breakpoint');
          // SUPABASE POSTGRES_DB_STORE
          const supabaseClient = createClient(
            `${import.meta.env.VITE_SUPABASE_URL}`,
            `${import.meta.env.VITE_SUPABASE_PUBLISHABLE_AUTH_KEY}`
          );

          const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
              data: {
                display_name: username,
              },
            },
          });
          if (error) {
            toast.error(error.message);
            // throw error;
            // Display user-friendly error messages
            let errorMessage = 'Signup failed. Please try again.';
            if (error.code === 'auth/email-already-in-use') {
              errorMessage = 'This email is already registered';
              toast.error(errorMessage);
              navigate('/login');
            } else if (error.code === 'auth/invalid-email') {
              errorMessage = 'Please provide a valid email address';
            } else if (error.code === 'auth/weak-password') {
              errorMessage = 'Password must be at least 6 characters';
            } else if (error.message) {
              errorMessage = error.message;
            }
          } else {
            // This gives you everything at once
            console.log('Signup data:', { data });
            console.log('Signup error:', { error });

            console.log(`user: ${user}`);

            // Send email verification
            // await sendEmailVerification(userCredential.user);

            // set the current profile to the newly created profile
            console.log(
              '// set profile of user IN SIGNUP OF  AUTH COMPONENT XXXXXXXXXXXXX'
            );

            setUser(data.user);
            setProfile(data.user);
            setAccessToken(data.session.access_token);
            setIsLoading(false);

            localStorage.setItem('user', JSON.stringify(data.user));

            navigate('/avatars');
          }
        } catch (error) {
          console.error('Signup error:', error);
          toast.error(error.message);
          throw error;
        }
      } else if (modalView === 'login') {
        toast
          .promise(
            (async () => {
              const supabase = await createClient(
                `${import.meta.env.VITE_SUPABASE_URL}`,
                `${import.meta.env.VITE_SUPABASE_PUBLISHABLE_AUTH_KEY}`
              );

              console.log('signInWithPassword BREAKPOINT');

              const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
              });

              if (error) {
                throw error;
              }

              console.log(
                'XXXXXXXXXXXXXXXXXXXXXX   HANDLE AUTH SERVICE XXXXXXXXXXXXXXXXXXXXXXXXXXX'
              );
              console.log(JSON.stringify(data));
              localStorage.setItem('user', JSON.stringify(data.user));

              // set the current user profile
              console.log(
                '// set profile of user IN AUTH COMPONENT XXXXXXXXXXXXX'
              );

              console.log(`handle Auth Error handleAuthError`);

              setProfile(data.user);
              setAccessToken(data.session.access_token);

              console.log(
                'XXXXXXXXXXXXXXXXXXXXXXXXX userCredential: ' +
                  JSON.stringify(data)
              );
              console.log(
                'XXXXXXXXXXXXXXXXXXXXXXXXX userCredential.user: ' +
                  JSON.stringify(data.user)
              );

              // GET AVATARS
              console.log('USER HAS LOGGED IN; GETING AVATARS FOR USER');
              console.log(`user.id: ${data.user.id}`);
              const avatars = await getAvatars(data.user.id);

              console.log('AVATARS LIST SHOULD BE RETRIEVED');
              console.log(`avatars: ${avatars}`);

              setUserAvatars(avatars);
              console.log('SETTING AVATARS FOR USER');

              console.log(`avatars: ${avatars}`);

              return data.user;
            })(),
            {
              // toast promise return values (catches errors)
              loading: 'Logging in...',
              success: 'Login successful!',
              error: (error) => {
                if (error.code === 'auth/user-not-found')
                  return 'No account found with this email';
                if (error.code === 'auth/wrong-password')
                  return 'Incorrect password';
                if (error.code === 'auth/invalid-email')
                  return 'Invalid email address';
                if (error.code === 'auth/too-many-requests')
                  return 'Too many attempts — try again later';
                return error.message || 'Login failed';
              },
              duration: 5000,
            }
          )
          .then(() => {
            console.log('navigate / avatars breakpoint');
            navigate('/avatars');
          })
          .catch((error) => {
            console.log('catching error: ' + error.message);
          });

        // Success handled in AuthContext
      } else if (modalView === 'forgotPassword') {
        await forgotPassword(email);
        // toast.success(
        //   (t) => (
        //     <div className="relative flex flex-col gap-2 p-4 ">
        //       {/* Text + X button in one row */}
        //       <div className="flex justify-between items-start">
        //         {/* Message */}
        //         <p className="pr-4">
        //           Password reset email sent! Check your inbox.
        //         </p>

        //         {/* X button top-right */}
        //         <button
        //           onClick={() => toast.dismiss(t.id)}
        //           className="p-1 bg-red-600 hover:bg-red-500 rounded text-sm"
        //         >
        //           <X size={16} />
        //         </button>
        //       </div>
        //     </div>
        //   ),
        //   { duration: Infinity }
        // );
        setModalView('login');
      }
    } catch (error) {
      // Handle specific error cases
      const errorMsg = error.message || 'Authentication failed';
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };
<!-- Avatar Selection Component -->
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CircularGallery from './CircularGallery';
import {
  Search,
  Settings,
  CirclePlus,
  LogOut,
  X,
  Edit,
  User,
} from 'lucide-react';
import { FiCircle } from 'react-icons/fi';
import CreateAvatarComponent from './CreateAvatarComponent';
import CreateAvatarModal from './CreateAvatarModal';
import AvatarCardComponent from './AvatarCardComponent';
import { useMedia } from '../context/MediaContext';
import { selectAvatar } from '../services/avatarService';

import { signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, storage } from '../firebase/config.js';

import { getAvatars } from '../services/avatarService.jsx';

const AvatarSelectionComponent = ({}) => {
  const {
    accessToken,
    user,
    profile,
    userAvatars,
    setActiveAvatar,
    lastUsedAvatar,
    setUserAvatars,
  } = useAuth();

  const { setMessages, fetchMessages } = useMedia();
  const navigate = useNavigate();
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const galleryRef = useRef(null);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);
  const hasInitialized = useRef(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isValidImageObjectUrl = (urlObject) => {
    if (!urlObject) return false;

    if (urlObject.url.startsWith('data:image/'))
      return urlObject.url.includes('base64,');
    return /^(https?:\/\/|\/)/.test(urlObject.url);
  };

  const isValidImageUrl = (urlLink) => {
    if (!urlLink) return false;

    if (urlLink.startsWith('data:image/')) return urlLink.includes('base64,');
    return /^(https?:\/\/|\/)/.test(urlLink);
  };

  const clearOtherAvatarCache = (currentAvatarId) => {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          (key.startsWith('avatar_icon_') ||
            key.startsWith('avatar_position_')) &&
          key !== `avatar_icon_${currentAvatarId}` &&
          key !== `avatar_position_${currentAvatarId}`
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.error('Failed to clear other avatar cache:', error);
    }
  };

  const cacheAvatarPosition = (avatarId, avatarIndex = null) => {
    try {
      // localStorage.setItem('last_used_avatar_id', avatarId);
      if (avatarIndex !== null && userAvatars?.length > 0) {
        const positionData = {
          avatarIndex,
        };
        localStorage.setItem(
          `avatar_position_${avatarId}`,
          JSON.stringify(positionData)
        );
        localStorage.setItem(
          'last_avatar_position',
          JSON.stringify(positionData)
        );
      }
    } catch (error) {
      console.error('Failed to cache avatar position:', error);
    }
  };

  const cacheAvatarIcon = (avatarId, iconUrl, avatarIndex = null) => {
    if (iconUrl) {
      try {
        clearOtherAvatarCache(avatarId);
        localStorage.setItem(`avatar_icon_${avatarId}`, iconUrl);
        localStorage.setItem('last_avatar_icon', iconUrl);
      } catch (error) {
        console.error('Failed to cache avatar icon:', error);
      }
    }
    cacheAvatarPosition(avatarId, avatarIndex);
  };

  const handleClick = async (cardData) => {
    let actualCardData = cardData;
    if (!cardData.type) {
      const matchingCard = authenticatedCards.find(
        (card) =>
          card.id === cardData.id ||
          (cardData.text && card.text === cardData.text)
      );
      if (matchingCard) actualCardData = matchingCard;
    }

    if (actualCardData.type === 'avatar') {
      const avatarId =
        actualCardData.id ||
        userAvatars?.find((avatar) => avatar.name === actualCardData.text)
          ?.avatar_id;
      if (!avatarId) {
        toast.error('Avatar ID not found');
        return;
      }

      const avatarIndex = userAvatars.findIndex(
        (avatar) => avatar.avatar_id === avatarId
      );

      setCurrentCardIndex(avatarIndex);
      if (galleryRef.current) {
        galleryRef.current.setCurrentIndex(avatarIndex);
      }
      // Use AuthContext selectAvatar which updates Firestore
      // await selectAvatar(avatarId);

      const selectedAvatar = userAvatars.find(
        (avatar) => avatar.avatar_id === avatarId
      );

      // when the avatar is selected, the backend is responsible for updating the identity and awareness of the avatar

      cacheAvatarPosition(avatarId, avatarIndex);
      if (selectedAvatar?.icon) {
        cacheAvatarIcon(avatarId, selectedAvatar.icon, avatarIndex);
      }
      setActiveAvatar(selectedAvatar);
      // await selectAvatar(avatarId); // Update Firestore last_used_avatar
      // localStorage.setItem('last_used_avatar_id', avatarId);

      // Load messages for this avatar
      // await fetchMessages();
      // toast.success(`Selected ${avatar.name || 'avatar'}`);
      // console.log('HANDLE CLICK');
      navigate(`/chat/${avatarId}`); // ← ROUTE TO CHAT AREA
      // navigate(/chat:selectedAvatar)
    } else if (actualCardData.type === 'create') {
      setShowCreateModal(true);
    }
  };

  const handleCustomizeAvatar = async () => {
    if (currentCardIndex === authenticatedCards.length - 1) {
      setShowCreateModal(true);
      return;
    }

    const selectedCard = authenticatedCards[currentCardIndex];
    if (selectedCard.type === 'avatar') {
      try {
        const avatarId =
          selectedCard.id ||
          userAvatars?.find((avatar) => avatar.name === selectedCard.text)
            ?.avatar_id;
        if (!avatarId) {
          toast.error('Avatar ID not found');
          return;
        }

        // Use AuthContext selectAvatar which updates FirestoreF
        await selectAvatar(avatarId);

        const selectedAvatar = userAvatars.find(
          (avatar) => avatar.avatar_id === avatarId
        );
        const avatarIndex = userAvatars.findIndex(
          (avatar) => avatar.avatar_id === avatarId
        );

        cacheAvatarPosition(avatarId, avatarIndex);

        if (selectedAvatar?.icon) {
          cacheAvatarIcon(avatarId, selectedAvatar.icon, avatarIndex);
        }

        setActiveAvatar(selectedAvatar);
        // Load messages for this avatar and set into media context if needed
        await fetchMessages();
        setActiveTab('documents');
        // navigate(/settings:selectedAvatar)
      } catch (error) {
        console.error('Error selecting avatar for settings:', error);
        toast.error('Failed to open avatar settings');
      }
    }
  };

  const authenticatedCards = useMemo(async () => {
    console.log(
      `authenticatedCards USEMEMO XXXXXXXXXXXXXXXXXX userAvatars: ${userAvatars}`
    );
    const avatars = await getAvatars(user.id);
    setUserAvatars(avatars);

    // getAvatars(user.id);
    const avatarCards =
      userAvatars?.map((avatar) => ({
        id: avatar.avatar_id,
        component: (
          <AvatarCardComponent avatar={avatar} onCardClick={handleClick} />
        ),
        type: 'avatar',
        text: avatar.name,
        image:
          avatar.icon && isValidImageObjectUrl(avatar.icon)
            ? avatar.icon.url
            : null,
        avatar_data: avatar,
      })) || [];

    avatarCards.push({
      id: 'create-avatar',
      component: <CreateAvatarComponent onCardClick={handleClick} />,
      type: 'create',
      text: 'Create Avatar',
      image: null,
    });

    return avatarCards;
  }, [userAvatars]);

  const getCachedAvatarPosition = (avatarId = null) => {
    try {
      if (avatarId) {
        const cachedPosition = localStorage.getItem(
          `avatar_position_${avatarId}`
        );
        if (cachedPosition) return JSON.parse(cachedPosition);
      }
      const lastPosition = localStorage.getItem('last_avatar_position');
      if (lastPosition) return JSON.parse(lastPosition);
      return null;
    } catch (error) {
      console.error('Error getting cached avatar position:', error);
      return null;
    }
  };

  useEffect(() => {
    console.log(`AVATAR SELECTION COMPONENT ENTRYPOINT`);
  });

  useEffect(() => {
    // SET AVATAR CARD INDEX TO LAST USED AVATAR
    if (userAvatars?.length > 0 && !hasInitialized.current) {
      let targetIndex = 0;

      // const cachedLastAvatarId = localStorage.getItem('last_used_avatar_id');

      // if (cachedLastAvatarId) {
      //   const cachedPosition = getCachedAvatarPosition(cachedLastAvatarId);
      //   if (cachedPosition && cachedPosition.avatarIndex < userAvatars.length) {
      //     targetIndex = cachedPosition.avatarIndex;
      //   }
      // } else if (lastUsedAvatar) {
      //   const lastUsedIndex = userAvatars.findIndex(
      //     (avatar) => avatar.avatar_id === lastUsedAvatar
      //   );
      //   if (lastUsedIndex !== -1) {
      //     targetIndex = lastUsedIndex;
      //   }
      // }

      setCurrentCardIndex(targetIndex);
      if (galleryRef.current) {
        galleryRef.current.setCurrentIndex(targetIndex);
      }
      hasInitialized.current = true;
    }
    if (!user || !userAvatars?.length) {
      hasInitialized.current = false;
    }
  }, [user, userAvatars]);

  const handleLogout = async () => {
    try {
      try {
        // localStorage.clear();
        const user = auth.currentUser;

        if (user) {
          await updateDoc(doc(db, 'users', user.id), {
            currently_logged_in: false,
          });
        }
        await signOut(auth);
      } catch (error) {
        console.error('Logout error:', error);
        toast.error('Logout completed with errors');
        // throw error;
      }
      setDropdownOpen(false);

      navigate('/login');
    } catch (err) {
      console.error('Logout failed', err);
      // toast.error("Logout failed");
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // useEffect(() => {
  //   if (user) {
  //     toast.dismiss();
  //   }
  // }, []);

  useEffect(() => {
    console.log('Avatar Selection Component user: ' + JSON.stringify(user));
  }, []);

  const handleDotClick = (index) => {
    setCurrentCardIndex(index);
    if (galleryRef.current) {
      galleryRef.current.setCurrentIndex(index);
    }
  };

  const handleJumpLeft = () => {
    const newIndex = Math.max(0, currentCardIndex - 5);
    setCurrentCardIndex(newIndex);
    if (galleryRef.current) {
      galleryRef.current.setCurrentIndex(newIndex);
    }
  };

  const handleJumpRight = () => {
    const newIndex = Math.min(
      authenticatedCards.length - 1,
      currentCardIndex + 5
    );
    setCurrentCardIndex(newIndex);
    if (galleryRef.current) {
      galleryRef.current.setCurrentIndex(newIndex);
    }
  };
  useEffect(() => {
    const visibleDots = getVisibleDots();

    // Find the index of the currently selected card within the visible dots
    const selectedDotIndex = visibleDots.findIndex(
      (card) => card.originalIndex === currentCardIndex
    );

    console.log('Currently selected visible dot index:', selectedDotIndex);
    console.log('Current Card Index:', currentCardIndex);
  }, [currentCardIndex]);

  // Get the 5 closest userAvatars to current index (2 before, current, 2 after)
  const getVisibleDots = () => {
    console.log(authenticatedCards);
    const total = authenticatedCards.length;
    const visibleCount = 5;
    const halfVisible = Math.floor(visibleCount / 2);

    let start = currentCardIndex - halfVisible;
    let end = currentCardIndex + halfVisible;

    // Clamp start/end to valid range
    if (start < 0) {
      end = Math.min(total - 1, end + Math.abs(start));
      start = 0;
    }
    if (end >= total) {
      start = Math.max(0, start - (end - total + 1));
      end = total - 1;
    }

    const slice = authenticatedCards.slice(start, end + 1);

    // Map slice to include visibleIndex
    return slice.map((card, idx) => ({
      ...card,
      originalIndex: start + idx,
      visibleIndex: idx, // index relative to the visible slice
    }));
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setHighlightedIndex(-1);

    const allCards = [
      ...(userAvatars?.map((avatar, idx) => ({
        id: avatar.avatar_id,
        type: 'avatar',
        text: avatar.name,
        image:
          avatar.icon && isValidImageObjectUrl(avatar.icon)
            ? avatar.icon.url
            : null,
        originalIndex: idx,
      })) || []),
      {
        id: 'create-avatar',
        type: 'create',
        text: 'Create Avatar',
        image: null,
        originalIndex: authenticatedCards.length - 1,
      },
    ];

    const filteredSuggestions = allCards
      .filter((card) => card.text.toLowerCase().includes(value.toLowerCase()))
      .map((card) => ({
        ...card,
        originalIndex: card.originalIndex ?? authenticatedCards.length - 1,
      }));

    setSuggestions(
      value && filteredSuggestions.length === 0
        ? [
            {
              id: 'create-avatar',
              type: 'create',
              text: 'Create Avatar',
              image: null,
              originalIndex: authenticatedCards.length - 1,
            },
          ]
        : filteredSuggestions
    );
    setIsDropdownOpen(true);
  };

  const handleSearchFocus = () => {
    const allCards = [
      ...(userAvatars?.map((avatar, idx) => ({
        id: avatar.avatar_id,
        type: 'avatar',
        text: avatar.name,
        image:
          avatar.icon && isValidImageObjectUrl(avatar.icon)
            ? avatar.icon.url
            : null,
        originalIndex: idx,
      })) || []),
      {
        id: 'create-avatar',
        type: 'create',
        text: 'Create Avatar',
        image: null,
        originalIndex: authenticatedCards.length - 1,
      },
    ];

    setSuggestions(
      searchQuery &&
        allCards.every(
          (card) => !card.text.toLowerCase().includes(searchQuery.toLowerCase())
        )
        ? [
            {
              id: 'create-avatar',
              type: 'create',
              text: 'Create Avatar',
              image: null,
              originalIndex: authenticatedCards.length - 1,
            },
          ]
        : allCards
    );
    setIsDropdownOpen(true);
  };

  const handleSuggestionSelect = (index) => {
    setCurrentCardIndex(index);
    if (galleryRef.current) {
      galleryRef.current.setCurrentIndex(index);
    }
    setSearchQuery(authenticatedCards[index]?.text || '');
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && suggestions.length > 0 && highlightedIndex >= 0) {
      handleSuggestionSelect(suggestions[highlightedIndex].originalIndex);
    } else if (e.key === 'Enter' && suggestions.length > 0) {
      handleSuggestionSelect(suggestions[0].originalIndex);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation for avatar gallery
  useEffect(() => {
    const handleGalleryKeyDown = (e) => {
      // Don't handle if dropdown is open or user is typing in search
      if (
        isDropdownOpen ||
        document.activeElement === searchRef.current?.querySelector('input')
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const newIndex = Math.max(0, currentCardIndex - 1);
        setCurrentCardIndex(newIndex);
        if (galleryRef.current) {
          galleryRef.current.setCurrentIndex(newIndex);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const newIndex = Math.min(
          authenticatedCards.length - 1,
          currentCardIndex + 1
        );
        setCurrentCardIndex(newIndex);
        if (galleryRef.current) {
          galleryRef.current.setCurrentIndex(newIndex);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const currentCard = authenticatedCards[currentCardIndex];
        if (currentCard) {
          handleClick(currentCard);
        }
      }
    };

    if (user) {
      document.addEventListener('keydown', handleGalleryKeyDown);
      return () =>
        document.removeEventListener('keydown', handleGalleryKeyDown);
    }
  }, [user, currentCardIndex, authenticatedCards, isDropdownOpen]);

  return (
    <div className="flex flex-col items-center justify-start p-4 relative mx-auto min-h-screen w-full">
      <div className="w-full h-screen overflow-hidden flex flex-col items-center gap-2">
        <div className="relative w-full max-w-md mt-8 mb-2" ref={searchRef}>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            onFocus={handleSearchFocus}
            onKeyDown={handleKeyDown}
            placeholder="Search userAvatars..."
            className="w-full bg-white/5 rounded-lg border border-white/20 py-2 pl-10 pr-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/80" />
          {isDropdownOpen && suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-white/10 rounded-lg border border-white/20 mt-1 max-h-60 overflow-auto">
              {suggestions.map((suggestion, idx) => (
                <li
                  key={suggestion.id}
                  onClick={() =>
                    handleSuggestionSelect(suggestion.originalIndex)
                  }
                  className={`px-4 py-2 text-white cursor-pointer ${
                    idx === highlightedIndex
                      ? 'bg-white/20'
                      : 'hover:bg-white/20'
                  }`}
                >
                  {suggestion.text}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="h-full flex flex-col min-h-0 w-full mb-2">
          <CircularGallery
            ref={galleryRef}
            items={authenticatedCards}
            bend={0}
            textColor="#ffffff"
            borderRadius={0.05}
            font="bold 48px system-ui"
            scrollSpeed={2}
            scrollEase={0.3}
            onCardClick={handleClick}
            currentIndex={currentCardIndex}
            onIndexChange={setCurrentCardIndex}
          />
        </div>
        <div
          className="flex flex-col items-center w-full gap-2 z-10"
          ref={dropdownRef}
        >
          <div className="flex gap-2 justify-center items-center">
            {/* Left arrow */}
            <button
              onClick={handleJumpLeft}
              disabled={currentCardIndex === 0}
              className={`p-1 rounded-full transition-all duration-300 ${
                currentCardIndex === 0
                  ? 'text-white/20 cursor-not-allowed'
                  : 'text-white/50 hover:text-white hover:bg-white/10 cursor-pointer'
              }`}
              aria-label="Jump left 5 positions"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            {/* Visible dots */}
            <div
              className="flex gap-2 items-center"
              style={{ minWidth: '200px', justifyContent: 'center' }}
            >
              {getVisibleDots().map((card) => {
                const isCreateAvatar = card.type === 'create';
                const isSelected = currentCardIndex === card.originalIndex;
                const distance = Math.abs(
                  currentCardIndex - card.originalIndex
                );

                // Scale dots based on distance from current index
                const scale = Math.max(0.4, 1 - distance * 0.2);

                return (
                  <div
                    key={card.originalIndex}
                    onClick={() => handleDotClick(card.originalIndex)}
                    className={`rounded-full transition-all duration-300 cursor-pointer hover:scale-110 border-2 ${
                      isSelected
                        ? 'border-white'
                        : 'border-white/30 hover:border-white/60'
                    }`}
                    style={{
                      transform: `scale(${scale})`,
                      width: '32px',
                      height: '32px',
                      flexShrink: 0,
                    }}
                    aria-label={`Go to ${card.text}`}
                  >
                    {isCreateAvatar ? (
                      <div className="w-full h-full flex items-center justify-center bg-white/10 rounded-full">
                        <CirclePlus className="w-5 h-5 text-white" />
                      </div>
                    ) : card.image && isValidImageUrl(card.image) ? (
                      <img
                        src={card.image}
                        alt={card.text}
                        className="w-full h-full object-cover rounded-full"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white/10 rounded-full">
                        <User className="w-4 h-4 text-white/50" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right arrow */}
            <button
              onClick={handleJumpRight}
              disabled={currentCardIndex === authenticatedCards.length - 1}
              className={`p-1 rounded-full transition-all duration-300 ${
                currentCardIndex === authenticatedCards.length - 1
                  ? 'text-white/20 cursor-not-allowed'
                  : 'text-white/50 hover:text-white hover:bg-white/10 cursor-pointer'
              }`}
              aria-label="Jump right 5 positions"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
          <div className="min-h-[40px] w-full flex justify-center items-center gap-2 mb-8">
            <div className="relative w-48">
              <button
                onClick={() => setDropdownOpen((open) => !open)}
                className="bg-white/10 rounded-lg border border-white/20 py-2 px-4 text-white hover:bg-white/15 transition-all duration-300 flex items-center gap-2 w-full"
                aria-haspopup="true"
                aria-expanded={dropdownOpen}
                aria-controls="user-menu"
              >
                <Settings className="w-6 h-6" />
                User Settings
              </button>
              {/* // Add this button temporarily to your AvatarSettings component */}
              {import.meta.env.VITE_TESTING === 'true' && (
                <button
                  onClick={() => {
                    console.log('test toast button clicked');
                    toast.dismiss();

                    toast.promise(
                      new Promise((resolve, reject) => {
                        setTimeout(() => {
                          // Change to reject() to test error path
                          // resolve('fake upload result');
                          reject();
                          // reject(new Error("fake upload error"));
                        }, 2400);
                      }),
                      {
                        loading: 'Uploading document...',
                        success: 'Document uploaded',
                        error: 'Upload failed',
                      }
                    );
                    toast.success('success works');
                    toast.error('error works');
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded"
                >
                  Test Promise Toast
                </button>
              )}
              {dropdownOpen && (
                <div
                  id="user-menu"
                  type="menu"
                  className="absolute bottom-[50px] w-full mt-2 right-0 backdrop-blur-lg bg-white/10 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                >
                  <div className="flex justify-between items-center px-4 py-2 border-b border-white/20">
                    <span className="text-white text-sm font-semibold">
                      {profile?.username}
                    </span>
                    <button
                      onClick={() => setDropdownOpen(false)}
                      className="text-white hover:text-red-500"
                      aria-label="Close menu"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left flex flex-row items-center px-4 py-2 text-sm text-red-500 hover:bg-red-900 hover:text-white transition"
                    type="menuitem"
                  >
                    Logout <LogOut className="ml-2 w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {showCreateModal && (
        <CreateAvatarModal setShowCreateModal={setShowCreateModal} />
      )}
    </div>
  );
};

export default AvatarSelectionComponent;
<!-- AuthContext -->
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

import toast from 'react-hot-toast';
import { X } from 'lucide-react';

import { getAvatars } from '../services/avatarService.jsx';

import { createClient } from '@supabase/supabase-js';

const supabase = await createClient(
  `${import.meta.env.VITE_SUPABASE_URL}`,
  `${import.meta.env.VITE_SUPABASE_PUBLISHABLE_AUTH_KEY}`
);

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // current user auth object
  const [profile, setProfile] = useState(null); // the user with metadata included

  const [userAvatars, setUserAvatars] = useState([]); // avatars of the user
  const [communityAvatars, setCommunityAvatars] = useState([]); // avatars shared by the community
  const [proprietaryAvatars, setProprietaryAvatars] = useState([]); // avatars created by Afterlife Systems Inc. (businesses, bibles, restaurants, etc.)

  const [activeAvatar, setActiveAvatar] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [accessToken, setAccessToken] = useState(null); // Firebase ID token for backend API

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
        profile,
        setProfile,
        activeAvatar,
        setActiveAvatar,
        isLoading,
        setIsLoading,
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
<!-- Protected Route -->

// components/ProtectedRoute.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  console.log(`PROTECTED ROUTE LOADING: ${isLoading}`);
  console.log(`user: ${user}`);
  console.log('ENTRY PROTECTED ROUTE');

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
