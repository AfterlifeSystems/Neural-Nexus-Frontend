import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ADMIN_ACCOUNT_EMAIL,
  canUploadReferenceMedia,
  isAdminAccount,
} from './adminAccount.js';

const administrator = { id: 'admin-1', email: ADMIN_ACCOUNT_EMAIL };
const otherUser = { id: 'user-2', email: 'someone@example.com' };

test('isAdminAccount matches the configured administrator email', () => {
  assert.equal(isAdminAccount(administrator), true);
  assert.equal(
    isAdminAccount({ email: ADMIN_ACCOUNT_EMAIL.toUpperCase() }),
    true
  );
  assert.equal(isAdminAccount(otherUser), false);
  assert.equal(isAdminAccount({ email: '' }), false);
  assert.equal(isAdminAccount(null), false);
});

test('reference-media upload is offered only to the administrator', () => {
  assert.equal(canUploadReferenceMedia(administrator), true);
  assert.equal(canUploadReferenceMedia(otherUser), false);
  assert.equal(canUploadReferenceMedia(null), false);
});
