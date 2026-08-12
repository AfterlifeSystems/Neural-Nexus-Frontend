// src/components/LiveVoiceMode.jsx
//
// Talking to the avatar instead of typing to it. Same conversation, different
// medium: every spoken turn is sent to the same endpoint, lands in the same
// thread, and is readable afterwards in the transcript — leaving live mode
// shows the exchange as ordinary messages, and the conversation can be reopened
// from the sidebar like any other.
//
// This is the turn-based transport: record a turn, send it, hear the reply.
// The avatar cannot be interrupted while speaking and does not hear you while
// it talks. The recording and speaking both live in services/voiceSession.js,
// so when the realtime backend lands, this screen should need little more than
// a different session to drive.

import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, X, Volume2, VolumeX, User } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { useMedia } from '../context/MediaContext';
import { isValidImageUrl } from './utils';
import {
  canCaptureMicrophone,
  recordOneTurn,
  speak,
  stopSpeaking,
} from '../services/voiceSession';

const LiveVoiceMode = ({ avatarName, avatarPortrait, onClose }) => {
  const { messages, sendVoiceTurn } = useMedia();
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isWaitingForReply, setIsWaitingForReply] = useState(false);
  const [isVoiceOutputOn, setIsVoiceOutputOn] = useState(true);
  const recordingRef = useRef(null);

  // Everything already said, so the spoken conversation is also a readable one.
  // These are the same messages the chat renders; live mode is a view of them,
  // not a separate history.
  const spokenExchange = messages.filter((message) =>
    ['human', 'ai'].includes(message.type)
  );
  const lastAvatarMessage = [...spokenExchange]
    .reverse()
    .find((message) => message.type === 'ai');

  // Stop talking when the screen closes. Speech synthesis outlives the
  // component that started it, so a voice would otherwise keep going after the
  // user has left.
  useEffect(() => {
    return () => {
      stopSpeaking();
      recordingRef.current?.cancel();
    };
  }, []);

  const startRecording = async () => {
    if (!canCaptureMicrophone()) {
      toast.error(
        'This browser cannot record audio here. A microphone needs a secure connection (https or localhost).'
      );
      return;
    }
    stopSpeaking();
    setIsSpeaking(false);
    try {
      recordingRef.current = await recordOneTurn();
      setIsRecording(true);
    } catch (microphoneError) {
      console.error('Microphone unavailable:', microphoneError);
      toast.error(
        microphoneError.name === 'NotAllowedError'
          ? 'Microphone access was refused. Allow it in your browser to speak.'
          : 'Could not start recording.'
      );
    }
  };

  const stopRecordingAndSend = async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;
    setIsRecording(false);

    const recordedAudio = await recording.stop();
    setIsWaitingForReply(true);
    try {
      const reply = await sendVoiceTurn(recordedAudio);
      if (reply && isVoiceOutputOn) {
        speak(reply, {
          onStart: () => setIsSpeaking(true),
          onEnd: () => setIsSpeaking(false),
        });
      }
    } finally {
      setIsWaitingForReply(false);
    }
  };

  const describeState = () => {
    if (isRecording) return 'Listening…';
    if (isWaitingForReply) return `${avatarName ?? 'The avatar'} is thinking…`;
    if (isSpeaking) return `${avatarName ?? 'The avatar'} is speaking…`;
    return 'Hold the button, speak, then let go';
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-lg flex flex-col items-center">
      <div className="w-full max-w-3xl flex justify-between items-center p-4">
        <h2 className="text-white font-semibold">
          Live with {avatarName ?? 'your avatar'}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (isVoiceOutputOn) {
                stopSpeaking();
                setIsSpeaking(false);
              }
              setIsVoiceOutputOn((isOn) => !isOn);
            }}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={isVoiceOutputOn ? 'Mute the reply' : 'Unmute the reply'}
            title={isVoiceOutputOn ? 'Mute the reply' : 'Unmute the reply'}
          >
            {isVoiceOutputOn ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Leave live mode"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* The avatar's face, which is the point of the medium: something to talk
          to rather than a text box. It pulses while the avatar is speaking. */}
      <div
        className={`w-40 h-40 rounded-full overflow-hidden border-4 flex items-center justify-center shrink-0 transition-all duration-300 ${
          isSpeaking
            ? 'border-teal-400 shadow-[0_0_40px_rgba(45,212,191,0.5)] scale-105'
            : isRecording
              ? 'border-red-400/70'
              : 'border-white/20'
        } bg-white/10`}
      >
        {avatarPortrait && isValidImageUrl(avatarPortrait) ? (
          <img
            src={avatarPortrait}
            alt={avatarName ?? 'Avatar'}
            className="w-full h-full object-cover"
          />
        ) : (
          <User className="w-16 h-16 text-white/40" />
        )}
      </div>

      <p className="text-white/70 mt-4 mb-2 h-6">{describeState()}</p>

      {/* Captions. The whole conversation is here, not just the last line, so
          what was said out loud can be read back — and it is the same
          transcript the chat shows. */}
      <div className="flex-grow w-full max-w-3xl overflow-y-auto px-6 space-y-3 mb-4">
        {spokenExchange.length === 0 ? (
          <p className="text-white/40 text-center">
            Nothing said yet. Hold the microphone and start talking.
          </p>
        ) : (
          spokenExchange.map((message) => (
            <div
              key={message.id ?? message.timestamp}
              className={`max-w-[85%] px-4 py-2 rounded-2xl ${
                message.type === 'human'
                  ? 'bg-teal-600/80 text-white ml-auto'
                  : 'bg-white/10 text-white mr-auto'
              } ${
                message.id === lastAvatarMessage?.id && isSpeaking
                  ? 'ring-2 ring-teal-400/60'
                  : ''
              }`}
            >
              {message.content || '…'}
            </div>
          ))
        )}
      </div>

      <div className="pb-10 flex flex-col items-center gap-3">
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecordingAndSend}
          onMouseLeave={() => isRecording && stopRecordingAndSend()}
          onTouchStart={(event) => {
            event.preventDefault();
            startRecording();
          }}
          onTouchEnd={(event) => {
            event.preventDefault();
            stopRecordingAndSend();
          }}
          disabled={isWaitingForReply}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-40 ${
            isRecording
              ? 'bg-red-500 scale-110 shadow-[0_0_30px_rgba(239,68,68,0.6)]'
              : 'bg-teal-600 hover:bg-teal-500'
          }`}
          aria-label={isRecording ? 'Stop and send' : 'Hold to speak'}
        >
          {isRecording ? (
            <Square className="w-7 h-7 text-white" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </button>
        <p className="text-white/40 text-xs">
          Your words are transcribed by the server and kept in this conversation.
        </p>
      </div>
    </div>
  );
};

export default LiveVoiceMode;
