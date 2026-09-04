import { Camera, CameraOff, Eye, EyeOff, MonitorUp } from 'lucide-react';
import { AccountMenuItem } from './AccountMenu';
import { useMediaShare } from '../context/MediaShareContext';
import { describeAmbientStatus } from '../services/ambientCaptureScheduler';

/**
 * Webcam and screen-share toggles for the sidebar rail and open panel, plus
 * the ambient-vision eye once a share is live.
 *
 * Ambient vision sends one snapshot per live share to the avatar on the
 * configured interval, as background context the avatar may ignore, respond
 * to, or notify the person about. The eye appears only where an observation
 * may be sent (a signed-in screen with a live share) and starts off.
 *
 * @param {{ variant?: 'icons' | 'rows' }} props
 */
const SidebarShareControls = ({ variant = 'icons' }) => {
  const {
    webcamStream,
    screenStream,
    toggleWebcam,
    toggleScreenShare,
    ambientAllowed,
    ambientEnabled,
    setAmbientEnabled,
    ambientStatus,
    ambientNextInMs,
    ambientIntervalMs,
  } = useMediaShare();

  const webcamLabel = webcamStream ? 'Turn off webcam' : 'Share webcam';
  const screenLabel = screenStream ? 'Stop sharing screen' : 'Share screen';
  const showAmbient = ambientAllowed && Boolean(webcamStream || screenStream);
  const intervalSeconds = Math.round((ambientIntervalMs ?? 30_000) / 1000);
  const ambientLabel = ambientEnabled
    ? 'Stop ambient vision'
    : `Ambient vision (a look every ${intervalSeconds}s)`;
  const ambientDetail = ambientEnabled
    ? describeAmbientStatus(ambientStatus, ambientNextInMs)
    : '';
  const ambientIcon = ambientEnabled ? (
    <Eye className="w-4 h-4 shrink-0" />
  ) : (
    <EyeOff className="w-4 h-4 shrink-0" />
  );
  const toggleAmbient = () => setAmbientEnabled((enabled) => !enabled);

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
        {showAmbient && (
          <AccountMenuItem
            icon={ambientIcon}
            label={
              <span className="flex flex-col min-w-0">
                <span>{ambientLabel}</span>
                {ambientDetail && (
                  <span className="text-[11px] text-white/50 truncate">
                    {ambientDetail}
                  </span>
                )}
              </span>
            }
            ariaLabel={ambientLabel}
            isCurrent={ambientEnabled}
            onClick={toggleAmbient}
          />
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
      {showAmbient && (
        <AccountMenuItem
          iconOnly
          icon={ambientIcon}
          label={ambientDetail ? `${ambientLabel} — ${ambientDetail}` : ambientLabel}
          isCurrent={ambientEnabled}
          onClick={toggleAmbient}
        />
      )}
    </>
  );
};

export default SidebarShareControls;
