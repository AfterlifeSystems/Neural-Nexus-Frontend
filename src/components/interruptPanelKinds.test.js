import { test } from 'node:test';
import assert from 'node:assert/strict';

import { interruptNeedsPanel } from './interruptPanelKinds.js';

test('a look_now pause from the Minecraft companion never draws a panel', () => {
  assert.equal(
    interruptNeedsPanel({ kind: 'look_now', silent: true, sources: ['screen'] }),
    false
  );
});

test('a fact review with nothing to review draws no panel', () => {
  assert.equal(interruptNeedsPanel({ kind: 'fact_correction', matches: [] }), false);
  assert.equal(interruptNeedsPanel({ kind: 'fact_correction', matches: [{ index: 0 }] }), true);
  assert.equal(interruptNeedsPanel({ kind: 'research_verification', matches: [{ index: 0 }] }), true);
  assert.equal(interruptNeedsPanel({ matches: [{ index: 0 }] }), true);
});

test('the dedicated panels still draw', () => {
  assert.equal(interruptNeedsPanel({ kind: 'phone_call_confirm' }), true);
  assert.equal(interruptNeedsPanel({ kind: 'mcp_connect_consent' }), true);
  assert.equal(interruptNeedsPanel({ kind: 'something_new' }), false);
  assert.equal(interruptNeedsPanel(null), false);
});
