import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  describeSubscriptionRow,
  summariseSubscriptions,
} from './socialSubscriptionStatus.js';

test('a proven, subscribed account reads as working and offers to pull more', () => {
  const described = describeSubscriptionRow({
    ownership_state: 'proven',
    subscription_status: 'active',
    subscribable: true,
    content_transport: 'websub',
  });
  assert.equal(described.proven, true);
  assert.equal(described.subscribed, true);
  assert.equal(described.action, 'pull_more');
  assert.deepEqual(
    described.pills.map((pill) => pill.text),
    ['Verified yours', 'Subscribed'],
  );
});

test('an unverified account explains itself rather than describing its transport', () => {
  // How the platform would announce is beside the point while nothing it
  // announces will be used at all.
  const described = describeSubscriptionRow({
    ownership_state: 'unproven',
    content_transport: 'websub',
    ownership_detail: 'Add the verification token to the page.',
  });
  assert.equal(described.proven, false);
  assert.equal(described.action, 'verify');
  assert.equal(described.explanation, 'Add the verification token to the page.');
  assert.equal(described.pills[0].text, 'Not verified');
  assert.equal(described.pills[0].tone, 'warn');
});

test('an unverified account with no stated reason still says it is unused', () => {
  const described = describeSubscriptionRow({ ownership_state: 'unproven' });
  assert.match(described.explanation, /will not be used|until it is verified/);
});

test('a proven account whose subscription is pending does not claim to be subscribed', () => {
  const described = describeSubscriptionRow({
    ownership_state: 'proven',
    subscription_status: 'pending',
    subscribable: true,
  });
  assert.equal(described.subscribed, false);
  assert.deepEqual(
    described.pills.map((pill) => pill.text),
    ['Verified yours', 'Waiting for the platform to confirm'],
  );
});

test('a proven account on a platform that announces nothing says so', () => {
  const described = describeSubscriptionRow({
    ownership_state: 'proven',
    subscribable: false,
    content_transport: 'none',
  });
  assert.ok(
    described.pills.some((pill) => pill.text === 'No new-post alerts'),
  );
  assert.equal(described.explanation, 'This platform offers no way to announce new posts');
});

test('a lapsed subscription is reported, not hidden', () => {
  const described = describeSubscriptionRow({
    ownership_state: 'proven',
    subscription_status: 'expired',
    subscribable: true,
  });
  assert.ok(described.pills.some((pill) => pill.text.includes('Lapsed')));
});

test('the summary counts what is working and what still needs the owner', () => {
  const summary = summariseSubscriptions([
    { ownership_state: 'proven', subscription_status: 'active' },
    { ownership_state: 'proven', subscription_status: 'active' },
    { ownership_state: 'unproven' },
  ]);
  assert.equal(summary, '2 accounts keeping your avatar current · 1 still to verify.');
});

test('the summary is singular when there is one of each', () => {
  const summary = summariseSubscriptions([
    { ownership_state: 'proven', subscription_status: 'active' },
    { ownership_state: 'unproven' },
  ]);
  assert.equal(summary, '1 account keeping your avatar current · 1 still to verify.');
});

test('an empty panel invites rather than reporting zero', () => {
  assert.equal(summariseSubscriptions([]), 'No accounts connected yet.');
});
