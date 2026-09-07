import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cardFromConnectResponse,
  cardFromConnectionRow,
  cardFromLoginResult,
  cardStatusLine,
  connectionCardMessage,
  connectionKeyOfCard,
  connectionsOf,
  isConnectionCardOnly,
  pendingCardFromInterrupt,
  resolvePendingCards,
  settlePendingCards,
} from './connectionCards.js';

const gmailInterrupt = {
  kind: 'connect_account',
  provider: 'gmail',
  display_name: 'Gmail',
  icon_key: 'gmail',
  category: 'mail',
  login_mode: 'oauth_popup',
  uses_popup: true,
  login_endpoint: '/connect_account/oauth/start',
  login_request: { provider: 'gmail' },
  tool_count: 6,
  tool_names: ['a', 'b', 'c', 'd', 'e', 'f'],
  fields: [],
};

test('cards are read from the live list first, then the stored metadata', () => {
  const stored = [{ provider: 'gmail', status: 'connected' }];
  assert.deepEqual(connectionsOf({ response_metadata: { connections: stored } }), stored);
  const live = [{ provider: 'slack', status: 'pending_login' }];
  assert.deepEqual(
    connectionsOf({ connections: live, response_metadata: { connections: stored } }),
    live
  );
  assert.deepEqual(connectionsOf({}), []);
  assert.deepEqual(connectionsOf(null), []);
});

test('an interrupt becomes a pending card and other interrupt kinds do not', () => {
  const card = pendingCardFromInterrupt(gmailInterrupt);
  assert.equal(card.status, 'pending_login');
  assert.equal(card.pending, true);
  assert.equal(card.login_endpoint, '/connect_account/oauth/start');
  assert.equal(pendingCardFromInterrupt({ kind: 'fact_correction' }), null);
  assert.equal(pendingCardFromInterrupt(null), null);
});

test('the status line reads like the API prints for the caption strip', () => {
  assert.equal(
    cardStatusLine({
      display_name: 'Gmail',
      status: 'connected',
      tool_count: 6,
      display_label: 'evan',
    }),
    'Gmail · Added · 6 tools · Connected as evan'
  );
  assert.equal(
    cardStatusLine({ display_name: 'Gmail', status: 'connected', tool_count: 1 }),
    'Gmail · Added · 1 tool'
  );
  assert.equal(
    cardStatusLine({ display_name: 'Gmail', status: 'pending_login' }),
    'Gmail · Waiting for sign-in'
  );
  assert.equal(
    cardStatusLine({ display_name: 'Gmail', status: 'cancelled' }),
    'Gmail · Not connected'
  );
  assert.equal(
    cardStatusLine({ display_name: 'Gmail', status: 'failed' }),
    'Gmail · Sign-in failed'
  );
  assert.equal(cardStatusLine({ provider: 'slack' }), 'slack · Not connected');
});

test('a message with only cards is card-only; words, files, or charts make a bubble', () => {
  const cardOnly = connectionCardMessage(gmailInterrupt, 'nonce-1');
  assert.equal(cardOnly.id, 'connection-card-nonce-1');
  assert.equal(cardOnly.connectionPauseId, cardOnly.id);
  assert.equal(isConnectionCardOnly(cardOnly), true);
  assert.equal(isConnectionCardOnly({ ...cardOnly, content: 'Sure.' }), false);
  assert.equal(isConnectionCardOnly({ ...cardOnly, isLoading: true }), false);
  assert.equal(
    isConnectionCardOnly({
      ...cardOnly,
      response_metadata: { charts: [{ chart_id: 'c' }] },
    }),
    false
  );
  assert.equal(isConnectionCardOnly({ content: 'hello' }), false);
});

test('settling flips the pending card and leaves other messages alone', () => {
  const pause = connectionCardMessage(gmailInterrupt, 'n');
  const messages = [{ id: 'm1', content: 'hi' }, pause];
  const settled = settlePendingCards(messages, {
    pauseMessageId: pause.id,
    resultCard: { status: 'connected', account_key: 'gmail:evan', display_label: 'evan' },
  });
  assert.equal(settled[0], messages[0]);
  assert.equal(settled[1].connections[0].status, 'connected');
  assert.equal(settled[1].connections[0].display_label, 'evan');
  assert.equal(settled[1].connections[0].tool_count, 6);
  assert.equal(settled[1].connections[0].pending, false);

  const cancelled = settlePendingCards(messages, { pauseMessageId: pause.id });
  assert.equal(cancelled[1].connections[0].status, 'cancelled');
  assert.equal(settlePendingCards(messages, { pauseMessageId: null }), messages);
});

test('resolving drops the pause card once the reply carries the record', () => {
  const pause = connectionCardMessage(gmailInterrupt, 'n');
  const reply = {
    id: 'reply',
    content: 'Gmail is connected.',
    response_metadata: { connections: [{ provider: 'gmail', status: 'connected' }] },
  };
  const messages = [{ id: 'm1', content: 'hi' }, pause, reply];
  const resolved = resolvePendingCards(messages, {
    pauseMessageId: pause.id,
    cards: reply.response_metadata.connections,
  });
  assert.deepEqual(
    resolved.map((message) => message.id),
    ['m1', 'reply']
  );

  const spoken = { ...pause, content: 'Let me connect that.' };
  const keptWords = resolvePendingCards([spoken, reply], {
    pauseMessageId: pause.id,
    cards: reply.response_metadata.connections,
  });
  assert.equal(keptWords.length, 2);
  assert.deepEqual(keptWords[0].connections, []);

  const untouched = resolvePendingCards(messages, { pauseMessageId: pause.id, cards: [] });
  assert.equal(untouched, messages);
});

test('records are built from a connections row, a login result, and a connect answer', () => {
  const card = pendingCardFromInterrupt(gmailInterrupt);
  const fromRow = cardFromConnectionRow(
    {
      provider: 'gmail',
      connection_key: 'account:gmail:evan@example.com',
      display_label: 'evan',
      sub_label: 'evan@example.com',
      connected: true,
    },
    card
  );
  assert.equal(fromRow.status, 'connected');
  assert.equal(fromRow.account_key, 'gmail:evan@example.com');
  assert.equal(fromRow.account_address, 'evan@example.com');
  assert.equal(fromRow.display_name, 'Gmail');
  assert.equal(connectionKeyOfCard(fromRow), 'account:gmail:evan@example.com');
  assert.equal(connectionKeyOfCard({}), null);

  const fromResult = cardFromLoginResult(
    { ok: true, provider: 'gmail', account_key: 'gmail:evan', display_label: 'evan', tool_count: 6 },
    card
  );
  assert.equal(fromResult.status, 'connected');
  assert.equal(fromResult.tool_count, 6);
  const failed = cardFromLoginResult({ ok: false, error: 'Denied' }, card);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.error, 'Denied');

  const fromAnswer = cardFromConnectResponse(
    { connected: true, account: { account_key: 'custom_mcp:x', display_label: 'My tools', tool_names: ['a', 'b'] } },
    { ...card, provider: 'custom_mcp', display_name: 'Custom connector' }
  );
  assert.equal(fromAnswer.tool_count, 2);
  assert.equal(fromAnswer.display_label, 'My tools');
  assert.equal(fromAnswer.display_name, 'Custom connector');
});
