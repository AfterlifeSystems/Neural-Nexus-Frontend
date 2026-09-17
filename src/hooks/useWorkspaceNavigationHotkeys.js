/**
 * Letter and `?` shortcuts wired to navigation and Evan's help overlay.
 *
 * Pure intent lives in `workspaceNavigationKeyboard.js`. This hook listens on
 * the document for signed-in screens and for opening the help assistant.
 */

import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useEvanAssist } from '../context/EvanAssistContext';
import { shouldOfferEvanAssist } from '../services/evanAssistSession';
import { usePersonalAvatarWorkspaceNavigation } from '../components/AccountMenu';
import { resolveAssistantId } from '../components/utils';
import {
  WORKSPACE_HOTKEY_INTENT_ASSIST,
  WORKSPACE_HOTKEY_INTENT_AVATARS,
  WORKSPACE_HOTKEY_INTENT_BILLING,
  WORKSPACE_HOTKEY_INTENT_INBOX,
  WORKSPACE_HOTKEY_INTENT_MAP,
  WORKSPACE_HOTKEY_INTENT_SETTINGS,
  fieldOwnsLetterHotkeys,
  overlayOwnsLetterHotkeys,
  workspaceNavigationHotkeyIntent,
} from '../components/workspaceNavigationKeyboard';

const isEmbeddedFrame = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

/**
 * Document-level letter and `?` shortcuts for Neural Nexus.
 *
 * Mount once under the router and EvanAssistProvider (see main.jsx).
 */
export default function useWorkspaceNavigationHotkeys() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, activeAvatar } = useAuth();
  const { open, evanId } = useEvanAssist();
  const openPersonalWorkspace = usePersonalAvatarWorkspaceNavigation();

  const openRef = useRef(open);
  const openPersonalWorkspaceRef = useRef(openPersonalWorkspace);
  const navigateRef = useRef(navigate);
  openRef.current = open;
  openPersonalWorkspaceRef.current = openPersonalWorkspace;
  navigateRef.current = navigate;

  const signedIn = Boolean(user);
  const assistOffered = shouldOfferEvanAssist({
    inIframe: isEmbeddedFrame(),
    pathname: location.pathname,
    currentAssistantId: resolveAssistantId(activeAvatar) ?? null,
    evanAssistantId: evanId ?? null,
  });

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7557/ingest/0403ecb1-fecd-46cd-92b1-501b8e956682', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '323df9',
      },
      body: JSON.stringify({
        sessionId: '323df9',
        runId: 'post-fix',
        hypothesisId: 'A',
        location: 'useWorkspaceNavigationHotkeys.js:mount',
        message: 'workspace navigation hotkeys hook mounted after import fix',
        data: {
          signedIn,
          assistOffered,
          pathname: location.pathname,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }, []);
  // #endregion

  useEffect(() => {
    const onKeyDown = (keyEvent) => {
      const intent = workspaceNavigationHotkeyIntent(keyEvent, {
        overlayOwnsKeys: overlayOwnsLetterHotkeys(),
        fieldOwnsKeys: fieldOwnsLetterHotkeys(keyEvent.target),
        signedIn,
        assistOffered,
      });
      if (!intent) return;
      keyEvent.preventDefault();

      if (intent === WORKSPACE_HOTKEY_INTENT_ASSIST) {
        void openRef.current?.();
        return;
      }
      if (intent === WORKSPACE_HOTKEY_INTENT_MAP) {
        navigateRef.current('/map');
        return;
      }
      if (intent === WORKSPACE_HOTKEY_INTENT_AVATARS) {
        navigateRef.current('/avatars');
        return;
      }
      if (intent === WORKSPACE_HOTKEY_INTENT_BILLING) {
        navigateRef.current('/billing');
        return;
      }
      if (intent === WORKSPACE_HOTKEY_INTENT_INBOX) {
        void openPersonalWorkspaceRef.current?.('inbox');
        return;
      }
      if (intent === WORKSPACE_HOTKEY_INTENT_SETTINGS) {
        void openPersonalWorkspaceRef.current?.('settings');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [signedIn, assistOffered]);
}
