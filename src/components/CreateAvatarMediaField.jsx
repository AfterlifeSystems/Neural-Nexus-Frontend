// Optional portrait, voice reference, and identity sources on Create Avatar.
//
// One drop zone and one address field. A photograph, an audio or video clip,
// a YouTube link, or a page can all be added here. They are ingested after
// the avatar exists.

import { useRef } from 'react';
import { AudioLines, Camera, FileUp, Link, Plus, X } from 'lucide-react';

import CreateAvatarPhotoField from './CreateAvatarPhotoField';
import { isFileOrUrlDrag } from './documentDropOverlay';
import { parseHttpUrls } from '../services/parseHttpUrls';
import {
  createAvatarVoiceFileKey,
  createAvatarVoiceUrlKey,
  fileIdentityKey,
} from '../services/createAvatarMedia';

const quietButtonClassName =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-700 bg-black/60 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-50';

const chipClassName =
  'flex items-center gap-2 rounded border border-neutral-700 bg-black/60 px-2 py-1 text-xs text-neutral-200';

function MediaChip({
  icon,
  label,
  title,
  disabled,
  onRemove,
  isReference = false,
  onToggleReference,
}) {
  return (
    <li className={chipClassName}>
      {icon}
      <span className="min-w-0 flex-1 truncate" title={title ?? label}>
        {label}
      </span>
      {onToggleReference ? (
        <button
          type="button"
          role="switch"
          aria-checked={isReference}
          aria-label={`Use ${label} as the avatar's reference voice`}
          disabled={disabled}
          onClick={onToggleReference}
          className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-50 ${
            isReference
              ? 'border-white/30 bg-white/15 text-white'
              : 'border-neutral-700 bg-black/60 text-white/50 hover:text-white'
          }`}
        >
          Reference
        </button>
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="rounded-md border border-neutral-700 bg-black/60 p-1 text-neutral-200 hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-50"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * @param {Object} props
 * @param {File|null} props.photoFile
 * @param {string|null} props.photoUrl
 * @param {'exif'|'device'|null} [props.placeSource]
 * @param {string} [props.placeError]
 * @param {File[]} props.voiceFiles
 * @param {string[]} props.voiceUrls
 * @param {File[]} props.identityFiles
 * @param {string[]} props.identityLinks
 * @param {string|null} [props.referenceAudioKey]
 * @param {string} props.draft
 * @param {string} [props.error]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.isDragging]
 * @param {(isBusy: boolean) => void} [props.onBusyChange]
 * @param {(payload: {file: File|null, url: string|null, place: Object|null, placeError: string}) => void} props.onPhotoChosen
 * @param {() => void} props.onClearPhoto
 * @param {(files: File[]) => void} props.onVoiceFilesChange
 * @param {(urls: string[]) => void} props.onVoiceUrlsChange
 * @param {(files: File[]) => void} props.onIdentityFilesChange
 * @param {(links: string[]) => void} props.onIdentityLinksChange
 * @param {(key: string) => void} props.onToggleReferenceAudio
 * @param {(draft: string) => void} props.onDraftChange
 * @param {(error: string) => void} props.onErrorChange
 * @param {(incoming: {files?: File[], urls?: string[]}) => void} props.onIncoming
 */
const CreateAvatarMediaField = ({
  photoFile,
  photoUrl,
  placeSource = null,
  placeError = '',
  voiceFiles,
  voiceUrls,
  identityFiles,
  identityLinks,
  referenceAudioKey = null,
  draft,
  error = '',
  disabled = false,
  isDragging = false,
  onBusyChange,
  onPhotoChosen,
  onClearPhoto,
  onVoiceFilesChange,
  onVoiceUrlsChange,
  onIdentityFilesChange,
  onIdentityLinksChange,
  onToggleReferenceAudio,
  onDraftChange,
  onErrorChange,
  onIncoming,
}) => {
  const photoFieldRef = useRef(null);
  const fileInputRef = useRef(null);
  const hasPhoto = Boolean(photoFile || photoUrl);
  const hasAttached =
    hasPhoto ||
    voiceFiles.length > 0 ||
    voiceUrls.length > 0 ||
    identityFiles.length > 0 ||
    identityLinks.length > 0;

  const addDraft = () => {
    const urls = parseHttpUrls(draft);
    if (urls.length === 0) {
      onErrorChange(
        draft.trim()
          ? 'Enter an http:// or https:// address, or clear the field.'
          : 'Enter an http:// or https:// address.'
      );
      return;
    }
    onIncoming({ urls });
  };

  return (
    <div className="mb-4">
      <p className="text-sm text-neutral-300">
        Media
        <span className="ml-2 text-xs font-normal text-white/40">Optional</span>
      </p>
      <p className="mt-1 text-xs leading-relaxed text-white/40">
        Drop a photo, audio, or video, or paste a YouTube or page link. Mark a
        clip as Reference if that recording is this avatar's voice (the avatar
        must at least speak most often).
      </p>

      <div
        className={`mt-2 rounded-lg border border-dashed p-3 transition-colors ${
          isDragging
            ? 'border-amber-400/50 bg-amber-400/5'
            : 'border-neutral-700 bg-black/40'
        }`}
        onDragOver={(dragEvent) => {
          if (!isFileOrUrlDrag(dragEvent.dataTransfer)) return;
          dragEvent.preventDefault();
        }}
        onDrop={(dropEvent) => {
          dropEvent.preventDefault();
          dropEvent.stopPropagation();
          onIncoming({
            files: Array.from(dropEvent.dataTransfer.files ?? []),
            urls: parseHttpUrls(
              dropEvent.dataTransfer.getData('text/uri-list') ||
                dropEvent.dataTransfer.getData('text/plain')
            ),
          });
        }}
      >
        <CreateAvatarPhotoField
          ref={photoFieldRef}
          showChooser={false}
          file={photoFile}
          url={photoUrl}
          placeSource={placeSource}
          placeError={placeError}
          disabled={disabled}
          onBusyChange={onBusyChange}
          onChosen={onPhotoChosen}
          onClear={onClearPhoto}
        />

        {voiceFiles.length +
          voiceUrls.length +
          identityFiles.length +
          identityLinks.length >
          0 && (
          <ul className={`space-y-1 ${hasPhoto ? 'mt-2' : ''}`}>
            {voiceFiles.map((voiceFile) => {
              const voiceKey = createAvatarVoiceFileKey(voiceFile);
              return (
                <MediaChip
                  key={voiceKey}
                  icon={
                    <AudioLines
                      className="h-3.5 w-3.5 shrink-0 text-white/40"
                      aria-hidden="true"
                    />
                  }
                  label={voiceFile.name}
                  isReference={referenceAudioKey === voiceKey}
                  onToggleReference={() => onToggleReferenceAudio(voiceKey)}
                  disabled={disabled}
                  onRemove={() =>
                    onVoiceFilesChange(
                      voiceFiles.filter(
                        (candidate) =>
                          fileIdentityKey(candidate) !==
                          fileIdentityKey(voiceFile)
                      )
                    )
                  }
                />
              );
            })}
            {voiceUrls.map((voiceUrl) => {
              const voiceKey = createAvatarVoiceUrlKey(voiceUrl);
              return (
                <MediaChip
                  key={voiceKey}
                  icon={
                    <AudioLines
                      className="h-3.5 w-3.5 shrink-0 text-white/40"
                      aria-hidden="true"
                    />
                  }
                  label={voiceUrl}
                  title={voiceUrl}
                  isReference={referenceAudioKey === voiceKey}
                  onToggleReference={() => onToggleReferenceAudio(voiceKey)}
                  disabled={disabled}
                  onRemove={() =>
                    onVoiceUrlsChange(
                      voiceUrls.filter((candidate) => candidate !== voiceUrl)
                    )
                  }
                />
              );
            })}
            {identityFiles.map((identityFile) => (
              <MediaChip
                key={fileIdentityKey(identityFile)}
                icon={
                  <FileUp
                    className="h-3.5 w-3.5 shrink-0 text-white/40"
                    aria-hidden="true"
                  />
                }
                label={identityFile.name}
                disabled={disabled}
                onRemove={() =>
                  onIdentityFilesChange(
                    identityFiles.filter(
                      (candidate) =>
                        fileIdentityKey(candidate) !==
                        fileIdentityKey(identityFile)
                    )
                  )
                }
              />
            ))}
            {identityLinks.map((identityLink) => (
              <MediaChip
                key={identityLink}
                icon={
                  <Link
                    className="h-3.5 w-3.5 shrink-0 text-white/40"
                    aria-hidden="true"
                  />
                }
                label={identityLink}
                title={identityLink}
                disabled={disabled}
                onRemove={() =>
                  onIdentityLinksChange(
                    identityLinks.filter(
                      (candidate) => candidate !== identityLink
                    )
                  )
                }
              />
            ))}
          </ul>
        )}

        {!hasAttached && (
          <p className="py-4 text-center text-sm text-white/50">
            Drop a file here
          </p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,audio/*,video/*,.pdf,.txt,.md,.csv,.doc,.docx"
          className="hidden"
          disabled={disabled}
          onChange={(changeEvent) => {
            const chosen = Array.from(changeEvent.target.files ?? []);
            changeEvent.target.value = '';
            if (chosen.length > 0) onIncoming({ files: chosen });
          }}
        />

        <div
          className={`flex flex-wrap gap-2 ${hasAttached ? 'mt-3' : 'mt-1'}`}
        >
          <button
            type="button"
            onClick={() => photoFieldRef.current?.openTakePicture()}
            disabled={disabled}
            className={quietButtonClassName}
          >
            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
            Photo
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className={quietButtonClassName}
          >
            <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
            Files
          </button>
        </div>

        <div className="mt-2 flex gap-2">
          <input
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(changeEvent) => {
              onDraftChange(changeEvent.target.value);
              if (error) onErrorChange('');
            }}
            onKeyDown={(keyEvent) => {
              if (keyEvent.key !== 'Enter') return;
              keyEvent.preventDefault();
              addDraft();
            }}
            onPaste={(pasteEvent) => {
              const pastedUrls = parseHttpUrls(
                pasteEvent.clipboardData.getData('text/plain')
              );
              if (pastedUrls.length <= 1) return;
              pasteEvent.preventDefault();
              onIncoming({ urls: pastedUrls });
            }}
            placeholder="https:// photo, YouTube, or a page"
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-label="Media or page link"
            className="min-w-0 flex-1 rounded border border-neutral-700 bg-black/60 p-2 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all duration-300"
          />
          <button
            type="button"
            onClick={addDraft}
            disabled={disabled || !draft.trim()}
            className={quietButtonClassName}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
};

export default CreateAvatarMediaField;
