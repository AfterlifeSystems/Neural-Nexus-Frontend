import { Ear, EarOff, Eye } from 'lucide-react';
import thoughtToImageService from '../services/ThoughtToImageService';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

import { incrementPendingRequests } from '../components/toastManager';

const DockButton = ({
  icon: ButtonIcon,
  label,
  isActive,
  onClick,
  disabled = false,
}) => (
  <div className="relative group">
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative p-3 rounded-xl transition-all duration-300 transform
        flex items-center justify-center min-w-[48px] h-12
        ${
          isActive
            ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-neutral-200 shadow-lg scale-105'
            : 'bg-black/40 border border-white/10 text-neutral-200 hover:bg-black/60 hover:scale-105 hover:border-white/40'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        backdrop-blur-sm
      `}
      aria-label={label}
    >
      <ButtonIcon className="w-5 h-5" />
    </button>
    {/* Tooltip */}
    <span
      className="absolute -top-12 left-1/2 transform -translate-x-1/2 
                     bg-black/90 text-neutral-200 text-xs rounded-lg py-2 px-3 
                     whitespace-nowrap opacity-0 group-hover:opacity-100 
                     transition-opacity duration-200 pointer-events-none z-30
                     before:content-[''] before:absolute before:top-full 
                     before:left-1/2 before:transform before:-translate-x-1/2 
                     before:border-4 before:border-transparent before:border-t-black/90"
    >
      {label}
    </span>
  </div>
);

const Dock = ({
  isTranscribing,
  startTranscription,
  stopTranscription,
  isThoughtToImageEnabled,
  startThoughtToImage,
  stopThoughtToImage,
  dataExchangeTypes,
}) => {
  const { user, activeAvatar } = useAuth();
  const activeAvatarId = activeAvatar?.assistant_id ?? activeAvatar?.avatar_id;

  useEffect(() => {
    if (isThoughtToImageEnabled) {
      const pollingFreq = 10000; // every ten seconds, send a request for a reconstructed image

      // Connect to the reconstruction websocket to receive
      // a reconstructed image
      thoughtToImageService.connectReconstructedImageWebSocket(user?.id);

      // Send the request for the reconstructed image
      incrementPendingRequests();
      thoughtToImageService.startPolling({
        avatar_id: activeAvatarId,
        user_id: user?.id,
        pollingFreq,
      });
    }
    return () => {
      thoughtToImageService.cleanup();
    };
  }, [isThoughtToImageEnabled, activeAvatarId, user?.id]);

  const buttons = [
    {
      icon: isTranscribing ? EarOff : Ear,
      label: isTranscribing ? 'Stop Suggestions' : 'Start Suggestions',
      isActive: isTranscribing,
      onClick: isTranscribing ? stopTranscription : startTranscription,
      disabled: !dataExchangeTypes.voice,
    },
    {
      icon: Eye,
      label: isThoughtToImageEnabled
        ? 'Disable Thought-To-Image'
        : 'Enable Thought-To-Image',
      isActive: isThoughtToImageEnabled,
      onClick: isThoughtToImageEnabled
        ? stopThoughtToImage
        : startThoughtToImage,
      disabled: !dataExchangeTypes.neuralImage,
    },
  ];

  return (
    <div className="flex items-center justify-center w-full">
      <div className="flex items-center gap-2 rounded-2xl shadow-2xl portrait:overflow-x-auto">
        {buttons.map((button, index) => (
          <DockButton
            key={index}
            icon={button.icon}
            label={button.label}
            isActive={button.isActive}
            onClick={button.onClick}
            disabled={button.disabled}
          />
        ))}
      </div>
    </div>
  );
};

export default Dock;
