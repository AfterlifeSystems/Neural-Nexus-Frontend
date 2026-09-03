// src/components/connections/ConnectionsSection.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { Check, Plug, Search, Sparkles } from 'lucide-react';
import ConnectorIcon from '../icons/ConnectorIcon';
import ConnectAccountCard from '../ConnectAccountCard';
import Modal from '../ui/Modal';
import Switch from '../ui/Switch';
import NewConnectorPicker from './NewConnectorPicker';
import {
  importMailboxWritingSamples,
  listConnectableProviders,
  listConnections,
  setConnectionState,
} from '../../services/avatarService';
import { showRequestFailureToast } from '../requestFailureToast';

const CATEGORY_LABELS = {
  mail: 'Mail',
  calendar: 'Calendar',
  social: 'Social',
  messaging: 'Messaging',
  device: 'Your machines',
  custom: 'Custom',
};

/**
 * Everything the personal avatar is connected to, and everything it could be.
 *
 * The manage-connections screen from the reference design: a header with the
 * Connectors pill, a search box and a New Connector button; a **Connected**
 * grid (icon, name, sub-label, on/off switch, "Added" pill, Disconnect); and a
 * **Featured** grid of catalog providers grouped by category with Add buttons
 * or Coming soon pills. The New Connector picker and the connect card open in
 * modals; both read their content from the API, so a provider added to the
 * registry appears here without a frontend change.
 *
 * The switch is a disconnect: off deletes the stored credential (after a
 * confirmation), on reopens the connect card, because a deleted credential
 * cannot be restored.
 *
 * Reached from the "+" menu's "Manage connectors" with `?section=connections`,
 * which scrolls this card into view.
 *
 * @param {Object} parameters
 * @param {Function} [parameters.onConnectionsChanged] Called after any change.
 */
const ConnectionsSection = ({ onConnectionsChanged }) => {
  const [connections, setConnections] = useState([]);
  const [providers, setProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [cardBeingConnected, setCardBeingConnected] = useState(null);
  const [busyConnectionKey, setBusyConnectionKey] = useState(null);
  const [importingAccountKey, setImportingAccountKey] = useState(null);
  const sectionRef = useRef(null);
  const [searchParams] = useSearchParams();

  const refresh = useCallback(async () => {
    try {
      const [connectionsResponse, providersResponse] = await Promise.all([
        listConnections(),
        listConnectableProviders(),
      ]);
      setConnections(connectionsResponse?.connections ?? []);
      setProviders(providersResponse?.providers ?? []);
    } catch (loadError) {
      console.debug('Connections could not be loaded:', loadError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // `?section=connections` brings the owner here from the composer's menu.
  useEffect(() => {
    if (searchParams.get('section') === 'connections' && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchParams, isLoading]);

  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (...texts) =>
    !normalizedQuery ||
    texts
      .filter(Boolean)
      .some((text) => String(text).toLowerCase().includes(normalizedQuery));

  const connectedRows = connections.filter((connection) =>
    matchesQuery(
      connection.display_label,
      connection.sub_label,
      connection.provider_display_name
    )
  );

  const featuredRows = providers.filter(
    (provider) =>
      provider.featured &&
      matchesQuery(provider.display_name, provider.summary, provider.category)
  );
  const featuredCategories = [
    ...new Set(featuredRows.map((provider) => provider.category)),
  ];

  const openCardFor = (provider) => {
    if (!provider) return;
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
    if (!nextConnected) {
      const confirmed = window.confirm(
        `Disconnect ${connection.display_label}? ` +
          (connection.source === 'device'
            ? 'The avatar stops using this machine until you connect it again.'
            : 'The saved credential is deleted and the avatar can no longer reach this account.')
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
            ? `${connection.display_label} will connect on the next turn.`
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

  const handleDisconnect = async (connection) => {
    await handleToggle(connection, false);
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

  const renderConnectedRow = (connection) => {
    const isBusy = busyConnectionKey === connection.connection_key;
    const isMailbox = connection.kind === 'mailbox';
    const needsReconnect = connection.status === 'needs_reconnect';
    return (
      <div
        key={connection.connection_key}
        className="flex items-center gap-3 p-3 bg-black/60 border border-white/10 rounded-xl"
      >
        <ConnectorIcon iconKey={connection.icon_key} />
        <div className="min-w-0 flex-grow">
          <p className="text-neutral-200 truncate">{connection.display_label}</p>
          <p
            className={`text-xs truncate ${
              needsReconnect ? 'text-amber-300' : 'text-white/50'
            }`}
          >
            {needsReconnect
              ? 'The saved credential stopped working — reconnect'
              : connection.sub_label}
          </p>
        </div>
        {connection.connected && !needsReconnect && (
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs shrink-0">
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
            Added
          </span>
        )}
        {isMailbox && connection.connected && (
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
          checked={connection.connected && !needsReconnect}
          busy={isBusy}
          label={`${connection.connected ? 'Disconnect' : 'Connect'} ${connection.display_label}`}
          onChange={(next) => handleToggle(connection, next)}
        />
        <button
          type="button"
          onClick={() => handleDisconnect(connection)}
          disabled={isBusy}
          className="hidden lg:inline-flex px-3 py-1.5 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg border border-red-500/30 transition-colors disabled:opacity-50"
        >
          Disconnect
        </button>
      </div>
    );
  };

  return (
    <div
      ref={sectionRef}
      id="connections"
      className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-6"
    >
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className="px-3 py-1.5 rounded-full bg-white/15 text-neutral-200 text-sm font-medium inline-flex items-center gap-2">
          <Plug className="w-4 h-4" aria-hidden="true" />
          Connectors
        </span>
        <div className="relative flex-grow min-w-[160px] max-w-xs ml-auto">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(changeEvent) => setQuery(changeEvent.target.value)}
            placeholder="Search…"
            aria-label="Search connections"
            className="w-full pl-9 pr-3 py-2 bg-black/50 border border-white/10 rounded-full text-neutral-200 text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          />
        </div>
        <button
          type="button"
          onClick={() => setIsPickerOpen(true)}
          className="px-4 py-2 rounded-full bg-neutral-200 hover:bg-neutral-100 text-neutral-900 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        >
          New Connector
        </button>
      </div>

      <h4 className="text-neutral-200 font-semibold mb-3">Connected</h4>
      {isLoading ? (
        <p className="text-white/50 text-sm mb-6">Loading…</p>
      ) : connectedRows.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-6">
          {connectedRows.map(renderConnectedRow)}
        </div>
      ) : (
        <p className="text-white/50 text-sm mb-6">
          Nothing connected yet. Connect an account below, or ask the avatar in
          chat — it can open the sign-in card for you.
        </p>
      )}

      <h4 className="text-neutral-200 font-semibold mb-3">Featured</h4>
      {featuredCategories.map((category) => (
        <div key={category} className="mb-4">
          <p className="text-white/40 text-xs uppercase tracking-wide mb-2">
            {CATEGORY_LABELS[category] ?? category}
          </p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            {featuredRows
              .filter((provider) => provider.category === category)
              .map((provider) => {
                const isComingSoon = provider.availability === 'coming_soon';
                const connectedCount = connections.filter(
                  (connection) =>
                    connection.provider === provider.provider && connection.connected
                ).length;
                return (
                  <div
                    key={provider.provider}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
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
      ))}

      <Modal
        open={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        title="New Connector"
      >
        <NewConnectorPicker
          providers={providers}
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
          <>
            {cardBeingConnected.provider === 'custom_mcp' && (
              <p className="text-white/60 text-sm mb-3">
                Enter a custom name and an MCP server URL
              </p>
            )}
            <ConnectAccountCard
              key={cardBeingConnected.provider}
              interrupt={cardBeingConnected}
              startOpen
              className="w-full"
              onDecision={async (decision) => {
                if (decision === 'apply') {
                  await refresh();
                  onConnectionsChanged?.();
                  // Leave the card up so the owner sees "Added"; it closes on
                  // the next dismissal.
                  return;
                }
                setCardBeingConnected(null);
              }}
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default ConnectionsSection;
