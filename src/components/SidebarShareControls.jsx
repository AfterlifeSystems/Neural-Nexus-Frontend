import { Camera, CameraOff, MonitorUp } from 'lucide-react';
import { AccountMenuItem } from './AccountMenu';
import { useMediaShare } from '../context/MediaShareContext';
import { describeAmbientStatus } from '../services/ambientCaptureScheduler';

/**
 * Webcam and screen-share toggles for the sidebar rail and open panel.
 *
 * Ambient vision has no control of its own: the moment a webcam or a screen
 * is shared, one snapshot per live share goes to the avatar on the configured
 * interval, as background context the avatar may ignore, respond to, or notify
 * the person about, until the share stops. The open panel shows the status
 * under the share rows. Webcam and screen stay on the rail on the gallery; a
 * snapshot is sent only in the message view or voice mode.
 *
 * @param {{ variant?: 'icons' | 'rows' }} props
 */
const SidebarShareControls = ({ variant = 'icons' }) => {
  const {
    webcamStream,
    screenStream,
    toggleWebcam,
    toggleScreenShare,
    ambientCaptureAllowed,
    ambientEnabled,
    ambientStatus,
    ambientNextInMs,
  } = useMediaShare();

  const webcamLabel = webcamStream ? 'Turn off webcam' : 'Share webcam';
  const screenLabel = screenStream ? 'Stop sharing screen' : 'Share screen';
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
        <AccountMenuItem
          icon={<MonitorUp className="w-4 h-4 shrink-0" />}
          label={screenLabel}
          isCurrent={Boolean(screenStream)}
          onClick={toggleScreenShare}
        />
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
        onClick={toggleWebcam}
      />
      <AccountMenuItem
        iconOnly
        icon={<MonitorUp className="w-4 h-4 shrink-0" />}
        label={screenLabel}
        isCurrent={Boolean(screenStream)}
        onClick={toggleScreenShare}
      />
    </>
  );
};

export default SidebarShareControls;
