// src/components/connections/CustomSiteForm.jsx
import React, { useState } from 'react';
import { CONNECT_ACCOUNT_INTERRUPT_KIND } from '../../services/connectionCards';
import {
  CONNECTOR_INPUT_CLASSES,
  CONNECTOR_PRIMARY_BUTTON_CLASSES,
  CONNECTOR_SECONDARY_BUTTON_CLASSES,
  hostOfSiteUrl,
} from './connectorFormStyles';

/**
 * Sign in to any website on the site's own login page.
 *
 * Nothing is posted from here: a browser session begins with a popup, and a
 * popup can only be opened from a click on the card. This form collects the
 * name and the sign-in page address, and hands back a `custom_site` card
 * whose `login_request` carries both; the card's "Sign in on {host}" button
 * does the rest.
 *
 * @param {Object} parameters
 * @param {Object} parameters.provider The `custom_site` catalog card.
 * @param {Function} parameters.onNeedsLogin Called with the popup card.
 * @param {Function} [parameters.onCancel]
 */
const CustomSiteForm = ({ provider, onNeedsLogin, onCancel }) => {
  const [name, setName] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  const canSubmit = name.trim() && siteUrl.trim();

  const handleSubmit = (submitEvent) => {
    submitEvent.preventDefault();
    if (!canSubmit) return;
    const trimmedUrl = siteUrl.trim();
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setErrorMessage('The sign-in page address must start with http:// or https://.');
      return;
    }
    const host = hostOfSiteUrl(trimmedUrl);
    onNeedsLogin?.({
      ...(provider ?? {}),
      kind: CONNECT_ACCOUNT_INTERRUPT_KIND,
      provider: provider?.provider ?? 'custom_site',
      display_name: name.trim() || host || provider?.display_name,
      icon_key: provider?.icon_key ?? 'url',
      login_mode: 'browser_session',
      uses_popup: true,
      login_endpoint: provider?.login_endpoint ?? '/connect_account/browser/start',
      login_request: {
        provider: provider?.provider ?? 'custom_site',
        site_url: trimmedUrl,
        name: name.trim(),
      },
      site_url: trimmedUrl,
      message: `Sign in on ${host} in the window that opens. The avatar keeps the signed-in session.`,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-white/60 text-sm">
        {provider?.card_description ??
          'Sign in to any website on the site’s own login page. The avatar keeps the signed-in session and can read and act on your account there.'}
      </p>
      <div>
        <label htmlFor="custom-site-name" className="block text-white/70 text-sm mb-1">
          Name
        </label>
        <input
          id="custom-site-name"
          type="text"
          value={name}
          placeholder="My dashboard"
          onChange={(changeEvent) => setName(changeEvent.target.value)}
          className={CONNECTOR_INPUT_CLASSES}
        />
        <p className="mt-1 text-white/50 text-xs">
          How the avatar refers to this site in conversation.
        </p>
      </div>
      <div>
        <label htmlFor="custom-site-url" className="block text-white/70 text-sm mb-1">
          Sign-in page address
        </label>
        <input
          id="custom-site-url"
          type="url"
          value={siteUrl}
          placeholder="https://example.com/login"
          onChange={(changeEvent) => {
            setSiteUrl(changeEvent.target.value);
            setErrorMessage(null);
          }}
          className={CONNECTOR_INPUT_CLASSES}
        />
        <p className="mt-1 text-white/50 text-xs">
          The page where you sign in. The page opens in a window for you to
          sign in on.
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
          Continue to sign-in
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={CONNECTOR_SECONDARY_BUTTON_CLASSES}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default CustomSiteForm;
