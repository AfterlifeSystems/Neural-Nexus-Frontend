// src/services/selfEchoGuard.js
//
// The last line of defence against an avatar answering itself.
//
// Live voice mode closes the microphone while the avatar speaks, so its own
// voice should never reach the recorder. Should is not never: a speaker at
// volume, a Bluetooth headset whose audio lags the `ended` event, or a browser
// whose echo cancellation gives up all put the avatar's own sentence into the
// microphone, where it is transcribed and sent back as if the person had said
// it. The avatar then replies to its own words, and the conversation walks in
// a circle.
//
// So a transcript that reads as something the avatar just said is dropped
// before it becomes a turn. The comparison is deliberately conservative:
// dropping a real turn is worse than letting one echo through, so only a long
// utterance that closely matches recent avatar speech is discarded. Short
// replies — "yeah", "okay", "that's true" — are never dropped, because a
// person says those constantly and they carry no evidence either way.

/** Fewer words than this and a match is not evidence of an echo. */
export const SELF_ECHO_MINIMUM_WORDS = 5;

/** Word-pair overlap above this reads as the same sentence. */
export const SELF_ECHO_MINIMUM_SIMILARITY = 0.7;

/**
 * In the moment right after the avatar stops, a shorter run of words counts.
 *
 * What the microphone catches then is usually the tail of the sentence rather
 * than the whole of it — "…feels like a problem" arriving as "as a problem" —
 * and three words are not enough for the similarity score above to say
 * anything. Inside that window a verbatim run of the avatar's own words is
 * evidence on its own; outside it, the same three words are just a person
 * agreeing, and are left alone. Two words are left alone either way — "yeah
 * exactly" is what people say back to each other, and losing a real one of
 * those is worse than answering one echo.
 */
export const SELF_ECHO_FRAGMENT_MINIMUM_WORDS = 3;

/**
 * Reduce a spoken line to comparable words.
 *
 * Transcription punctuates and capitalises differently every time, so neither
 * survives the comparison; the words themselves are what carry the match.
 *
 * @param {string|null|undefined} text
 * @returns {string[]} Lowercase words, in order.
 */
export function spokenWordsOf(text) {
  if (typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Adjacent word pairs, which capture word order without demanding the whole
 * sentence line up: a transcript that misses the opening words or trails off
 * still overlaps heavily with what was actually said.
 *
 * @param {string[]} words
 * @returns {string[]}
 */
function wordPairsOf(words) {
  const pairs = [];
  for (let index = 0; index + 1 < words.length; index += 1) {
    pairs.push(`${words[index]} ${words[index + 1]}`);
  }
  return pairs;
}

/**
 * How much of the shorter line appears, in order, inside the longer one.
 *
 * Scored against the shorter of the two on purpose: the microphone usually
 * catches only part of a spoken reply, and a fragment of the avatar's sentence
 * is still the avatar's sentence.
 *
 * @param {string} transcript
 * @param {string} spokenByAvatar
 * @returns {number} 0 through 1.
 */
export function spokenSimilarity(transcript, spokenByAvatar) {
  const heardPairs = wordPairsOf(spokenWordsOf(transcript));
  const saidPairs = new Set(wordPairsOf(spokenWordsOf(spokenByAvatar)));
  if (heardPairs.length === 0 || saidPairs.size === 0) return 0;
  const shared = heardPairs.filter((pair) => saidPairs.has(pair)).length;
  return shared / Math.min(heardPairs.length, saidPairs.size);
}

/**
 * Whether a transcript is a run of words lifted straight out of something the
 * avatar said — the tail of a sentence, caught as the speakers finished.
 *
 * Contiguous on purpose: "a problem" appearing somewhere in a reply is common,
 * but a person's whole turn being nothing but words the avatar just said, in
 * that order, is not.
 *
 * @param {string|null|undefined} transcript
 * @param {Array<string|null|undefined>} recentAvatarSpeech
 * @param {Object} [options]
 * @param {number} [options.minimumWords]
 * @returns {boolean}
 */
export function isAvatarSpeechFragment(
  transcript,
  recentAvatarSpeech,
  { minimumWords = SELF_ECHO_FRAGMENT_MINIMUM_WORDS } = {}
) {
  const heard = spokenWordsOf(transcript);
  if (heard.length < minimumWords) return false;
  const run = heard.join(' ');
  return (recentAvatarSpeech ?? []).some((spoken) => {
    const said = spokenWordsOf(spoken).join(' ');
    return said.length > 0 && said.includes(run);
  });
}

/**
 * Whether a transcript is the avatar hearing itself rather than a person
 * speaking.
 *
 * @param {string|null|undefined} transcript What the microphone produced.
 * @param {Array<string|null|undefined>} recentAvatarSpeech The lines the avatar
 *   spoke aloud most recently, newest last.
 * @param {Object} [options]
 * @param {boolean} [options.followedAvatarSpeech] The recording began while, or
 *   just after, the avatar was audible — so a short verbatim run of its words
 *   counts as an echo too.
 * @param {number} [options.minimumWords]
 * @param {number} [options.minimumSimilarity]
 * @returns {boolean}
 */
export function isAvatarSelfEcho(
  transcript,
  recentAvatarSpeech,
  {
    followedAvatarSpeech = false,
    minimumWords = SELF_ECHO_MINIMUM_WORDS,
    minimumSimilarity = SELF_ECHO_MINIMUM_SIMILARITY,
  } = {}
) {
  const heard = spokenWordsOf(transcript);
  if (heard.length === 0) return false;
  if (
    followedAvatarSpeech &&
    isAvatarSpeechFragment(transcript, recentAvatarSpeech)
  ) {
    return true;
  }
  if (heard.length < minimumWords) return false;
  return (recentAvatarSpeech ?? []).some(
    (spoken) => spokenSimilarity(transcript, spoken) >= minimumSimilarity
  );
}

/**
 * Keep only the last few lines the avatar spoke. Anything older cannot still
 * be coming out of the speakers.
 *
 * @param {string[]} spokenLines
 * @param {string} line
 * @param {number} [keep]
 * @returns {string[]}
 */
export function rememberAvatarSpeech(spokenLines, line, keep = 3) {
  if (!line?.trim()) return spokenLines ?? [];
  const next = [...(spokenLines ?? []), line];
  return next.length <= keep ? next : next.slice(next.length - keep);
}
