// src/hooks/useSpeech.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  isProviderCreditExhausted,
  isProviderKeyRefused,
  showRequestFailureToast,
} from '../components/requestFailureToast';
import { showVoiceNotReadyToast } from '../components/showVoiceNotReadyToast';
import { speakText } from '../services/avatarService';
import { rememberAvatarSpokenLine } from '../services/selfEchoGuard';
import {
  bindAvatarSpeechSession,
  claimAvatarSpeechSessionOwnerId,
  publishAvatarSpeechSession,
  readAvatarSpeechSession,
  releaseAvatarSpeechSessionMedia,
  releaseAvatarSpeechSessionOwner,
  stopAvatarSpeechSession,
  subscribeAvatarSpeechSession,
} from '../services/avatarSpeechSession';
import {
  isSpeechPlayBlocked,
  playOnUnlockedSpeechElement,
  primeAvatarSpeechPlayback,
} from '../services/avatarSpeechUnlock';
import { avatarHasClonedVoice } from '../services/avatarHasClonedVoice';
import {
  speakFailureKind,
  speakFailureReason,
} from '../services/voiceSpeakFailure';

/**
 * Speak text in the avatar's cloned voice, one utterance at a time.
 *
 * Wraps `POST /speak`: the response bytes become an object URL played by a
 * single `Audio` element, so starting a new utterance stops the previous one
 * and there is never more than one voice speaking. Speaking flags live in
 * `avatarSpeechSession` so message view and live voice mode — which each call
 * this hook — both see the same utterance: a transcript Speak that is still
 * playing when the person opens voice mode still lights the portrait glow and
 * keeps the microphone shut.
 * `voice_not_ready` (no clone and no standard voice) surfaces as `notReady`
 * with the server's progress so the caller can open the Voice panel rather
 * than showing a generic failure. A successful speak that used a standard
 * voice still shows the missing-clone toast: a stock voice is not a voice
 * added to this model. That is not the same as `voice_blocked` (a clone
 * ElevenLabs has banned): a banned voice was uploaded and then refused, and
 * more recording will not clear it. Blocked is reported through `blocked` and
 * NOT toasted — a notice on every reply would repeat something the reader can
 * do nothing about, and live voice mode answers in text. The settings Voice
 * panel is where the ban is explained. A missing clone (or voice stack that is
 * not configured yet) raises the create-voice toast once per conversation per
 * avatar: left side opens Voice settings, Close dismisses. "The avatar could
 * not speak that message" is the wrong sentence for that case. A server that
 * has no voice stack at all (`unavailable`) is different: the avatar may
 * already have a clone, so the create-voice toast is wrong — that case gets a
 * plain unavailable notice. A refused ElevenLabs, OpenAI, or xAI key is not an
 * empty vendor account: it is reported as a key refusal, not the Support
 * toast. A spent vendor account still uses the same Support toast as a chat
 * credit pause. Every other failure is toasted as a failed utterance — a speak
 * button that spins and then does nothing at all leaves the reader with no way
 * to tell a broken voice from a silent one.
 *
 * @param {Object} [options]
 * @param {boolean} [options.asAnonymousIdentity] Public chat: withhold the credential.
 * @param {string} [options.avatarName] Named on the create-voice toast.
 * @param {string} [options.conversationId] Limits the create-voice toast to once per conversation per avatar. A new conversation may show it again.
 * @param {boolean} [options.missingClonedVoice] True when a clone has not been
 *   added to this model. A successful standard-voice speak still shows the
 *   missing-clone toast; this flag covers browsers that hide `X-Voice-Kind`.
 * @param {boolean} [options.promptForMissingClonedVoice] False for
 *   administrator-created characters that are not meant to receive a clone.
 * @returns {{
 *   speak: (assistantId: string, text: string, handlers?: {onStart?: Function, onEnd?: Function}) => Promise<boolean>,
 *   stop: () => void,
 *   isSpeaking: boolean,
 *   speakingKey: string|null,
 *   notReady: Object|null,
 *   blocked: boolean,
 *   reportVoiceReadiness: (voice: Object|null) => void,
 * }}
 */
export default function useSpeech({
  asAnonymousIdentity = false,
  avatarName,
  conversationId,
  missingClonedVoice = false,
  promptForMissingClonedVoice = true,
} = {}) {
  const sessionOwnerIdRef = useRef(null);
  if (sessionOwnerIdRef.current == null) {
    sessionOwnerIdRef.current = claimAvatarSpeechSessionOwnerId();
  }
  const initialSession = readAvatarSpeechSession();
  const [isSpeaking, setIsSpeaking] = useState(initialSession.isSpeaking);
  const [speakingKey, setSpeakingKey] = useState(initialSession.speakingKey);
  const [notReady, setNotReady] = useState(null);
  // Set once the API confirms this avatar's cloned voice is banned. Further
  // utterances are dropped rather than re-requested: the answer cannot change,
  // and every attempt costs a round trip to be refused again.
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const syncFromSharedSession = () => {
      const session = readAvatarSpeechSession();
      setIsSpeaking(session.isSpeaking);
      setSpeakingKey(session.speakingKey);
    };
    syncFromSharedSession();
    return subscribeAvatarSpeechSession(syncFromSharedSession);
  }, []);

  // Voice mode learns that a voice is missing by trying to speak and being
  // refused. This is the opposite signal: the transcribe reply reports whether
  // the avatar can speak now, so a voice that finished building in the middle
  // of the conversation is used on the very next reply rather than after a
  // reload. A voice the vendor has banned is latched the same way a refusal
  // latches it, because that answer cannot change either.
  const reportVoiceReadiness = useCallback((voice) => {
    if (!voice) return;
    if (voice.blocked) {
      setBlocked(true);
      return;
    }
    // A standard voice sets has_voice so the next reply can be heard.
    // That is not a clone: keep notReady and the missing-clone toast.
    if (avatarHasClonedVoice(voice)) setNotReady(null);
  }, []);

  const stop = useCallback(() => {
    stopAvatarSpeechSession();
  }, []);

  useEffect(() => {
    const ownerId = sessionOwnerIdRef.current;
    return () => {
      releaseAvatarSpeechSessionOwner(ownerId);
    };
  }, []);

  const speak = useCallback(
    async (assistantId, text, { onStart, onEnd, key } = {}) => {
      // Still inside the tap when this is a Speak press. Live replies prime
      // earlier (enter voice / send / unmute); a second prime here is a no-op
      // once the element is already playing a real utterance.
      primeAvatarSpeechPlayback();
      stop();
      if (!text?.trim() || !assistantId) return false;
      if (blocked) return false;
      const ownerId = sessionOwnerIdRef.current;
      const controller = new AbortController();
      bindAvatarSpeechSession({
        ownerId,
        abortController: controller,
      });
      setNotReady(null);
      try {
        const audioBlob = await speakText(assistantId, text, {
          asAnonymousIdentity,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return false;
        // A stock voice speaks, but a clone has not been added to this model.
        // The 409 path never runs in that case, so the toast lives here too.
        const spokeWithClone =
          audioBlob.voiceKind === 'instant' ||
          audioBlob.voiceKind === 'professional';
        if (
          !spokeWithClone &&
          (audioBlob.voiceKind === 'standard' || missingClonedVoice)
        ) {
          showVoiceNotReadyToast({
            assistantId,
            avatarName,
            conversationId,
            prompt: promptForMissingClonedVoice,
          });
        }
        const objectUrl = URL.createObjectURL(audioBlob);
        const audio = playOnUnlockedSpeechElement(objectUrl);
        // Everything the avatar says out loud is said here, so this is where
        // it is remembered: a microphone that catches this line — a live voice
        // screen listening while the transcript's speak button plays, a
        // listener left over from a screen that has been replaced, a room
        // whose speakers beat the browser's echo cancellation — can then
        // recognise the avatar's own words instead of answering them.
        rememberAvatarSpokenLine(text);
        const utteranceKey = key ?? text;
        let playBlocked = false;
        await new Promise((resolve) => {
          let ended = false;
          const finish = (autoplayBlocked = false) => {
            if (ended) return;
            ended = true;
            if (autoplayBlocked) playBlocked = true;
            // Clear settle first so a nested stop cannot re-enter finish, but
            // keep the detach/audio handles so release can tear them down.
            bindAvatarSpeechSession({
              ownerId: null,
              abortController: null,
              detachListeners,
              settleUtterance: null,
              audioElement: audio,
              objectUrl,
            });
            releaseAvatarSpeechSessionMedia();
            publishAvatarSpeechSession({
              isSpeaking: false,
              speakingKey: null,
            });
            onEnd?.();
            resolve();
          };
          const detachListeners = () => {
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
          };
          const onEnded = () => finish(false);
          const onError = () => finish(false);
          bindAvatarSpeechSession({
            ownerId,
            abortController: controller,
            detachListeners,
            settleUtterance: finish,
            audioElement: audio,
            objectUrl,
          });
          publishAvatarSpeechSession({
            isSpeaking: false,
            speakingKey: utteranceKey,
          });
          audio.addEventListener('ended', onEnded, { once: true });
          audio.addEventListener('error', onError, { once: true });
          audio.addEventListener(
            'play',
            () => {
              publishAvatarSpeechSession({
                isSpeaking: true,
                speakingKey: utteranceKey,
              });
              onStart?.();
            },
            { once: true }
          );
          audio.play().then(
            () => {},
            (playError) => finish(isSpeechPlayBlocked(playError))
          );
        });
        return !playBlocked;
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
          const body = speakError?.body;
          const nested =
            body?.detail && typeof body.detail === 'object' ? body.detail : null;
          const collectedSeconds =
            body?.collected_seconds ?? nested?.collected_seconds ?? 0;
          setNotReady({
            collectedSeconds,
            minimumSeconds:
              body?.instant_minimum_seconds ??
              nested?.instant_minimum_seconds ??
              60,
            detail:
              (typeof body?.detail === 'string' && body.detail) ||
              speakError?.message,
          });
          // Speak-aloud and live replies share this path. The toast is once
          // per conversation so a speak press and an auto-reply do not stack.
          showVoiceNotReadyToast({
            assistantId,
            avatarName,
            collectedSeconds,
            conversationId,
            prompt: promptForMissingClonedVoice,
          });
        } else if (kind === 'unavailable') {
          // Not "create a voice" — the clone may already exist. The API process
          // itself cannot speak (missing key / media store).
          toast.error(
            'Voice speaking is unavailable on this server right now.',
            { id: 'avatar-speak-unavailable' }
          );
        } else if (
          isProviderCreditExhausted(speakError) ||
          isProviderKeyRefused(speakError)
        ) {
          showRequestFailureToast(speakError);
        } else {
          console.error('Speech failed:', speakError);
          // Say why when the server said why. "Could not speak" on its own
          // gives the reader nothing to act on; a 502 from the voice vendor,
          // a network drop and an expired session all read the same.
          const reason = speakFailureReason(speakError);
          toast.error(
            reason
              ? `The avatar could not speak that message: ${reason}`
              : 'The avatar could not speak that message.',
            { id: 'avatar-speak-failed' }
          );
        }
        bindAvatarSpeechSession({
          ownerId: null,
          abortController: null,
          detachListeners: null,
          settleUtterance: null,
          audioElement: null,
          objectUrl: null,
        });
        releaseAvatarSpeechSessionMedia();
        publishAvatarSpeechSession({ isSpeaking: false, speakingKey: null });
        onEnd?.();
        return false;
      }
    },
    [
      asAnonymousIdentity,
      avatarName,
      blocked,
      conversationId,
      missingClonedVoice,
      promptForMissingClonedVoice,
      stop,
    ]
  );

  return {
    speak,
    stop,
    isSpeaking,
    speakingKey,
    notReady,
    blocked,
    reportVoiceReadiness,
  };
}
