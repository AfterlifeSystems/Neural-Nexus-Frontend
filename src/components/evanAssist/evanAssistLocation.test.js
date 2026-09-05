import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeAssistLocation } from './evanAssistLocation.js';

test('gallery, settings, and a named chat are described in ordinary words', () => {
  assert.equal(describeAssistLocation('/avatars'), 'the avatar gallery');
  assert.equal(
    describeAssistLocation('/chat/abc', '?tab=settings', 'Maya'),
    'settings for Maya'
  );
  assert.equal(
    describeAssistLocation('/chat/abc', '', 'Maya'),
    'a conversation with Maya'
  );
  assert.equal(describeAssistLocation('/billing'), 'billing');
  assert.equal(
    describeAssistLocation('/share/xyz', '', 'Evan'),
    'a shared conversation with Evan'
  );
});
