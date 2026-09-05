// AvatarDocumentRow.jsx
//
// One row of the "Avatar Data" list in Avatar Settings: a single source
// document uploaded to an avatar, with a preview of what it actually is.
//
// The list arrives from GET /list_avatar_documents as labels, and for anything
// ingested from a link the label IS the original URL — URLDocumentLoaderClass
// records `"filename": url` for articles, tweets, and single YouTube videos.
// That is the whole basis of the previews here: a label that parses as a URL is
// the source itself, so a YouTube link can show its thumbnail and play in place,
// and any other link can show where it points instead of a bare address.
//
// Two kinds of upload are deliberately NOT previewed, because the API keeps
// nothing to preview them with:
//
//   * Playlist videos, labeled "{playlist title} :: {video title}" and keyed by
//     an opaque hash — the watch URL exists in the store metadata but
//     /list_avatar_documents does not return it, so it cannot be recovered here.
//   * Ordinary audio and video uploads, which are transcribed and discarded;
//     only the transcript is stored, so there is nothing to play back. The one
//     exception is the reference audio, whose clip IS stored but has no endpoint
//     serving it yet.
//
// Generated media is the other kind of row here. The emotion portraits and idle
// loops derived from the reference image (see hooks/emotionMediaRows.js) arrive
// with `source: 'emotion'` and a URL served by /avatar_emotion_media/{asset_id},
// so they DO preview — an image for a portrait, a silent looping video for an
// idle loop — and carry a "Generated" badge so nobody mistakes them for an
// upload. Deleting one passes the whole row back, because there is no label
// the document delete endpoint would recognise.

import React, { useId, useState } from 'react';
import {
  AudioLines,
  Camera,
  FileAudio,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Globe,
  Image as ImageIcon,
  Mic,
  Play,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import LoopingVideo from './ui/LoopingVideo';
import { titleCaseEmotion } from '../hooks/emotionMediaRows';

// The badge every generated row wears, beside its kind chip. One colour that
// no upload kind uses, so a glance down the list separates what the owner gave
// the avatar from what the avatar's pipeline made.
const GENERATED_MARK = {
  Icon: Sparkles,
  iconClassName: 'text-fuchsia-300',
  label: 'Generated',
  badgeClassName: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/40',
};

/**
 * The sentence under a generated row: what it was made from, and how long a
 * loop runs.
 *
 * @param {Object} documentEntry A row with `source: 'emotion'`.
 * @returns {string}
 */
export const describeGeneratedMedia = (documentEntry) => {
  if (documentEntry.isReferenceStill) {
    return 'The reference image, used as the neutral expression';
  }
  if (documentEntry.isEmotionLoop) {
    const seconds = documentEntry.durationSeconds;
    const duration =
      seconds != null
        ? ` · ${Math.round(Number(seconds))} s looping video`
        : '';
    return `Generated from the ${documentEntry.emotion} portrait${duration}`;
  }
  return 'Generated from the reference image';
};

// What each file extension means, for the rows whose label is a filename
// rather than a link. Grouped by what the row can say about the upload, not by
// format family: the row's job is to tell the user what they gave the avatar.
const EXTENSIONS_BY_KIND = {
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

// How each kind is drawn, and what is true about previewing it.
//
// `previewNote` is the honest part. The API returns a label and nothing else —
// no content, no media, no address (GET /list_avatar_documents answers with
// {label, reference_role, is_reference_image, is_reference_audio}) — and the
// only endpoint that serves any stored media at all is /avatar_reference_image.
// So for every kind but a link and the reference image there is nothing to show
// yet, and the row says which text the avatar kept instead of leaving a blank
// where a preview visibly failed to load.
const KIND_PRESENTATION = {
  image: {
    Icon: ImageIcon,
    iconClassName: 'text-purple-300',
    chip: 'Image',
    previewNote: 'Read into a description',
  },
  audio: {
    Icon: FileAudio,
    iconClassName: 'text-emerald-300',
    chip: 'Audio',
    previewNote: 'Transcribed',
  },
  video: {
    Icon: FileVideo,
    iconClassName: 'text-rose-300',
    chip: 'Video',
    previewNote: 'Transcribed',
  },
  document: {
    Icon: FileText,
    iconClassName: 'text-amber-300',
    chip: 'Document',
    previewNote: 'Read into text',
  },
  data: {
    Icon: FileSpreadsheet,
    iconClassName: 'text-lime-300',
    chip: 'Data',
    previewNote: 'Read into text',
  },
  text: {
    Icon: FileText,
    iconClassName: 'text-blue-300',
    chip: 'Text',
    previewNote: 'Stored as text',
  },
};

/**
 * Name what kind of upload a label describes, from its extension.
 *
 * @param {string} documentLabel The label as returned by the API.
 * @returns {string|null} One of the KIND_PRESENTATION keys, or null when the
 *   label carries no extension worth reading.
 */
export const describeDocumentKind = (documentLabel) => {
  if (typeof documentLabel !== 'string') return null;
  const extension = documentLabel.split('.').pop()?.toLowerCase() ?? '';
  if (!extension || extension === documentLabel.toLowerCase()) return null;
  for (const [kind, extensions] of Object.entries(EXTENSIONS_BY_KIND)) {
    if (extensions.includes(extension)) return kind;
  }
  return null;
};

/**
 * Read a document label as a web address.
 *
 * Only http and https are accepted: a label is user-supplied text, and every
 * other scheme (javascript:, data:) is one this row would otherwise be willing
 * to put in an href.
 *
 * @param {string} documentLabel The label as returned by the API.
 * @returns {URL|null} The parsed address, or null when the label is a filename.
 */
export const parseDocumentSourceUrl = (documentLabel) => {
  if (typeof documentLabel !== 'string') return null;
  const candidate = documentLabel.trim();
  if (!/^https?:\/\//i.test(candidate)) return null;
  try {
    const parsedUrl = new URL(candidate);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
      ? parsedUrl
      : null;
  } catch {
    return null;
  }
};

/**
 * Pull the video identifier out of a YouTube address.
 *
 * Covers the four shapes a person can paste — watch?v=, youtu.be/, /shorts/,
 * /live/ — plus /embed/ for completeness. A playlist address with no video of
 * its own returns null: there is no single video to show for it.
 *
 * @param {URL|null} sourceUrl A parsed source address.
 * @returns {string|null} The video identifier, or null when this is not a video.
 */
export const extractYouTubeVideoId = (sourceUrl) => {
  if (!sourceUrl) return null;
  const host = sourceUrl.hostname.replace(/^www\./i, '').toLowerCase();
  const isYouTubeHost =
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host === 'youtu.be';
  if (!isYouTubeHost) return null;

  const identifierPattern = /^[\w-]{11}$/;
  if (host === 'youtu.be') {
    const identifier = sourceUrl.pathname.split('/').filter(Boolean)[0];
    return identifierPattern.test(identifier ?? '') ? identifier : null;
  }

  const watchIdentifier = sourceUrl.searchParams.get('v');
  if (identifierPattern.test(watchIdentifier ?? '')) {
    return watchIdentifier;
  }

  const [pathPrefix, pathIdentifier] = sourceUrl.pathname
    .split('/')
    .filter(Boolean);
  if (
    ['shorts', 'live', 'embed', 'v'].includes(pathPrefix) &&
    identifierPattern.test(pathIdentifier ?? '')
  ) {
    return pathIdentifier;
  }
  return null;
};

/**
 * Name the kind of link, for the chip shown beside it.
 *
 * @param {URL} sourceUrl A parsed source address.
 * @returns {string} A short human name for where the link points.
 */
export const describeUrlKind = (sourceUrl) => {
  const host = sourceUrl.hostname.replace(/^www\./i, '').toLowerCase();
  if (host.endsWith('youtube.com') || host === 'youtu.be') return 'YouTube';
  if (host === 'x.com' || host.endsWith('twitter.com')) return 'X';
  if (host.endsWith('instagram.com')) return 'Instagram';
  if (host.endsWith('twitch.tv')) return 'Twitch';
  if (host.endsWith('linktr.ee')) return 'Linktree';
  return 'Link';
};

/**
 * Shorten an address to what identifies it, keeping the whole thing available
 * as the row's tooltip. A full watch URL with tracking parameters is unreadable
 * at this size and tells the user nothing the host and path do not.
 *
 * @param {URL} sourceUrl A parsed source address.
 * @returns {string} Host and path, without the scheme or a trailing slash.
 */
export const summarizeUrlForDisplay = (sourceUrl) => {
  const host = sourceUrl.hostname.replace(/^www\./i, '');
  const path = `${sourceUrl.pathname}${sourceUrl.search}`.replace(/\/$/, '');
  const summary = `${host}${path}`;
  return summary.length > 72 ? `${summary.slice(0, 71)}…` : summary;
};

/**
 * One source document, with whatever preview its kind supports.
 *
 * @param {Object} props
 * @param {Object} props.documentEntry An entry from listAvatarDocuments.
 * @param {string|null} props.portraitDataUri The avatar's reference image, already
 *   loaded for the header, reused as the thumbnail of the reference-image row.
 * @param {Function} [props.onSetVoiceReference] Called with the row's entry
 *   to make that upload the avatar's reference audio; shown only for uploads
 *   whose speech is in the voice model.
 * @param {Function} props.onDelete Called with the document's label for an
 *   upload, and with the whole row for generated media (which has no label the
 *   document delete endpoint would recognise — the caller deletes by asset id).
 */
const AvatarDocumentRow = ({
  documentEntry,
  portraitDataUri,
  onDelete,
  onSetVoiceReference,
}) => {
  // Generated media (emotion portraits and idle loops) is marked and previewed
  // differently from uploads; see the header comment.
  const isGeneratedMedia = documentEntry.source === 'emotion';
  const isGeneratedLoop =
    isGeneratedMedia && Boolean(documentEntry.isEmotionLoop);
  // Whether the YouTube player has replaced the thumbnail. The frame is only
  // mounted on demand: a settings screen listing twenty videos would otherwise
  // load twenty players, each of which is a third-party page.
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  // Sites are asked for their own favicon, and plenty do not have one. Falling
  // back to a generic globe keeps the row's leading column the same size either
  // way, so a list of links does not sit at ragged indentation.
  const [hasFaviconFailed, setHasFaviconFailed] = useState(false);

  // The two reference assets are marked so the user can tell which upload is the
  // avatar's portrait and which one is the voice sample: both are
  // ordinary-looking image / audio filenames in this list, and deleting the
  // wrong one costs the avatar its likeness or its speaker labelling.
  const referenceMark = isGeneratedMedia
    ? null
    : documentEntry.isReferenceImage
      ? {
          Icon: Camera,
          iconClassName: 'text-purple-300',
          label: 'Reference image',
          description: 'Portrait this avatar is depicted by',
          badgeClassName:
            'bg-purple-500/20 text-purple-200 border-purple-400/40',
        }
      : documentEntry.isReferenceAudio
        ? {
            Icon: Mic,
            iconClassName: 'text-emerald-300',
            label: 'Reference Audio',
            description:
              "Reference clip the diarizer uses to find this avatar's voice. Delete it, or pick another upload below, to change the reference.",
            badgeClassName:
              'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
          }
        : null;
  // Speech that reached the voice model is marked with the seconds it added,
  // so the owner can see which uploads the text-to-speech voice is built from.
  const voiceCorpusMark =
    !isGeneratedMedia && documentEntry.inVoiceCorpus
      ? {
          label: `In voice model · ${Math.round(documentEntry.voiceSeconds ?? 0)}s`,
          badgeClassName:
            'bg-emerald-500/10 text-emerald-200 border-emerald-400/30',
        }
      : null;
  const canBecomeVoiceReference =
    Boolean(onSetVoiceReference) &&
    !isGeneratedMedia &&
    documentEntry.inVoiceCorpus &&
    !documentEntry.isReferenceAudio;
  // A reference mark says what the upload is FOR; the kind says what it IS.
  // The mark wins the icon when there is one, because which upload is the
  // portrait matters more to the user than that the portrait is a .jpg.
  const documentKind = isGeneratedMedia
    ? null
    : describeDocumentKind(documentEntry.label);
  const kindPresentation = documentKind
    ? KIND_PRESENTATION[documentKind]
    : null;
  // Generated rows say what they are by asset kind, not by file extension.
  const generatedKindChip = isGeneratedMedia
    ? isGeneratedLoop
      ? 'Video'
      : 'Portrait'
    : null;
  const DocumentIcon =
    referenceMark?.Icon ?? kindPresentation?.Icon ?? FileText;

  const sourceUrl = isGeneratedMedia
    ? null
    : parseDocumentSourceUrl(documentEntry.label);
  const youTubeVideoId = extractYouTubeVideoId(sourceUrl);
  // Generated rows open a larger preview the same way a YouTube row opens its
  // player: the thumbnail, or the row itself, toggles it.
  const canOpenPreview = Boolean(youTubeVideoId) || isGeneratedMedia;
  // The portrait is fetched for the avatar as a whole, so the reference-image
  // row can show it without a second request. Ordinary image uploads are not
  // retained by the API and therefore have no thumbnail to show.
  const referenceImageThumbnail = documentEntry.isReferenceImage
    ? portraitDataUri
    : null;
  const displayLabel = sourceUrl
    ? summarizeUrlForDisplay(sourceUrl)
    : documentEntry.label;

  // The open player is given an identifier so the thumbnail control can name
  // the region it expands.
  const previewRegionId = useId();

  // Clicking the row itself opens and closes the video, so the empty space
  // beside a short title behaves the same as the thumbnail. Clicks are ignored
  // when they land on something that is already a control of its own — the
  // source link, the delete button, the thumbnail, the close button, the player
  // — or anywhere inside the open preview, so that watching a video and
  // clicking near its frame does not collapse it.
  const handleRowClick = (event) => {
    if (event.target.closest('a, button, iframe, [data-video-preview]')) return;
    setIsPlayerOpen((wasOpen) => !wasOpen);
  };

  const renderLeadingVisual = () => {
    if (isGeneratedMedia) {
      return (
        <button
          type="button"
          onClick={() => setIsPlayerOpen((wasOpen) => !wasOpen)}
          aria-expanded={isPlayerOpen}
          aria-controls={isPlayerOpen ? previewRegionId : undefined}
          aria-label={
            isPlayerOpen
              ? 'Close this preview'
              : `Preview the ${documentEntry.label.toLowerCase()}`
          }
          className="group relative shrink-0 w-16 h-16 rounded-md overflow-hidden border border-white/10 bg-black/30"
        >
          {isGeneratedLoop ? (
            <LoopingVideo
              src={documentEntry.url}
              poster={documentEntry.posterUrl ?? undefined}
              alt={documentEntry.label}
              className="w-full h-full"
            />
          ) : (
            <img
              src={documentEntry.url}
              alt={`Preview of ${documentEntry.label}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
            {isPlayerOpen && (
              <X size={20} className="text-neutral-200 drop-shadow" />
            )}
          </span>
        </button>
      );
    }

    if (youTubeVideoId) {
      return (
        <button
          type="button"
          onClick={() => setIsPlayerOpen((wasOpen) => !wasOpen)}
          aria-expanded={isPlayerOpen}
          aria-controls={isPlayerOpen ? previewRegionId : undefined}
          aria-label={
            isPlayerOpen ? 'Close this video' : 'Play this video in place'
          }
          className="group relative shrink-0 w-28 h-16 rounded-md overflow-hidden border border-white/10 bg-black/40"
        >
          <img
            // hqdefault is the one still that YouTube generates for every video;
            // maxresdefault is missing on plenty of them and would leave a hole.
            src={`https://img.youtube.com/vi/${youTubeVideoId}/hqdefault.jpg`}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
            {isPlayerOpen ? (
              <X size={22} className="text-neutral-200 drop-shadow" />
            ) : (
              <Play
                size={22}
                className="text-neutral-200 drop-shadow"
                fill="white"
              />
            )}
          </span>
        </button>
      );
    }

    if (referenceImageThumbnail) {
      return (
        <img
          src={referenceImageThumbnail}
          alt={`Preview of ${documentEntry.label}`}
          className="shrink-0 w-16 h-16 rounded-md object-cover border border-white/10 bg-black/30"
        />
      );
    }

    if (sourceUrl && !hasFaviconFailed) {
      return (
        <img
          src={`${sourceUrl.origin}/favicon.ico`}
          alt=""
          className="shrink-0 w-[18px] h-[18px] rounded-sm"
          loading="lazy"
          onError={() => setHasFaviconFailed(true)}
        />
      );
    }

    if (sourceUrl) {
      return <Globe size={18} className="shrink-0 text-sky-300" />;
    }

    return (
      <DocumentIcon
        size={18}
        className={`shrink-0 ${
          referenceMark?.iconClassName ??
          kindPresentation?.iconClassName ??
          'text-blue-400'
        }`}
      />
    );
  };

  return (
    <div
      onClick={canOpenPreview ? handleRowClick : undefined}
      className={`p-3 bg-black/60 border border-white/10 rounded-lg hover:bg-white/10 transition-colors${
        canOpenPreview ? ' cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {renderLeadingVisual()}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {sourceUrl ? (
                <a
                  href={sourceUrl.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={documentEntry.label}
                  className="text-neutral-200 text-sm font-medium break-all hover:text-blue-300 transition-colors"
                >
                  {displayLabel}
                </a>
              ) : (
                <span className="text-neutral-200 text-sm font-medium break-all">
                  {displayLabel}
                </span>
              )}
              {sourceUrl ? (
                <span className="px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded-full border bg-sky-500/20 text-sky-200 border-sky-400/40">
                  {describeUrlKind(sourceUrl)}
                </span>
              ) : generatedKindChip ? (
                <span className="px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded-full border bg-black/50 text-white/70 border-white/10">
                  {generatedKindChip}
                </span>
              ) : (
                kindPresentation && (
                  <span className="px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded-full border bg-black/50 text-white/70 border-white/10">
                    {kindPresentation.chip}
                  </span>
                )
              )}
              {isGeneratedMedia && (
                <>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded-full border ${GENERATED_MARK.badgeClassName}`}
                  >
                    <GENERATED_MARK.Icon size={11} />
                    {GENERATED_MARK.label}
                  </span>
                  {documentEntry.emotion && (
                    <span className="px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded-full border bg-black/50 text-white/70 border-white/10">
                      {titleCaseEmotion(documentEntry.emotion)}
                    </span>
                  )}
                </>
              )}
              {referenceMark && (
                <span
                  className={`px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded-full border ${referenceMark.badgeClassName}`}
                >
                  {referenceMark.label}
                </span>
              )}
              {voiceCorpusMark && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded-full border ${voiceCorpusMark.badgeClassName}`}
                  title="Seconds of this avatar's speech the voice model was collected from"
                >
                  <AudioLines size={11} aria-hidden="true" />
                  {voiceCorpusMark.label}
                </span>
              )}
            </div>
            {isGeneratedMedia ? (
              <p className="text-white/50 text-xs mt-0.5">
                {describeGeneratedMedia(documentEntry)}
              </p>
            ) : referenceMark ? (
              <p className="text-white/50 text-xs mt-0.5">
                {referenceMark.description}
              </p>
            ) : (
              !sourceUrl &&
              kindPresentation && (
                <p className="text-white/40 text-xs mt-0.5">
                  {kindPresentation.previewNote}
                </p>
              )
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onDelete(documentEntry)}
            title={isGeneratedMedia ? 'Delete this generated media' : 'Delete'}
            aria-label={
              isGeneratedMedia ? 'Delete this generated media' : 'Delete'
            }
            className="text-red-400 hover:text-red-300 transition-colors"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {isPlayerOpen && isGeneratedMedia && (
        <div id={previewRegionId} data-video-preview className="mt-3 space-y-2">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsPlayerOpen(false)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-white/70 hover:text-neutral-100 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
            >
              <X size={14} />
              Close preview
            </button>
          </div>
          <div className="w-full max-w-sm mx-auto aspect-[9/16] max-h-[60vh] rounded-lg overflow-hidden border border-white/10 bg-black">
            {isGeneratedLoop ? (
              <LoopingVideo
                src={documentEntry.url}
                poster={documentEntry.posterUrl ?? undefined}
                alt={documentEntry.label}
                className="w-full h-full"
                mediaClassName="w-full h-full object-contain"
              />
            ) : (
              <img
                src={documentEntry.url}
                alt={`Preview of ${documentEntry.label}`}
                className="w-full h-full object-contain"
              />
            )}
          </div>
        </div>
      )}

      {isPlayerOpen && youTubeVideoId && (
        <div id={previewRegionId} data-video-preview className="mt-3 space-y-2">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsPlayerOpen(false)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-white/70 hover:text-neutral-100 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
            >
              <X size={14} />
              Close preview
            </button>
          </div>
          <div className="aspect-video w-full rounded-lg overflow-hidden border border-white/10 bg-black">
            <iframe
              // youtube-nocookie serves the same player without YouTube's tracking
              // cookies, which is the right default for a settings screen.
              src={`https://www.youtube-nocookie.com/embed/${youTubeVideoId}?autoplay=1&rel=0`}
              title={`Preview of ${documentEntry.label}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AvatarDocumentRow;
