// src/components/connections/ComposerConnectorsMenu.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ChevronRight, Paperclip, Plug, Plus, Settings2 } from 'lucide-react';
import MenuPanel, { MenuRow } from '../ui/MenuPanel';
import Switch from '../ui/Switch';
import Modal from '../ui/Modal';
import ConnectorIcon from '../icons/ConnectorIcon';
import ConnectAccountCard from '../ConnectAccountCard';
import NewConnectorPicker from './NewConnectorPicker';
import {
  listConnectableProviders,
  listConnections,
  setConnectionState,
} from '../../services/avatarService';
import { showRequestFailureToast } from '../requestFailureToast';

/**
 * The composer's "+" menu: attach a file, and — on the personal avatar — the
 * Connectors submenu from the reference design (each connected account with an
 * on/off switch, then "Add connector" and "Manage connectors").
 *
 * Connections are fetched when the submenu opens rather than on every render of
 * the composer, so an owner who never opens it costs nothing. The switch is a
 * disconnect (the credential is deleted after a confirmation); switching a
 * disconnected account back on opens its connect card here, in a modal.
 *
 * @param {Object} parameters
 * @param {boolean} parameters.open Whether the menu is shown.
 * @param {Function} parameters.onClose Close the menu.
 * @param {Function} parameters.onAttachFile Open the file picker.
 * @param {boolean} parameters.showConnectors Whether the Connectors entry exists
 *   (personal avatar only).
 * @param {Function} parameters.onManageConnectors Navigate to the settings section.
 */
const ComposerConnectorsMenu = ({
  open,
  onClose,
  onAttachFile,
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
    try {
      const [connectionsResponse, providersResponse] = await Promise.all([
        listConnections(),
        listConnectableProviders(),
      ]);
      setConnections(connectionsResponse?.connections ?? []);
      setProviders(providersResponse?.providers ?? []);
    } catch (loadError) {
      console.debug('Connections could not be loaded:', loadError);
    }
  }, []);

  useEffect(() => {
    if (open && showConnectors) refresh();
    if (!open) setIsSubmenuOpen(false);
  }, [open, showConnectors, refresh]);

  const openCardFor = (provider) => {
    if (!provider) return;
    setIsPickerOpen(false);
    onClose?.();
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
    if (!next) {
      const confirmed = window.confirm(
        `Disconnect ${connection.display_label}? ` +
          (connection.source === 'device'
            ? 'The avatar stops using this machine until you connect it again.'
            : 'The saved credential is deleted and the avatar can no longer reach this account.')
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
            ? `${connection.display_label} will connect on the next turn.`
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

  const connectedRows = connections.filter(
    (connection) => connection.connected || connection.status === 'needs_reconnect'
  );

  return (
    <>
      <MenuPanel
        open={open}
        onClose={onClose}
        id="composer-menu"
        className="bottom-full mb-2 left-0 w-56"
      >
        <MenuRow
          icon={<Paperclip className="w-4 h-4" aria-hidden="true" />}
          label="Upload a file"
          onClick={() => {
            onClose?.();
            onAttachFile?.();
          }}
        />
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
                {connectedRows.map((connection) => (
                  <div
                    key={connection.connection_key}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5"
                  >
                    <ConnectorIcon iconKey={connection.icon_key} size="sm" />
                    <span className="flex-grow text-sm text-white/80 truncate">
                      {connection.display_label}
                    </span>
                    <Switch
                      checked={connection.connected && connection.status !== 'needs_reconnect'}
                      busy={busyKey === connection.connection_key}
                      label={`${connection.connected ? 'Disconnect' : 'Connect'} ${connection.display_label}`}
                      onChange={(next) => handleToggle(connection, next)}
                    />
                  </div>
                ))}
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
          providers={providers}
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
