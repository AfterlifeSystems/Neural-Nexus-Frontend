import { useEffect, useRef } from 'react';

import {
  WORKSPACE_ESCAPE_INTENT_AVATAR_SELECTION,
  WORKSPACE_ESCAPE_INTENT_CLOSE_SIDEBAR,
  fieldOwnsArrowKeys,
  overlayOwnsWorkspaceEscape,
  workspaceEscapeIntent,
  workspaceGalleryArrowIntent,
} from '../components/workspaceEscapeKeyboard';

/**
 * Escape closes an open sidebar; on chat, inbox, or avatar settings it then
 * goes to Avatar Selection. ArrowDown on chat and ArrowUp on avatar settings
 * do the same, reversing the gallery. Overlays and fields keep their keys.
 *
 * @param {Object} parameters
 * @param {boolean} parameters.sidebarOpen
 * @param {Function} parameters.onCloseSidebar
 * @param {boolean} [parameters.canGoToAvatarSelection]
 * @param {Function} [parameters.onGoToAvatarSelection]
 * @param {boolean} [parameters.isAvatarSettings]
 * @param {boolean} [parameters.isAvatarChat]
 */
export default function useWorkspaceEscape({
  sidebarOpen,
  onCloseSidebar,
  canGoToAvatarSelection = false,
  onGoToAvatarSelection,
  isAvatarSettings = false,
  isAvatarChat = false,
}) {
  const onCloseSidebarRef = useRef(onCloseSidebar);
  const onGoToAvatarSelectionRef = useRef(onGoToAvatarSelection);
  onCloseSidebarRef.current = onCloseSidebar;
  onGoToAvatarSelectionRef.current = onGoToAvatarSelection;

  useEffect(() => {
    const onKeyDown = (keyEvent) => {
      const overlayOwnsEscape = overlayOwnsWorkspaceEscape();
      const escapeIntent = workspaceEscapeIntent(keyEvent, {
        overlayOwnsEscape,
        sidebarOpen,
        canGoToAvatarSelection,
      });
      if (escapeIntent) {
        keyEvent.preventDefault();
        if (escapeIntent === WORKSPACE_ESCAPE_INTENT_CLOSE_SIDEBAR) {
          onCloseSidebarRef.current?.();
          return;
        }
        if (escapeIntent === WORKSPACE_ESCAPE_INTENT_AVATAR_SELECTION) {
          onGoToAvatarSelectionRef.current?.();
        }
        return;
      }
      const arrowIntent = workspaceGalleryArrowIntent(keyEvent, {
        overlayOwnsEscape,
        fieldOwnsArrows: fieldOwnsArrowKeys(keyEvent.target),
        isAvatarSettings,
        isAvatarChat,
      });
      if (arrowIntent === WORKSPACE_ESCAPE_INTENT_AVATAR_SELECTION) {
        keyEvent.preventDefault();
        onGoToAvatarSelectionRef.current?.();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen, canGoToAvatarSelection, isAvatarSettings, isAvatarChat]);
}
