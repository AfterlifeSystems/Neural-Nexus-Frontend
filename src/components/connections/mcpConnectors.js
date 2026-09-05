// src/components/connections/mcpConnectors.js
//
// MCP device connectors the owner adds from New Connector. Adding one puts a
// row on the Connected list and immediately tries to bind a reachable daemon.
// These are not custom MCP URLs.

import { connectMcpDevice } from '../../services/avatarService';
import { selectMcpDeviceToBind } from './mcpBindTarget';

export { selectMcpDeviceToBind } from './mcpBindTarget';

export const MCP_CONNECTORS = [
  {
    platform: 'ubuntu',
    display_name: 'Ubuntu desktop',
    summary: 'Neural Nexus MCP server for Linux',
    icon_key: 'ubuntu',
    downloadHref:
      'https://github.com/AfterlifeSystems/anubis-mcp-server-ubuntu-desktop',
    searchTerms: 'linux debian desktop mcp server machine',
  },
  {
    platform: 'windows',
    display_name: 'Windows',
    summary: 'Neural Nexus MCP server for Windows',
    icon_key: 'windows',
    downloadHref:
      'https://github.com/AfterlifeSystems/anubis-mcp-server-windows',
    searchTerms: 'pc desktop mcp server machine',
  },
  {
    platform: 'macos',
    display_name: 'macOS',
    summary: 'Neural Nexus MCP server for Mac',
    icon_key: 'apple',
    downloadHref:
      'https://github.com/AfterlifeSystems/anubis-mcp-server-mac-os',
    searchTerms: 'mac apple desktop mcp server machine',
  },
  {
    platform: 'ios',
    display_name: 'Mobile',
    summary: 'Neural Nexus MCP server for iPhone',
    icon_key: 'ios',
    searchTerms: 'iphone ios apple phone mobile mcp server',
  },
  {
    platform: 'android',
    display_name: 'Android',
    summary: 'Neural Nexus MCP server for Android',
    icon_key: 'android',
    availability: 'coming_soon',
    searchTerms: 'android phone mobile mcp server coming soon',
  },
];

const PENDING_STORAGE_KEY = 'neural_nexus_pending_mcp_devices';

/**
 * Canonical platform key for matching a picker row to a registered daemon.
 *
 * @param {string} [value] A platform string from the picker or the API.
 * @returns {string}
 */
export function normalizePlatform(value) {
  const platform = String(value || '').toLowerCase();
  if (['linux', 'ubuntu', 'debian'].includes(platform)) return 'ubuntu';
  if (['darwin', 'macos', 'mac'].includes(platform)) return 'macos';
  if (['iphone', 'ipad', 'ios', 'ipados', 'mobile'].includes(platform)) {
    return 'ios';
  }
  if (platform.includes('android')) return 'android';
  if (platform.includes('win')) return 'windows';
  return platform;
}

/**
 * Catalog cards for the New Connector picker and Featured grid.
 *
 * @returns {Object[]}
 */
export function mcpConnectorProviders() {
  return MCP_CONNECTORS.map((connector) => ({
    provider: `desktop_mcp:${connector.platform}`,
    platform: connector.platform,
    display_name: connector.display_name,
    summary: connector.summary,
    icon_key: connector.icon_key,
    category: 'device',
    featured: true,
    uses_form: false,
    credential_mechanism: 'device_pairing',
    downloadHref: connector.downloadHref,
    availability: connector.availability,
    searchTerms: connector.searchTerms,
  }));
}

/**
 * True when this catalog card is an MCP device type, not a mailbox or URL.
 *
 * @param {Object} provider A connectable-providers card.
 * @returns {boolean}
 */
export function isMcpConnectorProvider(provider) {
  return (
    provider?.category === 'device' ||
    String(provider?.provider ?? '').startsWith('desktop_mcp') ||
    provider?.provider === 'neural_nexus_desktop' ||
    provider?.credential_mechanism === 'device_pairing'
  );
}

/**
 * The MCP connector matching a picker card.
 *
 * @param {Object} provider A picker / featured card.
 * @returns {Object}
 */
export function mcpConnectorFromProvider(provider) {
  const platform = normalizePlatform(
    provider?.platform || String(provider?.provider ?? '').split(':')[1]
  );
  return (
    MCP_CONNECTORS.find((connector) => connector.platform === platform) ??
    MCP_CONNECTORS[0]
  );
}

function pendingKeyForPlatform(platform) {
  return `device:pending:${normalizePlatform(platform)}`;
}

/**
 * A Connected-list row for an MCP type that has been added but not bound yet.
 *
 * @param {Object} connector One of `MCP_CONNECTORS`.
 * @returns {Object}
 */
export function pendingConnectionFromConnector(connector) {
  const platform = normalizePlatform(connector.platform);
  return {
    connection_key: pendingKeyForPlatform(platform),
    source: 'device',
    provider: 'desktop_mcp',
    category: 'device',
    display_label: connector.display_name,
    sub_label: 'MCP · not connected yet',
    connected: false,
    online: false,
    pending: true,
    platform,
    icon_key: connector.icon_key,
    downloadHref: connector.downloadHref,
    searchTerms: connector.searchTerms,
  };
}

export function loadPendingMcpConnections() {
  try {
    const stored = JSON.parse(localStorage.getItem(PENDING_STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((row) => row?.pending) : [];
  } catch {
    return [];
  }
}

export function savePendingMcpConnections(rows) {
  localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(rows));
}

/**
 * Add an MCP type to the list. A second add of the same OS is a no-op.
 *
 * @param {Object} connector One of `MCP_CONNECTORS`.
 * @returns {Object} The pending row.
 */
export function addPendingMcpConnection(connector) {
  const pending = pendingConnectionFromConnector(connector);
  const existing = loadPendingMcpConnections();
  if (existing.some((row) => row.connection_key === pending.connection_key)) {
    return pending;
  }
  savePendingMcpConnections([...existing, pending]);
  return pending;
}

export function removePendingMcpConnection(connectionKey) {
  savePendingMcpConnections(
    loadPendingMcpConnections().filter(
      (row) => row.connection_key !== connectionKey
    )
  );
}

/**
 * Drop pending rows whose platform already has a registered machine.
 *
 * @param {Object[]} serverRows Unified connection rows.
 * @returns {Object[]}
 */
export function mergePendingMcpConnections(serverRows) {
  const listed = serverRows ?? [];
  const claimedPlatforms = new Set(
    listed
      .filter((row) => row?.source === 'device' && !row.pending)
      .map((row) => normalizePlatform(row.platform || row.sub_label))
      .filter(Boolean)
  );
  const pending = loadPendingMcpConnections().filter(
    (row) => !claimedPlatforms.has(normalizePlatform(row.platform))
  );
  savePendingMcpConnections(pending);
  return [...listed, ...pending];
}

/**
 * Replace catalog "Your machines" with the OS MCP connectors.
 *
 * @param {Object[]} providers Catalog providers.
 * @returns {Object[]}
 */
export function withMcpConnectorProviders(providers) {
  const withoutGenericDevice = (providers ?? []).filter(
    (provider) => !isMcpConnectorProvider(provider)
  );
  return [...withoutGenericDevice, ...mcpConnectorProviders()];
}

/**
 * One line of connection metadata under the device name.
 *
 * @param {Object} connection A device row.
 * @returns {string}
 */
export function formatDeviceMetadata(connection) {
  if (connection?.pending) {
    return 'MCP · not connected yet';
  }
  const parts = [];
  const platform = connection?.platform || connection?.sub_label;
  if (platform) parts.push(String(platform));
  if (
    connection?.server_name &&
    connection.server_name !== connection.display_label
  ) {
    parts.push(connection.server_name);
  }
  if (connection?.connection_mode) parts.push(connection.connection_mode);
  if (connection?.last_seen_at) {
    parts.push(`seen ${formatRelativeTime(connection.last_seen_at)}`);
  }
  return parts.length ? parts.join(' · ') : 'MCP';
}

function formatRelativeTime(value) {
  const then = new Date(value).valueOf();
  if (!Number.isFinite(then)) return String(value);
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 45) return 'just now';
  if (seconds < 90) return '1 min ago';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 5400) return '1 hr ago';
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hr ago`;
  return new Date(then).toLocaleDateString();
}

/**
 * Bind a listed MCP row to a reachable daemon right now.
 *
 * @param {Object} connection A device row (pending or registered).
 * @returns {Promise<Object>} The `/connect_mcp` response.
 */
export async function bindMcpConnection(connection) {
  const target = selectMcpDeviceToBind(connection);
  const response = await connectMcpDevice({
    deviceId: target.deviceId,
    deviceLabel: target.deviceLabel,
  });
  if (connection?.pending) {
    removePendingMcpConnection(connection.connection_key);
  }
  return response;
}
