// POST /speak can refuse for several different reasons that must not be
// collapsed:
//
//   blocked      — a clone exists and ElevenLabs has banned it. More recording
//                  does not clear it. Settings explain the ban; do not call this
//                  "no voice model" or "not yet uploaded".
//   not_ready    — no clone has been uploaded or trained yet. Settings can fix
//                  that, and that is the one case the missing-voice-model toast
//                  is for.
//   unavailable  — this API process has no voice stack (no ElevenLabs key / no
//                  media repo). The avatar may already have a clone elsewhere;
//                  creating another will not help.
//   billing      — the month's allotment is spent.
//   failed       — anything else (vendor 502, network). Not a standing fact
//                  about the avatar's voice.

const PAYMENT_REQUIRED_STATUS = 402;

/**
 * Machine-readable code on a speak refusal, if the API sent one.
 *
 * @param {Error|null|undefined} speakError
 * @returns {string|null}
 */
export function speakFailureCode(speakError) {
  const body = speakError?.body;
  if (!body || typeof body !== 'object') return null;
  if (typeof body.error === 'string' && body.error.trim()) {
    return body.error.trim();
  }
  const nested = body.detail;
  if (nested && typeof nested === 'object' && typeof nested.error === 'string') {
    return nested.error.trim() || null;
  }
  return null;
}

function speakFailureText(speakError) {
  const detail = speakError?.body?.detail;
  return [
    speakError?.message,
    typeof detail === 'string' ? detail : null,
    speakFailureCode(speakError),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function textSaysVoiceBlocked(text) {
  return (
    text.includes('voice_blocked') ||
    text.includes('voice_access_denied') ||
    text.includes('detected_blocked_voice') ||
    text.includes('blocked this avatar') ||
    text.includes('blocked this voice') ||
    text.includes('voice model blocked')
  );
}

function textSaysVoiceNotReady(text) {
  return (
    text.includes('voice_not_ready') ||
    text.includes('voice is not ready') ||
    text.includes('voice not ready') ||
    text.includes('no cloned voice') ||
    text.includes('no voice yet') ||
    text.includes('no voice model') ||
    text.includes('does not have a voice') ||
    text.includes('voice not yet added') ||
    text.includes('has no voice') ||
    text.includes('without a voice model') ||
    text.includes('record about two minutes')
  );
}

function textSaysVoiceUnavailable(text) {
  // Server-side: no ElevenLabs key / media repo on this process. Distinct from
  // not_ready — the avatar may already have a clone; creating another will not
  // fix a key the API process never loaded.
  return (
    text.includes('voice features are not configured') ||
    text.includes('elevenlabs_api_key is not configured') ||
    text.includes('elevenlabs api key is not configured')
  );
}

function collectedSecondsFrom(speakError) {
  const body = speakError?.body;
  if (!body || typeof body !== 'object') return undefined;
  if ('collected_seconds' in body) return body.collected_seconds;
  const detail = body.detail;
  if (detail && typeof detail === 'object' && 'collected_seconds' in detail) {
    return detail.collected_seconds;
  }
  return undefined;
}

/**
 * The sentence worth showing for a plain failure, if the error carries one.
 *
 * The API client's fallback ("Request failed (502)") and a bare status code
 * are not sentences; a network error's "Failed to fetch" is not one a reader
 * can do anything with either. Anything else the server said is shown, cut
 * to a length that fits a toast.
 *
 * @param {Error|null|undefined} speakError
 * @returns {string} The reason, or '' when there is nothing worth saying.
 */
export function speakFailureReason(speakError) {
  const detail = speakError?.body?.detail;
  const candidate = (
    (typeof detail === 'string' && detail) ||
    speakError?.message ||
    ''
  ).trim();
  if (!candidate) return '';
  if (/^request failed(\s*\(\d+\))?\.?$/i.test(candidate)) return '';
  if (/^\d{3}$/.test(candidate)) return '';
  if (/^(failed to fetch|networkerror|load failed)/i.test(candidate)) return '';
  const sentence = candidate.replace(/\s+/g, ' ');
  return sentence.length > 160 ? `${sentence.slice(0, 157).trimEnd()}…` : sentence;
}

/**
 * Which kind of speak refusal this is.
 *
 * @param {Error|null|undefined} speakError
 * @returns {'blocked'|'not_ready'|'unavailable'|'billing'|'failed'}
 */
export function speakFailureKind(speakError) {
  if (speakError?.status === PAYMENT_REQUIRED_STATUS) return 'billing';

  const code = speakFailureCode(speakError);
  if (code === 'voice_blocked') return 'blocked';
  if (code === 'voice_not_ready') return 'not_ready';

  const text = speakFailureText(speakError);
  if (textSaysVoiceBlocked(text)) return 'blocked';
  // Check before not_ready: "not configured" is about the server, not a
  // missing clone on this avatar.
  if (textSaysVoiceUnavailable(text)) return 'unavailable';
  if (textSaysVoiceNotReady(text)) return 'not_ready';

  // Seconds collected are only reported when there is no clone yet. The API
  // may put them on the body or nested under `detail`.
  if (collectedSecondsFrom(speakError) !== undefined) return 'not_ready';

  // POST /speak uses 409 for a missing clone and for a banned clone. A ban
  // has already been recognised above. Anything else on 409 is a missing
  // voice model — including a bare "Conflict" that used to surface as
  // "the avatar could not speak that message" on every live reply.
  if (speakError?.status === 409) return 'not_ready';

  return 'failed';
}
