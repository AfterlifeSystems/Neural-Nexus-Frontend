// POST /speak can refuse for three different reasons that must not be
// collapsed:
//
//   blocked   — a clone exists and ElevenLabs has banned it. More recording
//               does not clear it. Settings explain the ban; do not call this
//               "no voice model" or "not yet uploaded".
//   not_ready — no clone has been uploaded or trained yet. Settings can fix
//               that, and that is the one case the missing-voice-model toast
//               is for.
//   billing   — the month's allotment is spent.
//   failed    — anything else (vendor 502, network). Not a standing fact
//               about the avatar's voice.

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
    text.includes('no cloned voice') ||
    text.includes('no voice yet') ||
    text.includes('does not have a voice model') ||
    text.includes('record about two minutes')
  );
}

/**
 * Which kind of speak refusal this is.
 *
 * @param {Error|null|undefined} speakError
 * @returns {'blocked'|'not_ready'|'billing'|'failed'}
 */
export function speakFailureKind(speakError) {
  if (speakError?.status === PAYMENT_REQUIRED_STATUS) return 'billing';

  const code = speakFailureCode(speakError);
  if (code === 'voice_blocked') return 'blocked';
  if (code === 'voice_not_ready') return 'not_ready';

  const text = speakFailureText(speakError);
  if (textSaysVoiceBlocked(text)) return 'blocked';
  if (textSaysVoiceNotReady(text)) return 'not_ready';

  // Seconds collected are only reported when there is no clone yet.
  if (
    speakError?.body &&
    typeof speakError.body === 'object' &&
    'collected_seconds' in speakError.body
  ) {
    return 'not_ready';
  }

  return 'failed';
}
