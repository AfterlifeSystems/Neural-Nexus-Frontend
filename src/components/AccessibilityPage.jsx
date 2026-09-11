import { Camera, MessageSquare, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { MdAccessible } from 'react-icons/md';

import { useAuth } from '../context/AuthContext';
import { useMediaShare } from '../context/MediaShareContext';
import useSceneNarration from '../hooks/useSceneNarration';
import { canSpeakLocally } from '../services/sceneNarrationSpeech';
import { openVoiceChat } from '../services/voiceModePreference';
import { SCENE_NARRATION_PACE_OPTIONS } from '../config/sceneNarrationInterval';
import { resolveAssistantId } from './utils';

/**
 * One pace, in the words it should be read out as.
 *
 * "Every 60 seconds" is what the number says and "every minute" is what a
 * person says, and this label is spoken by a screen reader every time the
 * slider moves.
 *
 * @param {number} seconds
 * @returns {string}
 */
function describePace(seconds) {
  if (seconds === 60) return 'Every minute';
  return `Every ${seconds} seconds`;
}

/**
 * The Accessibility screen: describe my surroundings, and everything about it.
 *
 * The one mode on this page turns the phone into a pair of eyes that talk. The
 * rear camera is pointed at whatever is in front of the person — held up, or
 * worn on a lanyard — and every few seconds the avatar says what is there,
 * obstacles and signs and people first.
 *
 * Written to be used without seeing it. Every control is a real button with a
 * real label, the state of the switch is announced in a live region as well as
 * spoken aloud, and the page says in words what to do next rather than showing
 * it. The heading order is the outline a screen reader reads out.
 */
const AccessibilityPage = () => {
  const navigate = useNavigate();
  const { activeAvatar } = useAuth();
  const {
    sceneNarrationOn,
    sceneNarrationSeconds,
    setSceneNarrationOn,
    setSceneNarrationSeconds,
  } = useSceneNarration();
  const { ambientStatus, sceneNarrationSpeaking, webcamStream } =
    useMediaShare();

  const avatarName = activeAvatar?.name;
  const assistantId = resolveAssistantId(activeAvatar);
  const intervalSeconds = sceneNarrationSeconds;
  const paceIndex = Math.max(
    0,
    SCENE_NARRATION_PACE_OPTIONS.indexOf(intervalSeconds)
  );
  const paceLabel = describePace(intervalSeconds);

  const statusLine = !sceneNarrationOn
    ? 'Describing is off.'
    : !activeAvatar
      ? 'Describing is on, but no avatar is open yet. Open an avatar and the descriptions will begin.'
      : !webcamStream
        ? 'Describing is on. Waiting for the camera — allow camera access if your browser asks.'
        : sceneNarrationSpeaking
          ? `${avatarName ?? 'Your avatar'} is speaking.`
          : ambientStatus?.inFlight
            ? 'Looking at what your camera can see.'
            : `Describing is on. ${avatarName ?? 'Your avatar'} describes what your camera sees. ${paceLabel}.`;

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <header className="flex items-center gap-3 mb-2">
          <MdAccessible
            className="w-7 h-7 shrink-0 text-amber-300"
            aria-hidden
          />
          <h1 className="text-2xl font-semibold text-neutral-100">
            Accessibility
          </h1>
        </header>
        <p className="text-white/60 mb-8">
          Have your avatar tell you what is in front of you, out loud, for as
          long as you want it to.
        </p>

        <section
          aria-labelledby="describe-heading"
          className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6 mb-6"
        >
          <h2
            id="describe-heading"
            className="text-lg font-semibold text-neutral-100 mb-1"
          >
            Describe my surroundings
          </h2>
          <p className="text-white/60 text-sm mb-5">
            Point your phone&apos;s back camera at what is in front of you —
            held up, or worn on a lanyard. Every few seconds{' '}
            {avatarName ?? 'your avatar'} says what is there, starting with
            anything in your way and any writing worth reading to you.
          </p>
          <p className="text-white/60 text-sm mb-5">
            This setting changes what your camera does, so it follows the
            camera: turning the camera off stops the describing, and turning it
            back on starts it again while this is switched on. The camera
            preview in the sidebar is marked whenever describing is running. You
            can also just ask {avatarName ?? 'your avatar'} to start or stop
            describing, or to go faster or slower.
          </p>

          <button
            type="button"
            onClick={() =>
              setSceneNarrationOn(!sceneNarrationOn, {
                avatarName,
                assistantId,
              })
            }
            aria-pressed={sceneNarrationOn}
            className={`w-full flex items-center justify-center gap-3 px-5 py-4 rounded-xl text-base font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/70 ${
              sceneNarrationOn
                ? 'bg-amber-400 text-neutral-900 hover:bg-amber-300'
                : 'bg-white/10 text-neutral-100 hover:bg-white/20'
            }`}
          >
            <MdAccessible className="w-5 h-5 shrink-0" aria-hidden /> // asdf
            {sceneNarrationOn
              ? 'Stop describing my surroundings'
              : 'Start describing my surroundings'}
          </button>

          {/* Announced as well as shown: the state of this switch is the one
              thing on the page a person must never have to look to learn. */}
          <p
            role="status"
            aria-live="polite"
            className="mt-4 text-sm text-white/70"
          >
            {statusLine}
          </p>

          <div className="mt-6 pt-5 border-t border-white/10">
            <label
              htmlFor="narration-pace"
              className="block text-sm font-medium text-neutral-200"
            >
              How often you are told
            </label>
            <p className="text-white/50 text-xs mt-1 mb-3">
              You can also just say it: &ldquo;describe things more often&rdquo;
              or &ldquo;not so often&rdquo;.
            </p>
            <div className="flex items-center gap-4">
              {/* The slider runs over the five choices rather than over
                  seconds, so every position is one the person can be told the
                  name of and no drag lands somewhere meaningless. */}
              <input
                id="narration-pace"
                type="range"
                min={0}
                max={SCENE_NARRATION_PACE_OPTIONS.length - 1}
                step={1}
                value={paceIndex}
                onChange={(changeEvent) =>
                  setSceneNarrationSeconds(
                    SCENE_NARRATION_PACE_OPTIONS[
                      Number(changeEvent.target.value)
                    ]
                  )
                }
                // A bare "2" is what a screen reader would otherwise announce.
                // This is what position two actually means.
                aria-valuetext={paceLabel}
                className="flex-1 h-2 accent-amber-400 cursor-pointer"
              />
              <span
                className="w-28 shrink-0 text-sm text-neutral-200 tabular-nums"
                aria-hidden
              >
                {paceLabel}
              </span>
            </div>
            {/* Pressable as well as draggable: a slider is hard work with a
                screen reader, and on a phone it is hard work for anybody. */}
            <div className="mt-3 flex flex-wrap gap-2">
              {SCENE_NARRATION_PACE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSceneNarrationSeconds(option)}
                  aria-pressed={option === intervalSeconds}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/70 ${
                    option === intervalSeconds
                      ? 'bg-amber-400 text-neutral-900 font-semibold'
                      : 'bg-white/10 text-neutral-200 hover:bg-white/20'
                  }`}
                >
                  {option === 60 ? '1 min' : `${option}s`}
                </button>
              ))}
            </div>
            <p className="text-white/40 text-xs mt-3">
              The pace changes how much is said as well as how often. Every five
              seconds gives you the one thing that matters most; every minute
              gives you the fuller picture. Faster suits moving through
              somewhere unfamiliar, slower suits sitting still.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="ways-heading"
          className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6 mb-6"
        >
          <h2
            id="ways-heading"
            className="text-lg font-semibold text-neutral-100 mb-4"
          >
            Other ways to start and stop it
          </h2>
          <ul className="space-y-4 text-sm text-white/70">
            <li className="flex gap-3">
              <MessageSquare
                className="w-4 h-4 mt-0.5 shrink-0 text-white/40"
                aria-hidden
              />
              <span>
                <span className="text-neutral-200">
                  Just ask, in any conversation.
                </span>{' '}
                Say or type &ldquo;describe what&apos;s around me&rdquo; to any
                avatar, or to the help avatar in the corner, and it starts.
                &ldquo;Stop describing&rdquo; ends it. You never have to find
                this page again.
              </span>
            </li>
            <li className="flex gap-3">
              <Volume2
                className="w-4 h-4 mt-0.5 shrink-0 text-white/40"
                aria-hidden
              />
              <span>
                <span className="text-neutral-200">By voice, hands free.</span>{' '}
                Voice mode listens and answers aloud, which is the easiest way
                to use this while you are moving.
                {assistantId && (
                  <button
                    type="button"
                    onClick={() => openVoiceChat(assistantId)}
                    className="ml-2 underline text-amber-300 hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400/70 rounded"
                  >
                    Open voice mode
                  </button>
                )}
              </span>
            </li>
            <li className="flex gap-3">
              <MdAccessible
                className="w-4 h-4 mt-0.5 shrink-0 text-white/40"
                aria-hidden
              />
              <span>
                <span className="text-neutral-200">From the sidebar.</span> The
                same switch sits in the sidebar on every screen, under the
                accessibility symbol.
              </span>
            </li>
          </ul>
        </section>

        <section
          aria-labelledby="details-heading"
          className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6"
        >
          <h2
            id="details-heading"
            className="text-lg font-semibold text-neutral-100 mb-4"
          >
            What to expect
          </h2>
          <ul className="space-y-4 text-sm text-white/70">
            <li className="flex gap-3">
              <Camera
                className="w-4 h-4 mt-0.5 shrink-0 text-white/40"
                aria-hidden
              />
              <span>
                Your camera opens when you switch this on and closes when you
                switch it off. A scene that has not changed is not described
                again straight away, so standing still is quiet; if nothing
                changes for a minute you will hear the scene again anyway, so
                silence never leaves you wondering whether it is still running.
              </span>
            </li>
            <li className="flex gap-3">
              <Volume2
                className="w-4 h-4 mt-0.5 shrink-0 text-white/40"
                aria-hidden
              />
              <span>
                Descriptions are spoken in {avatarName ?? 'your avatar'}&apos;s
                own voice, and so is the line confirming the mode.{' '}
                {canSpeakLocally()
                  ? 'If it does not, your browser reads them instead, so you always hear them.'
                  : 'This browser cannot speak on its own, so an avatar voice is needed here.'}
              </span>
            </li>
            <li className="flex gap-3">
              <MessageSquare
                className="w-4 h-4 mt-0.5 shrink-0 text-white/40"
                aria-hidden
              />
              <span>
                Every description is also written into the conversation, so you
                can go back over what was said, and anyone helping you can read
                it.
              </span>
            </li>
          </ul>
          <button
            type="button"
            onClick={() => navigate('/account')}
            className="mt-6 text-sm underline text-white/60 hover:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-400/70 rounded"
          >
            Account settings
          </button>
        </section>
      </div>
    </div>
  );
};

export default AccessibilityPage;
