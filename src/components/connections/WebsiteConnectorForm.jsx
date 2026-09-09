// src/components/connections/WebsiteConnectorForm.jsx
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { connectAccount } from '../../services/avatarService';
import { cardFromConnectResponse } from '../../services/connectionCards';
import {
  CONNECTOR_INPUT_CLASSES,
  CONNECTOR_PRIMARY_BUTTON_CLASSES,
  CONNECTOR_SECONDARY_BUTTON_CLASSES,
  hostOfSiteUrl,
} from './connectorFormStyles';

/**
 * Add a website by address, with no credential.
 *
 * The `website` provider takes a name and the site's home page; the API
 * checks the address and saves the site, and the avatar can then crawl,
 * audit, and report on the site.
 *
 * @param {Object} parameters
 * @param {Object} parameters.provider The `website` catalog card.
 * @param {Function} parameters.onConnected Called with the settled record.
 * @param {Function} [parameters.onCancel]
 */
const WebsiteConnectorForm = ({ provider, onConnected, onCancel }) => {
  const [name, setName] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = siteUrl.trim() && !isSubmitting;

  const handleSubmit = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    const trimmedUrl = siteUrl.trim();
    const label = name.trim() || hostOfSiteUrl(trimmedUrl);
    try {
      const response = await connectAccount({
        provider: provider?.provider ?? 'website',
        fields: { name: name.trim(), site_url: trimmedUrl },
        endpoint: provider?.connect_endpoint || '/connect_account',
      });
      onConnected?.(
        cardFromConnectResponse(response, {
          ...(provider ?? {}),
          display_name: label || provider?.display_name,
        })
      );
    } catch (connectError) {
      setErrorMessage(connectError?.message ?? 'The website could not be added.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-white/60 text-sm">
        {provider?.card_description ??
          'Add a website by address. The avatar crawls the site and reports on content, search visibility, links, accessibility, and changes.'}
      </p>
      <div>
        <label htmlFor="website-connector-name" className="block text-white/70 text-sm mb-1">
          Name <span className="text-white/40">(optional)</span>
        </label>
        <input
          id="website-connector-name"
          type="text"
          value={name}
          placeholder="My website"
          onChange={(changeEvent) => setName(changeEvent.target.value)}
          className={CONNECTOR_INPUT_CLASSES}
        />
      </div>
      <div>
        <label htmlFor="website-connector-url" className="block text-white/70 text-sm mb-1">
          Website address
        </label>
        <input
          id="website-connector-url"
          type="url"
          value={siteUrl}
          placeholder="https://example.com"
          onChange={(changeEvent) => setSiteUrl(changeEvent.target.value)}
          className={CONNECTOR_INPUT_CLASSES}
        />
        <p className="mt-1 text-white/50 text-xs">
          The site&apos;s home page. The address is checked before the site is
          saved.
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
          {isSubmitting ? 'Checking…' : 'Add website'}
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

export default WebsiteConnectorForm;
