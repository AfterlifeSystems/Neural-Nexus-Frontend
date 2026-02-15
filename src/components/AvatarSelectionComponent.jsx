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
    console.log('handleClick');
    let actualCardData = cardData;
    if (!cardData.type) {
      const matchingCard = authenticatedCards.find(
        (card) =>
          card.id === cardData.avatar_data.assistant_id ||
          (cardData.text && card.text === cardData.text)
      );
      if (matchingCard) actualCardData = matchingCard;
    }

    if (actualCardData.type === 'avatar') {
      const avatarId =
        actualCardData.avatar_data.assistant_id ||
        userAvatars?.find((avatar) => avatar.name === actualCardData.text)
          ?.assistant_id;
      if (!avatarId) {
        toast.error('Avatar ID not found');
        return;
      }

      const avatarIndex = userAvatars.findIndex(
        (avatar) => avatar.assistant_id === avatarId
      );

      setCurrentCardIndex(avatarIndex);
      if (galleryRef.current) {
        galleryRef.current.setCurrentIndex(avatarIndex);
      }
      // Use AuthContext selectAvatar which updates Firestore
      // await selectAvatar(avatarId);

      const selectedAvatar = userAvatars.find(
        (avatar) => avatar.assistant_id === avatarId
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

  // https://claude.ai/chat/8e125e85-be01-4541-a4f4-da3590f996c1
  const authenticatedCards = useMemo(() => {
    console.log(
      `authenticatedCards USEMEMO XXXXXXXXXXXXXXXXXX userAvatars: ${userAvatars}`
    );

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
    let targetIndex = 0;
    setCurrentCardIndex(targetIndex);
    if (galleryRef.current) {
      galleryRef.current.setCurrentIndex(targetIndex);
    }
    hasInitialized.current = true;
    // if (!hasInitialized.current) {
    //   let targetIndex = 0;

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

    //   setCurrentCardIndex(targetIndex);
    //   if (galleryRef.current) {
    //     galleryRef.current.setCurrentIndex(targetIndex);
    //   }
    //   hasInitialized.current = true;
    // }

    // if (!user || !userAvatars?.length) {
    //   hasInitialized.current = false;
    // }
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
                  role="menu"
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
                  {/* <button
                    onClick={() => {
                      // navigate(settings:user)
                      setDropdownOpen(false);
                      1;
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-teal-600 transition"
                    role="menuitem"
                  >
                    Account Settings
                  </button>
                  <button
                    onClick={() => {
                      // navigate(/billing)
                      setDropdownOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-teal-600 transition"
                    role="menuitem"
                  >
                    Billing
                  </button> */}
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
      {showCreateModal && (
        <CreateAvatarModal setShowCreateModal={setShowCreateModal} />
      )}
    </div>
  );
};

export default AvatarSelectionComponent;
