// src/components/showVoiceNotReadyToast.jsx
//
// The avatar has no voice audio model yet. Clicking the notice opens avatar
// settings so the owner can record or upload speech; Close dismisses
// it. A plain toast would dismiss on press (see main.jsx) and never take the
// reader where they need to go.
//
// Shown at most once per avatar per tab session. Speak is retried from the
// transcript and from voice mode, each with its own hook, and every retry is
// another 409 — without this the same sentence stacked on every press.

import React from 'react';
import { toast } from 'react-hot-toast';
import { AudioLines } from 'lucide-react';

const shownThisSession = new Set();

function voiceNotReadyStorageKey(assistantId) {
  return `voice-not-ready-shown:${assistantId || 'avatar'}`;
}

function voiceNotReadyAlreadyShown(assistantId) {
  const key = voiceNotReadyStorageKey(assistantId);
  if (shownThisSession.has(key)) return true;
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function rememberVoiceNotReadyShown(assistantId) {
  const key = voiceNotReadyStorageKey(assistantId);
  shownThisSession.add(key);
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    // Private mode can refuse storage; the in-memory set still covers this tab.
  }
}

/**
 * Show a two-pane toast: left opens settings, right dismisses.
 *
 * @param {Object} parameters
 * @param {string} parameters.assistantId The avatar whose settings to open.
 * @param {string} [parameters.avatarName] For the sentence.
 * @param {number} [parameters.collectedSeconds] Seconds of speech already held.
 */
export function showVoiceNotReadyToast({
  assistantId,
  avatarName,
  collectedSeconds = 0,
}) {
  if (voiceNotReadyAlreadyShown(assistantId)) return;
  rememberVoiceNotReadyShown(assistantId);

  const settingsPath = assistantId
    ? `/chat/${encodeURIComponent(assistantId)}?tab=settings&section=voice`
    : '/avatars';
  const collected = Math.round(collectedSeconds);
  const toastId = voiceNotReadyStorageKey(assistantId);

  const openSettings = () => {
    toast.dismiss(toastId);
    window.location.assign(settingsPath);
  };

  toast.custom(
    (voiceToast) => (
      <div
        className={`${
          voiceToast.visible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2'
        } transition-all duration-200 max-w-md w-full flex pointer-events-auto rounded-lg shadow-lg backdrop-blur-lg bg-[rgba(0,0,0,0.92)] ring-1 ring-white/15`}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={openSettings}
          onKeyDown={(keyboardEvent) => {
            if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
              keyboardEvent.preventDefault();
              openSettings();
            }
          }}
          className="flex-1 w-0 p-4 cursor-pointer hover:bg-white/5 rounded-l-lg"
        >
          <div className="flex items-start gap-3">
            <AudioLines className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-100">
                {avatarName ?? 'This avatar'} has no voice yet
              </p>
              <p className="mt-1 text-sm text-white/60">
                Record or upload about two minutes of speech in settings
                {collected > 0 ? ` (${collected}s collected so far)` : ''}.
                Open avatar settings.
              </p>
            </div>
          </div>
        </div>
        <div className="flex border-l border-white/10">
          <button
            type="button"
            onClick={() => toast.dismiss(voiceToast.id)}
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-amber-300 hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          >
            Close
          </button>
        </div>
      </div>
    ),
    { id: toastId, duration: Infinity }
  );
}
