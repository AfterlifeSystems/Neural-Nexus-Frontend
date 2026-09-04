// src/hooks/useIdentityMediaJobs.js
//
// Avatar Settings reads identity-media upload cards from the store that
// outlives this screen. Hydrate on open so a job that started before this
// mount — leave and return, another tab, a refresh — comes back with its
// status indicator.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelIdentityMediaJob,
  dismissIdentityMediaJob,
  hydrateIdentityMediaJobs,
  listStoredIdentityMediaJobs,
  startIdentityMediaUpload,
  subscribeIdentityMediaJobs,
} from '../services/identityMediaJobs';

/**
 * @param {string} assistantId The open avatar.
 * @param {Object} [options]
 * @param {Function} [options.onDocumentsChanged] Re-read stored media when a
 *   job finishes (also used when a restored job completes after remount).
 * @returns {{
 *   jobs: Array<Object>,
 *   startUpload: Function,
 *   cancelJob: Function,
 *   dismissJob: Function,
 * }}
 */
export default function useIdentityMediaJobs(
  assistantId,
  { onDocumentsChanged } = {}
) {
  const [jobs, setJobs] = useState(() =>
    listStoredIdentityMediaJobs(assistantId)
  );
  const onDocumentsChangedRef = useRef(onDocumentsChanged);
  onDocumentsChangedRef.current = onDocumentsChanged;

  useEffect(() => {
    const sync = () => setJobs(listStoredIdentityMediaJobs(assistantId));
    const notifyDocumentsChanged = () => onDocumentsChangedRef.current?.();
    sync();
    const unsubscribe = subscribeIdentityMediaJobs(sync);
    hydrateIdentityMediaJobs(assistantId, {
      onDocumentsChanged: notifyDocumentsChanged,
    });
    return unsubscribe;
  }, [assistantId]);

  const startUpload = useCallback(
    (options) =>
      startIdentityMediaUpload({
        assistantId,
        onDocumentsChanged: () => onDocumentsChangedRef.current?.(),
        ...options,
      }),
    [assistantId]
  );

  return {
    jobs,
    startUpload,
    cancelJob: cancelIdentityMediaJob,
    dismissJob: dismissIdentityMediaJob,
  };
}
