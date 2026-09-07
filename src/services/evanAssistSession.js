// src/services/evanAssistSession.js
//
// The Evan help overlay talks to one public avatar on its own thread, so a
// conversation the person is already having is not overwritten. Screen and
// webcam observations use the same ambient message shape the rest of the app
// uses; they only run while the overlay is open and a share is live, and they
// are background context alone — a snapshot never rides along with a message
// the person typed or spoke.
//
// This file is the pure half — request builders and stream folding — so the
// Node test runner can load it without Vite or the API client. The fetch
// wrappers live in evanAssistApi.js.

export const INITIAL_EVAN_STREAM = Object.freeze({
  streamedText: '',
  activity: null,
  terminal: null,
  interrupt: null,
  ambientDecision: null,
  ambientSummary: null,
  observationId: null,
  threadId: null,
  // The id the first frame announces, so an observation still streaming can be
  // ended through the stop route the moment the person sends a message.
  requestId: null,
});

/**
 * Whether Evan should be sent ambient observations right now.
 *
 * Observations start when the help window is open and either the screen or the
 * webcam is live, and they stop when the window closes or the last share ends.
 * There is no separate switch.
 *
 * @param {Object} conditions
 * @param {boolean} conditions.windowOpen The help overlay is on screen.
 * @param {boolean} [conditions.hasScreenShare] A display stream is live.
 * @param {boolean} [conditions.hasWebcam] A webcam stream is live.
 * @returns {boolean}
 */
export function isEvanObservationActive({
  windowOpen,
  hasScreenShare = false,
  hasWebcam = false,
}) {
  return Boolean(windowOpen && (hasScreenShare || hasWebcam));
}

/**
 * Status for Evan's screen looks. The shared ambient label says "Could not
 * send" after a failed look, which reads as if the person's message was
 * refused. A failed look is only a failed look.
 *
 * @param {Object} status
 * @param {number} nextInMs
 * @returns {string}
 */
export function describeEvanAmbientStatus(status, nextInMs) {
  if (!status) return '';
  if (status.inFlight) return 'Looking…';
  const seconds = Math.ceil((nextInMs ?? 0) / 1000);
  if (status.lastError && status.consecutiveFailures > 0) {
    return seconds > 0 ? `Look failed · next in ${seconds}s` : 'Look failed';
  }
  if (status.lastDecision) {
    const label =
      status.lastDecision === 'respond'
        ? 'Spoke up'
        : status.lastDecision === 'notify'
          ? 'Heads-up sent'
          : 'Noticed quietly';
    return seconds > 0 ? `${label} · next in ${seconds}s` : label;
  }
  return seconds > 0 ? `First look in ${seconds}s` : 'Looking…';
}

/**
 * Pull a list of avatar records out of whatever shape the public listing used.
 *
 * @param {*} response GET /list_public_avatars body.
 * @returns {Array}
 */
export function asAvatarList(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.avatars)) return response.avatars;
  return [];
}

/**
 * Pick Evan from a public listing.
 *
 * A configured id wins. Otherwise the listing is searched by the name "Evan".
 * A fallback id is used only when nothing in the listing matched, so a
 * deployment that has not published Evan yet still has a target.
 *
 * @param {Array|Object} avatars Public avatar records.
 * @param {Object} options
 * @param {string} [options.configuredId] VITE_EVAN_ASSISTANT_ID, if set.
 * @param {string} [options.fallbackId] Demo / default public assistant.
 * @param {string} [options.displayName='Evan'] Name to match when no id hits.
 * @returns {Object|null}
 */
export function pickEvanAvatar(
  avatars,
  { configuredId, fallbackId, displayName = 'Evan' } = {}
) {
  const list = asAvatarList(avatars);
  const idOf = (avatar) =>
    avatar?.assistant_id ?? avatar?.avatar_id ?? avatar?.metadata?.assistant_id;

  if (configuredId) {
    const configured = list.find((avatar) => idOf(avatar) === configuredId);
    if (configured) return configured;
  }

  const namePattern = new RegExp(
    `^${String(displayName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
    'i'
  );
  const named = list.find((avatar) => namePattern.test(avatar?.name ?? ''));
  if (named) return named;

  if (fallbackId) {
    const fallback = list.find((avatar) => idOf(avatar) === fallbackId);
    if (fallback) return fallback;
    return { assistant_id: fallbackId, name: displayName };
  }

  if (configuredId) {
    return { assistant_id: configuredId, name: displayName };
  }

  return null;
}

/**
 * Whether the sidebar should offer the Evan help control.
 *
 * Hidden inside the landing-page demo iframe (too small, and that frame is
 * already Evan). Hidden on Evan's own public share page, where the visitor
 * is already talking to him.
 *
 * @param {Object} conditions
 * @param {boolean} [conditions.inIframe]
 * @param {string} [conditions.pathname]
 * @param {string|null} [conditions.currentAssistantId]
 * @param {string|null} [conditions.evanAssistantId]
 * @returns {boolean}
 */
export function shouldOfferEvanAssist({
  inIframe = false,
  pathname = '',
  currentAssistantId = null,
  evanAssistantId = null,
} = {}) {
  if (inIframe) return false;
  if (
    evanAssistantId &&
    currentAssistantId &&
    currentAssistantId === evanAssistantId &&
    /^\/share\/[^/]+/.test(pathname ?? '')
  ) {
    return false;
  }
  return true;
}

/**
 * Build the user-visible words plus the location note Evan receives.
 *
 * The bubble shows `displayText`. The API receives `apiText`, which names
 * where in Neural Nexus the person is standing so Evan can talk about the
 * screen they are looking at.
 *
 * No snapshot travels with the turn: the shares reach Evan as background
 * observations on their own timer, so the message goes out the instant it is
 * typed. The note only tells Evan which shares he is already watching, so he
 * can answer "what do you see" from the looks already in the thread.
 *
 * @param {Object} options
 * @param {string} [options.text] What the person typed or said.
 * @param {string} [options.locationLabel] A short place name.
 * @param {boolean} [options.screenShared] The screen is being shared right now.
 * @param {boolean} [options.webcamShared] The webcam is on right now.
 * @returns {{displayText: string, apiText: string}}
 */
export function buildEvanUserMessage({
  text = '',
  locationLabel = '',
  screenShared = false,
  webcamShared = false,
} = {}) {
  const displayText = String(text ?? '').trim();
  const sharing = Boolean(screenShared || webcamShared);
  const notes = [];
  if (locationLabel) {
    notes.push(`[Neural Nexus] The person is looking at ${locationLabel}.`);
  }
  if (screenShared && webcamShared) {
    notes.push(
      '[Neural Nexus] The person is sharing the screen and the webcam with you ' +
        'right now; you are being sent looks at both in the background.'
    );
  } else if (screenShared) {
    notes.push(
      '[Neural Nexus] The person is sharing the screen with you right now; ' +
        'you are being sent looks at it in the background.'
    );
  } else if (webcamShared) {
    notes.push(
      '[Neural Nexus] The person is sharing the webcam with you right now; ' +
        'you are being sent looks at it in the background.'
    );
  }
  const spoken =
    displayText || (sharing ? 'What do you see, and how can you help?' : '');
  const apiText = [...notes, spoken].filter(Boolean).join('\n');
  return { displayText: spoken, apiText };
}

/**
 * Build a streamed turn to Evan.
 *
 * @param {string} assistantId Evan's assistant id.
 * @param {Object} options
 * @param {string} options.message The text Evan should read.
 * @param {string|null} [options.threadId]
 * @param {File[]} [options.files]
 * @param {string} [options.userTimezone]
 * @returns {{path: string, formData: FormData}}
 */
export function buildEvanMessageRequest(
  assistantId,
  { message, threadId, files = [], userTimezone } = {}
) {
  const formData = new FormData();
  formData.append('message', message ?? '');
  formData.append('stream', 'true');
  if (threadId) {
    formData.append('thread_id', threadId);
  }
  for (const file of files ?? []) {
    formData.append('files', file);
  }
  if (userTimezone) {
    formData.append('user_timezone', userTimezone);
  }
  return {
    path: `/message/${encodeURIComponent(assistantId)}`,
    formData,
  };
}

/**
 * Build the resume request for a turn Evan paused for approval.
 *
 * @param {string} assistantId
 * @param {Object} options
 * @param {string} options.threadId
 * @param {string} options.decision
 * @param {Array} [options.items]
 * @param {string} [options.userTimezone]
 * @returns {{path: string, formData: FormData}}
 */
export function buildEvanResumeRequest(
  assistantId,
  { threadId, decision, items, userTimezone } = {}
) {
  const formData = new FormData();
  formData.append('thread_id', threadId);
  formData.append('decision', decision);
  if (items) {
    formData.append('items', JSON.stringify(items));
  }
  if (userTimezone) {
    formData.append('user_timezone', userTimezone);
  }
  return {
    path: `/message/${encodeURIComponent(assistantId)}/resume`,
    formData,
  };
}

/**
 * Fold one server-sent event into the overlay's stream state.
 *
 * @param {Object} status
 * @param {Object} event
 * @returns {Object}
 */
export function reduceEvanStreamEvent(status, event) {
  const current = status ?? INITIAL_EVAN_STREAM;
  switch (event?.type) {
    case 'turn_started':
      return {
        ...current,
        requestId: event.request_id ?? current.requestId,
        threadId: event.thread_id ?? current.threadId,
      };
    case 'assistant_token':
      return {
        ...current,
        streamedText: `${current.streamedText ?? ''}${event.text ?? ''}`,
        activity: 'Responding',
      };
    case 'usage_estimate':
      return { ...current, activity: 'Thinking' };
    case 'status':
      return { ...current, activity: event.text || 'Thinking' };
    case 'keepalive_comment':
      return { ...current, activity: 'Reflecting on the reply' };
    case 'ambient_decision':
      return {
        ...current,
        ambientDecision: event.decision ?? null,
        ambientSummary: event.summary ?? null,
        observationId: event.observation_id ?? null,
      };
    case 'done':
      return {
        ...current,
        activity: null,
        terminal: event,
        streamedText: event.content ?? current.streamedText,
        threadId: event.thread_id ?? current.threadId,
        interrupt: null,
      };
    case 'interrupt':
      return {
        ...current,
        activity: null,
        terminal: event,
        interrupt: event.interrupt ?? null,
        threadId: event.thread_id ?? current.threadId,
      };
    default:
      return current;
  }
}

