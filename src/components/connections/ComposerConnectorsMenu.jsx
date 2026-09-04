// src/components/connections/ComposerConnectorsMenu.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ChevronRight, Plug, Plus, Settings2 } from 'lucide-react';
import MenuPanel, { MenuRow } from '../ui/MenuPanel';
import Switch from '../ui/Switch';
import Modal from '../ui/Modal';
import ConnectorIcon from '../icons/ConnectorIcon';
import ConnectAccountCard from '../ConnectAccountCard';
import NewConnectorPicker from './NewConnectorPicker';
import {
  deviceIdFromConnection,
  disconnectDataServer,
  isDeviceConnection,
  listConnectableProviders,
  listConnections,
  listMcpConnections,
  mergeMcpDevicesIntoConnections,
  setConnectionState,
  unregisterMcpDevice,
} from '../../services/avatarService';
import { showRequestFailureToast } from '../requestFailureToast';
import ConnectionPresence from './ConnectionPresence';
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

/**
 * The composer's connectors menu on the personal avatar (each connected
 * account with an on/off switch, then "Add connector" and "Manage
 * connectors"). File attach lives on the paperclip beside this menu, not here.
 *
 * Connections are fetched when the menu opens rather than on every render of
 * the composer, so an owner who never opens it costs nothing. The switch is a
 * disconnect (the credential is deleted after a confirmation); switching a
 * disconnected account back on opens its connect card here, in a modal.
 *
 * @param {Object} parameters
 * @param {boolean} parameters.open Whether the menu is shown.
 * @param {Function} parameters.onClose Close the menu.
 * @param {boolean} parameters.showConnectors Whether the Connectors entry exists
 *   (personal avatar only).
 * @param {Function} parameters.onManageConnectors Navigate to the settings section.
 */
const ComposerConnectorsMenu = ({
  open,
  onClose,
  showConnectors,
  onManageConnectors,
}) => {
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
  const [connections, setConnections] = useState([]);
  const [providers, setProviders] = useState([]);
  const [busyKey, setBusyKey] = useState(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [cardBeingConnected, setCardBeingConnected] = useState(null);

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
      mcpResult.status === 'fulfilled' ? (mcpResult.value?.devices ?? []) : [];
    setConnections(
      mergePendingMcpConnections(
        mergeMcpDevicesIntoConnections(listedConnections, mcpDevices)
      )
    );
    if (providersResult.status === 'fulfilled') {
      setProviders(providersResult.value?.providers ?? []);
    }
  }, []);

  useEffect(() => {
    if (open && showConnectors) refresh();
    if (!open) setIsSubmenuOpen(false);
  }, [open, showConnectors, refresh]);

  useEffect(() => {
    if (!open || !showConnectors || !isSubmenuOpen) return undefined;
    const poll = setInterval(refresh, 15_000);
    return () => clearInterval(poll);
  }, [open, showConnectors, isSubmenuOpen, refresh]);

  const openCardFor = async (provider) => {
    if (!provider) return;
    setIsPickerOpen(false);
    onClose?.();
    if (isMcpConnectorProvider(provider)) {
      if (provider.availability === 'coming_soon') return;
      const connector = mcpConnectorFromProvider(provider);
      const alreadyListed = connections.find(
        (row) =>
          isDeviceConnection(row) &&
          !row.pending &&
          normalizePlatform(row.platform) === connector.platform
      );
      if (alreadyListed) {
        await handleToggle(alreadyListed, true);
        return;
      }
      const pending = addPendingMcpConnection(connector);
      setConnections(
        mergePendingMcpConnections(connections.filter((row) => !row.pending))
      );
      await handleToggle(pending, true);
      return;
    }
    setCardBeingConnected({
      ...provider,
      already_connected: connections
        .filter(
          (connection) =>
            connection.provider === provider.provider && connection.connected
        )
        .map((connection) => ({
          display_label: connection.display_label,
          account_address: connection.sub_label,
        })),
    });
  };

  const handleToggle = async (connection, next) => {
    if (isDeviceConnection(connection)) {
      setBusyKey(connection.connection_key);
      try {
        if (next) {
          const response = await bindMcpConnection(connection);
          const bound = Array.isArray(response?.connected_devices)
            ? response.connected_devices[0]
            : connection.display_label;
          toast.success(`${bound} is connected.`);
        } else {
          const deviceId = deviceIdFromConnection(connection);
          const confirmed = window.confirm(
            `Disconnect ${connection.display_label}? You can remove it from the list in Manage connectors.`
          );
          if (!confirmed) return;
          await disconnectDataServer(deviceId);
          toast.success(`${connection.display_label} disconnected.`);
        }
        await refresh();
      } catch (deviceError) {
        showRequestFailureToast(
          deviceError,
          'Start the MCP server on that machine, sign in, then press Connect again.'
        );
      } finally {
        setBusyKey(null);
      }
      return;
    }
    if (!next) {
      const confirmed = window.confirm(
        `Disconnect ${connection.display_label}? The saved credential is deleted and the avatar can no longer reach this account.`
      );
      if (!confirmed) return;
    }
    setBusyKey(connection.connection_key);
    try {
      const response = await setConnectionState(connection.connection_key, next);
      if (response?.action === 'open_connect_card' && response.card) {
        onClose?.();
        setCardBeingConnected({ ...response.card });
      } else {
        toast.success(
          next
            ? `${connection.display_label} is connecting now.`
            : `${connection.display_label} disconnected.`
        );
      }
      await refresh();
    } catch (toggleError) {
      showRequestFailureToast(toggleError, 'Could not change the connection.');
    } finally {
      setBusyKey(null);
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
    setBusyKey(connection.connection_key);
    try {
      try {
        await disconnectDataServer(deviceId);
      } catch {
        // Already unbound.
      }
      await unregisterMcpDevice(deviceId);
      toast.success(`${connection.display_label} removed.`);
      await refresh();
    } catch (removeError) {
      showRequestFailureToast(removeError, 'Could not remove that machine.');
    } finally {
      setBusyKey(null);
    }
  };

  const connectedRows = connections.filter(
    (connection) =>
      isDeviceConnection(connection) ||
      connection.connected ||
      connection.status === 'needs_reconnect'
  );

  return (
    <>
      <MenuPanel
        open={open}
        onClose={onClose}
        id="composer-menu"
        className="bottom-full mb-2 left-0 w-72"
      >
        {showConnectors && (
          <div className="relative">
            <MenuRow
              icon={<Plug className="w-4 h-4" aria-hidden="true" />}
              label="Connectors"
              onClick={() => setIsSubmenuOpen((previous) => !previous)}
              trailing={
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${
                    isSubmenuOpen ? 'rotate-90' : ''
                  }`}
                  aria-hidden="true"
                />
              }
              className={isSubmenuOpen ? 'bg-white/10 text-neutral-100' : ''}
            />
            {isSubmenuOpen && (
              <div
                role="menu"
                className="mt-1 ml-2 pl-2 border-l border-white/10 space-y-0.5"
              >
                {connectedRows.length === 0 && (
                  <p className="px-3 py-2 text-white/40 text-xs">
                    Nothing connected yet
                  </p>
                )}
                {connectedRows.map((connection) => {
                  const isDevice = isDeviceConnection(connection);
                  const isOnline = Boolean(connection.online);
                  const isBound =
                    Boolean(connection.connected) && !connection.pending;
                  return (
                  <div
                    key={connection.connection_key}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5"
                  >
                    <ConnectorIcon iconKey={connection.icon_key} size="sm" />
                    <span
                      className="flex-grow min-w-0 text-sm text-white/80 truncate"
                      title={
                        isDevice
                          ? formatDeviceMetadata(connection)
                          : connection.display_label
                      }
                    >
                      {connection.display_label}
                    </span>
                    {isDevice ? (
                      <>
                        <ConnectionPresence online={isOnline} />
                        {isBound && isOnline ? (
                          <button
                            type="button"
                            disabled={busyKey === connection.connection_key}
                            onClick={() => handleToggle(connection, false)}
                            className="text-xs text-white/70 hover:text-neutral-100 shrink-0"
                          >
                            Disconnect
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={busyKey === connection.connection_key}
                              onClick={() => handleToggle(connection, true)}
                              className="text-xs text-amber-300 hover:text-amber-200 shrink-0"
                            >
                              Connect
                            </button>
                            <button
                              type="button"
                              disabled={busyKey === connection.connection_key}
                              onClick={() => handleRemoveDevice(connection)}
                              className="text-xs text-red-300 hover:text-red-200 shrink-0"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <Switch
                        checked={connection.connected && connection.status !== 'needs_reconnect'}
                        busy={busyKey === connection.connection_key}
                        showLabel
                        onLabel="Disconnect"
                        offLabel="Connect"
                        label={`${connection.connected ? 'Disconnect' : 'Connect'} ${connection.display_label}`}
                        onChange={(next) => handleToggle(connection, next)}
                      />
                    )}
                  </div>
                  );
                })}
                <div className="border-t border-white/10 my-1" />
                <MenuRow
                  icon={<Plus className="w-4 h-4" aria-hidden="true" />}
                  label="Add connector"
                  onClick={() => {
                    setIsPickerOpen(true);
                    onClose?.();
                  }}
                />
                <MenuRow
                  icon={<Settings2 className="w-4 h-4" aria-hidden="true" />}
                  label="Manage connectors"
                  onClick={() => {
                    onClose?.();
                    onManageConnectors?.();
                  }}
                />
              </div>
            )}
          </div>
        )}
      </MenuPanel>

      <Modal
        open={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        title="New Connector"
      >
        <NewConnectorPicker
          providers={withMcpConnectorProviders(providers)}
          connections={connections}
          onPick={openCardFor}
        />
      </Modal>

      <Modal
        open={Boolean(cardBeingConnected)}
        onClose={() => setCardBeingConnected(null)}
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
                return;
              }
              setCardBeingConnected(null);
            }}
          />
        )}
      </Modal>
    </>
  );
};

export default ComposerConnectorsMenu;
