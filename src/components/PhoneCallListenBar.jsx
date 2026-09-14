// src/components/PhoneCallListenBar.jsx
//
// Compact listen-in bar for a personal-avatar SIP call. The owner's verified
// mobile is the default listen path; this bar is the web fallback. Joins the
// LiveKit room subscribe-only and muted.

import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { requestJson } from '../services/neuralNexusApiClient';
import { subscribeActivePhoneCall } from '../services/phoneCallListen';

const PhoneCallListenBar = ({ isPersonalAvatar }) => {
  const [frame, setFrame] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const roomRef = useRef(null);

  useEffect(() => subscribeActivePhoneCall(setFrame), []);

  useEffect(() => {
    if (!isPersonalAvatar || !frame?.call_id) {
      return undefined;
    }
    if (frame.phase === 'ended' || frame.phase === 'failed') {
      roomRef.current?.disconnect?.();
      roomRef.current = null;
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const listen = await requestJson(`/phone_calls/${encodeURIComponent(frame.call_id)}/listen`, {
          method: 'POST',
        });
        if (cancelled || !listen?.token || !listen?.livekit_url) {
          return;
        }
        const livekit = await import('livekit-client');
        const room = new livekit.Room({ adaptiveStream: true });
        await room.connect(listen.livekit_url, listen.token);
        room.localParticipant.setMicrophoneEnabled(false);
        roomRef.current = room;
      } catch (listenError) {
        setErrorMessage(
          listenError?.message ||
            'Web listen-in is unavailable. Answer your mobile if it is ringing.'
        );
      }
    })();
    return () => {
      cancelled = true;
      roomRef.current?.disconnect?.();
      roomRef.current = null;
    };
  }, [isPersonalAvatar, frame?.call_id, frame?.phase]);

  if (!isPersonalAvatar || !frame?.call_id) {
    return null;
  }
  if (frame.phase === 'ended' || frame.phase === 'failed') {
    return null;
  }

  const destination = frame.destination_name || 'the restaurant';
  const phaseLabel =
    frame.phase === 'ringing_owner'
      ? `Ringing your mobile · ${destination}`
      : `Listening · ${destination}`;

  return (
    <div
      className="mb-2 mx-auto w-full max-w-3xl rounded-xl border border-emerald-400/20 bg-black/70 px-3 py-2 flex items-center gap-2"
      data-phone-call-listen={frame.call_id}
    >
      <Phone className="w-4 h-4 text-emerald-300 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-grow text-sm text-neutral-200 truncate">{phaseLabel}</p>
      {errorMessage ? (
        <p className="text-xs text-amber-200/90 truncate" title={errorMessage}>
          {errorMessage}
        </p>
      ) : (
        <span className="text-xs text-white/40">Muted</span>
      )}
      <PhoneOff className="w-4 h-4 text-white/30 shrink-0" aria-hidden="true" />
    </div>
  );
};

export default PhoneCallListenBar;
