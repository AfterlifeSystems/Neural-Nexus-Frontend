// src/components/CreatedArtifacts.jsx
import React from 'react';
import {
  artifactDataUrl,
  artifactHasInlineContent,
  artifactIsImage,
  artifactIsText,
  artifactText,
  formatArtifactSize,
} from '../services/createdArtifacts';

/**
 * The files an analysis turn produced, painted under the avatar's reply.
 *
 * The avatar's data-analysis capability writes a plot and a report per turn
 * and the API inlines them on the reply's metadata. Painting them here is what
 * turns a prose summary into the chart the person asked to see: the model's
 * own `![plot](attachment:/data_created/...)` reference is not fetchable by a
 * browser and is stripped from the text elsewhere.
 *
 * @param {Object} properties
 * @param {Object[]} properties.artifacts Records from `createdArtifactsOf`.
 * @param {boolean} [properties.compact] Smaller images and collapsed reports,
 *   for the voice-mode caption strip.
 */
const CreatedArtifacts = ({ artifacts, compact = false }) => {
  if (!artifacts?.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {artifacts.map((artifact, index) => {
        const name = artifact.name || `artifact-${index + 1}`;
        const key = `${name}-${index}`;
        const dataUrl = artifactDataUrl(artifact);

        if (!artifactHasInlineContent(artifact) || !dataUrl) {
          return (
            <div key={key} className="text-xs text-white/60">
              📎 {name} — {formatArtifactSize(artifact.size_bytes)} (too large
              to display here; kept in the avatar&apos;s storage)
            </div>
          );
        }

        if (artifactIsImage(artifact)) {
          return (
            <figure key={key} className="space-y-1">
              <a
                href={dataUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open full size"
              >
                <img
                  src={dataUrl}
                  alt={name}
                  className={`rounded-md border border-white/10 bg-white max-w-full object-contain ${
                    compact ? 'max-h-48' : 'max-h-96'
                  }`}
                />
              </a>
              <figcaption className="flex items-center gap-3 text-xs text-white/60">
                <span className="truncate">{name}</span>
                <a
                  href={dataUrl}
                  download={name}
                  className="underline text-amber-300 shrink-0"
                >
                  Download
                </a>
              </figcaption>
            </figure>
          );
        }

        if (artifactIsText(artifact)) {
          return (
            <details
              key={key}
              open={!compact}
              className="rounded-md border border-white/10 bg-black/40"
            >
              <summary className="cursor-pointer px-2 py-1 text-xs text-white/70 flex items-center gap-3">
                <span className="truncate">📄 {name}</span>
                <a
                  href={dataUrl}
                  download={name}
                  className="underline text-amber-300 ml-auto shrink-0"
                  onClick={(clickEvent) => clickEvent.stopPropagation()}
                >
                  Download
                </a>
              </summary>
              <pre className="px-2 py-2 whitespace-pre-wrap break-words text-xs text-neutral-200 max-h-72 overflow-y-auto">
                {artifactText(artifact)}
              </pre>
            </details>
          );
        }

        return (
          <a
            key={key}
            href={dataUrl}
            download={name}
            className="block text-xs underline text-amber-300"
          >
            📎 {name} — {formatArtifactSize(artifact.size_bytes)}
          </a>
        );
      })}
    </div>
  );
};

export default CreatedArtifacts;
