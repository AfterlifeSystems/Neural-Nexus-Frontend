// src/components/connections/CustomConnectorForm.jsx
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { connectAccount } from '../../services/avatarService';
import { cardFromConnectResponse } from '../../services/connectionCards';
import {
  CONNECTOR_INPUT_CLASSES,
  CONNECTOR_PRIMARY_BUTTON_CLASSES,
  CONNECTOR_SECONDARY_BUTTON_CLASSES,
} from './connectorFormStyles';

/**
 * Add a Model Context Protocol server of the owner's own.
 *
 * Name, server URL, and an optional token go to `POST /connect_account` for
 * the `custom_mcp` provider, which lists the server's tools before saving.
 * A server that demands a sign-in (OAuth, or a token the owner did not give)
 * answers `open_login_popup`; the card that answer carries is handed back so
 * the sign-in continues in the transcript, where a popup can be opened from
 * a click.
 *
 * @param {Object} parameters
 * @param {Object} parameters.provider The `custom_mcp` catalog card.
 * @param {Function} parameters.onConnected Called with the settled record.
 * @param {Function} parameters.onNeedsLogin Called with the popup card.
 * @param {Function} [parameters.onCancel]
 */
const CustomConnectorForm = ({ provider, onConnected, onNeedsLogin, onCancel }) => {
  const [name, setName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [bearerToken, setBearerToken] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = name.trim() && serverUrl.trim() && !isSubmitting;

  const handleSubmit = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const fields = { name: name.trim(), server_url: serverUrl.trim() };
      if (bearerToken.trim()) fields.bearer_token = bearerToken.trim();
      const response = await connectAccount({
        provider: provider?.provider ?? 'custom_mcp',
        fields,
        endpoint: provider?.connect_endpoint || '/connect_account',
      });
      setBearerToken('');
      if (response?.action === 'open_login_popup') {
        onNeedsLogin?.({
          ...(provider ?? {}),
          ...(response.card ?? {}),
          display_name: name.trim() || response.card?.display_name || provider?.display_name,
          login_mode: response.login_mode ?? response.card?.login_mode,
          login_endpoint: response.login_endpoint ?? response.card?.login_endpoint,
          login_request:
            response.login_request ?? response.card?.login_request ?? fields,
          message: response.message ?? response.card?.message ?? null,
        });
        return;
      }
      onConnected?.(
        cardFromConnectResponse(response, {
          ...(provider ?? {}),
          display_name: name.trim() || provider?.display_name,
        })
      );
    } catch (connectError) {
      setErrorMessage(
        connectError?.message ?? 'The connector could not be added.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-white/60 text-sm">
        {provider?.card_description ??
          'Give the avatar the tools of any Model Context Protocol server you run.'}
      </p>
      <div>
        <label htmlFor="custom-connector-name" className="block text-white/70 text-sm mb-1">
          Name
        </label>
        <input
          id="custom-connector-name"
          type="text"
          value={name}
          placeholder="My Connector"
          onChange={(changeEvent) => setName(changeEvent.target.value)}
          className={CONNECTOR_INPUT_CLASSES}
        />
        <p className="mt-1 text-white/50 text-xs">
          How the avatar refers to this connector in conversation.
        </p>
      </div>
      <div>
        <label htmlFor="custom-connector-url" className="block text-white/70 text-sm mb-1">
          Server URL
        </label>
        <input
          id="custom-connector-url"
          type="url"
          value={serverUrl}
          placeholder="https://mcp.example.com/sse"
          onChange={(changeEvent) => setServerUrl(changeEvent.target.value)}
          className={CONNECTOR_INPUT_CLASSES}
        />
        <p className="mt-1 text-white/50 text-xs">
          The server&apos;s Streamable HTTP or SSE endpoint. The connector is
          verified by listing the server&apos;s tools before the connector is
          saved.
        </p>
      </div>
      <div>
        <label htmlFor="custom-connector-token" className="block text-white/70 text-sm mb-1">
          Access token <span className="text-white/40">(optional)</span>
        </label>
        <input
          id="custom-connector-token"
          type="password"
          autoComplete="off"
          value={bearerToken}
          placeholder="Optional bearer token"
          onChange={(changeEvent) => setBearerToken(changeEvent.target.value)}
          className={CONNECTOR_INPUT_CLASSES}
        />
        <p className="mt-1 text-white/50 text-xs">
          Sent as an Authorization header when the server requires one. Stored
          encrypted; never shown again. A server that signs in with OAuth
          opens a sign-in window instead.
        </p>
      </div>
      {errorMessage && (
        <p
          role="alert"
          className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2"
        >
          {errorMessage}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={!canSubmit} className={CONNECTOR_PRIMARY_BUTTON_CLASSES}>
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Connecting…' : 'Add connector'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className={CONNECTOR_SECONDARY_BUTTON_CLASSES}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default CustomConnectorForm;
