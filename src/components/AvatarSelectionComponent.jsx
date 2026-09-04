import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CircularGallery from './CircularGallery';
import { idleLoopFor, loadEmotionMedia } from '../hooks/useEmotionMedia';
import {
  Search,
  CirclePlus,
  LogOut,
  Edit,
  User,
} from 'lucide-react';
import { FiCircle } from 'react-icons/fi';
import CreateAvatarComponent from './CreateAvatarComponent';
import CreateAvatarModal from './CreateAvatarModal';
import AvatarCardComponent from './AvatarCardComponent';
import LoadingSpinner from './LoadingSpinner';
import UserSettingsMenu from './UserSettingsMenu';
import {
  readCachedAvatarIcons,
  writeCachedAvatarIcon,
  forgetCachedAvatarIcon,
  resolveAssistantId,
} from './utils';
import { useMedia } from '../context/MediaContext';
import {
  getAvatarReferenceImage,
  listUserAvatars,
} from '../services/avatarService';

/**
 * Whether two avatar lists say the same thing.
 *
 * The gallery is a WebGL scene that CircularGallery rebuilds from scratch
 * whenever the identity of its `items` array changes, and a rebuild shows as a
 * black frame before the cards are drawn again. Handing it a freshly parsed
 * copy of a list it is already displaying therefore costs a visible flash and
 * buys nothing, so the refresh below replaces the list only when the server
 * actually disagrees with what is on screen.
 *
 * Serialising is sound here because both lists come from the same endpoint and
 * are parsed by the same JSON parser, so equal content serialises identically.
 *
 * @param {Array} freshAvatars The list just read from the API.
 * @param {Array} displayedAvatars The list the gallery is currently showing.
 * @returns {boolean} True when replacing one with the other would change nothing.
 */
function describesTheSameAvatars(freshAvatars, displayedAvatars) {
  return (
    JSON.stringify(freshAvatars ?? []) === JSON.stringify(displayedAvatars ?? [])
  );
}

const AvatarSelectionComponent = ({}) => {
  const {
    user,
    userAvatars,
    setUserAvatars,
    setActiveAvatar,
    setContext,
  } = useAuth();

  const { setActiveConversation } = useMedia();
  const navigate = useNavigate();
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const galleryRef = useRef(null);
  // The live Create Avatar card laid over the WebGL gallery. The gallery
  // reports the slot's position every frame; writing the transform straight
  // onto the element keeps the card glued to the slot without a React render
  // per frame.
  const createCardOverlayRef = useRef(null);
  const handleCreateCardMove = useCallback(({ x, visible }) => {
    const overlay = createCardOverlayRef.current;
    if (!overlay) return;
    overlay.style.transform = `translate(calc(-50% + ${x}px), -50%)`;
    overlay.style.visibility = visible ? 'visible' : 'hidden';
  }, []);
  const searchRef = useRef(null);
  const hasInitialized = useRef(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // Avatar portraits fetched from GET /avatar_reference_image, keyed by
  // assistant_id. The API returns a data URI or URL string per avatar.
  //
  // Seeded from what this browser already has, so a returning visitor sees the
  // gallery filled on the first frame rather than a ring of placeholders that
  // fills in a second later. The seed is whatever was true last visit; the
  // effect below re-asks the API and corrects anything that changed.
  const [avatarIconsById, setAvatarIconsById] = useState(readCachedAvatarIcons);
  // True only while the first load of the list is in flight — the gallery is
  // a WebGL canvas that renders an empty ring until avatars arrive, which is
  // indistinguishable from an account that has none.
  const [isLoadingAvatars, setIsLoadingAvatars] = useState(false);

  // Revalidate each avatar's portrait against the API.
  //
  // Each request lands on its own rather than behind a Promise.all: the old
  // barrier meant one slow portrait held back every other, so a gallery of ten
  // showed nothing until the last one arrived. State is replaced only when a
  // portrait actually differs from what is already on screen, so revalidating a
  // cache that is still correct causes no re-render and no flicker.
  useEffect(() => {
    if (!Array.isArray(userAvatars) || userAvatars.length === 0) {
      return undefined;
    }
    let cancelled = false;

    for (const avatar of userAvatars) {
      const assistantId = resolveAssistantId(avatar);
      if (!assistantId) continue;

      (async () => {
        let iconSource;
        try {
          iconSource = await getAvatarReferenceImage(assistantId);
        } catch {
          // The API could not be reached. Whatever is cached is the best thing
          // available, so it stays: blanking a portrait over a dropped request
          // looks like the avatar lost its likeness.
          return;
        }
        if (cancelled) return;

        if (iconSource) {
          writeCachedAvatarIcon(assistantId, iconSource);
          setAvatarIconsById((previousIcons) =>
            previousIcons[assistantId] === iconSource
              ? previousIcons
              : { ...previousIcons, [assistantId]: iconSource }
          );
          return;
        }

        // The API answered, and the answer is that this avatar has no portrait.
        // That is not a stale cache entry, it is a wrong one — the portrait was
        // removed — so it goes rather than lingering until the next deletion.
        forgetCachedAvatarIcon(assistantId);
        setAvatarIconsById((previousIcons) => {
          if (!(assistantId in previousIcons)) return previousIcons;
          const remainingIcons = { ...previousIcons };
          delete remainingIcons[assistantId];
          return remainingIcons;
        });
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [userAvatars]);

  const isValidImageUrl = (urlLink) => {
    if (!urlLink) return false;

    if (urlLink.startsWith('data:image/')) return urlLink.includes('base64,');
    return /^(https?:\/\/|\/)/.test(urlLink);
  };

  // Forget where every OTHER avatar sat in the gallery.
  //
  // Only positions. This used to clear the cached portraits too, which made the
  // portrait cache useless for the screen that needs it most: opening one avatar
  // evicted the other nine, so returning to the gallery re-fetched almost every
  // portrait and showed placeholders while it did. A position is about the one
  // avatar being resumed and is right to narrow to it; a portrait is worth
  // keeping for every avatar the user owns.
  const clearOtherAvatarPositions = (currentAvatarId) => {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key.startsWith('avatar_position_') &&
          key !== `avatar_position_${currentAvatarId}`
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.error('Failed to clear other avatar positions:', error);
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
      clearOtherAvatarPositions(avatarId);
      // One writer for the portrait cache, shared with the gallery's
      // revalidation, so the key shape is defined in exactly one place.
      writeCachedAvatarIcon(avatarId, iconUrl);
      try {
        localStorage.setItem('last_avatar_icon', iconUrl);
      } catch (error) {
        console.error('Failed to record the last avatar icon:', error);
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
      localStorage.setItem('last_used_avatar_index', avatarIndex);
      localStorage.setItem('last_used_avatar_id', avatarId);

      const selectedAvatar = userAvatars.find(
        (avatar) => avatar.assistant_id === avatarId
      );

      cacheAvatarPosition(avatarId, avatarIndex);
      const selectedAvatarIcon = avatarIconsById[avatarId];
      if (selectedAvatarIcon) {
        cacheAvatarIcon(avatarId, selectedAvatarIcon, avatarIndex);
      }
      // Choosing an avatar is now purely a client-side decision: every endpoint
      // that acts on an avatar takes its assistant_id in the request, so there
      // is nothing to register server-side before navigating.
      setActiveAvatar(selectedAvatar);

      // build context for the conversation
      const context = {
        user_ctx: {
          user_id: user.id,
          name: user.name || '',
          description: user.description || '',
          metadata: user.metadata || {},
        },
        assistant_ctx: {
          assistant_id: avatarId,
          user_id: user.id,
          name: selectedAvatar?.name || '',
          description: selectedAvatar?.description || '',
          metadata: selectedAvatar?.metadata || {},
        },
      };

      setContext(context);

      // Start with no conversation: the chat screen picks the newest thread for
      // this avatar once it has listed them. (There is no recorded "active
      // conversation" on an avatar — nothing server-side ever writes one.)
      setActiveConversation(null);

      navigate(`/chat/${avatarId}`); // ← ROUTE TO CHAT AREA
    } else if (actualCardData.type === 'create') {
      setShowCreateModal(true);
    }
  };

  // https://claude.ai/chat/8e125e85-be01-4541-a4f4-da3590f996c1
  // Each avatar's neutral idle loop, when its emotion media has been
  // generated. Loaded once per avatar through the shared manifest cache; a
  // card without one shows its portrait, exactly as before.
  const [neutralLoopsById, setNeutralLoopsById] = useState({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        (userAvatars ?? []).map(async (avatar) => {
          const assistantId = avatar.assistant_id ?? avatar.avatar_id;
          const manifest = await loadEmotionMedia(assistantId);
          return [assistantId, idleLoopFor(manifest, 'neutral')];
        })
      );
      if (!cancelled) {
        setNeutralLoopsById(
          Object.fromEntries(entries.filter(([, loopUrl]) => Boolean(loopUrl)))
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userAvatars]);

  const authenticatedCards = useMemo(() => {
    const avatarCards =
      userAvatars?.map((avatar) => {
        const assistantId = avatar.assistant_id ?? avatar.avatar_id;
        const iconSource = avatarIconsById[assistantId];
        return {
          id: assistantId,
          component: (
            <AvatarCardComponent
              avatar={avatar}
              iconSource={iconSource}
              onCardClick={handleClick}
            />
          ),
          type: 'avatar',
          text: avatar.name,
          image: iconSource && isValidImageUrl(iconSource) ? iconSource : null,
          video: neutralLoopsById[assistantId] ?? null,
          avatar_data: avatar,
        };
      }) || [];

    avatarCards.push({
      id: 'create-avatar',
      component: <CreateAvatarComponent onCardClick={handleClick} />,
      type: 'create',
      text: 'Create Avatar',
      image: null,
    });

    return avatarCards;
  }, [userAvatars, avatarIconsById, neutralLoopsById]);

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

  // Re-read the avatar list from the API every time this screen opens.
  //
  // The list in context is written at sign-in and after a create, so anything
  // that changes it elsewhere — deleting an avatar, a change made in another
  // tab — used to leave this screen showing avatars the server no longer has.
  // This screen is the one place the whole list is displayed, so it is the
  // right place to insist on server truth rather than trusting what an earlier
  // screen happened to leave in memory.
  useEffect(() => {
    if (!user) {
      return;
    }
    let isCurrentRequest = true;
    // Only show the loading state when there is nothing to look at yet.
    // Re-entering the screen with avatars already in hand should not throw a
    // panel over a gallery the user can already see and use.
    setIsLoadingAvatars((userAvatars ?? []).length === 0);
    (async () => {
      try {
        const freshAvatars = await listUserAvatars();
        if (isCurrentRequest && !describesTheSameAvatars(freshAvatars, userAvatars)) {
          setUserAvatars(freshAvatars ?? []);
        }
      } catch (listError) {
        // Keep whatever is already on screen; a transient list failure should
        // not empty the gallery of a user who is simply offline for a moment.
        console.error('Refreshing the avatar list failed:', listError);
      } finally {
        if (isCurrentRequest) {
          setIsLoadingAvatars(false);
        }
      }
    })();
    return () => {
      isCurrentRequest = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, setUserAvatars]);

  useEffect(() => {
    // SET AVATAR CARD INDEX TO LAST USED AVATAR
    let targetIndex = localStorage.getItem('current_card_index');
    if (!targetIndex) {
      let targetIndex = 0;
      localStorage.setItem('current_card_index', targetIndex);
    }
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


  useEffect(() => {
    const handleClickOutside = (e) => {
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
        id: avatar.assistant_id ?? avatar.avatar_id,
        type: 'avatar',
        text: avatar.name,
        image: avatarIconsById[avatar.assistant_id ?? avatar.avatar_id] ?? null,
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
        id: avatar.assistant_id ?? avatar.avatar_id,
        type: 'avatar',
        text: avatar.name,
        image: avatarIconsById[avatar.assistant_id ?? avatar.avatar_id] ?? null,
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

  /**
   * Act on a suggestion picked out of the search dropdown.
   *
   * Picking an avatar by name IS choosing it: the search box exists to reach an
   * avatar without scrolling the gallery to it, and stopping at "the gallery is
   * now pointed at it" made the search the slower of the two ways in — the user
   * still had to find and press the card the search had just located. So the
   * card's own action is run, exactly as if it had been clicked in the gallery:
   * an avatar opens its chat, and the Create Avatar entry opens the create
   * dialog.
   *
   * The gallery is still moved first. Navigation unmounts this screen, but
   * coming back to it should find the gallery where the user left it, on the
   * avatar they chose, rather than back where it was before they searched.
   *
   * @param {number} index Position in `authenticatedCards`, carried on the
   *   suggestion as `originalIndex`.
   */
  const handleSuggestionSelect = (index) => {
    const selectedCard = authenticatedCards[index];
    setCurrentCardIndex(index);
    if (galleryRef.current) {
      galleryRef.current.setCurrentIndex(index);
    }
    setSearchQuery(selectedCard?.text || '');
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    if (selectedCard) {
      handleClick(selectedCard);
    }
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
      {isLoadingAvatars && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 px-8 py-6 flex flex-col items-center gap-4">
            <LoadingSpinner />
            <p className="text-white/80">Loading your avatars…</p>
          </div>
        </div>
      )}
      <div className="w-full h-screen overflow-hidden flex flex-col items-center gap-2">
        <div className="relative w-full max-w-md mt-8 mb-2" ref={searchRef}>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            onFocus={handleSearchFocus}
            onKeyDown={handleKeyDown}
            placeholder="Search avatars…"
            className="w-full bg-black/60 rounded-lg border border-white/10 py-2 pl-10 pr-4 text-neutral-200 placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/80" />
          {isDropdownOpen && suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-black/50 rounded-lg border border-white/10 mt-1 max-h-60 overflow-auto">
              {suggestions.map((suggestion, idx) => (
                <li
                  key={suggestion.id}
                  onClick={() =>
                    handleSuggestionSelect(suggestion.originalIndex)
                  }
                  className={`px-4 py-2 text-neutral-200 cursor-pointer ${
                    idx === highlightedIndex
                      ? 'bg-white/10'
                      : 'hover:bg-white/10'
                  }`}
                >
                  {suggestion.text}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="h-full flex flex-col min-h-0 w-full mb-2 relative">
          {/* The gallery is WebGL, so the Create Avatar entry it draws is a
              flat texture. When that entry is the one in front, a real card
              is laid over it at the same size — the gallery draws each card
              60% of its height tall and square — so the pixel shimmer and
              the click land on a live element. */}
          {authenticatedCards.some((card) => card.type === 'create') && (
            <div
              ref={createCardOverlayRef}
              className="absolute left-1/2 top-1/2 h-[60%] aspect-square z-10"
              style={{
                transform: 'translate(-50%, -50%)',
                visibility: 'hidden',
              }}
            >
              <CreateAvatarComponent onCardClick={handleClick} />
            </div>
          )}
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
            onCreateCardMove={handleCreateCardMove}
          />
        </div>
        <div className="flex flex-col items-center w-full gap-2 z-10">
          {/* <button
              onClick={handleCustomizeAvatar}
              className="bg-black/50 rounded-lg border border-white/10 py-2 px-4 text-neutral-200 hover:bg-white/10 transition-all duration-300 flex items-center gap-2"
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
                  : 'text-white/50 hover:text-neutral-100 hover:bg-white/10 cursor-pointer'
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
                        ? 'border-neutral-300'
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
                      <div className="w-full h-full flex items-center justify-center bg-black/50 rounded-full">
                        <CirclePlus className="w-5 h-5 text-neutral-200" />
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
                      <div className="w-full h-full flex items-center justify-center bg-black/50 rounded-full">
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
                  : 'text-white/50 hover:text-neutral-100 hover:bg-white/10 cursor-pointer'
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
          <div className="mb-8 w-full flex flex-col items-center gap-2">
            {/* The gallery is already on screen here, so the leading entry goes
                to the settings of the avatar that depicts the user instead. */}
            <UserSettingsMenu leadingAction="personalAvatar" />
            <div className="relative w-48">
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
                  className="px-4 py-2 bg-neutral-200 text-neutral-900 rounded"
                >
                  Test Promise Toast
                </button>
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
