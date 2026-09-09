// src/components/CreateAvatarPhotoField.jsx
//
// Take or choose a photograph of a name or place when creating an avatar, or
// paste the address of an image already on the web.
// On a phone the native camera is used so the file can keep EXIF GPS; on a
// desktop the live camera is a canvas snapshot and the pin comes from this
// device instead. A URL is fetched by the server and pins nothing.

import { useEffect, useRef, useState } from 'react';
import { Camera, ImageUp, Link, Loader2, X } from 'lucide-react';

import { canShowCameraBackground } from '../hooks/useCameraPassthrough';
import {
  describePhotoPlaceError,
  resolvePhotoCapturePlace,
} from '../services/createAvatarPhoto';
import { singleReferenceImageUrl } from '../services/referenceImageUrl';

const buttonClassName =
  'inline-flex flex-1 min-w-[8rem] items-center justify-center gap-1.5 rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-50';

function prefersNativeCamera() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

/**
 * @param {Object} props
 * @param {File|null} props.file The chosen photograph, if any.
 * @param {string|null} [props.url] The image address, when a link was used
 *   instead of a file. Never set together with `file`.
 * @param {'exif'|'device'|null} [props.placeSource] How the pin was resolved.
 * @param {string} [props.placeError] Why the place could not be read.
 * @param {boolean} [props.disabled]
 * @param {(isBusy: boolean) => void} [props.onBusyChange]
 * @param {(payload: {file: File|null, url: string|null, place: Object|null, placeError: string}) => void} props.onChosen
 * @param {() => void} props.onClear
 */
const CreateAvatarPhotoField = ({
  file,
  url = null,
  placeSource = null,
  placeError = '',
  disabled = false,
  onBusyChange,
  onChosen,
  onClear,
}) => {
  const captureInputRef = useRef(null);
  const libraryInputRef = useRef(null);
  const urlInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const previewUrlRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [isUrlFormOpen, setIsUrlFormOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlError, setUrlError] = useState('');
  // The preview <img> for a URL failed to load. The server still decides
  // whether the address serves an image, so this is a warning, not a block.
  const [urlPreviewFailed, setUrlPreviewFailed] = useState(false);

  useEffect(() => {
    if (!file) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreviewUrl(null);
      return undefined;
    }
    const nextUrl = URL.createObjectURL(file);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
    return () => {
      URL.revokeObjectURL(nextUrl);
      if (previewUrlRef.current === nextUrl) previewUrlRef.current = null;
    };
  }, [file]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isCameraOpen || !streamRef.current) return;
    video.srcObject = streamRef.current;
    return () => {
      video.srcObject = null;
    };
  }, [isCameraOpen]);

  useEffect(() => {
    setUrlPreviewFailed(false);
  }, [url]);

  useEffect(() => {
    if (isUrlFormOpen) urlInputRef.current?.focus();
  }, [isUrlFormOpen]);

  const setBusy = (isBusy) => {
    setIsResolving(isBusy);
    onBusyChange?.(isBusy);
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsCameraOpen(false);
  };

  const finishWithFile = async (chosenFile) => {
    if (!chosenFile) return;
    setBusy(true);
    setCameraError('');
    try {
      const place = await resolvePhotoCapturePlace(chosenFile);
      onChosen({
        file: chosenFile,
        url: null,
        place,
        placeError: place ? '' : describePhotoPlaceError(null),
      });
    } catch (error) {
      onChosen({
        file: chosenFile,
        url: null,
        place: null,
        placeError: describePhotoPlaceError(error),
      });
    } finally {
      setBusy(false);
    }
  };

  const openUrlForm = () => {
    setUrlError('');
    setUrlDraft('');
    setIsUrlFormOpen(true);
  };

  const closeUrlForm = () => {
    setIsUrlFormOpen(false);
    setUrlDraft('');
    setUrlError('');
  };

  const submitUrl = () => {
    const parsed = singleReferenceImageUrl(urlDraft);
    if (parsed.error) {
      setUrlError(parsed.error);
      return;
    }
    closeUrlForm();
    // A link says nothing about where the picture was taken, so there is no
    // place to resolve and no error to explain.
    onChosen({ file: null, url: parsed.url, place: null, placeError: '' });
  };

  const onUrlKeyDown = (keyEvent) => {
    if (keyEvent.key === 'Enter') {
      keyEvent.preventDefault();
      submitUrl();
    } else if (keyEvent.key === 'Escape') {
      // Close only this form; the dialog's own Escape handler must not fire.
      keyEvent.preventDefault();
      keyEvent.stopPropagation();
      closeUrlForm();
    }
  };

  const onFileInput = async (changeEvent) => {
    const [chosenFile] = changeEvent.target.files ?? [];
    changeEvent.target.value = '';
    await finishWithFile(chosenFile);
  };

  const startLiveCamera = async () => {
    if (!canShowCameraBackground()) {
      captureInputRef.current?.click();
      return;
    }
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
    } catch (error) {
      setCameraError(
        error?.message || 'This browser could not open the camera.'
      );
      captureInputRef.current?.click();
    }
  };

  const snapLiveCamera = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    );
    stopCamera();
    if (!blob) return;
    const snapped = new File([blob], `place-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });
    await finishWithFile(snapped);
  };

  const openTakePicture = () => {
    if (prefersNativeCamera()) {
      captureInputRef.current?.click();
      return;
    }
    startLiveCamera();
  };

  return (
    <div className="mb-4">
      <p className="text-sm text-neutral-300">
        Photograph a name or place, or paste an image link
      </p>
      <p className="mt-1 text-xs text-white/40">
        The picture becomes the reference image and is used for deep research.
        A photograph pins the avatar where it was taken.
      </p>

      <input
        ref={captureInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled || isResolving}
        onChange={onFileInput}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || isResolving}
        onChange={onFileInput}
      />

      {isCameraOpen ? (
        <div className="mt-3 space-y-2">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-40 w-full rounded-lg border border-white/10 bg-black object-cover"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={snapLiveCamera}
              disabled={disabled}
              className={buttonClassName}
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              Take picture
            </button>
            <button
              type="button"
              onClick={stopCamera}
              disabled={disabled}
              className={buttonClassName}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : previewUrl || url ? (
        <div className="relative mt-3">
          {previewUrl || !urlPreviewFailed ? (
            <img
              src={previewUrl ?? url}
              alt="Photograph for this avatar"
              className="h-40 w-full rounded-lg border border-white/10 object-cover"
              onError={() => {
                if (!previewUrl) setUrlPreviewFailed(true);
              }}
            />
          ) : (
            <div className="flex h-40 w-full flex-col items-center justify-center gap-1 rounded-lg border border-white/10 bg-black/60 px-4 text-center">
              <Link className="h-5 w-5 text-white/40" aria-hidden="true" />
              <span className="text-xs text-white/40">
                The preview did not load here. The server will still try to
                fetch this address.
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={onClear}
            disabled={disabled || isResolving}
            className="absolute right-2 top-2 rounded-md border border-neutral-700 bg-black/60 p-1 text-neutral-200 hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-50"
            aria-label={url ? 'Remove image link' : 'Remove photograph'}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          {isResolving && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
              <Loader2
                className="h-6 w-6 animate-spin text-amber-300"
                aria-hidden="true"
              />
              <span className="sr-only">Finding where this was taken</span>
            </div>
          )}
        </div>
      ) : isUrlFormOpen ? (
        <div className="mt-3 space-y-2">
          <label className="block text-xs text-white/60">
            Image link
            <input
              ref={urlInputRef}
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={urlDraft}
              onChange={(changeEvent) => {
                setUrlDraft(changeEvent.target.value);
                if (urlError) setUrlError('');
              }}
              onKeyDown={onUrlKeyDown}
              placeholder="https://example.com/portrait.jpg"
              disabled={disabled}
              aria-invalid={Boolean(urlError)}
              className="mt-1 w-full rounded border border-neutral-700 bg-black/60 p-2 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all duration-300"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitUrl}
              disabled={disabled || !urlDraft.trim()}
              className={buttonClassName}
            >
              <Link className="h-4 w-4" aria-hidden="true" />
              Use this link
            </button>
            <button
              type="button"
              onClick={closeUrlForm}
              disabled={disabled}
              className={buttonClassName}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openTakePicture}
            disabled={disabled || isResolving}
            className={buttonClassName}
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            Take a picture
          </button>
          <button
            type="button"
            onClick={() => libraryInputRef.current?.click()}
            disabled={disabled || isResolving}
            className={buttonClassName}
          >
            <ImageUp className="h-4 w-4" aria-hidden="true" />
            Choose a photo
          </button>
          <button
            type="button"
            onClick={openUrlForm}
            disabled={disabled || isResolving}
            className={buttonClassName}
          >
            <Link className="h-4 w-4" aria-hidden="true" />
            Paste a link
          </button>
        </div>
      )}

      {urlError && <p className="mt-2 text-xs text-red-300">{urlError}</p>}
      {cameraError && (
        <p className="mt-2 text-xs text-red-300">{cameraError}</p>
      )}
      {url && (
        <p className="mt-2 break-all text-xs text-white/50">
          Reference image from {url}. A link is not pinned to a place; add one
          below if you know it.
        </p>
      )}
      {placeSource && (
        <p className="mt-2 text-xs text-white/50">
          {placeSource === 'exif'
            ? 'Pinned at the place stored in this photograph.'
            : 'Pinned at this device’s position — where the picture was taken.'}
        </p>
      )}
      {placeError && !placeSource && (
        <p className="mt-2 text-xs text-red-300">{placeError}</p>
      )}
    </div>
  );
};

export default CreateAvatarPhotoField;
