// src/services/createdArtifacts.js
//
// The avatar's data-analysis turns produce files (a plot, a report) that the
// API inlines on the reply's `response_metadata.created_artifacts`. Each record
// carries `name`, `mime_type`, `size_bytes`, and, unless the file is over the
// server's inline cap, `content` with `encoding` 'base64' (binary) or 'utf-8'
// (text). The model also tends to reference those files in its prose as
// markdown images or links pointing at `attachment:/data_created/<name>` or
// `/data_created/<name>`, which no browser can fetch. These helpers turn the
// records into something React can paint, and strip the unusable references
// from text that is shown or spoken.

/**
 * The artifacts a message carries, or an empty list.
 *
 * @param {Object} message A transcript message.
 * @returns {Object[]}
 */
export function createdArtifactsOf(message) {
  const artifacts = message?.response_metadata?.created_artifacts;
  return Array.isArray(artifacts) ? artifacts : [];
}

/**
 * Whether the server inlined the file's bytes (small enough to display).
 *
 * @param {Object} artifact One created-artifact record.
 * @returns {boolean}
 */
export function artifactHasInlineContent(artifact) {
  return typeof artifact?.content === 'string' && artifact.content.length > 0;
}

/**
 * @param {Object} artifact One created-artifact record.
 * @returns {boolean} Whether the artifact is an image (a plot).
 */
export function artifactIsImage(artifact) {
  return String(artifact?.mime_type ?? '').startsWith('image/');
}

/**
 * @param {Object} artifact One created-artifact record.
 * @returns {boolean} Whether the artifact is readable text (a report).
 */
export function artifactIsText(artifact) {
  const mimeType = String(artifact?.mime_type ?? '');
  return mimeType.startsWith('text/') || mimeType === 'application/json';
}

/**
 * A `data:` URL for an inlined artifact, usable as an image source or a
 * download target. Null when the content was not inlined.
 *
 * @param {Object} artifact One created-artifact record.
 * @returns {string|null}
 */
export function artifactDataUrl(artifact) {
  if (!artifactHasInlineContent(artifact)) return null;
  const mimeType = artifact.mime_type || 'application/octet-stream';
  if (artifact.encoding === 'base64') {
    return `data:${mimeType};base64,${artifact.content}`;
  }
  return `data:${mimeType};charset=utf-8,${encodeURIComponent(artifact.content)}`;
}

/**
 * The decoded text of a text artifact, or an empty string.
 *
 * @param {Object} artifact One created-artifact record.
 * @returns {string}
 */
export function artifactText(artifact) {
  if (!artifactHasInlineContent(artifact)) return '';
  if (artifact.encoding !== 'base64') return artifact.content;
  try {
    const binary = atob(artifact.content);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

/**
 * "12.3 KB" style size for a caption.
 *
 * @param {number} sizeInBytes
 * @returns {string}
 */
export function formatArtifactSize(sizeInBytes) {
  const bytes = Number(sizeInBytes) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// A markdown image or link whose target is an artifact path the browser cannot
// fetch: `![alt](attachment:/data_created/plot.png)`, `[report](/data_created/r.md)`.
const ARTIFACT_MARKDOWN_REFERENCE_PATTERN =
  /!?\[[^\]\n]*\]\(\s*(?:attachment:)?\/?data_created\/[^)\s]*\s*\)/g;
// The same target written bare, outside markdown syntax.
const BARE_ARTIFACT_URI_PATTERN = /\battachment:\/?data_created\/\S+/g;
// Any other markdown image; spoken aloud, image syntax is noise.
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]\n]*\]\([^)\n]*\)/g;

function collapseWhitespace(text) {
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * The reply text without references to artifact files. The artifacts
 * themselves are rendered from the message's metadata, so a dangling
 * `![plot](attachment:/data_created/...)` only reads as a broken link.
 *
 * @param {string} text Reply text.
 * @returns {string}
 */
export function stripArtifactReferences(text) {
  if (typeof text !== 'string' || !text) return text ?? '';
  return collapseWhitespace(
    text
      .replace(ARTIFACT_MARKDOWN_REFERENCE_PATTERN, '')
      .replace(BARE_ARTIFACT_URI_PATTERN, '')
  );
}

/**
 * The reply text as the avatar should say it out loud: no artifact references
 * and no markdown image syntax.
 *
 * @param {string} text Reply text.
 * @returns {string}
 */
export function speakableReplyText(text) {
  const withoutArtifacts = stripArtifactReferences(text);
  if (!withoutArtifacts) return '';
  return collapseWhitespace(withoutArtifacts.replace(MARKDOWN_IMAGE_PATTERN, ''));
}
