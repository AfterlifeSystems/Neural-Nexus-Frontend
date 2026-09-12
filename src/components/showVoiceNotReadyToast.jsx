// src/components/showVoiceNotReadyToast.jsx
//
// A cloned voice has not been added to this model. Shown when speak-aloud or
// a live reply has no clone yet — including when a standard voice is standing
// in. Clicking the notice opens the avatar's Voice settings so the owner can
// create one; Close dismisses it.
// A plain toast would dismiss on press (see main.jsx) and never take the
// reader where they need to go.

import React from 'react';
import { toast } from 'react-hot-toast';
import { AudioLines } from 'lucide-react';
import {
  avatarVoiceSettingsPath,
  rememberVoiceNotReadyShown,
  voiceNotReadyAlreadyShown,
  voiceNotReadyStorageKey,
  voiceNotReadyToastTitle,
} from './voiceNotReadyToast';

/**
 * Show a two-pane toast: left opens Voice settings to create a voice, right dismisses.
 *
 * @param {Object} parameters
 * @param {string} parameters.assistantId The avatar whose settings to open.
 * @param {string} [parameters.avatarName] For the sentence.
 * @param {number} [parameters.collectedSeconds] Seconds of speech already held.
 * @param {string} [parameters.conversationId] Thread this notice belongs to.
 * @param {boolean} [parameters.prompt] False when this avatar should not be
 *   asked to add a clone (administrator-created characters).
 */
export function showVoiceNotReadyToast({
  assistantId,
  avatarName,
  collectedSeconds = 0,
  conversationId,
  prompt = true,
}) {
  if (!prompt) return;
  if (voiceNotReadyAlreadyShown(assistantId, conversationId)) return;
  rememberVoiceNotReadyShown(assistantId, conversationId);

  const settingsPath = avatarVoiceSettingsPath(assistantId);
  const collected = Math.round(collectedSeconds);
  const toastId = voiceNotReadyStorageKey(assistantId, conversationId);

  const openVoiceSettings = () => {
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
          onClick={openVoiceSettings}
          onKeyDown={(keyboardEvent) => {
            if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
              keyboardEvent.preventDefault();
              openVoiceSettings();
            }
          }}
          className="group flex-1 w-0 p-4 cursor-pointer hover:bg-white/5 rounded-l-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          <div className="flex items-start gap-3">
            <AudioLines className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-100">
                {voiceNotReadyToastTitle(avatarName)}
              </p>
              <p className="mt-1 text-sm text-white/60">
                Replies can use a standard voice until a clone is added.
                Record or upload about two minutes of speech
                {collected > 0 ? ` (${collected}s collected so far)` : ''} to
                create one. Open{' '}
                <span className="font-semibold text-neutral-300 underline underline-offset-2 group-hover:text-neutral-100">
                  Voice
                </span>
                .
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
