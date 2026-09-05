// src/components/SpeakerScript.jsx
//
// A spoken turn heard in the room, one line per speaker with a chip naming who
// spoke. The owner (the person the personal avatar is) gets the warm chip;
// other people in the room get neutral chips labelled "Speaker 2", "Speaker 3"
// and so on, stable within a conversation. Falls back to the plain text when
// a message carries no speaker record.

import React from 'react';
import { speakerLinesOf } from './speakerScript';


const OWNER_CHIP_CLASSES =
  'inline-flex items-center rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/30 px-1.5 py-0 text-[11px] font-medium leading-4 mr-1.5 align-middle';
const OTHER_CHIP_CLASSES =
  'inline-flex items-center rounded-full bg-white/10 text-neutral-200 border border-white/15 px-1.5 py-0 text-[11px] font-medium leading-4 mr-1.5 align-middle';

/**
 * Render a spoken turn as speaker-labelled lines.
 *
 * @param {Object} props
 * @param {Object} props.speakers The message's speaker record from the API.
 * @param {string} [props.fallback] Text shown when the record has no segments.
 * @param {string} [props.className]
 */
export default function SpeakerScript({ speakers, fallback = '', className = '' }) {
  const lines = speakerLinesOf(speakers?.segments);
  if (!lines.length) {
    return <div className={`whitespace-pre-wrap ${className}`}>{fallback}</div>;
  }
  return (
    <div className={`space-y-1 ${className}`} data-testid="speaker-script">
      {lines.map((line, index) => (
        <div key={`${line.speaker}-${index}`} className="whitespace-pre-wrap">
          <span
            className={line.isOwner ? OWNER_CHIP_CLASSES : OTHER_CHIP_CLASSES}
            title={line.isOwner ? 'The owner, recognised by voice' : 'Another person in the room'}
          >
            {line.speaker}
          </span>
          {line.text}
        </div>
      ))}
    </div>
  );
}
