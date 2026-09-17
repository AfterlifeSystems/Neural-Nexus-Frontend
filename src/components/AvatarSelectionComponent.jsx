import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CircularGallery from './CircularGallery';
import {
  cachedIdleLoopUrl,
  idleLoopFor,
  loadEmotionMedia,
} from '../hooks/useEmotionMedia';
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
  UserPlus,
} from 'lucide-react';
import { FiCircle } from 'react-icons/fi';
import CreateAvatarComponent from './CreateAvatarComponent';
import ProfileBubbleImage from './ProfileBubbleImage';
import CreateAvatarModal from './CreateAvatarModal';
import AvatarCardComponent from './AvatarCardComponent';
import LoadingSpinner from './LoadingSpinner';
import {
  readCachedAvatarIcons,
  writeCachedAvatarIcon,
  forgetCachedAvatarIcon,
  forgetCachedAvatarIconsExcept,
  resolveAssistantId,
  isAvatarOwnedByUser,
  canShareAvatar,
} from './utils';
import AvatarWorkspaceHeader from './AvatarWorkspaceHeader';
import { seedOpenedAvatarPortraitWell } from './openedAvatarPortraitWell';
import {
  getAvatarReferenceImage,
  listUserAvatars,
} from '../services/avatarService';
import { mayKeepAdultOnlyAvatarOnGallery } from '../services/adultOnlyAvatar';
import { isAdminAccount } from '../config/adminAccount';
import {
  avatarsWithPersonalFirst,
  startingCarouselIndex,
} from '../services/avatarListOrder';
import { rememberImageViewportsFromAvatars } from '../services/avatarImageViewport';
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
import {
  avatarWorkspacePath,
  createAvatarOverlayVisibility,
  isAvatarSelectionLocation,
  personalAvatarWorkspacePath,
} from './personalAvatarWorkspace';
import {
  assistantIdFromSelectionCard,
  setGalleryFocusedAssistantId,
} from '../services/worldBackgroundFocus';
import useInboxCount from '../hooks/useInboxCount';
import {
  galleryBoxIsPainted,
  galleryCardExpectsPortraitLoop,
  galleryCardLayout,
  galleryFrameHeight,
} from './galleryScrollIndex';
import {
  GALLERY_CAROUSEL_INTENT_CHAT,
  GALLERY_CAROUSEL_INTENT_NEXT,
  GALLERY_CAROUSEL_INTENT_PREVIOUS,
  GALLERY_CAROUSEL_INTENT_SELECT,
  GALLERY_CAROUSEL_INTENT_SETTINGS,
  galleryCarouselKeyIntent,
} from './galleryCarouselKeyboard';

function elementOuterHeight(element) {
  if (!element) return 0;
  const style = window.getComputedStyle(element);
  return (
    element.offsetHeight +
    (Number.parseFloat(style.marginTop) || 0) +
    (Number.parseFloat(style.marginBottom) || 0)
  );
}

/**
 * Gallery-relevant fields for one avatar record.
 *
 * Full-record JSON equality is too strict for the gallery open refresh: the
 * list endpoint often returns the same 26 avatars with volatile nested fields
 * (research progress, timestamps) that do not change which faces are shown.
 * Replacing context for those mismatches re-ran portrait revalidation for every
 * avatar — including multi-megabyte data URIs — and made settings→gallery
 * navigation feel stalled.
 *
 * @param {object|null|undefined} avatar
 * @returns {object}
 */
function galleryAvatarListIdentity(avatar) {
  const metadata = avatar?.metadata ?? {};
  return {
    id: avatar?.assistant_id ?? avatar?.avatar_id ?? '',
    name: avatar?.name ?? '',
    description: avatar?.description ?? '',
    is_public: Boolean(avatar?.is_public ?? metadata.is_public),
    adult_only: Boolean(avatar?.adult_only ?? metadata.adult_only),
    is_personal: Boolean(metadata.is_personal_avatar_of_creator),
    user_id: metadata.user_id ?? '',
  };
}

/**
 * Whether two avatar lists say the same thing for the gallery.
 *
 * The gallery is a WebGL scene that CircularGallery rebuilds from scratch
 * whenever the identity of its `items` array changes, and a rebuild shows as a
 * black frame before the cards are drawn again. Handing it a freshly parsed
 * copy of a list it is already displaying therefore costs a visible flash and
 * buys nothing, so the refresh below replaces the list only when gallery-
 * relevant fields disagree with what is on screen.
 *
 * @param {Array} freshAvatars The list just read from the API.
 * @param {Array} displayedAvatars The list the gallery is currently showing.
 * @returns {boolean} True when replacing one with the other would change nothing.
 */
function describesTheSameAvatars(freshAvatars, displayedAvatars) {
  const freshIdentity = (freshAvatars ?? []).map(galleryAvatarListIdentity);
  const displayedIdentity = (displayedAvatars ?? []).map(
    galleryAvatarListIdentity
  );
  return JSON.stringify(freshIdentity) === JSON.stringify(displayedIdentity);
}

const AvatarSelectionComponent = ({}) => {
  const {
    user,
    userAvatars,
    setUserAvatars,
    setActiveAvatar,
    setContext,
    activeAvatar,
    ageVerified,
  } = useAuth();

  const faceSourceRevision = useAvatarFaceSourceRevision();
  const inboxCount = useInboxCount();
  const navigate = useNavigate();
  const location = useLocation();
  const galleryIsOpen = isAvatarSelectionLocation(location.pathname);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [userSettingsMenuOpen, setUserSettingsMenuOpen] = useState(false);
  const galleryRef = useRef(null);
  // The live Create Avatar card laid over the WebGL gallery. The gallery
  // reports the slot's position every frame; writing the transform straight
  // onto the element keeps the card glued to the slot without a React render
  // per frame.
  const createCardOverlayRef = useRef(null);
  const cardActionsRef = useRef(null);
  const galleryColumnRef = useRef(null);
  const galleryRegionRef = useRef(null);
  const galleryStageRef = useRef(null);
  const galleryFrameRef = useRef(null);
  const galleryFooterRef = useRef(null);
  const searchRef = useRef(null);
  const createCardIsFrontRef = useRef(false);
  const [createCardIsFront, setCreateCardIsFront] = useState(false);
  const applyGalleryCardChrome = useCallback((cardPixelSize) => {
    if (!(Number.isFinite(cardPixelSize) && cardPixelSize > 0)) return;
    const overlay = createCardOverlayRef.current;
    if (overlay) {
      overlay.style.width = `${cardPixelSize}px`;
      overlay.style.height = `${cardPixelSize}px`;
    }
    const actions = cardActionsRef.current;
    if (actions) {
      actions.style.top = `calc(50% + ${cardPixelSize / 2}px + 0.35rem)`;
    }
  }, []);
  useEffect(() => {
    const column = galleryColumnRef.current;
    const region = galleryRegionRef.current;
    const stage = galleryStageRef.current;
    const frame = galleryFrameRef.current;
    const search = searchRef.current;
    const footer = galleryFooterRef.current;
    if (
      !galleryIsOpen ||
      !column ||
      !region ||
      !stage ||
      !frame ||
      typeof ResizeObserver !== 'function'
    ) {
      return undefined;
    }
    const applyFromColumn = () => {
      const stageStyle = window.getComputedStyle(stage);
      const stageGap =
        Number.parseFloat(stageStyle.rowGap || stageStyle.gap || '0') || 0;
      const stagePad =
        (Number.parseFloat(stageStyle.paddingTop) || 0) +
        (Number.parseFloat(stageStyle.paddingBottom) || 0);
      const available = Math.max(
        region.clientHeight -
          elementOuterHeight(footer) -
          stageGap -
          stagePad,
        0
      );
      const width = frame.clientWidth || stage.clientWidth || column.clientWidth;
      // Wait for a real layout. The stage must stay shrink-0 and hug the
      // frame. Locking flex-grow off on a flex-1 stage (basis 0% + min-h-0)
      // collapses the glass card to a horizontal line.
      if (!galleryBoxIsPainted(width, available)) return false;
      const height = galleryFrameHeight(width, available);
      const nextHeight = `${height}px`;
      // flex-1 is `flex-basis: 0%`. Turning off grow/shrink without a
      // basis leaves a 0-tall frame: the Create overlay still paints
      // from its pixel size, the WebGL discs do not.
      if (
        frame.style.height !== nextHeight ||
        frame.style.flexBasis !== nextHeight
      ) {
        frame.style.flexGrow = '0';
        frame.style.flexShrink = '0';
        frame.style.flexBasis = nextHeight;
        frame.style.height = nextHeight;
      }
      applyGalleryCardChrome(galleryCardLayout(width, height).pixelSize);
      return true;
    };
    let measureFrame = 0;
    const measureUntilPainted = (attemptsLeft) => {
      if (applyFromColumn() || attemptsLeft <= 0) return;
      measureFrame = window.requestAnimationFrame(() =>
        measureUntilPainted(attemptsLeft - 1)
      );
    };
    measureUntilPainted(12);
    const observer = new ResizeObserver(applyFromColumn);
    observer.observe(column);
    observer.observe(region);
    observer.observe(stage);
    observer.observe(frame);
    if (search) observer.observe(search);
    if (footer) observer.observe(footer);
    return () => {
      window.cancelAnimationFrame(measureFrame);
      observer.disconnect();
    };
  }, [applyGalleryCardChrome, galleryIsOpen]);
  const handleCreateCardMove = useCallback(
    ({ x, frontX, visible, isFront, cardPixelSize }) => {
      const overlay = createCardOverlayRef.current;
      if (overlay) {
        overlay.style.transform = `translate(calc(-50% + ${x}px), -50%)`;
        overlay.style.visibility = createAvatarOverlayVisibility(
          galleryIsOpen,
          visible
        );
      }
      applyGalleryCardChrome(cardPixelSize);
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
    },
    [applyGalleryCardChrome, galleryIsOpen]
  );
  useEffect(() => {
    const overlay = createCardOverlayRef.current;
    if (!overlay) return;
    if (galleryIsOpen) return;
    overlay.style.visibility = createAvatarOverlayVisibility(false, false);
  }, [galleryIsOpen]);
  const handleGalleryIndexChange = useCallback((index) => {
    setCurrentCardIndex(index);
    try {
      localStorage.setItem('current_card_index', String(index));
    } catch {
      // quota or private mode — the strip still follows the live index
    }
  }, []);
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
    rememberImageViewportsFromAvatars(userAvatars);
    // Production profiles keep portraits for avatars that no longer exist.
    // Those leftovers are what fill the origin quota on neuralnexus.site.
    forgetCachedAvatarIconsExcept(
      userAvatars.map((avatar) => resolveAssistantId(avatar)).filter(Boolean)
    );
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
          setAvatarIconsById((previousIcons) => {
            const iconUnchanged = previousIcons[assistantId] === iconSource;
            return iconUnchanged
              ? previousIcons
              : { ...previousIcons, [assistantId]: iconSource };
          });
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
        carouselAvatars.find(
          (avatar) => carouselAvatarId(avatar) === avatarId
        ) ??
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
      seedOpenedAvatarPortraitWell(avatarId);

      navigate(`/chat/${avatarId}`); // ← ROUTE TO CHAT AREA
    } else if (actualCardData.type === 'create') {
      setShowCreateModal(true);
    }
  };

  // Each avatar's neutral idle loop, when its emotion media has been
  // generated. A missing key means the manifest has not arrived yet; `null`
  // means this avatar has no loop. Generated cards keep the 9:16 window
  // until a clip URL is known, so the circular still never paints first.
  const [neutralLoopsById, setNeutralLoopsById] = useState(() => {
    const seeded = {};
    for (const avatar of userAvatars ?? []) {
      const assistantId = avatar.assistant_id ?? avatar.avatar_id;
      const loopUrl = cachedIdleLoopUrl(assistantId, 'neutral');
      if (loopUrl === undefined) continue;
      seeded[assistantId] = loopUrl;
    }
    return seeded;
  });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all(
        (userAvatars ?? []).map(async (avatar) => {
          const assistantId = avatar.assistant_id ?? avatar.avatar_id;
          const manifest = await loadEmotionMedia(assistantId);
          if (cancelled) return;
          const loopUrl = idleLoopFor(manifest, 'neutral') || null;
          setNeutralLoopsById((current) => {
            if (assistantId in current && current[assistantId] === loopUrl) {
              return current;
            }
            return { ...current, [assistantId]: loopUrl };
          });
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [userAvatars]);

  const galleryAvatars = useMemo(
    () =>
      (userAvatars ?? []).filter((avatar) =>
        mayKeepAdultOnlyAvatarOnGallery(avatar, {
          ageVerified,
          isAdmin: isAdminAccount(user),
          viewerUserId: user?.id,
        })
      ),
    [userAvatars, ageVerified, user]
  );
  const orderedAvatars = useMemo(
    () => avatarsWithPersonalFirst(galleryAvatars),
    [galleryAvatars]
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
        const loopUrl = galleryIdleLoopUrl(
          neutralLoopsById[assistantId],
          showGenerated
        );
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
            iconSource && isValidImageUrl(iconSource)
              ? iconSource
              : null,
          video: loopUrl,
          portraitLoop: galleryCardExpectsPortraitLoop({
            showGenerated,
            loopUrl,
            loopLookupSettled: assistantId in neutralLoopsById,
          }),
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
    faceSourceRevision,
  ]);

  useEffect(() => {
    setGalleryFocusedAssistantId(
      assistantIdFromSelectionCard(authenticatedCards[currentCardIndex])
    );
  }, [authenticatedCards, currentCardIndex]);

  useEffect(
    () => () => {
      setGalleryFocusedAssistantId(null);
    },
    []
  );

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

  // Re-read the avatar list from the API every time this screen is shown.
  //
  // The list in context is written at sign-in and after a create, so anything
  // that changes it elsewhere — deleting an avatar, a change made in another
  // tab — used to leave this screen showing avatars the server no longer has.
  // This screen is the one place the whole list is displayed, so it is the
  // right place to insist on server truth rather than trusting what an earlier
  // screen happened to leave in memory.
  //
  // The gallery itself stays mounted while the person is in chat or settings.
  // Refresh when the screen is actually shown; do not throw a loading panel
  // over chat just because the hidden gallery asked the server again.
  useEffect(() => {
    if (!user || !galleryIsOpen) {
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
        const listMatches = describesTheSameAvatars(freshAvatars, userAvatars);
        const fullJsonMatches =
          JSON.stringify(freshAvatars ?? []) ===
          JSON.stringify(userAvatars ?? []);
        if (
          isCurrentRequest &&
          !listMatches
        ) {
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
  }, [user, galleryIsOpen, setUserAvatars]);

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
    if (galleryIsOpen) return;
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    setShowCreateModal(false);
  }, [galleryIsOpen]);

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
      avatars: userAvatars,
      query,
      hiddenIds,
      iconsById: avatarIconsById,
      ageVerified,
      isAdmin: isAdminAccount(user),
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
            (candidate) =>
              carouselAvatarId(candidate) === carouselAvatarId(avatar)
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
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
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

  // Keyboard navigation for avatar gallery. Left/right turn the ring.
  // Up opens chat for the front avatar; down opens that avatar's settings.
  useEffect(() => {
    const handleGalleryKeyDown = (e) => {
      const searchOwnsKeys =
        isDropdownOpen ||
        document.activeElement === searchRef.current?.querySelector('input');
      if (e.key === 'Escape' && isDropdownOpen) {
        e.preventDefault();
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
        return;
      }
      const frontCard = authenticatedCards[currentCardIndex];
      const intent = galleryCarouselKeyIntent(e, {
        searchOwnsKeys,
        menuOpen: userSettingsMenuOpen,
        modalOpen: showCreateModal,
        frontCardType: frontCard?.type,
      });
      if (!intent) return;

      e.preventDefault();
      if (intent === GALLERY_CAROUSEL_INTENT_PREVIOUS) {
        const newIndex = Math.max(0, currentCardIndex - 1);
        setCurrentCardIndex(newIndex);
        if (galleryRef.current) {
          galleryRef.current.setCurrentIndex(newIndex);
        }
      } else if (intent === GALLERY_CAROUSEL_INTENT_NEXT) {
        const newIndex = Math.min(
          authenticatedCards.length - 1,
          currentCardIndex + 1
        );
        setCurrentCardIndex(newIndex);
        if (galleryRef.current) {
          galleryRef.current.setCurrentIndex(newIndex);
        }
      } else if (
        intent === GALLERY_CAROUSEL_INTENT_SELECT ||
        intent === GALLERY_CAROUSEL_INTENT_CHAT
      ) {
        if (frontCard) {
          handleClick(frontCard);
        }
      } else if (intent === GALLERY_CAROUSEL_INTENT_SETTINGS) {
        handleOpenFrontAvatarSettings();
      }
    };

    if (user && galleryIsOpen) {
      document.addEventListener('keydown', handleGalleryKeyDown);
      return () =>
        document.removeEventListener('keydown', handleGalleryKeyDown);
    }
  }, [
    user,
    galleryIsOpen,
    currentCardIndex,
    authenticatedCards,
    isDropdownOpen,
    userSettingsMenuOpen,
    showCreateModal,
  ]);

  const frontCompanionAction = carouselCompanionAction(
    authenticatedCards[currentCardIndex]?.avatar_data
  );
  const createSearchSuggestion = suggestions.find(
    (suggestion) => suggestion.type === 'create'
  );
  const createSearchSuggestionIndex = suggestions.findIndex(
    (suggestion) => suggestion.type === 'create'
  );

  const workspaceAvatar = useMemo(() => {
    const activeId = carouselAvatarId(activeAvatar);
    if (activeId) {
      const fromList = orderedAvatars.find(
        (avatar) => carouselAvatarId(avatar) === activeId
      );
      if (fromList) return fromList;
    }
    const frontCard = authenticatedCards[currentCardIndex];
    if (frontCard?.type === 'avatar' && frontCard.avatar_data) {
      return frontCard.avatar_data;
    }
    return orderedAvatars[0] ?? null;
  }, [activeAvatar, orderedAvatars, authenticatedCards, currentCardIndex]);
  const workspaceAvatarId = carouselAvatarId(workspaceAvatar);
  const workspaceIsPersonalAvatar =
    workspaceAvatar?.metadata?.is_personal_avatar_of_creator === true;
  const workspaceCanOpenAvatarSettings =
    isAvatarOwnedByUser(workspaceAvatar, user) ||
    canShareAvatar(workspaceAvatar, user);
  const handleWorkspaceTabChange = (tab) => {
    if (tab === 'avatar-selection') return;
    const path = avatarWorkspacePath(workspaceAvatarId, tab);
    if (!path) {
      toast.error(
        tab === 'inbox'
          ? 'Inbox is not available.'
          : tab === 'avatar-settings'
            ? 'Avatar settings are not available.'
            : 'Pick an avatar first.'
      );
      return;
    }
    if (workspaceAvatar?.metadata?.user_id) {
      setActiveAvatar(workspaceAvatar);
    }
    navigate(path);
  };

  return (
    <div className="flex flex-col items-center justify-start p-2 sm:p-4 relative mx-auto h-full w-full">
      {isLoadingAvatars && galleryIsOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 px-8 py-6 flex flex-col items-center gap-4">
            <LoadingSpinner />
            <p className="text-white/80">Loading your avatars…</p>
          </div>
        </div>
      )}
      <div
        ref={galleryColumnRef}
        className="w-full h-full overflow-hidden flex flex-col items-center gap-2"
      >
        <div
          className="w-full flex flex-col items-center gap-2 shrink-0"
          ref={searchRef}
        >
          <AvatarWorkspaceHeader
            className="w-full"
            avatarName={workspaceAvatar?.name}
            headerFace={
              workspaceAvatarId ? avatarIconsById[workspaceAvatarId] : null
            }
            assistantId={workspaceAvatarId || null}
            activeTab="avatar-selection"
            isPersonalAvatar={workspaceIsPersonalAvatar}
            canOpenAvatarSettings={workspaceCanOpenAvatarSettings}
            inboxCount={inboxCount}
            onTabChange={handleWorkspaceTabChange}
          />
          <div className="relative w-full max-w-md">
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
            <div className="absolute z-30 w-full mt-1 max-h-60 flex flex-col overflow-hidden rounded-lg border border-white/10 bg-black/50">
              <ul className="min-h-0 overflow-auto">
                {suggestions.map((suggestion, idx) =>
                  suggestion.type === 'create' ? null : (
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
                  )
                )}
              </ul>
              {createSearchSuggestion && (
                <div
                  role="button"
                  data-search-create-avatar
                  onClick={() => handleSuggestionSelect(createSearchSuggestion)}
                  className={`shrink-0 border-t border-white/10 px-4 py-2 text-neutral-200 cursor-pointer flex items-center gap-2 ${
                    createSearchSuggestionIndex === highlightedIndex
                      ? 'bg-white/10'
                      : 'bg-black/60 hover:bg-white/10'
                  }`}
                >
                  <span className="flex-grow min-w-0 truncate">
                    {createSearchSuggestion.text}
                  </span>
                  <span
                    data-search-create-avatar-icon
                    className="shrink-0 p-1 rounded-md"
                    aria-hidden="true"
                  >
                    <UserPlus className="w-4 h-4" />
                  </span>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
        {/* The leftover column centers a glass card that hugs the discs
            and the strip, so the faces read larger and the empty bands
            above and below the cluster stay outside the panel. The fill
            is a veil, not a wall: the world globe has to stay readable
            through it. */}
        <div
          ref={galleryRegionRef}
          data-gallery-region
          className="relative z-0 flex min-h-0 w-full flex-1 flex-col justify-center"
        >
        <div
          ref={galleryStageRef}
          data-gallery-stage
          className="relative flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/25 backdrop-blur-md py-3"
        >
        <div
          ref={galleryFrameRef}
          data-gallery-frame
          className="relative min-h-0 w-full overflow-hidden"
        >
          {/* The gallery is WebGL, so the Create Avatar entry it draws is a
              flat texture. When that entry is the one in front, a real card
              is laid over it at the same size — 66% of this box, which on a
              phone is shrunk so the width-capped discs fill it instead of
              floating in leftover viewport — and the live PixelCard tracks
              that size from the gallery. */}
          {authenticatedCards.some((card) => card.type === 'create') && (
            <div
              ref={createCardOverlayRef}
              className="absolute left-1/2 top-1/2 h-[66%] aspect-square z-10 overflow-hidden"
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
            borderRadius={0.5}
            font="bold 48px system-ui"
            scrollSpeed={2}
            scrollEase={0.3}
            onCardClick={handleClick}
            currentIndex={currentCardIndex}
            onIndexChange={handleGalleryIndexChange}
            onCreateCardMove={handleCreateCardMove}
            isActive={galleryIsOpen}
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
                    className={`${userSettingsMenuOpen ? 'pointer-events-none' : 'pointer-events-auto'} p-1.5 rounded-md text-white/40 hover:text-neutral-100 hover:bg-white/10 transition-colors`}
                    aria-label="Hide avatar from the carousel"
                    title="Hide avatar from the carousel"
                  >
                    <EyeOff className="w-6 h-6" />
                  </button>
                ) : frontCompanionAction === 'inbox' ? (
                  <button
                    type="button"
                    data-carousel-avatar-inbox
                    onMouseDown={(event) => event.stopPropagation()}
                    onTouchStart={(event) => event.stopPropagation()}
                    onClick={handleOpenFrontAvatarInbox}
                    className={`${userSettingsMenuOpen ? 'pointer-events-none' : 'pointer-events-auto'} relative p-1.5 rounded-md text-white/40 hover:text-neutral-100 hover:bg-white/10 transition-colors`}
                    aria-label="Open avatar inbox"
                    title="Open avatar inbox"
                  >
                    <Inbox className="w-6 h-6" />
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
                  className={`${userSettingsMenuOpen ? 'pointer-events-none' : 'pointer-events-auto'} p-1.5 rounded-md text-white/40 hover:text-neutral-100 hover:bg-white/10 transition-colors`}
                  aria-label="Open avatar settings"
                  title="Open avatar settings"
                >
                  <Settings className="w-6 h-6" />
                </button>
              </div>
            )}
        </div>
        {/* Above the hide / inbox / settings strip (`z-20`). User Settings
            opens upward over that strip; its own `z-50` cannot escape this
            flex item's stacking context, so this layer has to sit higher or
            a press on the menu hits those controls instead. */}
        <div
          ref={galleryFooterRef}
          className="relative z-30 flex flex-col items-center w-full gap-2.5 shrink-0 pt-1 pb-1"
        >
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
            className="flex gap-2.5 justify-center items-center"
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
                className="w-7 h-7"
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
              className="flex gap-2.5 items-center justify-center"
              style={{ minWidth: '220px', minHeight: '44px' }}
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
                    className={`relative rounded-full shrink-0 overflow-hidden border-2 transition-transform duration-300 hover:scale-110 ${
                      isSelected
                        ? 'border-neutral-300'
                        : 'border-white/30 hover:border-white/60'
                    }`}
                    style={{
                      transform: `scale(${scale})`,
                      width: '36px',
                      height: '36px',
                    }}
                    aria-label={`Open ${card.text}`}
                    aria-current={isSelected ? 'true' : undefined}
                  >
                    {isCreateAvatar ? (
                      <span className="w-full h-full flex items-center justify-center bg-black/50 rounded-full">
                        <CirclePlus className="w-6 h-6 text-neutral-200" />
                      </span>
                    ) : card.image && isValidImageUrl(card.image) ? (
                      <ProfileBubbleImage
                        src={card.image}
                        alt=""
                        assistantId={card.id}
                        className="h-full w-full rounded-full"
                      />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center bg-black/50 rounded-full">
                        <User className="w-5 h-5 text-white/50" />
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
                className="w-7 h-7"
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
          {import.meta.env.VITE_TESTING === 'true' && (
            <div className="relative w-48">
              <button
                onClick={() => {
                  console.log('test toast button clicked');
                  toast.dismiss();

                  toast.promise(
                    new Promise((resolve, reject) => {
                      setTimeout(() => {
                        reject();
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
