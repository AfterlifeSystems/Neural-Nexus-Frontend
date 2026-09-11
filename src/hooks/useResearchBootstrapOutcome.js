// src/hooks/useResearchBootstrapOutcome.js
//
// What the research managed to acquire for an avatar, and what it could not.
//
// Creating an avatar starts research, and that research goes looking for a
// picture and a recording when the avatar has neither. Often it finds them. When
// it does not — a private individual, a name with no public presence, a namesake
// it could not tell apart — the avatar is left without a portrait or a voice,
// and the creator deserves to be told THAT rather than shown the same generic
// "add a portrait" prompt an avatar nobody has researched would show.
//
// The progress stream that reported this is long gone by the time Settings is
// opened, so the outcome is read from where the acquisition recorded it.

import { useCallback, useEffect, useState } from 'react';
import { getAvatarResearchBootstrap } from '../services/avatarService';

/**
 * Read the recorded acquisition outcome for one avatar.
 *
 * @param {string} assistantId The avatar, or a falsy value to read nothing.
 * @param {number} [reloadToken] Bump to re-read, e.g. once research finishes.
 * @returns {{outcome: Object|null, reload: Function}} The outcome, or null when
 *   no acquisition has run for this avatar (or the caller may not read it).
 */
export const useResearchBootstrapOutcome = (assistantId, reloadToken = 0) => {
  const [outcome, setOutcome] = useState(null);

  const reload = useCallback(async () => {
    if (!assistantId) {
      setOutcome(null);
      return;
    }
    try {
      const response = await getAvatarResearchBootstrap(assistantId);
      setOutcome(response?.bootstrap ?? null);
    } catch (error) {
      // Nothing here is load-bearing: without it the screen shows its ordinary
      // empty states, which is the behaviour before this existed.
      console.debug('Could not read the research acquisition outcome:', error);
      setOutcome(null);
    }
  }, [assistantId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await reload();
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [reload, reloadToken]);

  return { outcome, reload };
};
