import React, { useState, useEffect, useRef } from 'react';
import { User, Mic, MicOff, CircleX } from 'lucide-react';

const LiveChat = ({ avatarIcon, onEndLiveChat, onSendVoice }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [toasts, setToasts] = useState([]);
  const mediaRecorderRef = useRef(null);

  // Add a toast message
  const addToast = (message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000); // disappear after 3s
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    mediaRecorderRef.current.start();
    setIsRecording(true);
    mediaRecorderRef.current.ondataavailable = (event) => {
      onSendVoice(event.data);
      // Example: simulate avatar response after sending voice
      addToast('Avatar is thinking...');
      setTimeout(() => {
        addToast('Hello, this is the avatar speaking!');
        setIsAvatarSpeaking(true);
        setTimeout(() => setIsAvatarSpeaking(false), 2000);
      }, 1000);
    };
    mediaRecorderRef.current.onstop = () => {
      setIsRecording(false);
    };
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  // Push-to-talk using spacebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') startRecording();
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') stopRecording();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-end h-full w-full overflow-hidden">
      {/* Background Image or User Icon - Large circular image like loginCard but bigger */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
        {avatarIcon ? (
          // Desktop: Large circular image (4x loginCard size), Mobile: full background
          <div className="hidden md:flex w-80 h-80 bg-white/10 rounded-full items-center justify-center">
            <img
              src={avatarIcon}
              alt="Avatar Icon"
              className="w-80 h-80 object-cover rounded-full"
              onError={(e) => {
                console.error('Avatar image load failed:', e.target.src);
                e.target.style.display = 'none';
              }}
            />
          </div>
        ) : (
          // Fallback User icon - larger circular container
          <div className="w-80 h-80 bg-black/50 rounded-full flex items-center justify-center border-4 border-white/10">
            <User className="w-40 h-40 text-neutral-400 opacity-20" />
          </div>
        )}

        {/* Mobile: Full background image */}
        {avatarIcon && (
          <div
            className="md:hidden absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${avatarIcon})`,
            }}
          />
        )}
      </div>

      {/* Overlay for better contrast - lighter on desktop to show the circumscribed image better */}
      <div className="absolute inset-0 bg-black/30 md:bg-black/20" />

      {/* Toast container */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex flex-col gap-2 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="px-4 py-2 bg-black/70 text-neutral-200 rounded-lg shadow-lg animate-slide-down backdrop-blur-sm"
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Speaking indicator overlay - circumscribed on desktop */}
      {isAvatarSpeaking && (
        <div className="absolute inset-0 border-4 border-green-500 animate-pulse  z-10" />
      )}

      {/* Recording indicator overlay - circumscribed on desktop */}
      {isRecording && (
        <div className="absolute inset-0 border-4 border-amber-400 animate-pulse  z-10" />
      )}

      {/* Control buttons at bottom */}
      <div className="relative z-20 flex gap-4 mb-8">
        {/* Microphone button - shows mic when not recording, mic-off when recording */}
        <button
          className={`p-4 rounded-full transition-all duration-300 backdrop-blur-sm ${
            isRecording
              ? 'bg-red-500/80 hover:bg-red-600/80 text-neutral-200'
              : 'bg-amber-500/90 hover:bg-amber-600/90 text-neutral-900'
          }`}
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
        >
          {isRecording ? (
            <MicOff className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </button>
        {/* End button with CircleX icon */}
        <button
          className="p-4 rounded-full bg-neutral-500/80 hover:bg-red-600/80 text-neutral-200 transition-all duration-300 backdrop-blur-sm"
          onClick={onEndLiveChat}
        >
          <CircleX className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default LiveChat;
