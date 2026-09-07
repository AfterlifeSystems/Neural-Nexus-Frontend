// src/hooks/useSpeech.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { showRequestFailureToast } from '../components/requestFailureToast';
import { showVoiceNotReadyToast } from '../components/showVoiceNotReadyToast';
import { speakText } from '../services/avatarService';
import { speakFailureKind } from '../services/voiceSpeakFailure';

/**
 * Speak text in the avatar's cloned voice, one utterance at a time.
 *
 * Wraps `POST /speak`: the response bytes become an object URL played by a
 * single `Audio` element, so starting a new utterance stops the previous one
 * and there is never more than one voice speaking. `voice_not_ready` (no clone
 * yet) surfaces as `notReady` with the server's progress so the caller can open
 * the Voice panel rather than showing a generic failure. That is not the same
 * as `voice_blocked` (a clone ElevenLabs has banned): a banned voice was
 * uploaded and then refused, and more recording will not clear it. Blocked is
 * reported through `blocked` and NOT toasted — a notice on every reply would
 * repeat something the reader can do nothing about, and live voice mode
 * answers in text. The settings Voice panel is where the ban is explained.
 * Only a voice that has not yet been uploaded gets the missing-voice-model
 * toast (once, with a route to settings). Every other failure is toasted as a
 * failed utterance — a speak button that spins and then does nothing at all
 * leaves the reader with no way to tell a broken voice from a silent one.
 *
 * @param {Object} [options]
 * @param {boolean} [options.asAnonymousIdentity] Public chat: withhold the credential.
 * @param {string} [options.avatarName] Shown on the missing-voice-model toast.
 * @returns {{
 *   speak: (assistantId: string, text: string, handlers?: {onStart?: Function, onEnd?: Function}) => Promise<boolean>,
 *   stop: () => void,
 *   isSpeaking: boolean,
 *   speakingKey: string|null,
 *   notReady: Object|null,
 *   blocked: boolean,
 * }}
 */
export default function useSpeech({
  asAnonymousIdentity = false,
  avatarName,
} = {}) {
  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);
  const abortRef = useRef(null);
  // Removes the current element's `ended`/`error` listeners.
  const detachRef = useRef(null);
  // Ends the utterance currently being awaited, exactly once.
  const settleRef = useRef(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingKey, setSpeakingKey] = useState(null);
  const [notReady, setNotReady] = useState(null);
  // Set once the API confirms this avatar's cloned voice is banned. Further
  // utterances are dropped rather than re-requested: the answer cannot change,
  // and every attempt costs a round trip to be refused again.
  const [blocked, setBlocked] = useState(false);

  const release = useCallback(() => {
    if (audioRef.current) {
      // Drop the element's own listeners BEFORE clearing the source. Clearing
      // `src` makes the browser fire `error` on the element a moment later, and
      // a listener still attached would report that as the utterance ending —
      // long after a newer utterance had taken over. In live voice mode that
      // late ending re-opened the microphone underneath the reply that
      // replaced it, so the avatar transcribed its own voice and answered
      // itself.
      detachRef.current?.();
      detachRef.current = null;
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    // Settle the utterance in flight here and now. `speak` awaits playback, so
    // a caller that stops one utterance and starts another must see the first
    // one end before the second begins, not on whatever media event the
    // browser gets around to firing afterwards.
    const settleInFlightUtterance = settleRef.current;
    if (settleInFlightUtterance) settleInFlightUtterance();
    else release();
    setIsSpeaking(false);
    setSpeakingKey(null);
  }, [release]);

  useEffect(() => stop, [stop]);

  const speak = useCallback(
    async (assistantId, text, { onStart, onEnd, key } = {}) => {
      stop();
      if (!text?.trim() || !assistantId) return false;
      if (blocked) return false;
      const controller = new AbortController();
      abortRef.current = controller;
      setNotReady(null);
      try {
        const audioBlob = await speakText(assistantId, text, {
          asAnonymousIdentity,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return false;
        const objectUrl = URL.createObjectURL(audioBlob);
        objectUrlRef.current = objectUrl;
        const audio = new Audio(objectUrl);
        audioRef.current = audio;
        setSpeakingKey(key ?? text);
        await new Promise((resolve) => {
          let ended = false;
          const finish = () => {
            if (ended) return;
            ended = true;
            if (settleRef.current === finish) settleRef.current = null;
            setIsSpeaking(false);
            setSpeakingKey(null);
            release();
            onEnd?.();
            resolve();
          };
          settleRef.current = finish;
          detachRef.current = () => {
            audio.removeEventListener('ended', finish);
            audio.removeEventListener('error', finish);
          };
          audio.addEventListener('ended', finish, { once: true });
          audio.addEventListener('error', finish, { once: true });
          audio.addEventListener(
            'play',
            () => {
              setIsSpeaking(true);
              onStart?.();
            },
            { once: true }
          );
          audio.play().catch(finish);
        });
        return true;
      } catch (speakError) {
        if (controller.signal.aborted) return false;
        const kind = speakFailureKind(speakError);
        if (kind === 'blocked') {
          // Silent on purpose. A banned clone is not "no voice uploaded" —
          // the model exists and the vendor has refused it. The reply stays
          // text and the Voice panel is where the ban is explained.
          setBlocked(true);
        } else if (kind === 'billing') {
          showRequestFailureToast(speakError);
        } else if (kind === 'not_ready') {
          const collectedSeconds = speakError?.body?.collected_seconds ?? 0;
          setNotReady({
            collectedSeconds,
            minimumSeconds: speakError?.body?.instant_minimum_seconds ?? 60,
            detail: speakError?.body?.detail ?? speakError?.message,
          });
          showVoiceNotReadyToast({
            assistantId,
            avatarName,
            collectedSeconds,
          });
        } else {
          console.error('Speech failed:', speakError);
          toast.error('The avatar could not speak that message.');
        }
        setIsSpeaking(false);
        setSpeakingKey(null);
        onEnd?.();
        return false;
      }
    },
    [asAnonymousIdentity, avatarName, blocked, release, stop]
  );

  return { speak, stop, isSpeaking, speakingKey, notReady, blocked };
}
