// src/components/connections/connectorSearch.js
//
// One search/filter for the connectors screen and the New Connector picker so
// "iphone", "mcp", "linux", and "mail" all land on the same rows.

export const CONNECTOR_CATEGORY_LABELS = {
  mail: 'Mail',
  calendar: 'Calendar',
  social: 'Social',
  messaging: 'Messaging',
  device: 'Devices',
  custom: 'Custom',
};

const CATEGORY_ALIASES = {
  mail: 'email mailbox gmail',
  device: 'devices machine machines desktop mobile phone mcp',
  custom: 'custom url mcp server',
  social: 'social media',
};

/**
 * True when this catalog card or connection row matches the search box.
 *
 * @param {Object} item A provider or connection.
 * @param {string} query The search box value.
 * @returns {boolean}
 */
export function matchesConnectorSearch(item, query) {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return true;
  const category = item?.category;
  const haystack = [
    item?.display_name,
    item?.display_label,
    item?.summary,
    item?.card_description,
    item?.sub_label,
    item?.category,
    CONNECTOR_CATEGORY_LABELS[category],
    CATEGORY_ALIASES[category],
    item?.platform,
    item?.provider,
    item?.provider_display_name,
    item?.icon_key,
    item?.searchTerms,
    item?.online === true ? 'online' : '',
    item?.online === false ? 'offline' : '',
    item?.pending ? 'mcp pending not connected' : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return normalized
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}

/**
 * True when this item belongs to the selected category chip.
 *
 * @param {Object} item A provider or connection.
 * @param {string} category `all` or a catalog category.
 * @returns {boolean}
 */
export function matchesConnectorCategory(item, category) {
  if (!category || category === 'all') return true;
  return item?.category === category;
}

/**
 * Category chips to offer, given the providers on screen.
 *
 * @param {Object[]} providers Catalog cards.
 * @returns {Array<{id: string, label: string}>}
 */
export function connectorFilterOptions(providers = []) {
  const seen = new Set();
  const options = [{ id: 'all', label: 'All' }];
  for (const provider of providers) {
    const category = provider?.category;
    if (!category || seen.has(category)) continue;
    seen.add(category);
    options.push({
      id: category,
      label: CONNECTOR_CATEGORY_LABELS[category] ?? category,
    });
  }
  return options;
}
