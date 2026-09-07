// src/services/connectionCards.js
//
// A connect card in the transcript, from pause to record.
//
// The avatar raises a `connect_account` interrupt when a turn needs an account
// that is not connected. While the run is paused the card is INTERACTIVE and
// lives on the message that paused; once the turn resumes, the API keeps a
// RECORD of the outcome on the reply's `response_metadata.connections`, and
// that record is what the transcript shows after a reload ("Gmail · Added ·
// 6 tools · Connected as evan"). The helpers here move a card between those
// two states without the components having to know the difference.

export const CARD_STATUS_CONNECTED = 'connected';
export const CARD_STATUS_CANCELLED = 'cancelled';
export const CARD_STATUS_FAILED = 'failed';
export const CARD_STATUS_PENDING_LOGIN = 'pending_login';
export const CARD_STATUS_NOT_CONNECTED = 'not_connected';

export const CONNECT_ACCOUNT_INTERRUPT_KIND = 'connect_account';

/**
 * The connect cards a message carries, or an empty list.
 *
 * A live pause keeps the cards on the message itself (`connections`); a
 * stored reply keeps them under `response_metadata.connections`. A message
 * that has both shows the live list, which is the one the card flow updates.
 *
 * @param {Object} message A transcript message.
 * @returns {Object[]}
 */
export function connectionsOf(message) {
  if (!message) return [];
  if (Array.isArray(message.connections)) return message.connections;
  const stored = message.response_metadata?.connections;
  return Array.isArray(stored) ? stored : [];
}

/**
 * The interactive card for a `connect_account` interrupt payload.
 *
 * The payload already carries everything the card renders (fields, login
 * mode, endpoints); the status and the `pending` flag are what mark the card
 * as one the owner can still act on.
 *
 * @param {Object} interrupt The interrupt payload.
 * @returns {Object|null} A card, or null when the payload is not a connect card.
 */
export function pendingCardFromInterrupt(interrupt) {
  if (!interrupt || typeof interrupt !== 'object') return null;
  if (interrupt.kind && interrupt.kind !== CONNECT_ACCOUNT_INTERRUPT_KIND) {
    return null;
  }
  return {
    ...interrupt,
    kind: CONNECT_ACCOUNT_INTERRUPT_KIND,
    status: CARD_STATUS_PENDING_LOGIN,
    pending: true,
  };
}

/**
 * The card a "+"-menu pick puts in the transcript before any turn exists.
 *
 * Shaped like an interrupt's card so the same component renders both; the
 * nonce tells the card's message apart from a server-side pause.
 *
 * @param {Object} providerCard A `GET /connectable_providers` row (or a
 *   `card` from a connect response).
 * @param {string} nonce A client-side identifier for this card.
 * @returns {Object}
 */
export function clientCardFromProvider(providerCard, nonce) {
  const card = pendingCardFromInterrupt({
    ...providerCard,
    kind: CONNECT_ACCOUNT_INTERRUPT_KIND,
  });
  return { ...card, client_nonce: nonce };
}

/**
 * A transcript message holding one client-side connect card.
 *
 * @param {Object} providerCard See `clientCardFromProvider`.
 * @param {string} nonce The card's identifier.
 * @returns {Object} A message MessageList renders as a card-only row.
 */
export function connectionCardMessage(providerCard, nonce) {
  const id = `connection-card-${nonce}`;
  return {
    id,
    type: 'ai',
    content: '',
    connections: [clientCardFromProvider(providerCard, nonce)],
    connectionPauseId: id,
    clientCard: true,
    timestamp: new Date().toISOString(),
  };
}

/**
 * The record the transcript keeps once a card has been acted on.
 *
 * @param {Object} card The pending card.
 * @param {Object} [outcome] What the connection produced: a status and the
 *   account fields, or an error.
 * @returns {Object}
 */
export function settledCard(card, outcome = {}) {
  const status = outcome.status ?? CARD_STATUS_CONNECTED;
  return {
    provider: card?.provider ?? outcome.provider ?? null,
    display_name: card?.display_name ?? outcome.display_name ?? card?.provider,
    icon_key: card?.icon_key ?? outcome.icon_key ?? 'custom',
    category: card?.category ?? outcome.category ?? 'custom',
    login_mode: card?.login_mode ?? outcome.login_mode ?? 'form',
    ...outcome,
    status,
    tool_count:
      outcome.tool_count ??
      (Array.isArray(card?.tool_names) ? card.tool_names.length : null) ??
      card?.tool_count ??
      0,
    tool_names: outcome.tool_names ?? card?.tool_names ?? [],
    pending: false,
  };
}

/**
 * One line describing where a card stands.
 *
 * The same sentence the API prints for the voice caption strip, kept in step
 * here so a live card and a reloaded one read alike.
 *
 * @param {Object} card A card or a card record.
 * @returns {string}
 */
export function cardStatusLine(card) {
  const name = card?.display_name || card?.provider || 'Account';
  const status = card?.status;
  if (status === CARD_STATUS_CONNECTED) {
    const count = Number(card?.tool_count) || 0;
    const label = card?.display_label || card?.account_address;
    const suffix = count ? ` · ${count} ${count === 1 ? 'tool' : 'tools'}` : '';
    const who = label ? ` · Connected as ${label}` : '';
    return `${name} · Added${suffix}${who}`;
  }
  if (status === CARD_STATUS_PENDING_LOGIN) return `${name} · Waiting for sign-in`;
  if (status === CARD_STATUS_CANCELLED) return `${name} · Not connected`;
  if (status === CARD_STATUS_FAILED) return `${name} · Sign-in failed`;
  return `${name} · Not connected`;
}

/**
 * Whether a card is still waiting on the owner.
 *
 * @param {Object} card
 * @returns {boolean}
 */
export function isPendingCard(card) {
  return Boolean(card?.pending) || card?.status === CARD_STATUS_PENDING_LOGIN;
}

/**
 * Whether a message is nothing but connect cards: no words, no files.
 *
 * Such a message renders as the cards alone, without a bubble or a portrait
 * beside an empty box.
 *
 * @param {Object} message A transcript message.
 * @returns {boolean}
 */
export function isConnectionCardOnly(message) {
  if (!message || message.isLoading) return false;
  if (connectionsOf(message).length === 0) return false;
  if (String(message.content ?? '').trim()) return false;
  if (Array.isArray(message.media) && message.media.length > 0) return false;
  const metadata = message.response_metadata ?? {};
  if (Array.isArray(metadata.created_artifacts) && metadata.created_artifacts.length) {
    return false;
  }
  if (Array.isArray(metadata.charts) && metadata.charts.length) return false;
  return true;
}

/**
 * Flip the pending card on a pause message to its outcome right away.
 *
 * Called the moment the owner finishes with the card, before the resumed turn
 * answers, so the card does not sit on "Waiting for sign-in" while the avatar
 * composes a reply.
 *
 * @param {Object[]} messages The transcript.
 * @param {Object} parameters
 * @param {string} parameters.pauseMessageId The message holding the card.
 * @param {Object|null} [parameters.resultCard] The outcome; null means the
 *   card was dismissed.
 * @returns {Object[]} The transcript with the card settled.
 */
export function settlePendingCards(messages, { pauseMessageId, resultCard = null }) {
  if (!pauseMessageId || !Array.isArray(messages)) return messages ?? [];
  return messages.map((message) => {
    if (String(message?.id) !== String(pauseMessageId)) return message;
    const cards = connectionsOf(message);
    if (cards.length === 0) return message;
    return {
      ...message,
      connections: cards.map((card) =>
        isPendingCard(card)
          ? settledCard(
              card,
              resultCard ?? { status: CARD_STATUS_CANCELLED }
            )
          : card
      ),
    };
  });
}

/**
 * Reconcile the pause message with the records the resumed reply carries.
 *
 * The reply is the transcript's record of the outcome — the one a reload
 * shows — so once the reply has a record for a card, the pause message's copy
 * of that card is removed; a pause message that held nothing else goes with
 * the card. A reply with no records leaves the pause message as the owner's
 * action left the card.
 *
 * @param {Object[]} messages The transcript.
 * @param {Object} parameters
 * @param {string} parameters.pauseMessageId The message holding the card.
 * @param {Object[]} parameters.cards The records on the reply.
 * @returns {Object[]}
 */
export function resolvePendingCards(messages, { pauseMessageId, cards }) {
  if (!pauseMessageId || !Array.isArray(messages)) return messages ?? [];
  const records = Array.isArray(cards) ? cards : [];
  if (records.length === 0) return messages;
  const recordedProviders = new Set(records.map((record) => record?.provider));
  const resolved = [];
  for (const message of messages) {
    if (String(message?.id) !== String(pauseMessageId)) {
      resolved.push(message);
      continue;
    }
    const remaining = connectionsOf(message).filter(
      (card) => !recordedProviders.has(card?.provider)
    );
    const hadOnlyCards = isConnectionCardOnly({ ...message, isLoading: false });
    if (remaining.length === 0 && hadOnlyCards) {
      continue;
    }
    resolved.push({ ...message, connections: remaining });
  }
  return resolved;
}

/**
 * The card record a `listConnections` row describes.
 *
 * @param {Object} row A connections row.
 * @param {Object} [card] The pending card, for the fields a row lacks.
 * @returns {Object}
 */
export function cardFromConnectionRow(row, card = null) {
  const connectionKey = String(row?.connection_key ?? '');
  const accountKey =
    row?.account_key ??
    (connectionKey.startsWith('account:')
      ? connectionKey.slice('account:'.length)
      : connectionKey || null);
  return settledCard(card ?? row, {
    status: CARD_STATUS_CONNECTED,
    provider: row?.provider ?? card?.provider ?? null,
    display_name: card?.display_name ?? row?.display_name ?? row?.provider,
    icon_key: card?.icon_key ?? row?.icon_key ?? 'custom',
    account_key: accountKey,
    display_label: row?.display_label ?? null,
    account_address: row?.account_address ?? row?.sub_label ?? null,
    connected_at: row?.connected_at ?? null,
    tool_count: row?.tool_count ?? card?.tool_count ?? 0,
    tool_names: row?.tool_names ?? card?.tool_names ?? [],
  });
}

/**
 * The card record a popup's login result describes.
 *
 * @param {Object} result The posted `neural-nexus:login-result` message.
 * @param {Object} [card] The pending card, for the fields a result lacks.
 * @returns {Object}
 */
export function cardFromLoginResult(result, card = null) {
  return settledCard(card ?? result, {
    status: result?.ok ? CARD_STATUS_CONNECTED : CARD_STATUS_FAILED,
    provider: result?.provider ?? card?.provider ?? null,
    account_key: result?.account_key ?? null,
    display_label: result?.display_label ?? null,
    account_address: result?.account_address ?? null,
    tool_count: result?.tool_count ?? card?.tool_count ?? 0,
    error: result?.ok ? null : (result?.error ?? 'Sign-in failed.'),
  });
}

/**
 * The card record a `POST /connect_account` answer describes.
 *
 * @param {Object} response `{connected, account}`.
 * @param {Object} [card] The pending card.
 * @returns {Object}
 */
export function cardFromConnectResponse(response, card = null) {
  const account = response?.account ?? {};
  return settledCard(card ?? account, {
    status: CARD_STATUS_CONNECTED,
    provider: account.provider ?? card?.provider ?? null,
    account_key: account.account_key ?? null,
    display_label: account.display_label ?? null,
    account_address: account.account_address ?? null,
    connected_at: account.connected_at ?? null,
    tool_count:
      account.tool_count ??
      (Array.isArray(account.tool_names) ? account.tool_names.length : null) ??
      card?.tool_count ??
      0,
    tool_names: account.tool_names ?? card?.tool_names ?? [],
  });
}

/**
 * The `connection_key` a card record's account is listed under.
 *
 * @param {Object} card A card record.
 * @returns {string|null}
 */
export function connectionKeyOfCard(card) {
  if (!card?.account_key) return null;
  const key = String(card.account_key);
  return key.startsWith('account:') ? key : `account:${key}`;
}
