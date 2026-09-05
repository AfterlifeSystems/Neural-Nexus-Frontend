/**
 * Stopping a reply the avatar is still generating.
 *
 * The stream announces its `request_id` in its first frame (`turn_started`).
 * With that id — or, failing that, the thread id — the browser asks the server
 * to end the reply through `POST /message/{assistant_id}/stop`; the server
 * then cancels the model call, keeps what was said so far on the thread, and
 * ends the stream with a `done` frame flagged `stopped`, which the client
 * finalizes exactly like a completed reply. When neither id is known, or the
 * stop route cannot be reached in time, the browser aborts the fetch instead
 * and finalizes locally with what arrived; the server treats the disconnect
 * the same way as a stop.
 */

/**
 * How long to wait for the server's own `done` frame after a stop request
 * before aborting the fetch as a fallback.
 */
export const STOP_FALLBACK_ABORT_DELAY_MS = 4000;

/**
 * Which way a running turn can be stopped.
 *
 * @param {Object} turn
 * @param {string|null} [turn.requestId] The id from the `turn_started` frame.
 * @param {string|null} [turn.threadId] The conversation the turn runs on.
 * @returns {'server'|'abort'} `server` asks the API to end the reply; `abort`
 *   cuts the connection because the API has no way to identify the turn.
 */
export function resolveStopStrategy({ requestId, threadId } = {}) {
  return requestId || threadId ? 'server' : 'abort';
}

/**
 * Whether an error is the browser reporting an aborted fetch.
 *
 * @param {*} error
 * @returns {boolean}
 */
export function isAbortError(error) {
  return Boolean(error) && error.name === 'AbortError';
}

/**
 * The terminal frame a locally aborted turn is finalized with.
 *
 * Mirrors the server's stopped `done` frame so the same finalization path
 * handles both: the content is whatever streamed before the abort, or nothing
 * when the stream was carrying the correction tool's internal proposal.
 *
 * @param {Object} parameters
 * @param {string} parameters.streamedText Everything streamed so far.
 * @param {boolean} [parameters.suppressed] The stream was internal JSON, not a reply.
 * @param {string|null} [parameters.threadId] The conversation, when known.
 * @param {string|null} [parameters.requestId] The request, when known.
 * @returns {Object} A `done` frame with `stopped: true`.
 */
export function buildLocallyStoppedDoneFrame({
  streamedText,
  suppressed = false,
  threadId = null,
  requestId = null,
}) {
  return {
    type: 'done',
    stopped: true,
    stopped_by: 'user',
    content: suppressed ? '' : (streamedText ?? ''),
    thread_id: threadId ?? null,
    request_id: requestId ?? null,
  };
}

/**
 * Whether a finalized avatar message was cut short by the person.
 *
 * @param {Object} terminalFrame The `done` frame.
 * @returns {boolean}
 */
export function terminalFrameWasStopped(terminalFrame) {
  return Boolean(
    terminalFrame &&
    (terminalFrame.stopped === true ||
      terminalFrame.response_metadata?.stopped === true)
  );
}
