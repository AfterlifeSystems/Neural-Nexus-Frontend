// src/components/connections/NewConnectorPicker.jsx
import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import ConnectorIcon from '../icons/ConnectorIcon';
import { isMcpConnectorProvider } from './mcpConnectors';
import ConnectorBrowseControls from './ConnectorBrowseControls';
import {
  CONNECTOR_CATEGORY_LABELS,
  connectorFilterOptions,
  matchesConnectorCategory,
  matchesConnectorSearch,
} from './connectorSearch';

/**
 * The "New Connector" picker: search, category filters, the Custom row first,
 * then every catalog provider grouped by category with an Add button (or a
 * Coming soon pill).
 */
const NewConnectorPicker = ({ providers = [], connections = [], onPick }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

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

  const customProvider = providers.find(
    (provider) => provider.provider === 'custom_mcp'
  );
  const catalog = providers.filter(
    (provider) => provider.provider !== 'custom_mcp' && matches(provider)
  );
  const categories = [...new Set(catalog.map((provider) => provider.category))];
  const customMatches = Boolean(customProvider && matches(customProvider));
  const filterOptions = connectorFilterOptions(providers);

  return (
    <div className="space-y-4">
      <ConnectorBrowseControls
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={setCategory}
        categories={filterOptions}
      />

      {customMatches && (
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

      {catalog.length === 0 && !customMatches && (
        <p className="text-white/50 text-sm">No connectors match that search.</p>
      )}
    </div>
  );
};

export default NewConnectorPicker;
