// src/components/connections/ConnectorBrowseControls.jsx
import React from 'react';
import { Search } from 'lucide-react';

/**
 * Search box and category chips shared by the connectors screen and the
 * New Connector picker.
 */
const ConnectorBrowseControls = ({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  categories = [],
  searchPlaceholder = 'Search connectors',
  searchLabel = 'Search connectors',
}) => (
  <div className="space-y-3">
    <div className="relative">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="search"
        value={query}
        onChange={(changeEvent) => onQueryChange(changeEvent.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchLabel}
        className="w-full pl-9 pr-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-neutral-200 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
      />
    </div>
    {categories.length > 1 && (
      <div
        role="tablist"
        aria-label="Filter connectors"
        className="flex flex-wrap gap-1.5"
      >
        {categories.map((option) => {
          const isCurrent = category === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              onClick={() => onCategoryChange(option.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${
                isCurrent
                  ? 'bg-neutral-200 text-neutral-900'
                  : 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-neutral-100'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    )}
  </div>
);

export default ConnectorBrowseControls;
