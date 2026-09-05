// Duration, tokens, and cost for an avatar reply.
//
// The live `done` frame carries `total_response_time_ms` on the envelope.
// Stored thread messages do not: the graph only writes `token_usage` (and
// sometimes `total_cost`) onto `response_metadata`. After a reload the
// metrics line would show tokens and cost and drop the seconds unless we
// read every place the API puts a duration, and remember the live value
// for this browser.

const STORAGE_KEY = 'neural_nexus_avatar_response_metrics';
const MAX_ENTRIES_PER_THREAD = 200;

/**
 * First positive finite millisecond value among the known duration fields.
 *
 * @param {Object|null|undefined} message An avatar message or `done` frame.
 * @returns {number|null} Milliseconds, or null when none is known.
 */
export function resolveMessageResponseTimeMs(message) {
  const candidates = [
    message?.total_response_time_ms,
    message?.usage?.latency_ms,
    message?.usage?.total_response_time_ms,
    message?.response_metadata?.total_response_time_ms,
    message?.response_metadata?.latency_ms,
  ];
  for (const candidate of candidates) {
    const milliseconds = Number(candidate);
    if (Number.isFinite(milliseconds) && milliseconds > 0) {
      return milliseconds;
    }
  }
  return null;
}

/**
 * Format the screenshot metrics line: `4.6s • 8.4k tokens • $0.0012`.
 *
 * @param {Object} message An avatar message that may carry usage metadata.
 * @returns {string|null} The line, or null when nothing is known.
 */
export const formatMessageMetrics = (message) => {
  const parts = [];
  const timeMs = resolveMessageResponseTimeMs(message);
  if (timeMs != null) {
    parts.push(`${(timeMs / 1000).toFixed(1)}s`);
  }
  const tokens = Number(
    message?.usage?.total_tokens ??
      message?.response_metadata?.token_usage?.total_tokens ??
      0
  );
  if (tokens > 0) {
    parts.push(
      tokens >= 1000
        ? `${(tokens / 1000).toFixed(tokens >= 10_000 ? 0 : 1)}k tokens`
        : `${tokens} tokens`
    );
  }
  const cost = Number(
    message?.response_metadata?.total_cost ?? message?.usage?.cost_usd ?? NaN
  );
  if (Number.isFinite(cost) && cost > 0) {
    parts.push(`$${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(3)}`);
  }
  return parts.length ? parts.join(' • ') : null;
};

/**
 * A stable key for matching a live reply to the same row after reload.
 *
 * @param {string|null|undefined} content Reply text.
 * @returns {string} Fingerprint.
 */
export function fingerprintMessageContent(content) {
  return String(content ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 500);
}

function readStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota or a locked store must not break the reply.
  }
}

/**
 * Remember the duration (and clock time) of a live reply so a reload in this
 * browser can still print the seconds the API never persisted on the message.
 *
 * @param {string|null|undefined} threadId Conversation the reply belongs to.
 * @param {Object} message The finalized avatar message.
 */
export function rememberAvatarResponseMetrics(threadId, message) {
  if (!threadId || threadId.startsWith('__')) return;
  const fingerprint = fingerprintMessageContent(message?.content);
  const timeMs = resolveMessageResponseTimeMs(message);
  const timestamp = message?.timestamp ?? null;
  if (!fingerprint || (timeMs == null && !timestamp)) return;

  const store = readStore();
  const entries = Array.isArray(store[threadId]) ? [...store[threadId]] : [];
  entries.push({
    fingerprint,
    total_response_time_ms: timeMs,
    timestamp,
    request_id: message?.request_id ?? null,
  });
  store[threadId] = entries.slice(-MAX_ENTRIES_PER_THREAD);
  writeStore(store);
}

/**
 * Copy remembered duration and clock time onto loaded avatar messages that
 * no longer carry them.
 *
 * @param {string|null|undefined} threadId Conversation being opened.
 * @param {Array<Object>} messages Normalized transcript rows.
 * @returns {Array<Object>} The same rows, with remembered metrics filled in.
 */
export function applyRememberedAvatarResponseMetrics(threadId, messages) {
  if (!threadId || !Array.isArray(messages)) return messages ?? [];
  const entries = [...(readStore()[threadId] ?? [])];
  if (entries.length === 0) return messages;

  return messages.map((message) => {
    if (message?.type !== 'ai') return message;
    const alreadyHasTime = resolveMessageResponseTimeMs(message) != null;
    const alreadyHasTimestamp = Boolean(message?.timestamp);
    if (alreadyHasTime && alreadyHasTimestamp) return message;

    const fingerprint = fingerprintMessageContent(message?.content);
    const matchIndex = entries.findIndex(
      (entry) => entry.fingerprint === fingerprint
    );
    if (matchIndex === -1) return message;
    const [match] = entries.splice(matchIndex, 1);
    return {
      ...message,
      total_response_time_ms:
        alreadyHasTime
          ? message.total_response_time_ms
          : (match.total_response_time_ms ?? message.total_response_time_ms ?? null),
      timestamp: alreadyHasTimestamp
        ? message.timestamp
        : (match.timestamp ?? message.timestamp ?? null),
      request_id: message.request_id ?? match.request_id ?? null,
    };
  });
}

/**
 * Fold a resolved duration onto the fields the metrics line already reads.
 *
 * @param {Object} message Message or `done` frame fields.
 * @param {number|null} timeMs Duration to attach.
 * @returns {Object} `usage` and `response_metadata` copies that carry time.
 */
export function attachResponseTimeMs(message, timeMs) {
  const responseMetadata = { ...(message?.response_metadata ?? {}) };
  const usage =
    message?.usage && typeof message.usage === 'object'
      ? { ...message.usage }
      : {};
  if (timeMs != null) {
    responseMetadata.total_response_time_ms = timeMs;
    if (usage.latency_ms == null) {
      usage.latency_ms = timeMs;
    }
  }
  return {
    total_response_time_ms: timeMs,
    usage: Object.keys(usage).length ? usage : message?.usage ?? null,
    response_metadata: responseMetadata,
  };
}
