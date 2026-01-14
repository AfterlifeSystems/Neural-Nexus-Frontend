SHOULD I USE GLOBAL CONTEXT AT ALL? HOW DO I IMPLEMENT THIS APP WITHOUT GLOBAL CONTEXT? I FEEL AS IF USING A GLOBAL CONTEXT AND IMPORTING THAT CONTEXT INTO ALL NEEDED FILES IS BAD PRACTICE; 

I have main.jsx:

inside main, I have App.jsx:

There is activeTab & activeAvatar;

activeTab is passed into AvatarSelectionComponent & activeAvatar is a global variable exported from useAuth from AuthContext (an AuthProvider route)

activeTab is default to avatar-selection showing the AvatarSelectionComponent when there is no activeAvatar

otherwise the ChatArea is shown


INSIDE AVATAR SELECTION COMPONENT:
isLoggedIn is import from useAuth (global)
and conditionally renders a circular gallery of avatars OR showns a loginCard component;

the loginCard component is a useMemo inside AvatarSelectionComponent that hosts a component AuthComponent and passes setActiveTab into the AuthComponent (setActiveTab is no used)

AuthComponent imports useAuth

there is modalView & showModal & handleAuth & modalContent

modalContent is the body of what is shown

handleAuth is an async function called inside modalConent

showModal determines if the ModalConent is shown otherwise nothing is shown:

handleAuth reads the modalView and depending on values: signup, login, forgotPassword, signup, login, and forgotPassword are called from authService.jsx which holds the logic of interacting with firebase auth;

  return (
    <>
      <Toaster position="top-center" />
      <>{showModal && ReactDOM.createPortal(modalContent, modalRoot)}</>
    </>
  );

on sucessful login or signup, setShowModal is set to false in handleAuth which doesnt render the login Card in AvatarSelectionComponent

in AuthContext there is a useEffect for onAuthStateChanged; 
const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
the firebaseUser defined in onAuthStateChanged will conditionally after having a value (and every change of the AuthState in firebase) set isLoggedIn to true and set the activeAvatar; 
therefore the activeAvatar is set, the activeTab is avatar-selection, and the login card will not be rendered in AvatarSelectionComponent;

instead, the avatar selection component will show a circurlar gallery of avatar cards which on click will navigate to the ChatArea for that selected avatar. 

THIS IS NOT THE PROPER METHOD TO HANDLE PAGE ROUTING, OR THE CURRENT USER;

HOW IS THE BEST WAY TO SIMPLY NAVIGATE THROUGH THE APPLICATION WITH PROTECTED ROUTES TO ALLOW FOR A LEAN APPLICATION?

SHOULD I INSTEAD BE USING LOCAL STORAGE TO SET THE CURRENT USER RATHER THAN HAVING A USE EFFECT IN A GLOBAL CONTEXT THAT UPDATES BOOLEAN VARIABLES THAT TRIGGER STATES OF SHOWN HTML BODIES? WHAT IS THE BEST WAY TO DO THIS SO THAT I MAY QUICKLY (within a half hour) DEVELOP AROUND THIS APPLICATION; 

// main.jsx


import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';

import './index.css';

import App from './App.jsx';

import { AuthProvider } from './context/AuthContext';

import { MediaProvider } from './context/MediaContext.jsx';

import ReactDOM from 'react-dom/client';

import { BrowserRouter, Routes, Route } from 'react-router-dom';

import LandingPage from './components/Landing/LandingPage.jsx';

import PrivacyPolicy from './components/Landing/PrivacyPolicy.jsx';

import TermsOfService from './components/Landing/TermsOfService.jsx';

import { ToastContainer, Zoom } from 'react-toastify';

import 'react-toastify/dist/ReactToastify.css';

import AuthCallback from './components/AuthCallback.jsx';

import ResetPassword from './components/ResetPassword.jsx';


createRoot(document.getElementById('root')).render(

  <StrictMode>

    <AuthProvider>

      <MediaProvider>

        <BrowserRouter>

          <ToastContainer

            position="top-center"

            autoClose={false}

            closeOnClick={true}

            transition={Zoom}

          />

          <Routes>

            {/* Home/Landing Page */}

            <Route path="/" element={<LandingPage />} />


            {/* Main App: All /app routes handled inside App.jsx */}

            <Route path="/app/*" element={<App />} />


            <Route path="/privacy" element={<PrivacyPolicy />} />

            <Route path="/terms" element={<TermsOfService />} />


            {/* Auth Callback - handles email verification, OAuth returns, etc. */}

            <Route path="/auth/callback" element={<AuthCallback />} />


            {/* Password Reset Page */}

            <Route path="/auth/reset-password" element={<ResetPassword />} />

          </Routes>

        </BrowserRouter>

      </MediaProvider>

    </AuthProvider>

  </StrictMode>

);



---

import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import CreateAvatarModal from './components/CreateAvatarModal';
import AvatarSelectionComponent from './components/AvatarSelectionComponent';
import VantaBackground from './components/VantaBackground';
import { useAuth } from './context/AuthContext';
import { useMedia } from './context/MediaContext';
import { Toaster } from 'react-hot-toast';
import LiveChat from './components/LiveChat';
import AccountSettings from './components/AccountSettings';
import BillingDashboard from './components/BillingDashboard';

const App = () => {
  const { activeAvatar, setActiveAvatar } = useAuth();
  const {
    messages,
    sendMessage,
    messagesEndRef,
    inputMessage,
    dataExchangeTypes,
  } = useMedia();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDataExchangeDropdown, setShowDataExchangeDropdown] =
    useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('avatar-selection'); // Default to avatar-selection
  const dropdownRef = useRef(null);
  const [isLiveChat, setIsLiveChat] = useState(false);

  const handleEndLiveChat = () => {
    setIsLiveChat(false);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      const isFormElement =
        target.tagName === 'TEXTAREA' ||
        (target.tagName === 'INPUT' && !target.readOnly);

      if (isFormElement) return;

      if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarVisible((v) => !v);
      }

      if (e.key === 'Escape') {
        setShowDataExchangeDropdown(false);
        setSidebarVisible(false);
      }
    };

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDataExchangeDropdown(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [inputMessage, activeAvatar, dataExchangeTypes?.text]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-green-900 text-white relative">
      <VantaBackground />
      <Toaster
        position="top-center"
        containerStyle={{ zIndex: 99999 }}
        toastOptions={{
          style: { boxShadow: 'none', zIndex: 99999 },
          className: 'z-[99999]',
        }}
      />
      <div className="w-screen h-screen flex flex-col gap-1 relative z-10">
        <div className="relative flex flex-grow overflow-hidden justify-center items-center">
          {activeTab === 'avatar-selection' || !activeAvatar ? (
            <AvatarSelectionComponent
              setShowCreateModal={setShowCreateModal}
              setActiveTab={setActiveTab}
              onEndLiveChat={handleEndLiveChat}
            />
          ) : activeTab === 'billing' ? (
            <BillingDashboard />
          ) : activeTab === 'account' ? (
            <AccountSettings />
          ) : isLiveChat ? (
            <LiveChat
              avatarIcon={activeAvatar?.icon}
              onEndLiveChat={handleEndLiveChat}
              onSendVoice={sendMessage}
            />
          ) : (
            <ChatArea
              className="flex flex-grow w-full h-full z-50"
              showDataExchangeDropdown={showDataExchangeDropdown}
              setShowDataExchangeDropdown={setShowDataExchangeDropdown}
              dropdownRef={dropdownRef}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onActivateLiveChat={() => setIsLiveChat(true)}
              setShowCreateModal={setShowCreateModal}
              onEndLiveChat={handleEndLiveChat}
            />
          )}
        </div>
        {showCreateModal && (
          <CreateAvatarModal setShowCreateModal={setShowCreateModal} />
        )}
      </div>
    </div>
  );
};

export default App;
----

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
import AvatarCardComponent from './AvatarCardComponent';
import { useMedia } from '../context/MediaContext';
import AuthComponent from './AuthComponent';
import { signup, login, logout } from '../services/authService';

const AvatarSelectionComponent = ({
  setShowCreateModal,
  setActiveTab,
  onEndLiveChat,
}) => {
  const {
    isLoggedIn,
    accessToken,
    user,
    avatars,
    // logout,
    setActiveAvatar,
    lastUsedAvatar,
    selectAvatar,
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

  const isValidImageUrl = (url) => {
    if (!url) return false;
    if (url.startsWith('data:image/')) return url.includes('base64,');
    return /^(https?:\/\/|\/)/.test(url);
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
      localStorage.setItem('last_used_avatar_id', avatarId);
      if (avatarIndex !== null && avatars?.length > 0) {
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
      try {
        const avatarId =
          actualCardData.id ||
          avatars?.find((avatar) => avatar.name === actualCardData.text)
            ?.avatar_id;
        if (!avatarId) {
          toast.error('Avatar ID not found');
          return;
        }

        const avatarIndex = avatars.findIndex(
          (avatar) => avatar.avatar_id === avatarId
        );

        setCurrentCardIndex(avatarIndex);
        if (galleryRef.current) {
          galleryRef.current.setCurrentIndex(avatarIndex);
        }

        // Use AuthContext selectAvatar which updates Firestore
        await selectAvatar(avatarId);

        const selectedAvatar = avatars.find(
          (avatar) => avatar.avatar_id === avatarId
        );

        cacheAvatarPosition(avatarId, avatarIndex);
        if (selectedAvatar?.icon) {
          cacheAvatarIcon(avatarId, selectedAvatar.icon, avatarIndex);
        }

        setActiveAvatar(selectedAvatar);
        // Load messages for this avatar
        await fetchMessages();
        setActiveTab('chat');
      } catch (error) {
        console.error('Error selecting avatar:', error);
        toast.error('Failed to select avatar');
      }
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
          avatars?.find((avatar) => avatar.name === selectedCard.text)
            ?.avatar_id;
        if (!avatarId) {
          toast.error('Avatar ID not found');
          return;
        }

        // Use AuthContext selectAvatar which updates Firestore
        await selectAvatar(avatarId);

        const selectedAvatar = avatars.find(
          (avatar) => avatar.avatar_id === avatarId
        );
        const avatarIndex = avatars.findIndex(
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
      } catch (error) {
        console.error('Error selecting avatar for settings:', error);
        toast.error('Failed to open avatar settings');
      }
    }
  };

  const authenticatedCards = useMemo(() => {
    const avatarCards =
      avatars?.map((avatar) => ({
        id: avatar.avatar_id,
        component: (
          <AvatarCardComponent avatar={avatar} onCardClick={handleClick} />
        ),
        type: 'avatar',
        text: avatar.name,
        image: avatar.icon && isValidImageUrl(avatar.icon) ? avatar.icon : null,
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
  }, [avatars]);

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
    if (isLoggedIn && avatars?.length > 0 && !hasInitialized.current) {
      let targetIndex = 0;

      const cachedLastAvatarId = localStorage.getItem('last_used_avatar_id');
      if (cachedLastAvatarId) {
        const cachedPosition = getCachedAvatarPosition(cachedLastAvatarId);
        if (cachedPosition && cachedPosition.avatarIndex < avatars.length) {
          targetIndex = cachedPosition.avatarIndex;
        }
      } else if (lastUsedAvatar) {
        const lastUsedIndex = avatars.findIndex(
          (avatar) => avatar.avatar_id === lastUsedAvatar
        );
        if (lastUsedIndex !== -1) {
          targetIndex = lastUsedIndex;
        }
      }

      setCurrentCardIndex(targetIndex);
      if (galleryRef.current) {
        galleryRef.current.setCurrentIndex(targetIndex);
      }
      hasInitialized.current = true;
    }
    if (!isLoggedIn || !avatars?.length) {
      hasInitialized.current = false;
    }
  }, [isLoggedIn, avatars]);

  const handleLogout = () => {
    setActiveAvatar(null);
    logout();
    setDropdownOpen(false);
    onEndLiveChat?.();
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

  useEffect(() => {
    if (isLoggedIn) {
      toast.dismiss();
    }
  }, []);

  useEffect(() => {
    console.log(
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX TARA HOLIDAY XXXXXXXXXXXXXXXXXXXXXXXXXXX'
    );
    console.log('Avatar Selection Component isLoggedIn: ' + isLoggedIn);
  }, []);

  const loginCard = useMemo(
    () => ({
      id: 'login',
      component: (
        <AuthComponent
          setActiveTab={setActiveTab}
          onEndLiveChat={onEndLiveChat}
        />
      ),
      // type: 'login',
      // text: 'Sign In',
      // image: getLoginCardIcon(),
    }),
    [user, lastUsedAvatar, avatars]
  );

  const currentCards = isLoggedIn ? authenticatedCards : [loginCard];

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
    const newIndex = Math.min(currentCards.length - 1, currentCardIndex + 5);
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

  // Get the 5 closest avatars to current index (2 before, current, 2 after)
  const getVisibleDots = () => {
    const total = currentCards.length;
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

    const slice = currentCards.slice(start, end + 1);

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
      ...(avatars?.map((avatar, idx) => ({
        id: avatar.avatar_id,
        type: 'avatar',
        text: avatar.name,
        image: avatar.icon && isValidImageUrl(avatar.icon) ? avatar.icon : null,
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
      ...(avatars?.map((avatar, idx) => ({
        id: avatar.avatar_id,
        type: 'avatar',
        text: avatar.name,
        image: avatar.icon && isValidImageUrl(avatar.icon) ? avatar.icon : null,
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
          currentCards.length - 1,
          currentCardIndex + 1
        );
        setCurrentCardIndex(newIndex);
        if (galleryRef.current) {
          galleryRef.current.setCurrentIndex(newIndex);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const currentCard = currentCards[currentCardIndex];
        if (currentCard) {
          handleClick(currentCard);
        }
      }
    };

    if (isLoggedIn) {
      document.addEventListener('keydown', handleGalleryKeyDown);
      return () =>
        document.removeEventListener('keydown', handleGalleryKeyDown);
    }
  }, [isLoggedIn, currentCardIndex, currentCards, isDropdownOpen]);

  return (
    <div className="flex flex-col items-center justify-start p-4 relative mx-auto min-h-screen w-full">
      {isLoggedIn ? (
        <div className="w-full h-screen overflow-hidden flex flex-col items-center gap-2">
          <div className="relative w-full max-w-md mt-8 mb-2" ref={searchRef}>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearch}
              onFocus={handleSearchFocus}
              onKeyDown={handleKeyDown}
              placeholder="Search avatars..."
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
            {/* <button
              onClick={handleCustomizeAvatar}
              className="bg-white/10 rounded-lg border border-white/20 py-2 px-4 text-white hover:bg-white/15 transition-all duration-300 flex items-center gap-2"
            >
              {currentCardIndex === authenticatedCards.length - 1 ? (
                <>
                  <CirclePlus className="w-5 h-5" />
                  Create Avatar
                </>
              ) : (
                <>
                  <Edit className="w-5 h-5" />
                  Customize Avatar
                </>
              )}
            </button> */}
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
                disabled={currentCardIndex === currentCards.length - 1}
                className={`p-1 rounded-full transition-all duration-300 ${
                  currentCardIndex === currentCards.length - 1
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
                {dropdownOpen && (
                  <div
                    id="user-menu"
                    role="menu"
                    className="absolute bottom-[50px] w-full mt-2 right-0 backdrop-blur-lg bg-white/10 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                  >
                    <div className="flex justify-between items-center px-4 py-2 border-b border-white/20">
                      <span className="text-white text-sm font-semibold">
                        {user?.username}
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
                      onClick={() => {
                        onEndLiveChat?.();
                        setActiveTab('account');
                        setDropdownOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-teal-600 transition"
                      role="menuitem"
                    >
                      Account Settings
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('billing');
                        onEndLiveChat?.();
                        setDropdownOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-teal-600 transition"
                      role="menuitem"
                    >
                      Billing
                    </button>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left flex flex-row items-center px-4 py-2 text-sm text-red-500 hover:bg-red-900 hover:text-white transition"
                      role="menuitem"
                    >
                      Logout <LogOut className="ml-2 w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md">{loginCard.component}</div>
      )}
    </div>
  );
};

export default AvatarSelectionComponent;


---

import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  LogIn,
  LogOutIcon,
  UserPlus,
  X,
  SendIcon,
  Github,
  Mail,
  User,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import VantaBackground from './VantaBackground';
import LoadingSpinner from './LoadingSpinner';
import { toast, Toaster } from 'react-hot-toast';
import { signup, login, logout } from '../services/authService';

const modalRoot =
  document.getElementById('modal-root') ||
  (() => {
    const el = document.createElement('div');
    el.id = 'modal-root';
    document.body.appendChild(el);
    return el;
  })();

const AuthComponent = ({ setActiveTab, onEndLiveChat }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showModal, setShowModal] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [modalView, setModalView] = useState('login'); // 'login', 'signup', 'forgotPassword'

  // Rotating avatar index
  const [rotatingIndex, setRotatingIndex] = useState(0);

  const {
    user,
    isLoggedIn,
    // login,
    // signup,
    // logout,
    resendVerification,
    forgotPassword,
    signInWithProvider,
    accessToken,
    avatars,
    lastUsedAvatar,
    setActiveAvatar,
  } = useAuth();

  const { setMessages } = useMedia();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const validIcons = Array.isArray(avatars)
    ? avatars
        .map((a) => a.icon)
        .filter((icon) => typeof icon === 'string' && icon.startsWith('https'))
    : [];

  // Intermittently rotate avatar images

  // This returns the exact image or fallback you should render.
  const getRotatingAvatarIcon = (avatars, rotatingIndex, user) => {
    // Filter only valid URLs
    const validIcons = avatars
      .map((a) => a.icon)
      .filter((icon) => typeof icon === 'string' && icon.startsWith('https'));
    // Case 1: No avatars at all → show User icon
    if (!Array.isArray(avatars) || avatars.length === 0) {
      return null; // This signals: "render <User />"
    }

    // Case 2: Exactly one avatar → show that one avatar
    if (validIcons.length === 1) {
      return avatars[0].icon || null;
    }

    // Case 3: Multiple avatars → rotate through them
    return avatars[rotatingIndex]?.icon || null;
  };

  // Rotation effect (only when there are 2+ avatars)
  useEffect(() => {
    if (!Array.isArray(avatars)) return;

    if (validIcons.length < 2) {
      setRotatingIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setRotatingIndex((prev) => (prev + 1) % validIcons.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [avatars]);

  const avatarToRender = getRotatingAvatarIcon(avatars, rotatingIndex, user);

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (modalView === 'signup') {
        const res = await signup(username, email, password);
        // Success handled in AuthContext
        if (res.message === 'Login successful') {
          setShowModal(false);
          resetForm();
        } else {
          setShowModal(true);
          resetForm();
          setModalView('login');
        }
      } else if (modalView === 'login') {
        await login(email, password);
        // Success handled in AuthContext
        setShowModal(false);
        resetForm();
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

      if (
        errorMsg.includes('Email not confirmed') ||
        errorMsg.includes('verify your email')
      ) {
        // Email not verified
        // toast.error(
        //   (t) => (
        //     <div className="flex flex-col gap-3">
        //       <p className="font-medium">Please verify your email first</p>
        //       <div className="flex gap-2">
        //         <button
        //           onClick={() => {
        //             resendVerification(email);
        //             toast.dismiss(t.id);
        //           }}
        //           className="px-3 py-1 bg-teal-600 hover:bg-teal-700 rounded text-sm flex items-center gap-1"
        //         >
        //           <SendIcon size={14} />
        //           Resend Email
        //         </button>
        //         <button
        //           onClick={() => toast.dismiss(t.id)}
        //           className="px-3 py-1 bg-red-500 hover:bg-red-500 rounded text-sm"
        //         >
        //           Dismiss
        //         </button>
        //       </div>
        //     </div>
        //   ),
        //   { duration: 10000 }
        // );
      } else if (
        errorMsg.includes('Invalid login credentials') ||
        errorMsg.includes('Invalid email or password')
      ) {
        // Wrong password
        // toast.error(
        //   (t) => (
        //     <div className="flex flex-col gap-3">
        //       <p className="font-medium">Invalid email or password</p>
        //       <div className="flex gap-2">
        //         <button
        //           onClick={() => {
        //             setModalView('forgotPassword');
        //             toast.dismiss(t.id);
        //           }}
        //           className="px-3 py-1 bg-teal-600 hover:bg-teal-700 rounded text-sm"
        //         >
        //           Forgot Password?
        //         </button>
        //         <button
        //           onClick={() => toast.dismiss(t.id)}
        //           className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm"
        //         >
        //           Try Again
        //         </button>
        //       </div>
        //     </div>
        //   ),
        //   { duration: 10000 }
        // );
      } else if (errorMsg.includes('User already registered')) {
        // Already registered
        toast.error(
          (t) => (
            <div className="flex flex-col gap-3">
              <p className="font-medium">Email already registered</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setModalView('login');
                    toast.dismiss(t.id);
                  }}
                  className="px-3 py-1 bg-teal-600 hover:bg-teal-700 rounded text-sm flex items-center gap-1"
                >
                  <LogIn size={14} />
                  Login Instead
                </button>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ),
          { duration: 10000 }
        );
      } else {
        // Generic error
        toast.error(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    try {
      await signInWithProvider(provider);
    } catch (error) {
      toast.error(`${provider} login failed`);
    }
  };

  const handleLogout = () => {
    setMessages('');
    setActiveAvatar(null);
    logout();
    setDropdownOpen(false);
    onEndLiveChat?.();
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setUsername('');
    setModalView('login');
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
    toast.dismiss();
  };

  const modalContent = (
    <div className="fixed inset-0 flex items-center justify-center z-[999]">
      {/* <VantaBackground /> */}

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/0" />

      {/* Modal */}
      <div
        className="relative z-10 p-8 rounded-xl shadow-2xl w-full max-w-md bg-white/5 backdrop-blur-lg border border-white/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <>
          {/* relative flex items-center justify-center space-x-4 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 p-16 text-center cursor-pointer hover:bg-white/10 transition-all duration-300 min-h-screen w-full flex flex-col justify-evenly items-center  */}
          <div className="flex jusify-center items-center justify-evenly ">
            <h2 className="text-5xl font-bold text-white mb-6">Neural Nexus</h2>
          </div>
          {validIcons?.length > 0 && (
            <div className="flex justify-center items-center pb-6">
              <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center">
                <img
                  src={avatarToRender}
                  alt="Avatar"
                  className="w-32 h-32 rounded-full object-cover transition-opacity duration-500"
                  onError={(e) => {
                    console.error('Avatar failed to load:', e.target.src);
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            </div>
          )}
        </>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-white">
            {modalView === 'signup' && 'Create Account'}
            {modalView === 'login' && 'Login'}
            {modalView === 'forgotPassword' && 'Reset Password'}
          </h2>
          {/* <button
            type="button"
            onClick={closeModal}
            className="p-2 hover:bg-red-500/20 rounded-lg text-white transition"
          >
            <X size={24} />
          </button> */}
        </div>

        {isLoading && (
          <div className="flex justify-center mb-4">
            <LoadingSpinner />
          </div>
        )}

        {/* Social Login Buttons (not for password reset) */}
        {/* {modalView !== 'forgotPassword' && (
          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleSocialLogin('google')}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-gray-800 rounded-lg hover:bg-gray-100 transition font-medium"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>

            <button
              onClick={() => handleSocialLogin('github')}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-800 text-white rounded-lg hover:bg-red-500 transition font-medium"
            >
              <Github size={20} />
              Continue with GitHub
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center pt-6">
                <div className="w-full border-t border-white/20"></div>
              </div>
            </div>

            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-transparent text-white/60">
                Or continue with email
              </span>
            </div>
          </div>
        )} */}

        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-4">
          {modalView === 'signup' && (
            <div>
              <label className="block text-white/80 mb-2 text-sm font-medium">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-white/40"
                placeholder="Enter your username"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-white/80 mb-2 text-sm font-medium">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-white/40"
              placeholder="Enter your email"
              required
            />
          </div>

          {modalView !== 'forgotPassword' && (
            <div>
              <label className="block text-white/80 mb-2 text-sm font-medium">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-white/40"
                placeholder="Enter your password"
                required
                minLength={6}
              />
            </div>
          )}

          {/* Forgot Password Link */}
          {modalView === 'login' && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => setModalView('forgotPassword')}
                className="text-teal-400 hover:text-teal-300 text-sm transition"
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-600/50 rounded-lg text-white font-semibold transition flex items-center justify-center gap-2"
          >
            {modalView === 'signup' && (
              <>
                <UserPlus size={20} />
                Sign Up
              </>
            )}
            {modalView === 'login' && (
              <>
                <LogIn size={20} />
                Log In
              </>
            )}
            {modalView === 'forgotPassword' && (
              <>
                <SendIcon size={20} />
                Send Reset Link
              </>
            )}
          </button>
        </form>

        {/* Toggle between Login/Signup */}
        {modalView !== 'forgotPassword' && (
          <div className="mt-6 text-center text-white/60 text-sm">
            {modalView === 'login' ? (
              <>
                Don't have an account?{' '}
                <button
                  onClick={() => {
                    setModalView('signup');
                    setPassword('');
                  }}
                  className="text-teal-400 hover:text-teal-300 font-medium transition"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => {
                    setModalView('login');
                    setUsername('');
                  }}
                  className="text-teal-400 hover:text-teal-300 font-medium transition"
                >
                  Log in
                </button>
              </>
            )}
          </div>
        )}

        {/* Back to login from forgot password */}
        {modalView === 'forgotPassword' && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setModalView('login')}
              className="text-teal-400 hover:text-teal-300 text-sm transition"
            >
              ← Back to login
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Toaster position="top-center" />
      <>{showModal && ReactDOM.createPortal(modalContent, modalRoot)}</>
    </>
  );
};

export default AuthComponent;


----

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
} from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db, storage } from '../firebase/config.js';
import { getUserProfile } from '../services/userService';
import {
  getAvatars as getAvatarsFromFirestore,
  createAvatar as createAvatarInFirestore,
  deleteAvatar as deleteAvatarFromFirestore,
  selectAvatar as selectAvatarInFirestore,
} from '../services/avatar_Service.jsx';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { signup, login, logout } from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // Firebase Auth user
  const [userProfile, setUserProfile] = useState(null); // Firestore user profile
  const [avatars, setAvatars] = useState([]);
  const [activeAvatar, setActiveAvatar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null); // Firebase ID token for backend API

  // verify connection to firebase auth emulator
  useEffect(() => {
    if (auth.config) {
      console.log('Full Auth Config:', auth.config);
      // Look for a property called 'emulatorConfig' in the object tree
    }
  }, []);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setCurrentUser(firebaseUser);

      if (firebaseUser) {
        try {
          // Debug: ensure uid and token are available
          console.log('Auth state changed for uid:', firebaseUser.uid);

          // Get Firebase ID token for backend API calls
          // Firebase automatically refreshes tokens when needed
          let token;
          try {
            token = await firebaseUser.getIdToken();
            setAccessToken(token);
            localStorage.setItem('access_token', token);
          } catch (tokenErr) {
            console.error('Error obtaining ID token:', tokenErr);
          }

          // Get Firestore user profile (returns null if missing)
          let profile = null;
          try {
            profile = await getUserProfile(firebaseUser.uid);
          } catch (err) {
            console.error('Error fetching user profile:', err);
            if (
              err.message &&
              err.message.includes('Insufficient Firestore permissions')
            ) {
              toast.error(
                'Firestore permissions error: please check rules and project configuration.'
              );
            } else {
              throw err;
            }
          }

          // If profile missing, attempt to create a minimal profile document
          // if (!profile) {
          //   try {
          //     const minimalProfile = {
          //       user_id: firebaseUser.uid,
          //       username:
          //         firebaseUser.displayName ||
          //         (firebaseUser.email || '').split('@')[0],
          //       email: firebaseUser.email || null,
          //       created_at: new Date(),
          //       last_login: new Date(),
          //       currently_logged_in: true,
          //       avatars: [],
          //       digital_twins: [],
          //     };
          //     await setDoc(doc(db, 'users', firebaseUser.uid), minimalProfile);
          //     profile = await getUserProfile(firebaseUser.uid);
          //     console.log(
          //       'Created minimal user profile for uid:',
          //       firebaseUser.uid
          //     );
          //   } catch (createErr) {
          //     console.error(
          //       'Failed to create minimal user profile:',
          //       createErr
          //     );
          //     if (
          //       createErr?.message &&
          //       createErr.message.includes('Insufficient Firestore permissions')
          //     ) {
          //       toast.error(
          //         'Unable to create user profile due to Firestore permissions.'
          //       );
          //     }
          //   }
          // }

          if (profile) {
            setUserProfile(profile);
            setUser(profile);
            setIsLoggedIn(true);

            // Store user data in localStorage
            localStorage.setItem('user', JSON.stringify(profile));
            localStorage.setItem('firebase_user_id', firebaseUser.uid);

            // Load avatars from Firestore
            const loadedAvatars = await loadAvatars(firebaseUser.uid);

            // Set active avatar if user has last_used_digital_twin
            if (profile.last_used_digital_twin && loadedAvatars.length > 0) {
              const lastUsed = loadedAvatars.find(
                (a) => a.avatar_id === profile.last_used_digital_twin
              );
              if (lastUsed) {
                setActiveAvatar(lastUsed);
              }
            }
          } else {
            // Profile unavailable: keep auth state limited
            setUserProfile(null);
            setUser(null);
            setIsLoggedIn(false);
          }
        } catch (error) {
          console.error('Error loading user profile:', error);
          setUserProfile(null);
          setUser(null);
          setIsLoggedIn(false);
          setAccessToken(null);
        }
      } else {
        // User signed out
        setUser(null);
        setUserProfile(null);
        setIsLoggedIn(false);
        setAvatars([]);
        setActiveAvatar(null);
        setAccessToken(null);
        localStorage.removeItem('user');
        localStorage.removeItem('firebase_user_id');
        localStorage.removeItem('avatars');
        localStorage.removeItem('access_token');
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Load avatars from Firestore
  const loadAvatars = async (userId) => {
    try {
      const fetchedAvatars = await getAvatarsFromFirestore(userId);
      setAvatars(fetchedAvatars);
      localStorage.setItem('avatars', JSON.stringify(fetchedAvatars));
      return fetchedAvatars;
    } catch (error) {
      console.error('Error loading avatars:', error);
      return [];
    }
  };

  const resendVerification = async (email) => {
    try {
      // Firebase doesn't have a direct resend verification for email
      // We need to get the current user and resend
      if (auth.currentUser && auth.currentUser.email === email) {
        await sendEmailVerification(auth.currentUser);
        toast.success(
          (t) => (
            <div className="relative flex flex-col gap-2 p-4">
              <div className="flex justify-between items-start">
                <p className="pr-4">Verification email sent!</p>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="p-1 bg-red-600 hover:bg-red-500 rounded text-sm"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ),
          { duration: Infinity }
        );
      } else {
        throw new Error('Please log in first to resend verification email');
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      toast.error(
        (t) => (
          <div className="relative flex flex-col gap-2 p-4">
            <div className="flex justify-between items-start">
              <p className="pr-4">
                {error.message || 'Failed to send verification email'}
              </p>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="p-1 bg-red-600 hover:bg-red-500 rounded text-sm"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ),
        { duration: Infinity }
      );
      throw error;
    }
  };

  const forgotPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/auth/reset-password`,
      });
      // Don't show toast here - let AuthComponent handle it
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  };

  const updatePassword = async (newPassword) => {
    try {
      if (!auth.currentUser) {
        throw new Error('No user logged in');
      }
      await firebaseUpdatePassword(auth.currentUser, newPassword);
      toast.success('Password updated successfully!');
    } catch (error) {
      console.error('Update password error:', error);
      throw error;
    }
  };

  // Social login with Google
  const signInWithProvider = async (provider) => {
    try {
      if (provider === 'google') {
        const googleProvider = new GoogleAuthProvider();
        // Use redirect for better UX
        await signInWithRedirect(auth, googleProvider);
      } else {
        throw new Error(`Provider ${provider} is not supported`);
      }
    } catch (error) {
      console.error(`${provider} login error:`, error);
      toast.error(`${provider} login failed`);
      throw error;
    }
  };

  const getAvatars = async () => {
    if (!currentUser) return;

    try {
      const fetchedAvatars = await loadAvatars(currentUser.uid);
      return fetchedAvatars;
    } catch (error) {
      console.error('Get avatars error:', error);
      return [];
    }
  };

  const createAvatar = async ({ name, description = '', iconFile = null }) => {
    if (!currentUser) {
      throw new Error('User must be logged in to create avatar');
    }

    try {
      const created = await createAvatarInFirestore(
        currentUser.uid,
        name,
        description,
        iconFile
      );

      // Reload avatars and wait for state update
      const fetchedAvatars = await loadAvatars(currentUser.uid);

      // Find the created avatar in the fetched list (should be there)
      const createdAvatar =
        fetchedAvatars.find((a) => a.avatar_id === created.avatar_id) ||
        created; // Fallback to created object if not found

      // Set as active avatar
      setActiveAvatar(createdAvatar);

      // Update Firestore to mark as last_used_digital_twin
      await updateDoc(doc(db, 'users', currentUser.uid), {
        last_used_digital_twin: created.avatar_id,
        digital_twins: [...(user?.digital_twins || []), created.avatar_id],
      });

      // Update local user state
      if (user) {
        const updatedUser = {
          ...user,
          last_used_digital_twin: created.avatar_id,
          digital_twins: [...(user.digital_twins || []), created.avatar_id],
        };
        setUser(updatedUser);
        setUserProfile(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }

      return created;
    } catch (error) {
      console.error('Create avatar failed:', error);
      throw error;
    }
  };

  const deleteAvatar = async (avatarId) => {
    if (!currentUser) return;

    try {
      await deleteAvatarFromFirestore(currentUser.uid, avatarId);
      await loadAvatars(currentUser.uid);

      if (activeAvatar?.avatar_id === avatarId) {
        setActiveAvatar(null);
      }
    } catch (error) {
      console.error('Delete avatar failed:', error);
      throw error;
    }
  };

  const selectAvatar = async (avatarId) => {
    if (!currentUser) return;

    try {
      const response = await selectAvatarInFirestore(currentUser.uid, avatarId);

      if (response.status === 'success') {
        const selectedAvatar = avatars.find((a) => a.avatar_id === avatarId);
        if (selectedAvatar) {
          setActiveAvatar(selectedAvatar);
        }

        // Update user profile
        await updateDoc(doc(db, 'users', currentUser.uid), {
          last_used_digital_twin: avatarId,
        });

        // Update local user state
        if (user) {
          const updatedUser = { ...user, last_used_digital_twin: avatarId };
          setUser(updatedUser);
          setUserProfile(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
      }
    } catch (error) {
      console.error('Select avatar failed:', error);
      throw error;
    }
  };

  const updateActiveAvatarField = (field, value) => {
    setActiveAvatar((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle OAuth redirect result
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          // User signed in via redirect
          // toast.success('Login successful!');
        }
      })
      .catch((error) => {
        console.error('OAuth redirect error:', error);
        toast.error('Authentication failed');
      });
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider
      value={{
        // User state
        user,
        userProfile,
        isLoggedIn,
        currentUser, // Firebase Auth user object
        accessToken, // Firebase ID token for backend API calls
        avatars,
        activeAvatar,
        setActiveAvatar,

        // Auth methods
        // login,
        // signup,
        // logout,
        resendVerification,
        forgotPassword,
        updatePassword,
        signInWithProvider,

        // Avatar methods
        getAvatars,
        createAvatar,
        deleteAvatar,
        selectAvatar,
        updateActiveAvatarField,

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
---

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, storage } from '../firebase/config.js';
import toast from 'react-hot-toast';

export const signup = async (username, email, password) => {
  try {
    console.log(email);
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const uid = userCredential.user.uid;

    // Send email verification
    // await sendEmailVerification(userCredential.user);

    // Update display name
    // await updateProfile(userCredential.user, { displayName: username });

    // Create Firestore profile
    const userDoc = {
      user_id: userCredential.user.uid,
      username,
      email,
      created_at: new Date(),
      last_login: null,
      currently_logged_in: true,
      avatars: [],
      last_used_avatar: null,
    };

    // 3. Write to Firestore
    // Using doc(db, 'collection', ID) ensures the document ID matches the Auth UID
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, userDoc);
    console.log(`✅ Profile created in Firestore for UID: ${uid}`);
    // return userCredential.user;

    // await setDoc(doc(db, 'users', userCredential.user.uid), userDoc);
    // toast.success(
    //   'Signup successful! Please check your email to verify your account.',
    //   { duration: Infinity }
    // );

    return userCredential.user;
  } catch (error) {
    console.error('Signup error:', error);
    console.error('Signup error:', error);
    toast.error(error.message);
    // throw error;
    // Display user-friendly error messages
    let errorMessage = 'Signup failed. Please try again.';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'This email is already registered';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Please provide a valid email address';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password must be at least 6 characters';
    } else if (error.message) {
      errorMessage = error.message;
    }

    toast.error(errorMessage);
    throw error;
  }
};

export const login = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Allow unverified emails if we are using the emulator
    const isEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

    // Check if email is verified
    // if (!userCredential.user.emailVerified && !isEmulator) {
    //   await signOut(auth);
    //   throw new Error('Please verify your email before logging in');
    // }

    // Update last_login in Firestore
    await updateDoc(doc(db, 'users', userCredential.user.uid), {
      last_login: new Date(),
      currently_logged_in: true,
    });

    // toast.success('Login successful!');
    return userCredential.user;
  } catch (error) {
    console.error('Login error:', error);

    let errorMessage = 'Login failed. Please try again.';
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'No account found with this email';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'Incorrect password';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address';
    } else if (error.message) {
      errorMessage = error.message;
    }

    toast.error(errorMessage);
    throw error;
  }
};

// export const logout = async () => {
try {
  const user = auth.currentUser;
  if (user) {
    await updateDoc(doc(db, 'users', user.uid), {
      currently_logged_in: false,
    });
  }
  await signOut(auth);
} catch (error) {
  throw error;
}
// };

export const logout = async () => {
  try {
    const user = auth.currentUser;
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), {
        currently_logged_in: false,
      });
    }
    await signOut(auth);

    // Clear local state
    // setUser(null);
    // setUserProfile(null);
    // setIsLoggedIn(false);
    // setAvatars([]);
    // setActiveAvatar(null);
    // setAccessToken(null);
    // localStorage.removeItem('user');
    // localStorage.removeItem('firebase_user_id');
    // localStorage.removeItem('avatars');
    // localStorage.removeItem('access_token');
  } catch (error) {
    console.error('Logout error:', error);
    toast.error('Logout completed with errors');
    // throw error;
  }
};
