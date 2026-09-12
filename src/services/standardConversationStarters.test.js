import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  STANDARD_STARTERS_STORAGE_KEY,
  cachedStandardConversationStarters,
  forgetStandardConversationStarters,
  normalizeStandardStartersRecord,
  rememberStandardConversationStarters,
  resetStandardConversationStartersForTests,
  resolveStandardConversationStarters,
  standardConversationStartersOf,
  subscribeStandardConversationStarters,
} from './standardConversationStarters.js';

const ASSISTANT_ID = 'asst-guard';
const RECRUITER = [
  'What are the requirements to join the National Guard?',
  'Which roles are you recruiting for right now?',
  'Walk me through the first step to enlist.',
];

function withFakeStorage(run) {
  const store = new Map();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
  });
  resetStandardConversationStartersForTests();
  try {
    run(store);
  } finally {
    resetStandardConversationStartersForTests();
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
}

test('a record is normalized to three distinct specific starters', () => {
  const record = normalizeStandardStartersRecord({
    starters: [...RECRUITER, 'What roles are open?', RECRUITER[0]],
    generated_at: '2026-09-11T20:00:00+00:00',
    source: 'deep_research',
  });
  assert.deepEqual(record.starters, RECRUITER);
  assert.equal(record.generatedAt, '2026-09-11T20:00:00+00:00');
  assert.equal(record.source, 'deep_research');
});

test('a generic or empty record is not a standard set', () => {
  assert.equal(normalizeStandardStartersRecord(null), null);
  assert.equal(normalizeStandardStartersRecord({ starters: ['Hi'] }), null);
  assert.equal(
    normalizeStandardStartersRecord({
      starters: ['Hey, how are you?', 'Tell me more', 'I missed you'],
    }),
    null
  );
});

test('the set is read from the metadata for owners and the top level for visitors', () => {
  const record = { starters: RECRUITER, generated_at: '2026-09-11T20:00:00Z' };
  assert.deepEqual(
    standardConversationStartersOf({
      assistant_id: ASSISTANT_ID,
      metadata: { conversation_starters: record },
    }).starters,
    RECRUITER
  );
  assert.deepEqual(
    standardConversationStartersOf({
      assistant_id: ASSISTANT_ID,
      conversation_starters: record,
    }).starters,
    RECRUITER
  );
  assert.equal(standardConversationStartersOf({ assistant_id: ASSISTANT_ID }), null);
});

test('a set on the avatar record is remembered and survives a reload', () => {
  withFakeStorage((store) => {
    const avatar = {
      assistant_id: ASSISTANT_ID,
      metadata: {
        conversation_starters: {
          starters: RECRUITER,
          generated_at: '2026-09-11T20:00:00Z',
        },
      },
    };
    assert.deepEqual(resolveStandardConversationStarters(avatar), RECRUITER);
    assert.ok(store.get(STANDARD_STARTERS_STORAGE_KEY).includes(RECRUITER[0]));

    // "Reload": the in-memory map is gone, storage is not.
    const kept = store.get(STANDARD_STARTERS_STORAGE_KEY);
    resetStandardConversationStartersForTests();
    store.set(STANDARD_STARTERS_STORAGE_KEY, kept);

    // The record no longer carries the set (say, a stale listing); the
    // browser still holds it.
    assert.deepEqual(
      resolveStandardConversationStarters({ assistant_id: ASSISTANT_ID }),
      RECRUITER
    );
  });
});

test('a newer set replaces the held one and an older set does not', () => {
  withFakeStorage(() => {
    rememberStandardConversationStarters(ASSISTANT_ID, {
      starters: RECRUITER,
      generated_at: '2026-09-11T20:00:00Z',
    });
    const newer = [
      'Can you share the National Guard website?',
      'What benefits come with enlisting?',
      'How long is basic training?',
    ];
    rememberStandardConversationStarters(ASSISTANT_ID, {
      starters: newer,
      generated_at: '2026-09-12T08:00:00Z',
    });
    assert.deepEqual(cachedStandardConversationStarters(ASSISTANT_ID).starters, newer);

    rememberStandardConversationStarters(ASSISTANT_ID, {
      starters: RECRUITER,
      generated_at: '2026-09-10T08:00:00Z',
    });
    assert.deepEqual(cachedStandardConversationStarters(ASSISTANT_ID).starters, newer);
  });
});

test('listeners hear when a set lands or is forgotten', () => {
  withFakeStorage(() => {
    const heard = [];
    const stop = subscribeStandardConversationStarters((id) => heard.push(id));
    rememberStandardConversationStarters(ASSISTANT_ID, {
      starters: RECRUITER,
      generated_at: '2026-09-11T20:00:00Z',
    });
    forgetStandardConversationStarters(ASSISTANT_ID);
    stop();
    rememberStandardConversationStarters(ASSISTANT_ID, {
      starters: RECRUITER,
      generated_at: '2026-09-11T21:00:00Z',
    });
    assert.deepEqual(heard, [ASSISTANT_ID, ASSISTANT_ID]);
    assert.equal(
      cachedStandardConversationStarters(ASSISTANT_ID)?.starters[0],
      RECRUITER[0]
    );
  });
});

test('sets are held per avatar', () => {
  withFakeStorage(() => {
    rememberStandardConversationStarters('asst-a', {
      starters: RECRUITER,
      generated_at: '2026-09-11T20:00:00Z',
    });
    assert.equal(cachedStandardConversationStarters('asst-b'), null);
    assert.equal(resolveStandardConversationStarters({ assistant_id: 'asst-b' }), null);
  });
});
