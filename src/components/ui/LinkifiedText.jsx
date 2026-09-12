import React from 'react';
import { splitHttpUrlParts } from '../../services/linkifyHttpUrls.js';

/**
 * Spoken bubble text with http(s) URLs painted as links.
 *
 * @param {Object} parameters
 * @param {string} parameters.text The spoken words.
 */
export default function LinkifiedText({ text }) {
  const parts = splitHttpUrlParts(text);
  if (parts.length === 0) return null;
  return (
    <>
      {parts.map((part, index) =>
        part.type === 'link' ? (
          <a
            key={`${part.href}:${index}`}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 pointer-events-auto cursor-pointer text-amber-300 hover:text-amber-200 underline break-words"
          >
            {part.display ?? part.href}
          </a>
        ) : (
          <React.Fragment key={`text:${index}`}>{part.value}</React.Fragment>
        )
      )}
    </>
  );
}
