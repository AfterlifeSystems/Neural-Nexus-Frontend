// attachmentArchive.js
//
// Keeps the files a user attached to a message visible after a page reload.
//
// The API cannot do this for us. `/conversations/{thread_id}/messages` answers
// with the raw LangGraph state, and by the time a turn is stored the upload has
// already been turned into a transcript or an image description and the bytes
// discarded — there is no address to fetch an attachment back from. The object
// URL the composer minted dies with the page, so a reloaded transcript showed a
// message with its attachment silently missing, and an image-only message as an
// empty bubble.
//
// So the browser keeps its own copy. This is a per-origin, per-device cache for
// display only: it never travels with the conversation, and a different browser
// or a cleared site data shows the transcript the way the server tells it.
//
// Keying: attachments are stored against the ORDINAL of the human message
// within its thread — the first message the user sent is 0, the second 1 — not
// against a message id. The optimistic message carries a temporary local id and
// the server assigns its own, so the two never match; ordinals do, because
// these threads are append-only and both sides count the same messages in the
// same order.

const DATABASE_NAME = 'neural-nexus-attachments';
const DATABASE_VERSION = 1;
const OBJECT_STORE_NAME = 'message_attachments';
const THREAD_INDEX_NAME = 'by_thread';
const SAVED_AT_INDEX_NAME = 'by_saved_at';

// How long a cached attachment is worth keeping. Long enough that reopening
// last week's conversation still shows what was sent, short enough that a
// browser profile does not accumulate every file the user ever attached.
const MAXIMUM_AGE_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;

/**
 * Whether this browser can store attachments at all.
 *
 * Private windows, embedded webviews and hardened privacy settings can leave
 * `indexedDB` missing or throw on access. Every function here degrades to doing
 * nothing rather than breaking a conversation over a display convenience.
 *
 * @returns {boolean} True when IndexedDB is usable.
 */
const isStorageAvailable = () => {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
};

/**
 * Open the archive, creating its schema on first use.
 *
 * @returns {Promise<IDBDatabase|null>} The open database, or null when this
 *   browser cannot provide one.
 */
const openArchiveDatabase = () => {
  if (!isStorageAvailable()) return Promise.resolve(null);
  return new Promise((resolve) => {
    let openRequest;
    try {
      openRequest = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    } catch {
      resolve(null);
      return;
    }
    openRequest.onupgradeneeded = () => {
      const database = openRequest.result;
      if (!database.objectStoreNames.contains(OBJECT_STORE_NAME)) {
        const objectStore = database.createObjectStore(OBJECT_STORE_NAME, {
          keyPath: 'entryKey',
        });
        objectStore.createIndex(THREAD_INDEX_NAME, 'threadId', {
          unique: false,
        });
        objectStore.createIndex(SAVED_AT_INDEX_NAME, 'savedAt', {
          unique: false,
        });
      }
    };
    openRequest.onsuccess = () => resolve(openRequest.result);
    // A blocked or failed open is not worth reporting to the user: the
    // transcript still renders, it simply loses the attachment previews.
    openRequest.onerror = () => resolve(null);
    openRequest.onblocked = () => resolve(null);
  });
};

/**
 * Run one transaction and resolve when it has actually committed.
 *
 * @param {IDBDatabase} database The open archive.
 * @param {IDBTransactionMode} transactionMode 'readonly' or 'readwrite'.
 * @param {Function} runWithStore Receives the object store; its return value is
 *   resolved once the transaction completes.
 * @returns {Promise<*>} Whatever `runWithStore` produced, or null on failure.
 */
const runInTransaction = (database, transactionMode, runWithStore) =>
  new Promise((resolve) => {
    let result = null;
    let transaction;
    try {
      transaction = database.transaction(OBJECT_STORE_NAME, transactionMode);
    } catch {
      resolve(null);
      return;
    }
    // Resolve on `oncomplete`, not on the request callback: a write is only
    // durable once the transaction commits, and a quota failure surfaces here.
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => resolve(null);
    transaction.onabort = () => resolve(null);
    try {
      result = runWithStore(transaction.objectStore(OBJECT_STORE_NAME));
    } catch {
      resolve(null);
    }
  });

/**
 * The key one message's attachments are stored under.
 *
 * @param {string} threadId The conversation.
 * @param {number} humanMessageOrdinal Which of the user's messages this is.
 * @returns {string} The primary key.
 */
const buildEntryKey = (threadId, humanMessageOrdinal) =>
  `${threadId}:${humanMessageOrdinal}`;

/**
 * Remember the files attached to one message.
 *
 * Files are stored as Blobs, which IndexedDB holds natively — no base64
 * inflation. A failure here (quota exhausted, storage disabled) is swallowed:
 * the message was still sent, and only the local preview is lost.
 *
 * @param {string} threadId The conversation the message belongs to.
 * @param {number} humanMessageOrdinal Which of the user's messages this is,
 *   counting from zero.
 * @param {File[]} attachedFiles The files that were sent.
 * @returns {Promise<void>}
 */
export const saveMessageAttachments = async (
  threadId,
  humanMessageOrdinal,
  attachedFiles
) => {
  if (!threadId || !attachedFiles?.length) return;
  const database = await openArchiveDatabase();
  if (!database) return;
  const archiveEntry = {
    entryKey: buildEntryKey(threadId, humanMessageOrdinal),
    threadId,
    humanMessageOrdinal,
    savedAt: Date.now(),
    attachments: attachedFiles.map((attachedFile) => ({
      filename: attachedFile.name,
      contentType: attachedFile.type || '',
      // `File` is a `Blob`, and the structured clone that IndexedDB performs
      // keeps it readable as one after a reload.
      blob: attachedFile,
    })),
  };
  await runInTransaction(database, 'readwrite', (objectStore) => {
    objectStore.put(archiveEntry);
  });
  database.close();
};

/**
 * Recover every attachment remembered for one conversation.
 *
 * @param {string} threadId The conversation being opened.
 * @returns {Promise<Map<number, Array<{filename: string, contentType: string, blob: Blob}>>>}
 *   Attachments keyed by the ordinal of the human message they belong to.
 *   Empty when nothing was stored or storage is unavailable.
 */
export const loadThreadAttachments = async (threadId) => {
  const attachmentsByOrdinal = new Map();
  if (!threadId) return attachmentsByOrdinal;
  const database = await openArchiveDatabase();
  if (!database) return attachmentsByOrdinal;
  const archiveEntries = await runInTransaction(
    database,
    'readonly',
    (objectStore) => {
      const collected = [];
      const cursorRequest = objectStore
        .index(THREAD_INDEX_NAME)
        .openCursor(IDBKeyRange.only(threadId));
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        collected.push(cursor.value);
        cursor.continue();
      };
      return collected;
    }
  );
  database.close();
  for (const archiveEntry of archiveEntries ?? []) {
    attachmentsByOrdinal.set(
      archiveEntry.humanMessageOrdinal,
      archiveEntry.attachments ?? []
    );
  }
  return attachmentsByOrdinal;
};

/**
 * Drop everything older than the retention window.
 *
 * Called once when the provider mounts. Nothing depends on it succeeding, so it
 * neither reports nor retries.
 *
 * @returns {Promise<void>}
 */
export const pruneExpiredAttachments = async () => {
  const database = await openArchiveDatabase();
  if (!database) return;
  const oldestTimestampToKeep = Date.now() - MAXIMUM_AGE_MILLISECONDS;
  await runInTransaction(database, 'readwrite', (objectStore) => {
    const cursorRequest = objectStore
      .index(SAVED_AT_INDEX_NAME)
      .openCursor(IDBKeyRange.upperBound(oldestTimestampToKeep));
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
  });
  database.close();
};
