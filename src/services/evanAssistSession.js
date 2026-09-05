// src/services/evanAssistSession.js
//
// The Evan help overlay talks to one public avatar on its own thread, so a
// conversation the person is already having is not overwritten. Screen
// observations use the same ambient message shape the rest of the app uses;
// they only run while the overlay is open and a screen share is live.
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
});

/**
 * Whether Evan should be sent screen observations right now.
 *
 * Observations start when the help window is open and a screen share is live,
 * and they stop when either of those ends. There is no separate switch.
 *
 * @param {Object} conditions
 * @param {boolean} conditions.windowOpen The help overlay is on screen.
 * @param {boolean} conditions.hasScreenShare A display stream is live.
 * @returns {boolean}
 */
export function isEvanScreenObservationActive({ windowOpen, hasScreenShare }) {
  return Boolean(windowOpen && hasScreenShare);
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
 * One-at-a-time gate so a screen look and a typed/spoken turn never share
 * the same Evan thread at once. The server parks a run per thread; a second
 * POST while a look is open is refused, which the person reads as "unable
 * to send" right after "Evan is looking".
 *
 * @returns {{busy: boolean, run: Function}}
 */
export function createTurnGate() {
  let tail = Promise.resolve();
  let pending = 0;
  return {
    get busy() {
      return pending > 0;
    },
    run(task) {
      pending += 1;
      const runThis = async () => {
        try {
          return await task();
        } finally {
          pending -= 1;
        }
      };
      const scheduled = tail.then(runThis, runThis);
      tail = scheduled.then(
        () => undefined,
        () => undefined
      );
      return scheduled;
    },
  };
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
 * @param {Object} options
 * @param {string} [options.text] What the person typed or said.
 * @param {string} [options.locationLabel] A short place name.
 * @param {boolean} [options.screenShared] A screen still will travel with the turn.
 * @returns {{displayText: string, apiText: string}}
 */
export function buildEvanUserMessage({
  text = '',
  locationLabel = '',
  screenShared = false,
} = {}) {
  const displayText = String(text ?? '').trim();
  const notes = [];
  if (locationLabel) {
    notes.push(`[Neural Nexus] The person is looking at ${locationLabel}.`);
  }
  if (screenShared) {
    notes.push('[Neural Nexus] A live screen share is attached.');
  }
  const spoken = displayText || (screenShared ? 'What do you see, and how can you help?' : '');
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

