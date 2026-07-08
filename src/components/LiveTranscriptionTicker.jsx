import React, { useEffect, useRef, useState } from 'react';

const LiveTranscriptionTicker = ({ isTranscribing }) => {
  const [transcript, setTranscript] = useState('');
  const tickerRef = useRef(null);
  const scrollAnimationRef = useRef(null);

  useEffect(() => {
    const handleTranscription = (e) => {
      const text = e.detail;
      setTranscript(text);
    };

    document.addEventListener('transcription', handleTranscription);
    return () => {
      document.removeEventListener('transcription', handleTranscription);
    };
  }, []);

  // Scroll ticker animation
  useEffect(() => {
    const ticker = tickerRef.current;
    if (!ticker) return;

    let scrollPos = 0;
    const animateScroll = () => {
      scrollPos += 1;
      if (scrollPos > ticker.scrollWidth) scrollPos = 0;
      ticker.scrollLeft = scrollPos;
      scrollAnimationRef.current = requestAnimationFrame(animateScroll);
    };

    if (isTranscribing) {
      animateScroll();
    } else {
      ticker.scrollLeft = 0;
      cancelAnimationFrame(scrollAnimationRef.current);
    }

    return () => cancelAnimationFrame(scrollAnimationRef.current);
  }, [isTranscribing, transcript]);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className={`relative overflow-hidden whitespace-nowrap px-3 py-2 rounded border border-gray-700 bg-black/40
      text-white text-base font-sans select-none transition-opacity duration-500 mb-2 rounded-xl flex items-center
      ${isTranscribing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      style={{ height: '80px', userSelect: 'none' }}
      type="region"
      aria-label="Live transcription ticker"
    >
      <div
        ref={tickerRef}
        style={{
          whiteSpace: 'nowrap',
          overflowX: 'hidden',
          display: 'inline-block',
          willChange: 'scrollLeft',
        }}
      >
        {transcript || 'Listening...'}
      </div>
    </div>
  );
};

export default LiveTranscriptionTicker;
