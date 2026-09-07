import {
  FileAudio,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Image as ImageIcon,
} from 'lucide-react';
import { describeDocumentKind } from './documentKind.js';

// How an attachment is drawn in the composer before it is sent. An image shows
// itself; everything else shows what kind of file it is, because a document has
// no thumbnail and an <img> pointed at one renders a broken tile.
export const ATTACHMENT_PRESENTATION = {
  image: { Icon: ImageIcon, label: 'Image', tileClassName: 'bg-neutral-500' },
  audio: { Icon: FileAudio, label: 'Audio', tileClassName: 'bg-emerald-500' },
  video: { Icon: FileVideo, label: 'Video', tileClassName: 'bg-rose-500' },
  data: { Icon: FileSpreadsheet, label: 'Data', tileClassName: 'bg-lime-600' },
  text: { Icon: FileText, label: 'Document', tileClassName: 'bg-blue-500' },
  document: { Icon: FileText, label: 'Document', tileClassName: 'bg-blue-500' },
};

/**
 * Say what an attachment is, for the chip that stands in for it.
 *
 * The browser's own media type is trusted first and the filename consulted only
 * when it says nothing useful: a .csv arrives as text/csv from one operating
 * system and application/octet-stream from another, and the extension is the
 * only thing both have in common.
 *
 * @param {File|{name?: string, type?: string}} attachedFile A file waiting in
 *   the composer.
 * @returns {{Icon: Function, label: string, tileClassName: string}} How to draw it.
 */
export function describeAttachment(attachedFile) {
  const mediaType = attachedFile?.type || '';
  const kindFromMediaType = mediaType.startsWith('image/')
    ? 'image'
    : mediaType.startsWith('audio/')
      ? 'audio'
      : mediaType.startsWith('video/')
        ? 'video'
        : null;
  const kind =
    kindFromMediaType ??
    describeDocumentKind(attachedFile?.name) ??
    'document';
  return ATTACHMENT_PRESENTATION[kind] ?? ATTACHMENT_PRESENTATION.document;
}

/**
 * Whether this attachment can be drawn as a thumbnail of itself.
 *
 * @param {File|{type?: string}|null|undefined} attachedFile
 * @returns {boolean}
 */
export function isImageAttachment(attachedFile) {
  return (attachedFile?.type || '').startsWith('image/');
}

/**
 * Files still being composed, then files of a turn already sent and still
 * running. Shown as one strip so an attachment never blinks out between
 * pressing send and the reply arriving.
 *
 * @param {File[]|null|undefined} mediaFiles
 * @param {File[]|null|undefined} attachmentsInFlight
 * @returns {File[]}
 */
export function composeComposerAttachments(mediaFiles, attachmentsInFlight) {
  return [...(mediaFiles ?? []), ...(attachmentsInFlight ?? [])];
}

/**
 * The `media` entries a sent bubble paints from files this browser still holds.
 *
 * @param {File[]|null|undefined} attachedFiles
 * @param {(file: File) => string} [createObjectUrl]
 * @returns {{filename: string, content_type: string, url: string}[]}
 */
export function mediaEntriesFromFiles(attachedFiles, createObjectUrl) {
  const mintUrl =
    typeof createObjectUrl === 'function'
      ? createObjectUrl
      : (file) => URL.createObjectURL(file);
  return (attachedFiles ?? []).map((attachedFile) => ({
    filename: attachedFile.name,
    content_type: attachedFile.type,
    url: mintUrl(attachedFile),
  }));
}
