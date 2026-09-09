import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CircularGallery from './CircularGallery';
import { idleLoopFor, loadEmotionMedia } from '../hooks/useEmotionMedia';
import { useAvatarFaceSourceRevision } from '../hooks/useAvatarFaceSource';
import {
  galleryIdleLoopUrl,
  showsGeneratedFace,
} from '../config/avatarFaceSource';
import {
  Search,
  CirclePlus,
  EyeOff,
  Inbox,
  Settings,
  Plus,
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
import {
  avatarsWithPersonalFirst,
  startingCarouselIndex,
} from '../services/avatarListOrder';
import {
  avatarsOnCarousel,
  canHideAvatarOnCarousel,
  carouselAvatarId,
  carouselCompanionAction,
  clampCarouselIndex,
  hideAvatarOnCarousel,
  readHiddenCarouselAvatarIds,
  showAvatarOnCarousel,
  writeHiddenCarouselAvatarIds,
} from '../services/avatarCarouselMembership';
import { buildAvatarSearchSuggestions } from './avatarSearchSuggestions';
import { avatarSettingsPath } from './createdAvatarSettings';
import { personalAvatarWorkspacePath } from './personalAvatarWorkspace';
import useInboxCount from '../hooks/useInboxCount';

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
  const faceSourceRevision = useAvatarFaceSourceRevision();
  const inboxCount = useInboxCount();
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
  const cardActionsRef = useRef(null);
  const createCardIsFrontRef = useRef(false);
  const [createCardIsFront, setCreateCardIsFront] = useState(false);
  const handleCreateCardMove = useCallback(({ x, frontX, visible, isFront }) => {
    const overlay = createCardOverlayRef.current;
    if (overlay) {
      overlay.style.transform = `translate(calc(-50% + ${x}px), -50%)`;
      overlay.style.visibility = visible ? 'visible' : 'hidden';
    }
    const createIsFront = Boolean(isFront);
    const actions = cardActionsRef.current;
    if (actions) {
      const underFrontCard = Number.isFinite(frontX) ? frontX : 0;
      actions.style.transform = `translateX(calc(-50% + ${underFrontCard}px))`;
      actions.style.visibility = createIsFront ? 'hidden' : '';
      actions.style.pointerEvents = createIsFront ? 'none' : '';
    }
    if (createCardIsFrontRef.current !== createIsFront) {
      createCardIsFrontRef.current = createIsFront;
      setCreateCardIsFront(createIsFront);
    }
  }, []);
  const handleGalleryIndexChange = useCallback((index) => {
    setCurrentCardIndex(index);
    try {
      localStorage.setItem('current_card_index', String(index));
    } catch {
      // quota or private mode — the strip still follows the live index
    }
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
  const [hiddenCarouselIds, setHiddenCarouselIds] = useState([]);

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
          card.id === carouselAvatarId(cardData.avatar_data) ||
          (cardData.text && card.text === cardData.text)
      );
      if (matchingCard) actualCardData = matchingCard;
    }

    if (actualCardData.type === 'avatar') {
      const avatarId =
        carouselAvatarId(actualCardData.avatar_data) ||
        carouselAvatarId(
          carouselAvatars.find((avatar) => avatar.name === actualCardData.text)
        );
      if (!avatarId) {
        toast.error('Avatar ID not found');
        return;
      }

      const avatarIndex = carouselAvatars.findIndex(
        (avatar) => carouselAvatarId(avatar) === avatarId
      );

      if (avatarIndex >= 0) {
        setCurrentCardIndex(avatarIndex);
        if (galleryRef.current) {
          galleryRef.current.setCurrentIndex(avatarIndex);
        }
        localStorage.setItem('last_used_avatar_index', avatarIndex);
      }
      localStorage.setItem('last_used_avatar_id', avatarId);

      const selectedAvatar =
        carouselAvatars.find((avatar) => carouselAvatarId(avatar) === avatarId) ??
        orderedAvatars.find((avatar) => carouselAvatarId(avatar) === avatarId);

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

  // Each avatar's neutral idle loop, when its emotion media has been
  // generated. Loaded once per avatar through the shared manifest cache.
  // The still and the loop are handed to the gallery in the same items
  // update, so a card never paints the portrait and then pops the video in.
  const [neutralLoopsById, setNeutralLoopsById] = useState({});
  const [loopLookupDone, setLoopLookupDone] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoopLookupDone(false);
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
        setLoopLookupDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userAvatars]);

  const orderedAvatars = useMemo(
    () => avatarsWithPersonalFirst(userAvatars),
    [userAvatars]
  );
  const carouselAvatars = useMemo(
    () => avatarsOnCarousel(orderedAvatars, hiddenCarouselIds),
    [orderedAvatars, hiddenCarouselIds]
  );

  const authenticatedCards = useMemo(() => {
    const avatarCards =
      carouselAvatars.map((avatar) => {
        const assistantId = avatar.assistant_id ?? avatar.avatar_id;
        const iconSource = avatarIconsById[assistantId];
        const showGenerated = showsGeneratedFace(assistantId);
        const pairReady = !showGenerated || loopLookupDone;
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
          image:
            pairReady && iconSource && isValidImageUrl(iconSource)
              ? iconSource
              : null,
          video: pairReady
            ? galleryIdleLoopUrl(neutralLoopsById[assistantId], showGenerated)
            : null,
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
  }, [
    carouselAvatars,
    avatarIconsById,
    neutralLoopsById,
    loopLookupDone,
    faceSourceRevision,
  ]);

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
    if (!user?.id) {
      setHiddenCarouselIds([]);
      return;
    }
    setHiddenCarouselIds(readHiddenCarouselAvatarIds(user.id));
  }, [user?.id]);

  useEffect(() => {
    if (hasInitialized.current || !carouselAvatars.length) return;
    const targetIndex = startingCarouselIndex(carouselAvatars);
    setCurrentCardIndex(targetIndex);
    galleryRef.current?.setCurrentIndex(targetIndex, false);
    hasInitialized.current = true;
  }, [user, carouselAvatars]);

  useEffect(() => {
    setCurrentCardIndex((current) =>
      clampCarouselIndex(current, authenticatedCards.length)
    );
  }, [authenticatedCards.length]);


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
    const selectedCard = authenticatedCards[index];
    setCurrentCardIndex(index);
    localStorage.setItem('current_card_index', String(index));
    if (galleryRef.current) {
      galleryRef.current.setCurrentIndex(index);
    }
    if (selectedCard) {
      handleClick(selectedCard);
    }
  };

  const handleJumpLeft = () => {
    const newIndex = Math.max(0, currentCardIndex - 5);
    setCurrentCardIndex(newIndex);
    localStorage.setItem('current_card_index', String(newIndex));
    galleryRef.current?.setCurrentIndex(newIndex);
  };

  const handleJumpRight = () => {
    const newIndex = Math.min(
      authenticatedCards.length - 1,
      currentCardIndex + 5
    );
    setCurrentCardIndex(newIndex);
    localStorage.setItem('current_card_index', String(newIndex));
    galleryRef.current?.setCurrentIndex(newIndex);
  };

  const getVisibleDots = () => {
    const total = authenticatedCards.length;
    const visibleCount = 5;
    const halfVisible = Math.floor(visibleCount / 2);

    let start = currentCardIndex - halfVisible;
    let end = currentCardIndex + halfVisible;

    if (start < 0) {
      end = Math.min(total - 1, end + Math.abs(start));
      start = 0;
    }
    if (end >= total) {
      start = Math.max(0, start - (end - total + 1));
      end = total - 1;
    }

    return authenticatedCards.slice(start, end + 1).map((card, idx) => ({
      ...card,
      originalIndex: start + idx,
    }));
  };

  const listSearchSuggestions = (query, hiddenIds = hiddenCarouselIds) =>
    buildAvatarSearchSuggestions({
      avatars: orderedAvatars,
      query,
      hiddenIds,
      iconsById: avatarIconsById,
    });

  const persistHiddenCarouselIds = (hiddenIds) => {
    setHiddenCarouselIds(hiddenIds);
    writeHiddenCarouselAvatarIds(user?.id, hiddenIds);
    if (isDropdownOpen) {
      setSuggestions(listSearchSuggestions(searchQuery, hiddenIds));
    }
    return hiddenIds;
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setHighlightedIndex(-1);
    setSuggestions(listSearchSuggestions(value));
    setIsDropdownOpen(true);
  };

  const handleSearchFocus = () => {
    setSuggestions(listSearchSuggestions(searchQuery));
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
   * @param {Object} suggestion A row from {@link buildAvatarSearchSuggestions}.
   */
  const handleSuggestionSelect = (suggestion) => {
    if (suggestion?.type === 'avatar' && suggestion.originalIndex < 0) {
      setSearchQuery(suggestion.text || '');
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
      handleClick({
        type: 'avatar',
        text: suggestion.text,
        avatar_data: suggestion.avatar,
      });
      return;
    }

    const index = suggestion?.originalIndex;
    const selectedCard = authenticatedCards[index];
    if (typeof index === 'number' && index >= 0) {
      setCurrentCardIndex(index);
      if (galleryRef.current) {
        galleryRef.current.setCurrentIndex(index);
      }
    }
    setSearchQuery(selectedCard?.text || suggestion?.text || '');
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    if (selectedCard) {
      handleClick(selectedCard);
    }
  };

  const handleAddAvatarToCarousel = (avatar) => {
    const assistantId = carouselAvatarId(avatar);
    if (!assistantId) return;
    const nextHidden = persistHiddenCarouselIds(
      showAvatarOnCarousel(assistantId, hiddenCarouselIds)
    );
    const nextCards = avatarsOnCarousel(orderedAvatars, nextHidden);
    const nextIndex = nextCards.findIndex(
      (card) => carouselAvatarId(card) === assistantId
    );
    if (nextIndex >= 0) {
      setCurrentCardIndex(nextIndex);
      galleryRef.current?.setCurrentIndex(nextIndex);
    }
  };

  const handleHideAvatarFromCarousel = (avatar) => {
    if (!canHideAvatarOnCarousel(avatar)) return;
    const assistantId = carouselAvatarId(avatar);
    if (!assistantId) return;
    const nextHidden = hideAvatarOnCarousel(avatar, hiddenCarouselIds);
    persistHiddenCarouselIds(nextHidden);
    const nextCount = avatarsOnCarousel(orderedAvatars, nextHidden).length + 1;
    const nextIndex = clampCarouselIndex(currentCardIndex, nextCount);
    setCurrentCardIndex(nextIndex);
    galleryRef.current?.setCurrentIndex(nextIndex);
    try {
      localStorage.setItem('current_card_index', String(nextIndex));
    } catch {
      // quota or private mode — the strip still follows the live index
    }
  };

  const handleHideFrontAvatar = () => {
    const frontCard = authenticatedCards[currentCardIndex];
    if (frontCard?.type !== 'avatar') return;
    handleHideAvatarFromCarousel(frontCard.avatar_data);
  };

  const handleOpenAvatarSettings = (avatar) => {
    const selectedAvatar =
      avatar && typeof avatar === 'object'
        ? avatar
        : orderedAvatars.find(
            (candidate) => carouselAvatarId(candidate) === carouselAvatarId(avatar)
          );
    const settingsPath = avatarSettingsPath(selectedAvatar ?? avatar);
    if (!settingsPath) {
      toast.error('Avatar settings are not available.');
      return;
    }
    if (selectedAvatar?.metadata?.user_id) {
      setActiveAvatar(selectedAvatar);
    }
    navigate(settingsPath);
  };

  const handleOpenFrontAvatarSettings = () => {
    const frontCard = authenticatedCards[currentCardIndex];
    if (frontCard?.type !== 'avatar') return;
    handleOpenAvatarSettings(frontCard.avatar_data ?? frontCard.id);
  };

  const handleOpenFrontAvatarInbox = () => {
    const frontCard = authenticatedCards[currentCardIndex];
    const avatar = frontCard?.avatar_data;
    if (carouselCompanionAction(avatar) !== 'inbox') return;
    const inboxPath = personalAvatarWorkspacePath(
      carouselAvatarId(avatar),
      'inbox'
    );
    if (!inboxPath) {
      toast.error('Inbox is not available.');
      return;
    }
    if (avatar?.metadata?.user_id) {
      setActiveAvatar(avatar);
    }
    navigate(inboxPath);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && suggestions.length > 0 && highlightedIndex >= 0) {
      handleSuggestionSelect(suggestions[highlightedIndex]);
    } else if (e.key === 'Enter' && suggestions.length > 0) {
      handleSuggestionSelect(suggestions[0]);
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

  const frontCompanionAction = carouselCompanionAction(
    authenticatedCards[currentCardIndex]?.avatar_data
  );

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
            <ul className="absolute z-30 w-full bg-black/50 rounded-lg border border-white/10 mt-1 max-h-60 overflow-auto">
              {suggestions.map((suggestion, idx) => (
                <li
                  key={suggestion.id}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  className={`px-4 py-2 text-neutral-200 cursor-pointer flex items-center gap-2 ${
                    idx === highlightedIndex
                      ? 'bg-white/10'
                      : 'hover:bg-white/10'
                  }`}
                >
                  <span className="flex-grow min-w-0 truncate">
                    {suggestion.text}
                  </span>
                  {suggestion.canAddToCarousel && (
                    <button
                      type="button"
                      data-search-add-avatar
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        handleAddAvatarToCarousel(suggestion.avatar);
                      }}
                      className="shrink-0 p-1 rounded-md text-white/40 hover:text-neutral-100 hover:bg-white/10"
                      aria-label={`Add ${suggestion.text} to the carousel`}
                      title={`Add ${suggestion.text} to the carousel`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
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
              <CreateAvatarComponent
                onCardClick={handleClick}
                active={authenticatedCards[currentCardIndex]?.type === 'create'}
              />
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
            onIndexChange={handleGalleryIndexChange}
            onCreateCardMove={handleCreateCardMove}
          />
          {authenticatedCards[currentCardIndex]?.type === 'avatar' &&
            !createCardIsFront && (
            <div
              ref={cardActionsRef}
              className="absolute left-1/2 z-20 flex items-center gap-3 pointer-events-none"
              style={{
                top: 'calc(50% + 30% + 0.35rem)',
                transform: 'translateX(-50%)',
              }}
              data-carousel-card-actions
            >
              {frontCompanionAction === 'hide' ? (
                <button
                  type="button"
                  data-carousel-hide-avatar
                  onMouseDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                  onClick={handleHideFrontAvatar}
                  className="pointer-events-auto p-1.5 rounded-md text-white/40 hover:text-neutral-100 hover:bg-white/10 transition-colors"
                  aria-label="Hide avatar from the carousel"
                  title="Hide avatar from the carousel"
                >
                  <EyeOff className="w-5 h-5" />
                </button>
              ) : frontCompanionAction === 'inbox' ? (
                <button
                  type="button"
                  data-carousel-avatar-inbox
                  onMouseDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                  onClick={handleOpenFrontAvatarInbox}
                  className="pointer-events-auto relative p-1.5 rounded-md text-white/40 hover:text-neutral-100 hover:bg-white/10 transition-colors"
                  aria-label="Open avatar inbox"
                  title="Open avatar inbox"
                >
                  <Inbox className="w-5 h-5" />
                  {inboxCount > 0 && (
                    <span
                      aria-label={`${inboxCount} items waiting`}
                      className="absolute -top-0.5 -right-0.5 min-w-[0.875rem] h-3.5 px-0.5 rounded-full bg-amber-400 text-neutral-900 text-[9px] font-semibold flex items-center justify-center"
                    >
                      {inboxCount > 9 ? '9+' : inboxCount}
                    </span>
                  )}
                </button>
              ) : null}
              <button
                type="button"
                data-carousel-avatar-settings
                onMouseDown={(event) => event.stopPropagation()}
                onTouchStart={(event) => event.stopPropagation()}
                onClick={handleOpenFrontAvatarSettings}
                className="pointer-events-auto p-1.5 rounded-md text-white/40 hover:text-neutral-100 hover:bg-white/10 transition-colors"
                aria-label="Open avatar settings"
                title="Open avatar settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          )}
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
          <div
            className="flex gap-2 justify-center items-center"
            data-avatar-picker
          >
            <button
              type="button"
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

            <div
              className="flex gap-2 items-center justify-center"
              style={{ minWidth: '200px', minHeight: '40px' }}
            >
              {getVisibleDots().map((card) => {
                const isCreateAvatar = card.type === 'create';
                const isSelected = currentCardIndex === card.originalIndex;
                const distance = Math.abs(
                  currentCardIndex - card.originalIndex
                );
                const scale = Math.max(0.4, 1 - distance * 0.2);

                return (
                  <button
                    key={card.originalIndex}
                    type="button"
                    data-avatar-dot
                    onClick={() => handleDotClick(card.originalIndex)}
                    className={`rounded-full shrink-0 overflow-hidden border-2 transition-transform duration-300 hover:scale-110 ${
                      isSelected
                        ? 'border-neutral-300'
                        : 'border-white/30 hover:border-white/60'
                    }`}
                    style={{
                      transform: `scale(${scale})`,
                      width: '32px',
                      height: '32px',
                    }}
                    aria-label={`Open ${card.text}`}
                    aria-current={isSelected ? 'true' : undefined}
                  >
                    {isCreateAvatar ? (
                      <span className="w-full h-full flex items-center justify-center bg-black/50 rounded-full">
                        <CirclePlus className="w-5 h-5 text-neutral-200" />
                      </span>
                    ) : card.image && isValidImageUrl(card.image) ? (
                      <img
                        src={card.image}
                        alt=""
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center bg-black/50 rounded-full">
                        <User className="w-4 h-4 text-white/50" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
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
