// The `error` frame a message stream ends with when the turn failed after the
// response had already begun.
//
// An HTTP status can only be sent before the first byte. A turn that is
// refused up front — a spent allotment at the gate — is a 402 response and the
// API client turns it into an `ApiError`. A turn that fails while streaming
// (the model vendor refusing for want of credit, a metering call inside the
// run refused with 402, the graph raising) has a 200 already on the wire, so
// the server says why in a last `data:` frame instead:
//
//   {"type": "error", "status": 402, "code": "...", "message": "..."}
//
// This module turns that frame into the same shape the API client throws, so
// the one reporting path (transcript notice for billing, toast for the rest)
// serves both.

/**
 * @param {Object|null|undefined} frame The `error` frame as parsed.
 * @returns {Error & {status: number|null, code: string|null, body: Object}}
 */
export function streamErrorFromFrame(frame) {
  const message =
    typeof frame?.message === 'string' && frame.message.trim()
      ? frame.message.trim()
      : typeof frame?.detail === 'string' && frame.detail.trim()
        ? frame.detail.trim()
        : '';
  const status = Number.isInteger(frame?.status) ? frame.status : null;
  const code =
    typeof frame?.code === 'string' && frame.code.trim()
      ? frame.code.trim()
      : null;
  const streamError = new Error(message);
  streamError.name = 'StreamError';
  streamError.status = status;
  streamError.code = code;
  streamError.body = { ...(frame ?? {}) };
  return streamError;
}

export default streamErrorFromFrame;
