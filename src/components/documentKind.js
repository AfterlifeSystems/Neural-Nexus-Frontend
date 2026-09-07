// What each file extension means, for labels that are a filename rather than
// a link. Grouped by what the UI can say about the upload, not by format family.

export const EXTENSIONS_BY_KIND = {
  image: [
    'jpg',
    'jpeg',
    'png',
    'gif',
    'webp',
    'bmp',
    'svg',
    'heic',
    'heif',
    'avif',
    'tif',
    'tiff',
  ],
  audio: [
    'mp3',
    'wav',
    'm4a',
    'aac',
    'ogg',
    'oga',
    'flac',
    'wma',
    'opus',
    'aiff',
    'amr',
  ],
  video: [
    'mp4',
    'mov',
    'avi',
    'mkv',
    'webm',
    'wmv',
    'flv',
    'm4v',
    'mpg',
    'mpeg',
  ],
  document: ['pdf', 'doc', 'docx', 'odt', 'rtf'],
  data: [
    'csv',
    'tsv',
    'json',
    'jsonl',
    'xml',
    'xlsx',
    'xls',
    'parquet',
    'yaml',
    'yml',
  ],
  text: ['txt', 'md', 'markdown', 'html', 'htm', 'vtt', 'srt'],
};

/**
 * Name what kind of upload a label describes, from its extension.
 *
 * @param {string} documentLabel The label as returned by the API.
 * @returns {string|null} One of the EXTENSIONS_BY_KIND keys, or null when the
 *   label carries no extension worth reading.
 */
export function describeDocumentKind(documentLabel) {
  if (typeof documentLabel !== 'string') return null;
  const extension = documentLabel.split('.').pop()?.toLowerCase() ?? '';
  if (!extension || extension === documentLabel.toLowerCase()) return null;
  for (const [kind, extensions] of Object.entries(EXTENSIONS_BY_KIND)) {
    if (extensions.includes(extension)) return kind;
  }
  return null;
}
