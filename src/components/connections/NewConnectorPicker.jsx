// src/components/connections/NewConnectorPicker.jsx
import React, { useMemo, useState } from 'react';
import { ArrowLeft, Globe, Plus } from 'lucide-react';
import ConnectorIcon from '../icons/ConnectorIcon';
import { isMcpConnectorProvider } from './mcpConnectors';
import ConnectorBrowseControls from './ConnectorBrowseControls';
import CustomConnectorForm from './CustomConnectorForm';
import CustomSiteForm from './CustomSiteForm';
import WebsiteConnectorForm from './WebsiteConnectorForm';
import {
  CONNECTOR_CATEGORY_LABELS,
  connectorFilterOptions,
  matchesConnectorCategory,
  matchesConnectorSearch,
} from './connectorSearch';

const CUSTOM_CONNECTOR_PROVIDER = 'custom_mcp';
const CUSTOM_SITE_PROVIDER = 'custom_site';
const WEBSITE_PROVIDER = 'website';

// The two "bring your own" rows sit first whatever the catalog answers; when
// the catalog has no card for one of them, this description stands in so the
// row still opens the form.
const DEFAULT_CUSTOM_CONNECTOR = {
  provider: CUSTOM_CONNECTOR_PROVIDER,
  display_name: 'Custom connector',
  summary: 'Add your own Model Context Protocol server',
  icon_key: 'custom',
  category: 'custom',
  login_mode: 'form',
  connect_endpoint: '/connect_account',
};
const DEFAULT_CUSTOM_SITE = {
  provider: CUSTOM_SITE_PROVIDER,
  display_name: 'Custom site',
  summary: 'Sign in to any website on the site’s own login page',
  icon_key: 'url',
  category: 'custom',
  login_mode: 'browser_session',
  login_endpoint: '/connect_account/browser/start',
};

/**
 * Which form a picker row opens in place, when the row does not go straight
 * to a transcript card.
 *
 * @param {Object} provider A catalog row.
 * @returns {'custom_connector'|'custom_site'|'website'|null}
 */
function formKindOf(provider) {
  const name = provider?.provider;
  if (name === CUSTOM_CONNECTOR_PROVIDER) return 'custom_connector';
  if (name === CUSTOM_SITE_PROVIDER) return 'custom_site';
  if (name === WEBSITE_PROVIDER) return 'website';
  return null;
}

/**
 * The "New Connector" picker: search, category filters, the Custom connector
 * and Custom site rows first, then every catalog provider grouped by
 * category with an Add button (or a Coming soon pill).
 *
 * A row with a credential form or a sign-in window is handed to `onPick`, and
 * the caller puts the connect card in the transcript. The three rows that
 * need an address first — a custom Model Context Protocol server, a site to
 * sign in on, a website to audit — open their form here, in place of the
 * list; the form answers with a settled record (`onConnected`) or with a
 * card that still needs a sign-in window (`onNeedsLogin`).
 *
 * @param {Object} parameters
 * @param {Object[]} parameters.providers `GET /connectable_providers` rows.
 * @param {Object[]} parameters.connections `GET /list_connections` rows.
 * @param {Function} parameters.onPick Called with a catalog row to connect.
 * @param {Function} [parameters.onConnected] Called with the settled record
 *   when a form connected on its own.
 * @param {Function} [parameters.onNeedsLogin] Called with the popup card when
 *   a form's answer was `open_login_popup`, or the site signs in on its own page.
 */
const NewConnectorPicker = ({
  providers = [],
  connections = [],
  onPick,
  onConnected = null,
  onNeedsLogin = null,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [openForm, setOpenForm] = useState(null);

  const connectedCountByProvider = useMemo(() => {
    const counts = {};
    for (const connection of connections) {
      if (!connection.connected) continue;
      counts[connection.provider] = (counts[connection.provider] ?? 0) + 1;
    }
    return counts;
  }, [connections]);

  const matches = (provider) =>
    matchesConnectorSearch(provider, query) &&
    matchesConnectorCategory(provider, category);

  const customConnectorProvider =
    providers.find((provider) => provider.provider === CUSTOM_CONNECTOR_PROVIDER) ??
    DEFAULT_CUSTOM_CONNECTOR;
  const customSiteProvider =
    providers.find((provider) => provider.provider === CUSTOM_SITE_PROVIDER) ??
    DEFAULT_CUSTOM_SITE;
  const customRows = [customConnectorProvider, customSiteProvider].filter(matches);

  const catalog = providers.filter(
    (provider) =>
      provider.provider !== CUSTOM_CONNECTOR_PROVIDER &&
      provider.provider !== CUSTOM_SITE_PROVIDER &&
      matches(provider)
  );
  const categories = [...new Set(catalog.map((provider) => provider.category))];
  const filterOptions = connectorFilterOptions(providers);

  const chooseRow = (provider) => {
    if (formKindOf(provider)) {
      setOpenForm(provider);
      return;
    }
    onPick?.(provider);
  };

  if (openForm) {
    const formKind = formKindOf(openForm);
    const closeForm = () => setOpenForm(null);
    const settle = (record) => {
      closeForm();
      onConnected?.(record);
    };
    const continueInPopup = (card) => {
      closeForm();
      onNeedsLogin?.(card);
    };
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={closeForm}
          className="inline-flex items-center gap-1.5 text-white/60 hover:text-neutral-100 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          All connectors
        </button>
        <div className="flex items-center gap-3">
          <ConnectorIcon iconKey={openForm.icon_key} />
          <p className="text-neutral-200 font-medium">{openForm.display_name}</p>
        </div>
        {formKind === 'custom_connector' && (
          <CustomConnectorForm
            provider={openForm}
            onConnected={settle}
            onNeedsLogin={continueInPopup}
            onCancel={closeForm}
          />
        )}
        {formKind === 'custom_site' && (
          <CustomSiteForm
            provider={openForm}
            onNeedsLogin={continueInPopup}
            onCancel={closeForm}
          />
        )}
        {formKind === 'website' && (
          <WebsiteConnectorForm
            provider={openForm}
            onConnected={settle}
            onCancel={closeForm}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ConnectorBrowseControls
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={setCategory}
        categories={filterOptions}
      />

      {customRows.length > 0 && (
        <div className="space-y-2">
          {customRows.map((provider) => {
            const isSite = provider.provider === CUSTOM_SITE_PROVIDER;
            return (
              <button
                key={provider.provider}
                type="button"
                onClick={() => chooseRow(provider)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-neutral-300/40 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              >
                <span className="w-10 h-10 shrink-0 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
                  {isSite ? (
                    <Globe className="w-5 h-5 text-neutral-200" aria-hidden="true" />
                  ) : (
                    <Plus className="w-5 h-5 text-neutral-200" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-neutral-200 font-medium">
                    {provider.display_name}
                  </span>
                  <span className="block text-white/60 text-sm truncate">
                    {provider.summary || provider.card_description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {categories.map((catalogCategory) => (
        <div key={catalogCategory}>
          <p className="text-white/50 text-xs uppercase tracking-wide mb-2">
            {CONNECTOR_CATEGORY_LABELS[catalogCategory] ?? catalogCategory}
          </p>
          <ul className="space-y-1">
            {catalog
              .filter((provider) => provider.category === catalogCategory)
              .map((provider) => {
                const connectedCount =
                  connectedCountByProvider[provider.provider] ?? 0;
                const isComingSoon = provider.availability === 'coming_soon';
                return (
                  <li
                    key={provider.provider}
                    className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <ConnectorIcon iconKey={provider.icon_key} />
                    <div className="min-w-0 flex-grow">
                      <p className="text-neutral-200 truncate">
                        {provider.display_name}
                      </p>
                      <p className="text-white/50 text-sm truncate">
                        {isMcpConnectorProvider(provider)
                          ? connections.some(
                              (connection) =>
                                connection.source === 'device' &&
                                (connection.platform === provider.platform ||
                                  connection.pending)
                            )
                            ? 'On the list · Connect it under Connected'
                            : provider.summary
                          : connectedCount > 0
                            ? `${connectedCount} connected · Connect another`
                            : provider.summary || provider.card_description}
                      </p>
                    </div>
                    {isComingSoon ? (
                      <span className="shrink-0 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-white/60 text-xs">
                        Coming soon
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => chooseRow(provider)}
                        className="shrink-0 px-3 py-1.5 rounded-full bg-neutral-200 hover:bg-neutral-100 text-neutral-900 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                      >
                        Add
                      </button>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}

      {catalog.length === 0 && customRows.length === 0 && (
        <p className="text-white/50 text-sm">No connectors match that search.</p>
      )}
    </div>
  );
};

export default NewConnectorPicker;
