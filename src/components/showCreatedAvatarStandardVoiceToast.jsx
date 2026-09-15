// Shown after create when no standard voice was picked. Names the gender that
// chose the stock voice and how to change it. Pressing the notice opens Avatar
// Settings on Voice; Close dismisses. A plain toast would dismiss on press
// (see main.jsx) and never take the reader where they need to go.

import React from 'react';
import { toast } from 'react-hot-toast';
import { AudioLines } from 'lucide-react';
import {
  avatarVoiceSettingsPath,
  createdAvatarStandardVoiceToastCopy,
  createdAvatarStandardVoiceToastId,
} from './createdAvatarStandardVoiceToast';

/**
 * Two-pane toast: left opens Avatar Settings (Voice), right dismisses.
 *
 * @param {Object} parameters
 * @param {string} [parameters.assistantId]
 * @param {string} [parameters.avatarName]
 * @param {'female'|'male'} [parameters.gender]
 * @param {'selected'|'inferred'|'fallback'} [parameters.source]
 * @param {string} [parameters.givenName]
 * @param {string} [parameters.voiceName]
 * @param {boolean} [parameters.assigned]
 * @param {(path: string) => void} [parameters.onOpenSettings]
 */
export function showCreatedAvatarStandardVoiceToast({
  assistantId,
  avatarName,
  gender,
  source,
  givenName,
  voiceName,
  assigned = true,
  onOpenSettings,
} = {}) {
  const toastId = createdAvatarStandardVoiceToastId(assistantId);
  const settingsPath = avatarVoiceSettingsPath(assistantId);
  const { title, body, action } = createdAvatarStandardVoiceToastCopy({
    avatarName,
    gender,
    source,
    givenName,
    voiceName,
    assigned,
  });

  const openAvatarSettings = () => {
    toast.dismiss(toastId);
    if (onOpenSettings) {
      onOpenSettings(settingsPath);
      return;
    }
    window.location.assign(settingsPath);
  };

  toast.custom(
    (createdVoiceToast) => (
      <div
        className={`${
          createdVoiceToast.visible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2'
        } transition-all duration-200 max-w-md w-full flex pointer-events-auto rounded-lg shadow-lg backdrop-blur-lg bg-[rgba(0,0,0,0.92)] ring-1 ring-white/15`}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={openAvatarSettings}
          onKeyDown={(keyboardEvent) => {
            if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
              keyboardEvent.preventDefault();
              openAvatarSettings();
            }
          }}
          className="group flex-1 w-0 p-4 cursor-pointer hover:bg-white/5 rounded-l-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          <div className="flex items-start gap-3">
            <AudioLines
              className="w-5 h-5 text-amber-300 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-100">{title}</p>
              <p className="mt-1 text-sm text-white/60">
                {body}{' '}
                <span className="font-semibold text-neutral-300 underline underline-offset-2 group-hover:text-neutral-100">
                  {action}
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex border-l border-white/10">
          <button
            type="button"
            onClick={() => toast.dismiss(createdVoiceToast.id)}
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
