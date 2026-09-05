import assert from 'node:assert/strict';
import { test } from 'node:test';

import { restoreSignedInUser } from './authSession.js';

test('prefers the email the API reports so account settings can show it', () => {
  const restored = restoreSignedInUser(
    { id: 'u1', email: 'old@example.com' },
    { logged_in: true, email: 'kovotap375@liondapt.com' }
  );
  assert.equal(restored.email, 'kovotap375@liondapt.com');
  assert.equal(restored.id, 'u1');
});

test('keeps the stored email when the status body omits one', () => {
  const restored = restoreSignedInUser(
    { id: 'u1', email: 'kept@example.com' },
    { logged_in: true }
  );
  assert.equal(restored.email, 'kept@example.com');
});

test('does not invent a signed-in user from a logged-out status', () => {
  assert.equal(
    restoreSignedInUser({ id: 'u1', email: 'a@b.c' }, { logged_in: false }),
    null
  );
  assert.equal(restoreSignedInUser(null, { logged_in: true, email: 'a@b.c' }), null);
});
