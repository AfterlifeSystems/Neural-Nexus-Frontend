// src/components/connections/ConnectionsSection.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { Plug, Sparkles } from 'lucide-react';
import ConnectorIcon from '../icons/ConnectorIcon';
import ConnectAccountCard from '../ConnectAccountCard';
import Modal from '../ui/Modal';
import Switch from '../ui/Switch';
import ConnectionPresence from './ConnectionPresence';
import ConnectorBrowseControls from './ConnectorBrowseControls';
import NewConnectorPicker from './NewConnectorPicker';
import {
  addPendingMcpConnection,
  bindMcpConnection,
  formatDeviceMetadata,
  isMcpConnectorProvider,
  mcpConnectorFromProvider,
  mergePendingMcpConnections,
  normalizePlatform,
  removePendingMcpConnection,
  withMcpConnectorProviders,
} from './mcpConnectors';
import {
  CONNECTOR_CATEGORY_LABELS,
  connectorFilterOptions,
  matchesConnectorCategory,
  matchesConnectorSearch,
} from './connectorSearch';
import {
  connectAccount,
  deviceIdFromConnection,
  disconnectDataServer,
  importMailboxWritingSamples,
  isDeviceConnection,
  listConnectableProviders,
  listConnections,
  listMcpConnections,
  mergeMcpDevicesIntoConnections,
  setConnectionState,
  unregisterMcpDevice,
} from '../../services/avatarService';
import { showRequestFailureToast } from '../requestFailureToast';

/**
 * Everything the personal avatar is connected to, and everything it could be.
 *
 * Machines are listed once they have been added. Online/offline is their
 * status. Disconnecting a machine offers Remove so it leaves this list.
 * Adding a machine is installing the connector, not pasting an MCP URL.
 */
const ConnectionsSection = ({ onConnectionsChanged }) => {
  const [connections, setConnections] = useState([]);
  const [providers, setProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [cardBeingConnected, setCardBeingConnected] = useState(null);
  const [busyConnectionKey, setBusyConnectionKey] = useState(null);
  const [importingAccountKey, setImportingAccountKey] = useState(null);
  const sectionRef = useRef(null);
  const [searchParams] = useSearchParams();

  const refresh = useCallback(async () => {
    const [connectionsResult, providersResult, mcpResult] = await Promise.allSettled([
      listConnections(),
      listConnectableProviders(),
      listMcpConnections(),
    ]);
    const listedConnections =
      connectionsResult.status === 'fulfilled'
        ? (connectionsResult.value?.connections ?? [])
        : [];
    const mcpDevices =
      mcpResult.status === 'fulfilled'
        ? (mcpResult.value?.devices ?? [])
        : [];
    setConnections(
      mergePendingMcpConnections(
        mergeMcpDevicesIntoConnections(listedConnections, mcpDevices)
      )
    );
    if (providersResult.status === 'fulfilled') {
      setProviders(providersResult.value?.providers ?? []);
    }
    if (
      connectionsResult.status === 'rejected' &&
      providersResult.status === 'rejected' &&
      mcpResult.status === 'rejected'
    ) {
      console.debug(
        'Connections could not be loaded:',
        connectionsResult.reason ?? providersResult.reason ?? mcpResult.reason
      );
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 15_000);
    return () => clearInterval(poll);
  }, [refresh]);

  useEffect(() => {
    if (searchParams.get('section') === 'connections' && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchParams, isLoading]);

  const connectedRows = connections.filter(
    (connection) =>
      matchesConnectorSearch(connection, query) &&
      matchesConnectorCategory(connection, categoryFilter)
  );

  const catalogProviders = withMcpConnectorProviders(providers);
  const filterOptions = connectorFilterOptions(catalogProviders);

  const featuredRows = catalogProviders.filter(
    (provider) =>
      provider.featured &&
      matchesConnectorSearch(provider, query) &&
      matchesConnectorCategory(provider, categoryFilter)
  );
  const featuredCategories = [
    ...new Set(featuredRows.map((provider) => provider.category)),
  ];

  const addMcpConnector = async (provider) => {
    if (provider?.availability === 'coming_soon') return;
    const connector = mcpConnectorFromProvider(provider);
    const alreadyListed = connections.find(
      (row) =>
        isDeviceConnection(row) &&
        !row.pending &&
        normalizePlatform(row.platform) === connector.platform
    );
    setIsPickerOpen(false);
    setCardBeingConnected(null);
    if (alreadyListed) {
      await handleDeviceConnect(alreadyListed);
      return;
    }
    const pending = addPendingMcpConnection(connector);
    setConnections(
      mergePendingMcpConnections(
        connections.filter((row) => !row.pending)
      )
    );
    await handleDeviceConnect(pending);
  };

  const openCardFor = (provider) => {
    if (!provider) return;
    if (isMcpConnectorProvider(provider)) {
      addMcpConnector(provider);
      return;
    }
    setIsPickerOpen(false);
    setCardBeingConnected({
      ...provider,
      already_connected: connections
        .filter(
          (connection) =>
            connection.provider === provider.provider && connection.connected
        )
        .map((connection) => ({
          account_key: connection.connection_key,
          display_label: connection.display_label,
          account_address: connection.sub_label,
        })),
    });
  };

  const handleToggle = async (connection, nextConnected) => {
    if (isDeviceConnection(connection)) {
      if (nextConnected) {
        await handleDeviceConnect(connection);
      } else {
        await handleDeviceDisconnect(connection);
      }
      return;
    }
    if (!nextConnected) {
      const confirmed = window.confirm(
        `Disconnect ${connection.display_label}? The saved credential is deleted and the avatar can no longer reach this account.`
      );
      if (!confirmed) return;
    }
    setBusyConnectionKey(connection.connection_key);
    try {
      const response = await setConnectionState(
        connection.connection_key,
        nextConnected
      );
      if (response?.action === 'open_connect_card' && response.card) {
        setCardBeingConnected({ ...response.card });
      } else {
        toast.success(
          nextConnected
            ? `${connection.display_label} is connecting now.`
            : `${connection.display_label} disconnected.`
        );
      }
      await refresh();
      onConnectionsChanged?.();
    } catch (toggleError) {
      showRequestFailureToast(toggleError, 'Could not change the connection.');
    } finally {
      setBusyConnectionKey(null);
    }
  };

  const handleDeviceConnect = async (connection) => {
    setBusyConnectionKey(connection.connection_key);
    try {
      const response = await bindMcpConnection(connection);
      const bound = Array.isArray(response?.connected_devices)
        ? response.connected_devices[0]
        : connection.display_label;
      toast.success(`${bound} is connected.`);
      await refresh();
      onConnectionsChanged?.();
    } catch (connectError) {
      try {
        await connectAccount({
          provider: connection.provider,
          fields: {},
          endpoint: connection.connect_endpoint || '/connect_mcp',
        });
        if (connection.pending) {
          removePendingMcpConnection(connection.connection_key);
        }
        toast.success(`${connection.display_label} is connected.`);
        await refresh();
        onConnectionsChanged?.();
      } catch {
        showRequestFailureToast(
          connectError,
          'Start the MCP server on that machine, sign in, then press Connect again.'
        );
      }
    } finally {
      setBusyConnectionKey(null);
    }
  };

  const handleDeviceDisconnect = async (connection) => {
    const deviceId = deviceIdFromConnection(connection);
    if (!deviceId) return;
    const confirmed = window.confirm(
      `Disconnect ${connection.display_label}? You can remove it from this list afterwards.`
    );
    if (!confirmed) return;
    setBusyConnectionKey(connection.connection_key);
    try {
      await disconnectDataServer(deviceId);
      toast.success(`${connection.display_label} disconnected.`);
      await refresh();
      onConnectionsChanged?.();
    } catch (disconnectError) {
      showRequestFailureToast(disconnectError, 'Could not disconnect that machine.');
    } finally {
      setBusyConnectionKey(null);
    }
  };

  const handleRemoveDevice = async (connection) => {
    const confirmed = window.confirm(
      `Remove ${connection.display_label} from this list?`
    );
    if (!confirmed) return;
    if (connection.pending) {
      removePendingMcpConnection(connection.connection_key);
      setConnections((current) =>
        current.filter((row) => row.connection_key !== connection.connection_key)
      );
      toast.success(`${connection.display_label} removed.`);
      return;
    }
    const deviceId = deviceIdFromConnection(connection);
    if (!deviceId) return;
    setBusyConnectionKey(connection.connection_key);
    try {
      try {
        await disconnectDataServer(deviceId);
      } catch {
        // Already unbound; still drop the registration.
      }
      await unregisterMcpDevice(deviceId);
      toast.success(`${connection.display_label} removed.`);
      await refresh();
      onConnectionsChanged?.();
    } catch (removeError) {
      showRequestFailureToast(removeError, 'Could not remove that machine.');
    } finally {
      setBusyConnectionKey(null);
    }
  };

  const handleImportWritingSamples = async (connection) => {
    const accountKey = connection.connection_key.replace(/^account:/, '');
    setImportingAccountKey(accountKey);
    try {
      const response = await importMailboxWritingSamples({ accountKey });
      toast.success(
        `Reading ${response?.messages_imported ?? 'your'} sent messages into the avatar's identity…`
      );
    } catch (importError) {
      showRequestFailureToast(importError, 'Could not import sent mail.');
    } finally {
      setImportingAccountKey(null);
    }
  };

  const renderDeviceRow = (connection) => {
    const isBusy = busyConnectionKey === connection.connection_key;
    const isOnline = Boolean(connection.online);
    const isBound = Boolean(connection.connected) && !connection.pending;
    return (
      <div
        key={connection.connection_key}
        className="flex items-center gap-3 p-3 bg-black/60 border border-white/10 rounded-xl"
      >
        <ConnectorIcon iconKey={connection.icon_key} />
        <div className="min-w-0 flex-grow">
          <p className="text-neutral-200 whitespace-normal break-words">
            {connection.display_label}
          </p>
          <p className="text-xs text-white/50 whitespace-normal break-words">
            {formatDeviceMetadata(connection)}
          </p>
          {connection.pending && connection.downloadHref && (
            <a
              href={connection.downloadHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/40 hover:text-white/70 underline"
            >
              Download the MCP server
            </a>
          )}
        </div>
        <ConnectionPresence online={isOnline} />
        {isBound && isOnline ? (
          <button
            type="button"
            onClick={() => handleDeviceDisconnect(connection)}
            disabled={isBusy}
            className="shrink-0 px-3 py-1.5 text-sm bg-white/10 hover:bg-white/15 text-neutral-200 rounded-lg border border-white/15 transition-colors disabled:opacity-50"
          >
            Disconnect
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => handleDeviceConnect(connection)}
              disabled={isBusy}
              className="shrink-0 px-3 py-1.5 text-sm bg-neutral-200 hover:bg-neutral-100 text-neutral-900 rounded-lg transition-colors disabled:opacity-50"
            >
              Connect
            </button>
            <button
              type="button"
              onClick={() => handleRemoveDevice(connection)}
              disabled={isBusy}
              className="shrink-0 px-3 py-1.5 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg border border-red-500/30 transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          </>
        )}
      </div>
    );
  };

  const renderAccountRow = (connection) => {
    const isBusy = busyConnectionKey === connection.connection_key;
    const isMailbox = connection.kind === 'mailbox';
    const needsReconnect = connection.status === 'needs_reconnect';
    const isOn = connection.connected && !needsReconnect;
    return (
      <div
        key={connection.connection_key}
        className="flex items-center gap-3 p-3 bg-black/60 border border-white/10 rounded-xl"
      >
        <ConnectorIcon iconKey={connection.icon_key} />
        <div className="min-w-0 flex-grow">
          <p className="text-neutral-200 whitespace-normal break-words">
            {connection.display_label}
          </p>
          <p
            className={`text-xs whitespace-normal break-words ${
              needsReconnect ? 'text-amber-300' : 'text-white/50'
            }`}
          >
            {needsReconnect
              ? 'The saved credential stopped working — reconnect'
              : connection.sub_label}
          </p>
        </div>
        {isMailbox && isOn && (
          <button
            type="button"
            onClick={() => handleImportWritingSamples(connection)}
            disabled={importingAccountKey !== null}
            title="Read your sent mail so the avatar learns how you write"
            className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100/10 hover:bg-neutral-100/15 border border-neutral-700 text-neutral-300 text-xs transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            Learn my voice
          </button>
        )}
        <Switch
          checked={isOn}
          busy={isBusy}
          showLabel
          onLabel="Disconnect"
          offLabel="Connect"
          label={`${isOn ? 'Disconnect' : 'Connect'} ${connection.display_label}`}
          onChange={(next) => handleToggle(connection, next)}
        />
      </div>
    );
  };

  return (
    <div
      ref={sectionRef}
      id="connections"
      className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-6"
    >
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="px-3 py-1.5 rounded-full bg-white/15 text-neutral-200 text-sm font-medium inline-flex items-center gap-2">
          <Plug className="w-4 h-4" aria-hidden="true" />
          Connectors
        </span>
        <button
          type="button"
          onClick={() => setIsPickerOpen(true)}
          className="ml-auto px-4 py-2 rounded-full bg-neutral-200 hover:bg-neutral-100 text-neutral-900 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        >
          New Connector
        </button>
      </div>
      <div className="mb-5">
        <ConnectorBrowseControls
          query={query}
          onQueryChange={setQuery}
          category={categoryFilter}
          onCategoryChange={setCategoryFilter}
          categories={filterOptions}
          searchPlaceholder="Search connectors"
          searchLabel="Search connections"
        />
      </div>

      <h4 className="text-neutral-200 font-semibold mb-3">Connected</h4>
      {isLoading ? (
        <p className="text-white/50 text-sm mb-6">Loading…</p>
      ) : connectedRows.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-6">
          {connectedRows.map((connection) =>
            isDeviceConnection(connection)
              ? renderDeviceRow(connection)
              : renderAccountRow(connection)
          )}
        </div>
      ) : (
        <p className="text-white/50 text-sm mb-6">
          {query.trim() || categoryFilter !== 'all'
            ? 'No connections match that search.'
            : 'Nothing connected yet. Press New Connector to add an MCP connection or an account.'}
        </p>
      )}

      <h4 className="text-neutral-200 font-semibold mb-3">Featured</h4>
      {featuredRows.length === 0 ? (
        <p className="text-white/50 text-sm">
          No connectors match that search.
        </p>
      ) : (
      featuredCategories.map((category) => (
        <div key={category} className="mb-4">
          <p className="text-white/40 text-xs uppercase tracking-wide mb-2">
            {CONNECTOR_CATEGORY_LABELS[category] ?? category}
          </p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            {featuredRows
              .filter((provider) => provider.category === category)
              .map((provider) => {
                const isComingSoon = provider.availability === 'coming_soon';
                const isDevice = isMcpConnectorProvider(provider);
                const platform = provider.platform;
                const connectedCount = connections.filter((connection) =>
                  isDevice
                    ? isDeviceConnection(connection) &&
                      (!platform ||
                        normalizePlatform(connection.platform) ===
                          normalizePlatform(platform))
                    : connection.provider === provider.provider &&
                      connection.connected
                ).length;
                return (
                  <div
                    key={provider.provider}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <ConnectorIcon iconKey={provider.icon_key} />
                    <div className="min-w-0 flex-grow">
                      <p className="text-neutral-200 whitespace-normal break-words">
                        {provider.display_name}
                      </p>
                      <p className="text-white/50 text-sm whitespace-normal break-words">
                        {connectedCount > 0
                          ? isDevice
                            ? 'On the list · Connect it above'
                            : `${connectedCount} connected · Connect another`
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
                        onClick={() => openCardFor(provider)}
                        className="shrink-0 px-3 py-1.5 rounded-full bg-neutral-200 hover:bg-neutral-100 text-neutral-900 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                      >
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      ))
      )}

      <Modal
        open={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        title="New Connector"
      >
        <NewConnectorPicker
          providers={catalogProviders}
          connections={connections}
          onPick={openCardFor}
        />
      </Modal>

      <Modal
        open={Boolean(cardBeingConnected)}
        onClose={() => setCardBeingConnected(null)}
        onBack={() => {
          setCardBeingConnected(null);
          setIsPickerOpen(true);
        }}
        title={
          cardBeingConnected?.provider === 'custom_mcp'
            ? 'Custom Connector'
            : cardBeingConnected?.display_name
        }
        widthClassName="max-w-md"
      >
        {cardBeingConnected && (
          <ConnectAccountCard
            key={cardBeingConnected.provider}
            interrupt={cardBeingConnected}
            startOpen
            className="w-full"
            onDecision={async (decision) => {
              if (decision === 'apply') {
                await refresh();
                onConnectionsChanged?.();
                return;
              }
              setCardBeingConnected(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default ConnectionsSection;
