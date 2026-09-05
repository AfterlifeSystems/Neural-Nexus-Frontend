import assert from 'node:assert/strict';
import { test } from 'node:test';

import { selectMcpDeviceToBind } from './mcpBindTarget.js';

test('a listed machine binds only that device id', () => {
  assert.deepEqual(
    selectMcpDeviceToBind({
      connection_key: 'device:linux-pc',
      source: 'device',
      device_id: 'linux-pc',
      display_label: 'linux-pc',
    }),
    { deviceId: 'linux-pc', deviceLabel: 'linux-pc' }
  );
});

test('a pending connector does not guess another account\'s desktop', () => {
  assert.deepEqual(
    selectMcpDeviceToBind({
      connection_key: 'device:pending:ubuntu',
      source: 'device',
      pending: true,
      platform: 'ubuntu',
      display_label: 'Ubuntu desktop',
    }),
    { deviceId: undefined, deviceLabel: undefined }
  );
});
