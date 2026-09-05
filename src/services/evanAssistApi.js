// Fetch wrappers for the Evan help overlay. Kept apart from the pure session
// helpers so those can be tested in Node without the API client.

import {
  requestJson,
  streamServerSentEvents,
} from './neuralNexusApiClient';
import { buildAmbientMessageRequest } from './avatarService';
import {
  INITIAL_EVAN_STREAM,
  reduceEvanStreamEvent,
} from './evanAssistSession';

/**
 * Stream one Evan turn and reduce every frame into a single snapshot.
 *
 * @param {{path: string, formData: FormData}} request
 * @param {Object} options
 * @param {boolean} [options.asAnonymousIdentity]
 * @param {AbortSignal} [options.signal]
 * @param {Function} [options.onUpdate]
 * @returns {Promise<Object>}
 */
export async function streamEvanTurn(
  request,
  { asAnonymousIdentity = false, signal, onUpdate } = {}
) {
  let state = { ...INITIAL_EVAN_STREAM };
  await streamServerSentEvents(request.path, {
    method: 'POST',
    formData: request.formData,
    asAnonymousIdentity,
    signal,
    onEvent: (streamEvent) => {
      state = reduceEvanStreamEvent(state, streamEvent);
      onUpdate?.(state, streamEvent);
    },
  });
  return state;
}

/**
 * Send one ambient screen observation to Evan.
 *
 * @param {string} assistantId
 * @param {File[]} files
 * @param {Object} options
 * @param {string|null} [options.threadId]
 * @param {boolean} [options.voiceMode]
 * @param {boolean} [options.asAnonymousIdentity]
 * @param {Function} [options.onUpdate]
 * @returns {Promise<Object>}
 */
export async function streamEvanObservation(
  assistantId,
  files,
  { threadId, voiceMode = false, asAnonymousIdentity = false, onUpdate } = {}
) {
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const request = buildAmbientMessageRequest(assistantId, files, {
    threadId,
    capturedAt: new Date().toISOString(),
    voiceMode,
    userTimezone,
  });
  return streamEvanTurn(request, { asAnonymousIdentity, onUpdate });
}

/**
 * Load an existing Evan help thread, dropping hidden ambient human turns.
 *
 * @param {string} assistantId
 * @param {string} threadId
 * @param {Object} [options]
 * @param {boolean} [options.asAnonymousIdentity]
 * @returns {Promise<Array>}
 */
export async function loadEvanThreadMessages(
  assistantId,
  threadId,
  { asAnonymousIdentity = false } = {}
) {
  const response = await requestJson(
    `/conversations/${encodeURIComponent(threadId)}/messages`,
    {
      query: { assistant_id: assistantId },
      asAnonymousIdentity,
    }
  );
  const stored = Array.isArray(response?.messages) ? response.messages : [];
  return stored
    .filter((message) => message?.type === 'human' || message?.type === 'ai')
    .filter((message) => !message?.additional_kwargs?.hidden)
    .map((message) => ({
      id: message.id ?? `evan-${message.timestamp ?? Date.now()}`,
      type: message.type,
      content:
        typeof message.content === 'string'
          ? message.content
          : Array.isArray(message.content)
            ? message.content
                .map((part) =>
                  typeof part === 'string' ? part : (part?.text ?? '')
                )
                .join('')
            : String(message.content ?? ''),
      timestamp:
        message.timestamp ??
        message.created_at ??
        message.additional_kwargs?.created_at ??
        null,
      ambient: message.response_metadata?.ambient ?? null,
      isLoading: false,
    }));
}
