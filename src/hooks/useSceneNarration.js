// src/hooks/useSceneNarration.js
import { useCallback, useEffect, useState } from 'react';
import {
  readSceneNarrationRecord,
  subscribeSceneNarration,
  writeSceneNarration,
  writeSceneNarrationSeconds,
} from '../config/sceneNarration';
import { announceSceneNarration } from '../services/sceneNarrationSpeech';

/**
 * The scene-narration switch, live: whether the camera is being described to
 * the person continuously, and a way to flip it.
 *
 * Every reader of this hook sees the same switch, whoever flipped it — the
 * Accessibility section in account settings, or an avatar the person asked.
 *
 * @returns {{sceneNarrationOn: boolean, sceneNarrationSeconds: number, setSceneNarrationOn: (enabled: boolean, options?: {avatarName?: string, assistantId?: string}) => void, setSceneNarrationSeconds: (seconds: number) => void}}
 */
export default function useSceneNarration() {
  const [record, setRecord] = useState(() => readSceneNarrationRecord());
  useEffect(() => {
    setRecord(readSceneNarrationRecord());
    return subscribeSceneNarration((enabled, intervalSeconds) =>
      setRecord({ enabled: Boolean(enabled), intervalSeconds })
    );
  }, []);
  /**
   * Flip the switch BY HAND, and say out loud which way it went.
   *
   * The announcement is what makes this control usable by the person the mode
   * exists for: they pressed something they cannot see, and silence afterwards
   * is indistinguishable from a press that did not register. It also rides
   * inside the press itself, which is what unlocks speech on the browsers that
   * refuse to speak until a gesture has happened — so the descriptions that
   * follow can be spoken at all.
   *
   * An avatar asked to flip the switch does NOT come through here: it writes
   * the switch directly and says what it did in its own words, which is a
   * better announcement than this one.
   */
  const setSceneNarrationOn = useCallback(
    (enabled, { avatarName, assistantId } = {}) => {
      const next = Boolean(enabled);
      writeSceneNarration(next);
      announceSceneNarration(next, { avatarName, assistantId });
    },
    []
  );
  /**
   * Change how often the scene is read out, without touching the switch.
   *
   * The slider in account settings and an avatar asked to describe
   * things more or less often both end up here.
   */
  const setSceneNarrationSeconds = useCallback((seconds) => {
    writeSceneNarrationSeconds(seconds);
  }, []);

  return {
    sceneNarrationOn: record.enabled,
    sceneNarrationSeconds: record.intervalSeconds,
    setSceneNarrationOn,
    setSceneNarrationSeconds,
  };
}
