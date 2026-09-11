import { Camera, CameraOff, MonitorUp, SwitchCamera } from 'lucide-react';
import { AccountMenuItem } from './AccountMenu';
import { useMediaShare } from '../context/MediaShareContext';
import { describeAmbientStatus } from '../services/ambientCaptureScheduler';
import { describeCameraFlip } from '../services/cameraFacing';
import { useMobileCameraView } from '../hooks/useCameraPassthrough';
import { openCollapsedSidebar } from './sharePreviewSlots';

/**
 * Webcam and screen controls for the sidebar rail and open panel.
 *
 * The screen can be in a third state besides off and shared: a capture the
 * avatar may GLANCE at once when a question needs it, started only from the
 * avatar's own request (see `ShareRequestPrompt`). There is deliberately no
 * sidebar control for it — offering a look is something the avatar asks for
 * when it needs one, not a switch the person is asked to reason about — but
 * the labels here still describe that state when it is live, since the share
 * button promotes such a capture to a watched share without a second trip
 * through the browser's picker.
 *
 * Ambient vision has no control of its own: the moment a webcam or a WATCHED
 * screen is live, one snapshot per live share goes to the avatar on the
 * configured interval, as background context the avatar may ignore, respond
 * to, or notify the person about, until the share stops. The open panel shows the status
 * under the share rows. Webcam and screen stay on the rail on the gallery; a
 * snapshot is sent only in the message view or voice mode. Camera-flip is
 * a panel row only, so the rail's five stage icons stay put.
 *
 * @param {{ variant?: 'icons' | 'rows' }} props
 */
const SidebarShareControls = ({ variant = 'icons' }) => {
  const {
    webcamStream,
    screenStream,
    webcamFacingMode,
    isFlippingWebcam,
    toggleWebcam,
    flipWebcam,
    toggleScreenShare,
    screenWatched,
    ambientCaptureAllowed,
    ambientEnabled,
    ambientStatus,
    ambientNextInMs,
  } = useMediaShare();
  const isMobileCameraViewActive = useMobileCameraView();
  const canFlipWebcam = Boolean(webcamStream) && isMobileCameraViewActive;
  const flipLabel = describeCameraFlip(webcamFacingMode);

  const webcamLabel = webcamStream ? 'Turn off webcam' : 'Share webcam';
  // A capture the avatar asked for runs unwatched until the person promotes it
  // here; sharing and peeking are the same capture in different modes, so that
  // never asks the person to pick their screen again.
  const screenIsShared = Boolean(screenStream) && screenWatched;
  const screenIsPeekable = Boolean(screenStream) && !screenWatched;
  const screenLabel = screenIsShared
    ? 'Stop sharing screen'
    : screenIsPeekable
      ? 'Share screen (watched)'
      : 'Share screen';
  const ambientDetail = ambientEnabled
    ? ambientCaptureAllowed
      ? describeAmbientStatus(ambientStatus, ambientNextInMs)
      : 'Looks resume when you open a chat'
    : '';

  if (variant === 'rows') {
    return (
      <div className="space-y-1">
        <AccountMenuItem
          icon={
            webcamStream ? (
              <Camera className="w-4 h-4 shrink-0" />
            ) : (
              <CameraOff className="w-4 h-4 shrink-0" />
            )
          }
          label={webcamLabel}
          isCurrent={Boolean(webcamStream)}
          onClick={toggleWebcam}
        />
        {canFlipWebcam && (
          <AccountMenuItem
            icon={<SwitchCamera className="w-4 h-4 shrink-0" />}
            label={flipLabel}
            onClick={isFlippingWebcam ? undefined : flipWebcam}
          />
        )}
        <AccountMenuItem
          icon={<MonitorUp className="w-4 h-4 shrink-0" />}
          label={screenLabel}
          isCurrent={screenIsShared}
          onClick={toggleScreenShare}
        />
        {screenIsPeekable && (
          <p className="px-3 pt-1 text-[11px] text-white/50">
            Your screen is not being watched. The avatar looks once, when
            something you ask needs it.
          </p>
        )}
        {ambientDetail && (
          <p
            className="px-3 pt-1 text-[11px] text-white/50 truncate"
            aria-live="polite"
          >
            Ambient vision: {ambientDetail}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <AccountMenuItem
        iconOnly
        icon={
          webcamStream ? (
            <Camera className="w-4 h-4 shrink-0" />
          ) : (
            <CameraOff className="w-4 h-4 shrink-0" />
          )
        }
        label={webcamLabel}
        isCurrent={Boolean(webcamStream)}
        onClick={(event) => {
          const shouldReveal = !webcamStream;
          toggleWebcam();
          if (shouldReveal) openCollapsedSidebar(event.currentTarget);
        }}
      />
      <AccountMenuItem
        iconOnly
        icon={<MonitorUp className="w-4 h-4 shrink-0" />}
        label={screenLabel}
        isCurrent={screenIsShared}
        onClick={(event) => {
          const shouldReveal = !screenStream;
          toggleScreenShare();
          if (shouldReveal) openCollapsedSidebar(event.currentTarget);
        }}
      />
    </>
  );
};

export default SidebarShareControls;
