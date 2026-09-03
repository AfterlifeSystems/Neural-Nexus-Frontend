// src/components/connections/NewConnectorPicker.jsx
import React, { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import ConnectorIcon from '../icons/ConnectorIcon';

const CATEGORY_LABELS = {
  mail: 'Mail',
  calendar: 'Calendar',
  social: 'Social',
  messaging: 'Messaging',
  device: 'Your machines',
  custom: 'Custom',
};

/**
 * The "New Connector" picker: a search box, the Custom row first, then every
 * catalog provider grouped by category with an Add button (or a Coming soon
 * pill). Mirrors the reference design's picker one to one.
 *
 * Nothing here knows what a provider needs to connect; choosing one hands the
 * provider's card description back to the caller, which opens the connect card.
 *
 * @param {Object} parameters
 * @param {Object[]} parameters.providers Card descriptions from the catalog.
 * @param {Object[]} parameters.connections Current connections, to mark rows
 *   that already have an account connected.
 * @param {Function} parameters.onPick Called with the chosen provider card.
 */
const NewConnectorPicker = ({ providers = [], connections = [], onPick }) => {
  const [query, setQuery] = useState('');

  const connectedCountByProvider = useMemo(() => {
    const counts = {};
    for (const connection of connections) {
      if (!connection.connected) continue;
      counts[connection.provider] = (counts[connection.provider] ?? 0) + 1;
    }
    return counts;
  }, [connections]);

  const normalizedQuery = query.trim().toLowerCase();
  const matches = (provider) =>
    !normalizedQuery ||
    [provider.display_name, provider.summary, provider.category, provider.provider]
      .filter(Boolean)
      .some((text) => String(text).toLowerCase().includes(normalizedQuery));

  const customProvider = providers.find(
    (provider) => provider.provider === 'custom_mcp'
  );
  const catalog = providers.filter(
    (provider) => provider.provider !== 'custom_mcp' && matches(provider)
  );
  const categories = [...new Set(catalog.map((provider) => provider.category))];

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(changeEvent) => setQuery(changeEvent.target.value)}
          placeholder="Search"
          aria-label="Search connectors"
          className="w-full pl-9 pr-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-neutral-200 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        />
      </div>

      {customProvider && matches(customProvider) && (
        <button
          type="button"
          onClick={() => onPick?.(customProvider)}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-neutral-300/40 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        >
          <span className="w-10 h-10 shrink-0 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
            <Plus className="w-5 h-5 text-neutral-200" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-neutral-200 font-medium">Custom</span>
            <span className="block text-white/60 text-sm truncate">
              Add your own custom connector
            </span>
          </span>
        </button>
      )}

      {categories.map((category) => (
        <div key={category}>
          <p className="text-white/50 text-xs uppercase tracking-wide mb-2">
            {CATEGORY_LABELS[category] ?? category}
          </p>
          <ul className="space-y-1">
            {catalog
              .filter((provider) => provider.category === category)
              .map((provider) => {
                const connectedCount = connectedCountByProvider[provider.provider] ?? 0;
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
                        {connectedCount > 0
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
                        onClick={() => onPick?.(provider)}
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

      {catalog.length === 0 && !customProvider && (
        <p className="text-white/50 text-sm">No connectors match that search.</p>
      )}
    </div>
  );
};

export default NewConnectorPicker;
