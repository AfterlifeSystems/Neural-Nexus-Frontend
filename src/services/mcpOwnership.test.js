import assert from 'node:assert/strict';
import { test } from 'node:test';

import { retainOwnedMcpDevices } from './mcpOwnership.js';

test('keeps machines that name this account as owner', () => {
  const devices = [
    { device_id: 'mine', owner_user_id: 'acct-b' },
    { device_id: 'theirs', owner_user_id: 'acct-a' },
  ];
  assert.deepEqual(retainOwnedMcpDevices(devices, 'acct-b'), [devices[0]]);
});

test('keeps unstamped rows so an older API payload still lists', () => {
  const devices = [{ device_id: 'legacy' }];
  assert.deepEqual(retainOwnedMcpDevices(devices, 'acct-b'), devices);
});

test('returns the list unchanged when the payload has no account id', () => {
  const devices = [{ device_id: 'theirs', owner_user_id: 'acct-a' }];
  assert.deepEqual(retainOwnedMcpDevices(devices, undefined), devices);
});
