// src/components/ConnectAccountCard.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Loader2, RotateCcw } from 'lucide-react';
import ConnectorIcon from './icons/ConnectorIcon';
import {
  cancelConnectionLogin,
  connectAccount,
  finishConnectionLogin,
  isDeviceProvider,
  listConnections,
  startConnectionLogin,
} from '../services/avatarService';
import { NEURAL_NEXUS_API_BASE_URL } from '../services/neuralNexusApiClient';
import {
  absoluteApiUrl,
  accountKeyOfRow,
  apiOriginOf,
  closePopup,
  navigatePopup,
  openPopupSynchronously,
  parseLoginResultMessage,
  pollUntilConnected,
  rowMatchesLogin,
} from '../services/connectionOauthPopup';
import {
  CARD_STATUS_CANCELLED,
  CARD_STATUS_CONNECTED,
  CARD_STATUS_FAILED,
  CARD_STATUS_PENDING_LOGIN,
  cardFromConnectResponse,
  cardFromConnectionRow,
  cardFromLoginResult,
  cardStatusLine,
} from '../services/connectionCards';
import {
  hostedWindowRetry,
  ownBrowserInstructions,
  ownBrowserLoginFromStart,
  ownBrowserSignInFailure,
  ownBrowserSignInSucceeded,
  startedInOwnBrowser,
} from '../services/ownBrowserSignIn';
import AddDevicePanel from './connections/AddDevicePanel';

// How long a closed popup is given to still deliver a result (a result posts
// in the popup's last moments, and the connections list lags by a poll).
const CLOSED_POPUP_GRACE_MS = 6_000;

const GOOGLE_PROVIDERS = new Set([
  'gmail',
  'google_calendar',
  'google_analytics',
  'youtube',
]);

/**
 * The path a card takes to a connected account, from the provider's
 * `login_mode`: a credential form, a popup window, or installing a device.
 *
 * @param {Object} payload The card payload.
 * @returns {'form'|'popup'|'device'}
 */
function loginPathOf(payload) {
  if (isDeviceProvider(payload)) return 'device';
  const loginMode = payload?.login_mode;
  if (loginMode === 'form') return 'form';
  if (loginMode && loginMode !== 'none') return 'popup';
  return payload?.uses_form === false ? 'popup' : 'form';
}

/**
 * The host of the site a browser-session card signs in on.
 *
 * @param {Object} payload The card payload.
 * @returns {string} The host, or an empty string.
 */
function siteHostOf(payload) {
  const candidate = payload?.site_url || payload?.login_request?.site_url || '';
  if (!candidate) return '';
  try {
    return new URL(candidate).host;
  } catch {
    return String(candidate).replace(/^https?:\/\//, '').split('/')[0];
  }
}

/**
 * What the popup button says, by provider and login mode.
 *
 * @param {Object} payload The card payload.
 * @param {string} loginMode The effective login mode.
 * @returns {string}
 */
function popupButtonLabel(payload, loginMode) {
  const provider = String(payload?.provider ?? '');
  if (GOOGLE_PROVIDERS.has(provider) || provider.startsWith('google')) {
    return 'Sign in with Google';
  }
  if (loginMode === 'plaid_link') return 'Connect bank';
  if (loginMode === 'browser_session') {
    const host = siteHostOf(payload);
    return host ? `Sign in on ${host}` : 'Sign in on the site';
  }
  return 'Sign in';
}

const STATUS_PILL = {
  [CARD_STATUS_CONNECTED]: {
    label: 'Added',
    className: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
    showCheck: true,
  },
  [CARD_STATUS_PENDING_LOGIN]: {
    label: 'Waiting for sign-in',
    className: 'bg-amber-400/15 border-amber-400/30 text-amber-200',
  },
  [CARD_STATUS_FAILED]: {
    label: 'Sign-in failed',
    className: 'bg-red-500/15 border-red-500/30 text-red-200',
  },
  [CARD_STATUS_CANCELLED]: {
    label: 'Not connected',
    className: 'bg-white/10 border-white/10 text-white/60',
  },
};

const StatusPill = ({ status, compact }) => {
  const pill = STATUS_PILL[status] ?? STATUS_PILL[CARD_STATUS_CANCELLED];
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 rounded-full border ${
        compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1.5 text-sm'
      } ${pill.className}`}
    >
      {pill.showCheck && <Check className="w-4 h-4" aria-hidden="true" />}
      {pill.label}
    </span>
  );
};

/**
 * A card that has been acted on: the record the transcript keeps.
 *
 * "✓ Added · 6 tools · Connected as evan" for a connection, or the reason
 * nothing was connected. Nothing here can be pressed; the owner acts on the
 * connection from the connectors menu.
 */
const ConnectionRecordCard = ({ card, compact, className }) => {
  const status = card?.status ?? CARD_STATUS_CANCELLED;
  const statusLine = cardStatusLine(card);
  const detail = statusLine.includes(' · ')
    ? statusLine.slice(statusLine.indexOf(' · ') + 3)
    : statusLine;
  const toolNames = Array.isArray(card?.tool_names) ? card.tool_names : [];
  return (
    <div
      className={`${className} bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 ${
        compact ? 'p-2.5' : 'p-4'
      }`}
      data-connection-card={card?.provider ?? ''}
    >
      <div className="flex items-center gap-3">
        <ConnectorIcon iconKey={card?.icon_key} size={compact ? 'sm' : 'md'} />
        <div className="min-w-0 flex-grow">
          <p className="text-neutral-200 font-medium truncate">
            {card?.display_name ?? card?.provider ?? 'Account'}
          </p>
          <p className="text-white/60 text-xs truncate" title={statusLine}>
            {detail}
          </p>
        </div>
        <StatusPill status={status} compact={compact} />
      </div>
      {!compact && status === CARD_STATUS_CONNECTED && toolNames.length > 0 && (
        <p className="mt-2 text-white/40 text-xs break-words">
          Tools: {toolNames.slice(0, 8).join(', ')}
          {toolNames.length > 8 ? '…' : ''}
        </p>
      )}
      {status === CARD_STATUS_FAILED && card?.error && (
        <p className="mt-2 text-red-300 text-xs break-words">{card.error}</p>
      )}
    </div>
  );
};

/**
 * The connect card the avatar raises when it needs an account connected.
 *
 * Rendered from an `interrupt` frame whose kind is `connect_account`, from a
 * "+"-menu pick, or from the same description served by
 * `GET /connectable_providers`. Every label, field, help string, and the
 * endpoint to post to comes from that payload rather than from this file, so
 * a provider added to the backend registry renders here with no change.
 *
 * FOUR WAYS IN, BY `login_mode`
 *   `form`            — a credential form posted to `connect_endpoint`.
 *   `oauth_popup`,
 *   `plaid_link`,
 *   `browser_session` — a popup window opened in the click handler (popup
 *                       blockers allow nothing else), then navigated to the
 *                       page the login endpoint names. The popup finishes by
 *                       posting a result back; the connections list is polled
 *                       in parallel for a popup whose opener was blocked.
 *   `desktop_browser` — the sign-in page opened as a tab in the owner's OWN
 *                       browser, on a machine of theirs running the
 *                       connector. The API decides this at start time, so a
 *                       card that asked for `browser_session` can be answered
 *                       with this instead. Nothing here can see that window:
 *                       the pre-opened popup is closed, the owner signs in on
 *                       their own screen, and pressing "I've signed in" asks
 *                       their machine for the session.
 *   `none`            — a device: installing the connector, not a form.
 *
 * THE CREDENTIAL DOES NOT GO THROUGH THE RESUME
 *   A resume value is written into the graph's checkpointer, so a password
 *   handed back that way would come to rest in the conversation's stored
 *   state. The card posts the credential to the endpoint the payload names,
 *   which verifies and encrypts it, and only then resumes the turn — carrying
 *   a decision and a record of the outcome, never a secret.
 *
 * @param {Object} parameters
 * @param {Object} [parameters.interrupt] The interactive `connect_account`
 *   payload. When absent, `card` is rendered read-only.
 * @param {Object} [parameters.card] A persisted card record (from
 *   `response_metadata.connections`), shown read-only.
 * @param {Function} [parameters.onDecision] Called with `('apply', null,
 *   resultCard)` once an account is connected, or `('cancel')` when the owner
 *   closes the card.
 * @param {boolean} [parameters.startOpen] Skip the offer step.
 * @param {string} [parameters.className] Layout classes for the outer card.
 * @param {boolean} [parameters.compact] The voice-mode caption strip: tighter
 *   spacing, no description.
 * @param {boolean} [parameters.readOnly] Render the payload as a record even
 *   when interactive.
 */
const ConnectAccountCard = ({
  interrupt,
  card,
  onDecision,
  startOpen = false,
  className = 'self-start w-full max-w-[85%]',
  compact = false,
  readOnly = false,
}) => {
  const payload = interrupt ?? card ?? {};
  const {
    provider,
    display_name: displayName,
    card_description: cardDescription,
    icon_key: iconKey,
    tool_count: toolCount,
    credential_help_url: credentialHelpUrl,
    connect_endpoint: connectEndpoint,
    availability,
    fields = [],
    already_connected: alreadyConnected = [],
    prefilled_fields: prefilledFields = {},
    message: payloadMessage,
  } = payload;

  const isComingSoon = availability === 'coming_soon';
  const isMailbox = fields.some((field) => field.name === 'app_password');
  const isDevice = isDeviceProvider(payload);
  const initialLoginPath = loginPathOf(payload);

  // 'offer' → 'signing_in' → 'connected' | 'failed', or 'dismissed'. Held here
  // rather than derived from the turn, because the turn resumes the moment the
  // account is connected and the card must keep showing what it did.
  const [stage, setStage] = useState(
    startOpen && initialLoginPath !== 'device' && !isComingSoon
      ? 'signing_in'
      : 'offer'
  );
  // 'form' or 'popup'. A form provider can switch to the popup path when the
  // API answers `open_login_popup` (a custom connector that demands OAuth, a
  // site that signs in on its own page).
  const [loginPath, setLoginPath] = useState(initialLoginPath);
  const [popupLogin, setPopupLogin] = useState(null);
  const [fieldValues, setFieldValues] = useState(() => ({
    ...(prefilledFields ?? {}),
  }));
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWaitingForPopup, setIsWaitingForPopup] = useState(false);
  const [fallbackLink, setFallbackLink] = useState(null);
  const [resultCard, setResultCard] = useState(null);
  // A second account of the same provider needs a name of its own ("work",
  // "personal"); a "sign in again" refreshes the record named by the card.
  const [accountName, setAccountName] = useState(
    () => prefilledFields?.name ?? ''
  );
  // The API may answer that the sign-in needs the address of the page to
  // sign in on (a bank's own website when Plaid is not configured).
  const [siteRequest, setSiteRequest] = useState(null);
  const [siteUrlValue, setSiteUrlValue] = useState('');
  // The sign-in opened as a tab in the owner's OWN browser, on a machine of
  // theirs running the connector. There is no window here to watch and no
  // result posted back, so the card waits for the owner to say they are done
  // and then asks their machine for the session.
  const [ownBrowserLogin, setOwnBrowserLogin] = useState(null);
  const loginControllerRef = useRef(null);
  const popupRef = useRef(null);

  useEffect(
    () => () => {
      loginControllerRef.current?.abort();
      closePopup(popupRef.current);
    },
    []
  );

  if (!interrupt || readOnly) {
    return (
      <ConnectionRecordCard card={payload} compact={compact} className={className} />
    );
  }

  const reconnectAccountKey = (payload.reconnect_connection_key || '')
    .replace(/^account:/, '');
  const withLoginExtras = (loginRequest) => ({
    ...(loginRequest ?? { provider }),
    ...(accountName.trim() ? { name: accountName.trim() } : {}),
    ...(reconnectAccountKey ? { reconnect_account_key: reconnectAccountKey } : {}),
  });
  const effectiveLogin = popupLogin ?? {
    login_mode: payload.login_mode,
    login_endpoint: payload.login_endpoint,
    login_request: withLoginExtras(payload.login_request),
    message: payloadMessage,
  };

  const setFieldValue = (name, value) =>
    setFieldValues((previous) => ({ ...previous, [name]: value }));

  const everyRequiredFieldFilled = fields
    .filter((field) => field.required !== false)
    .every((field) => String(fieldValues[field.name] ?? '').trim());

  const finishConnected = (connected) => {
    setResultCard(connected);
    setErrorMessage(null);
    setIsWaitingForPopup(false);
    setStage('connected');
    onDecision?.('apply', null, connected);
  };

  const handleDismiss = () => {
    loginControllerRef.current?.abort();
    closePopup(popupRef.current);
    setStage('dismissed');
    onDecision?.('cancel');
  };

  const handleSubmitForm = async (submitEvent) => {
    submitEvent?.preventDefault();
    if (isSubmitting || !everyRequiredFieldFilled) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await connectAccount({
        provider,
        fields: fieldValues,
        endpoint: connectEndpoint || '/connect_account',
      });
      if (response?.action === 'open_login_popup') {
        // The API cannot connect this one from a form: the server demands a
        // sign-in, or the site signs in on its own page. The next press opens
        // the window — a popup can only be opened from a click.
        setPopupLogin({
          login_mode: response.login_mode ?? response.card?.login_mode,
          login_endpoint: response.login_endpoint ?? response.card?.login_endpoint,
          login_request:
            response.login_request ?? response.card?.login_request ?? { provider },
          message: response.message ?? response.card?.message ?? null,
        });
        setLoginPath('popup');
        return;
      }
      const connected = cardFromConnectResponse(response, {
        ...payload,
        display_name: displayName,
      });
      if (!connected.display_label && !connected.account_address) {
        connected.display_label =
          fieldValues.email_address ?? fieldValues.name ?? displayName;
      }
      // Drop the secret from component state the instant it is no longer
      // needed, so the secret does not sit in memory for the rest of the
      // conversation.
      setFieldValues({});
      finishConnected(connected);
    } catch (connectError) {
      // Shown as written. The API's rejection names what was wrong — for
      // Gmail, that an app password is required and the account password will
      // never work; for a custom server, that the address did not answer.
      setErrorMessage(
        connectError?.message ??
          `${displayName ?? 'That account'} could not be connected.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Open the sign-in window and wait for the account to appear.
   *
   * The window is opened first, synchronously, then the login endpoint is
   * asked where the window should go. Success arrives either as the result
   * the window posts back (checked against the API origin and this login's
   * nonce) or as a new row for the provider in the connections list.
   */
  const handlePopupLogin = async (loginOverride = null) => {
    if (isSubmitting) return;
    const login =
      loginOverride && loginOverride.login_endpoint ? loginOverride : effectiveLogin;
    const popup = openPopupSynchronously(`neural-nexus-login-${provider}`);
    popupRef.current = popup;
    loginControllerRef.current?.abort();
    const controller = new AbortController();
    loginControllerRef.current = controller;
    const { signal } = controller;

    setIsSubmitting(true);
    setErrorMessage(null);
    setFallbackLink(null);
    try {
      const [started, existingRows] = await Promise.all([
        startConnectionLogin(login.login_endpoint, withLoginExtras(login.login_request)),
        listConnections()
          .then((listed) => listed?.connections ?? [])
          .catch(() => []),
      ]);
      if (started?.action === 'needs_site_url') {
        // The sign-in needs the address of the page to sign in on: close the
        // window, collect the address, and start again from the button.
        closePopup(popup);
        setSiteRequest({
          login_endpoint: started.login_endpoint || '/connect_account/browser/start',
          login_request: started.login_request ?? { provider },
          message: started.message,
          fields: started.fields ?? [],
        });
        setIsSubmitting(false);
        return;
      }
      if (startedInOwnBrowser(started)) {
        // The page opened in the owner's own browser, on their own machine.
        // The window opened here on the click has nothing to show, so close
        // it and wait for the owner rather than for a postMessage.
        closePopup(popup);
        popupRef.current = null;
        controller.abort();
        setOwnBrowserLogin(
          ownBrowserLoginFromStart(started, {
            loginEndpoint: login.login_endpoint,
            loginRequest: withLoginExtras(login.login_request),
          })
        );
        setIsSubmitting(false);
        return;
      }
      const url = absoluteApiUrl(
        started?.authorization_url ?? started?.link_url ?? started?.view_url,
        NEURAL_NEXUS_API_BASE_URL
      );
      if (!url) {
        throw new Error('The sign-in page could not be opened.');
      }
      if (!navigatePopup(popup, url)) {
        // The browser refused the window: offer the page as a link that opens
        // in a tab. The poll below notices the account when the sign-in ends.
        setFallbackLink(url);
      }
      setIsWaitingForPopup(true);

      const nonce = started?.nonce;
      const expectedOrigin = apiOriginOf(NEURAL_NEXUS_API_BASE_URL);
      const knownAccountKeys = existingRows.map(accountKeyOfRow);

      const resultFromWindow = new Promise((resolve) => {
        const onMessage = (messageEvent) => {
          const result = parseLoginResultMessage(messageEvent, {
            expectedOrigin,
            nonce,
          });
          if (result) resolve({ kind: 'message', result });
        };
        window.addEventListener('message', onMessage, { signal });
        signal.addEventListener('abort', () => resolve({ kind: 'aborted' }), {
          once: true,
        });
      });

      const resultFromList = pollUntilConnected({
        listConnections: () =>
          listConnections().then((listed) => listed?.connections ?? []),
        matches: (row) =>
          rowMatchesLogin(row, { provider, knownAccountKeys }),
        signal,
      }).then((row) => (row ? { kind: 'row', row } : { kind: 'timeout' }));

      const resultFromClosedWindow = new Promise((resolve) => {
        if (!popup) return;
        const watch = setInterval(() => {
          if (signal.aborted) {
            clearInterval(watch);
            return;
          }
          let closed = false;
          try {
            closed = Boolean(popup.closed);
          } catch {
            closed = false;
          }
          if (closed) {
            clearInterval(watch);
            setTimeout(() => resolve({ kind: 'closed' }), CLOSED_POPUP_GRACE_MS);
          }
        }, 1_000);
        signal.addEventListener('abort', () => clearInterval(watch), {
          once: true,
        });
      });

      const outcome = await Promise.race([
        resultFromWindow,
        resultFromList,
        resultFromClosedWindow,
      ]);
      controller.abort();
      if (outcome.kind === 'aborted') return;

      if (outcome.kind === 'message') {
        if (outcome.result.ok) {
          closePopup(popup);
          finishConnected(cardFromLoginResult(outcome.result, payload));
          return;
        }
        setIsWaitingForPopup(false);
        setErrorMessage(
          outcome.result.error ?? `${displayName ?? 'The account'} was not connected.`
        );
        return;
      }
      if (outcome.kind === 'row') {
        closePopup(popup);
        finishConnected(cardFromConnectionRow(outcome.row, payload));
        return;
      }
      setIsWaitingForPopup(false);
      setErrorMessage(
        outcome.kind === 'closed'
          ? 'The sign-in window closed before the account was connected.'
          : 'The sign-in did not finish. Try again.'
      );
    } catch (loginError) {
      closePopup(popup);
      setIsWaitingForPopup(false);
      setErrorMessage(
        loginError?.message ?? 'The sign-in could not be started.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * The owner says they have signed in in their own browser: bring the
   * session back from their machine and store the account.
   */
  const handleOwnBrowserSignedIn = async () => {
    if (isSubmitting || !ownBrowserLogin) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await finishConnectionLogin(
        ownBrowserLogin.login_id,
        ownBrowserLogin.login_token
      );
      if (ownBrowserSignInSucceeded(result)) {
        setOwnBrowserLogin(null);
        finishConnected(cardFromLoginResult(result, payload));
        return;
      }
      // The daemon's own words: the browser holds no session for the site
      // yet, the machine went offline, or the keyring is locked.
      setErrorMessage(ownBrowserSignInFailure(result, displayName));
    } catch (finishError) {
      setErrorMessage(
        finishError?.message ?? 'The sign-in could not be finished.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Give up on the tab in the owner's browser; the tab itself is theirs. */
  const handleOwnBrowserCancel = async () => {
    const login = ownBrowserLogin;
    setOwnBrowserLogin(null);
    setErrorMessage(null);
    if (!login) return;
    try {
      await cancelConnectionLogin(login.login_id, login.login_token);
    } catch {
      // Abandoning is local either way: the sign-in expires on its own.
    }
  };

  /**
   * Sign in in a hosted window instead (a machine that is no longer at hand).
   *
   * The window opens first and the abandoned sign-in is forgotten in the
   * background: a popup can only be opened from the click itself, and an
   * awaited request in between is enough for the browser to refuse it.
   */
  const handleUseHostedWindow = () => {
    const login = ownBrowserLogin;
    setOwnBrowserLogin(null);
    setErrorMessage(null);
    handlePopupLogin(hostedWindowRetry(login, provider));
    if (login) {
      cancelConnectionLogin(login.login_id, login.login_token).catch(() => {});
    }
  };

  if (stage === 'dismissed') {
    return null;
  }

  const padding = compact ? 'p-3' : 'p-4';
  const popupLabel = popupButtonLabel(
    { ...payload, login_request: effectiveLogin.login_request },
    effectiveLogin.login_mode
  );

  return (
    <div
      className={`${className} bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 ${padding}`}
      data-connection-card={provider ?? ''}
    >
      <div className="flex items-center gap-3">
        <ConnectorIcon iconKey={iconKey} size={compact ? 'sm' : 'md'} />
        <div className="min-w-0 flex-grow">
          <p className="text-neutral-200 font-medium whitespace-normal break-words">
            {isDevice ? 'Add a device' : (displayName ?? provider)}
          </p>
          {cardDescription && !isDevice && !compact && (
            <p className="text-white/60 text-sm whitespace-normal break-words">
              {cardDescription}
            </p>
          )}
          {stage === 'connected' ? (
            <p className="text-white/60 text-xs truncate">
              {cardStatusLine(resultCard).replace(/^[^·]*· /, '')}
            </p>
          ) : (
            Number.isFinite(toolCount) &&
            toolCount > 0 && (
              <p className="text-white/40 text-xs">
                {toolCount} {toolCount === 1 ? 'tool' : 'tools'}
              </p>
            )
          )}
        </div>

        {stage === 'connected' ? (
          <StatusPill status={CARD_STATUS_CONNECTED} compact={compact} />
        ) : isComingSoon ? (
          <span className="shrink-0 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-white/60 text-xs">
            Coming soon
          </span>
        ) : (
          stage === 'offer' &&
          loginPath !== 'device' && (
            <button
              type="button"
              onClick={() => setStage('signing_in')}
              className="shrink-0 px-4 py-2 rounded-lg bg-neutral-100/10 hover:bg-neutral-100/15 border border-neutral-700 text-neutral-300 text-sm font-medium transition-colors"
            >
              Add {displayName ?? provider}
            </button>
          )
        )}
      </div>

      {payloadMessage && stage !== 'connected' && !popupLogin && (
        <p className="mt-2 text-white/60 text-sm whitespace-normal break-words">
          {payloadMessage}
        </p>
      )}

      {/* Adding a machine is installing the connector, not an MCP URL form. */}
      {loginPath === 'device' && stage !== 'connected' && (
        <div className="mt-3">
          <AddDevicePanel />
        </div>
      )}

      {stage === 'offer' && alreadyConnected.length > 0 && (
        <p className="mt-3 text-white/50 text-xs">
          Already connected:{' '}
          {alreadyConnected
            .map((account) => account.display_label ?? account.account_address)
            .join(', ')}
        </p>
      )}

      {stage === 'offer' && (
        <button
          type="button"
          onClick={handleDismiss}
          className="mt-3 text-white/40 hover:text-white/70 text-xs underline transition-colors"
        >
          {isComingSoon || loginPath === 'device' ? 'Close' : 'Not now'}
        </button>
      )}

      {stage === 'signing_in' && loginPath === 'form' && (
        <form onSubmit={handleSubmitForm} className="mt-4 space-y-3">
          {fields.map((field) => (
            <div key={field.name}>
              <label
                htmlFor={`connect-${provider}-${field.name}`}
                className="block text-white/70 text-sm mb-1"
              >
                {field.label}
                {field.required === false && (
                  <span className="text-white/40"> (optional)</span>
                )}
              </label>
              <input
                id={`connect-${provider}-${field.name}`}
                type={field.input_type || 'text'}
                value={fieldValues[field.name] ?? ''}
                placeholder={field.placeholder || ''}
                autoComplete={field.input_type === 'password' ? 'off' : 'on'}
                onChange={(changeEvent) =>
                  setFieldValue(field.name, changeEvent.target.value)
                }
                className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-neutral-200 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
              {field.help_text && !compact && (
                <p className="mt-1 text-white/50 text-xs">{field.help_text}</p>
              )}
            </div>
          ))}

          {credentialHelpUrl && (
            <a
              href={credentialHelpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-neutral-300 hover:text-neutral-100 text-xs underline"
            >
              {isMailbox ? 'Generate an app password' : 'Where to get the credential'}
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          )}

          {errorMessage && (
            <p
              role="alert"
              className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2"
            >
              {errorMessage}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting || !everyRequiredFieldFilled}
              className="px-4 py-2 rounded-lg bg-neutral-100/10 hover:bg-neutral-100/15 disabled:opacity-40 disabled:hover:bg-neutral-100/10 border border-neutral-700 text-neutral-300 text-sm font-medium transition-colors inline-flex items-center gap-2"
            >
              {isSubmitting && (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              )}
              {isSubmitting
                ? isMailbox
                  ? 'Signing in…'
                  : 'Connecting…'
                : isMailbox
                  ? 'Sign in'
                  : 'Add connector'}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-white/50 hover:text-white/80 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {stage === 'signing_in' && loginPath === 'popup' && (
        <div className="mt-4 space-y-3">
          {effectiveLogin.message && !siteRequest && (
            <p className="text-white/60 text-sm whitespace-normal break-words">
              {effectiveLogin.message}
            </p>
          )}

          {siteRequest && (
            <div className="space-y-2">
              <p className="text-white/60 text-sm whitespace-normal break-words">
                {siteRequest.message}
              </p>
              <label
                htmlFor={`connect-${provider}-site-url`}
                className="block text-white/70 text-sm"
              >
                Sign-in page address
              </label>
              <input
                id={`connect-${provider}-site-url`}
                type="url"
                value={siteUrlValue}
                placeholder="https://www.yourbank.com/"
                onChange={(changeEvent) => setSiteUrlValue(changeEvent.target.value)}
                className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-neutral-200 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>
          )}

          {(siteRequest || alreadyConnected.length > 0 || effectiveLogin.login_mode === 'browser_session') &&
            !reconnectAccountKey && (
              <div>
                <label
                  htmlFor={`connect-${provider}-account-name`}
                  className="block text-white/70 text-sm mb-1"
                >
                  Account name{' '}
                  <span className="text-white/40">(optional; tells accounts apart)</span>
                </label>
                <input
                  id={`connect-${provider}-account-name`}
                  type="text"
                  value={accountName}
                  placeholder={alreadyConnected.length > 0 ? 'work, personal, …' : displayName || ''}
                  onChange={(changeEvent) => setAccountName(changeEvent.target.value)}
                  className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-neutral-200 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                />
              </div>
            )}

          {isWaitingForPopup && !errorMessage && !ownBrowserLogin && (
            <p className="text-amber-200/90 text-sm inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Finish signing in in the window that opened. This card updates on
              its own.
            </p>
          )}

          {/* The page opened in the owner's OWN browser. Nothing here can see
              that window, so the owner says when they are done. */}
          {ownBrowserLogin && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2.5 space-y-1">
              <p className="text-amber-200/90 text-sm whitespace-normal break-words">
                {ownBrowserInstructions(ownBrowserLogin)}
              </p>
              <p className="text-white/50 text-xs">
                Sign in there as you normally would, then press the button
                below and the session comes back to your avatar.
              </p>
            </div>
          )}

          {fallbackLink && (
            <a
              href={fallbackLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 text-sm underline"
            >
              The window was blocked — open the sign-in page in a new tab
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          )}

          {errorMessage && (
            <p
              role="alert"
              className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2"
            >
              {errorMessage}
            </p>
          )}

          {ownBrowserLogin ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleOwnBrowserSignedIn}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-neutral-100/10 hover:bg-neutral-100/15 disabled:opacity-40 disabled:hover:bg-neutral-100/10 border border-neutral-700 text-neutral-300 text-sm font-medium transition-colors inline-flex items-center gap-2"
              >
                {isSubmitting && (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                )}
                {isSubmitting
                  ? 'Keeping the session…'
                  : errorMessage
                    ? 'Try again'
                    : "I've signed in"}
              </button>
              <button
                type="button"
                onClick={handleUseHostedWindow}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-white/50 hover:text-white/80 text-sm transition-colors"
              >
                Sign in here instead
              </button>
              <button
                type="button"
                onClick={handleOwnBrowserCancel}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-white/50 hover:text-white/80 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  siteRequest
                    ? handlePopupLogin({
                        login_endpoint: siteRequest.login_endpoint,
                        login_request: {
                          ...siteRequest.login_request,
                          site_url: siteUrlValue.trim(),
                        },
                        login_mode: 'browser_session',
                      })
                    : handlePopupLogin()
                }
                disabled={
                  isSubmitting || (Boolean(siteRequest) && !siteUrlValue.trim())
                }
                className="px-4 py-2 rounded-lg bg-neutral-100/10 hover:bg-neutral-100/15 disabled:opacity-40 disabled:hover:bg-neutral-100/10 border border-neutral-700 text-neutral-300 text-sm font-medium transition-colors inline-flex items-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : errorMessage ? (
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                ) : null}
                {isSubmitting
                  ? isWaitingForPopup
                    ? 'Waiting for sign-in…'
                    : 'Opening…'
                  : errorMessage
                    ? 'Try again'
                    : popupLabel}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-4 py-2 rounded-lg text-white/50 hover:text-white/80 text-sm transition-colors"
              >
                {isWaitingForPopup ? 'Stop waiting' : 'Cancel'}
              </button>
            </div>
          )}
        </div>
      )}

      {stage === 'connected' && !compact && (
        <p className="mt-3 text-white/60 text-sm">
          {resultCard?.display_label || resultCard?.account_address ? (
            <>
              Connected as{' '}
              <span className="text-neutral-200">
                {resultCard.display_label ?? resultCard.account_address}
              </span>
              .
            </>
          ) : (
            'Connected.'
          )}
          {isMailbox
            ? ' The avatar can now read this mailbox, draft in your voice, and send when you ask.'
            : ' Its tools are available to the avatar now.'}
        </p>
      )}
    </div>
  );
};

export default ConnectAccountCard;
