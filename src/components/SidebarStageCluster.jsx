import { MessageSquarePlus } from 'lucide-react';

import SharePreviewSlot from './SharePreviewSlot';
import SidebarShareControls from './SidebarShareControls';
import SidebarVoiceMuteControls from './SidebarVoiceMuteControls';

/**
 * How tall the rail well must stay so a screen tile (h-8) plus a webcam tile
 * (h-11) with a gap between them can appear without moving the icons or the
 * QR code. Matches `SidebarShareTiles` in SharePreviewOutlet.
 */
export const RAIL_SHARE_PREVIEW_WELL_CLASS = 'w-full px-1 min-h-20';

/**
 * New conversation, mute, mic, webcam, and share screen — the stage actions
 * that sit above the QR on the collapsed rail, separated from account chrome.
 *
 * Describing your surroundings is NOT one of them: it is a setting on the
 * Accessibility page (or something the avatar is asked for in words) that
 * changes what the webcam does, not a capture of its own with its own button.
 *
 * The preview well keeps its height whether a share is live or not, so those
 * five icons do not jump when a tile appears.
 *
 * @param {Object} props
 * @param {boolean} [props.showConversations]
 * @param {boolean} [props.showShareControls]
 * @param {Function} [props.onStartNewConversation]
 * @param {React.ReactNode} props.children The QR control.
 */
const SidebarStageCluster = ({
  showConversations = false,
  showShareControls = false,
  onStartNewConversation,
  children,
}) => (
  <div className="shrink-0 w-full flex flex-col items-center gap-1">
    <div
      data-sidebar-stage-actions
      className="w-full border-t border-white/10 pt-1 flex flex-col items-center gap-0.5"
    >
      {showConversations && (
        <button
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
            onStartNewConversation?.();
          }}
          className="p-1.5 rounded-lg text-white/70 hover:text-neutral-100 hover:bg-white/10 transition-colors"
          aria-label="New conversation"
          title="New conversation"
        >
          <MessageSquarePlus className="w-4 h-4" />
        </button>
      )}
      <SidebarVoiceMuteControls />
      {showShareControls && <SidebarShareControls />}
    </div>
    {showShareControls ? (
      <SharePreviewSlot
        name="rail"
        className={`${RAIL_SHARE_PREVIEW_WELL_CLASS} cursor-pointer`}
      />
    ) : null}
    {children}
  </div>
);

export default SidebarStageCluster;
