// DocumentDropZone.jsx
//
// Drag-and-drop (or paste-a-URL) intake for avatar identity media. Uploads go
// to POST /update_avatar_identity_with_media, which answers immediately with a
// job identifier; real progress then streams from the job's progress endpoint
// until the terminal `done` event.

import React, { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  uploadAvatarIdentityMedia,
  streamMediaJobProgress,
} from '../services/avatarService';

export default function DocumentDropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState(null);
  const [progressMessage, setProgressMessage] = useState(null);

  const { isLoading, setIsLoading, activeAvatar } = useAuth();

  /**
   * Upload the gathered files/URLs and follow the processing job to
   * completion, surfacing progress along the way.
   *
   * @param {File[]} files Files dropped onto the zone.
   * @param {string[]} urls URLs dropped or pasted onto the zone.
   */
  const uploadAndTrack = useCallback(
    async (files, urls) => {
      setIsLoading(true);
      setError(null);
      setProgressMessage('Uploading…');
      try {
        const uploadResponse = await uploadAvatarIdentityMedia({
          assistantId:
            activeAvatar?.assistant_id ??
            activeAvatar?.avatar_id ??
            activeAvatar?.metadata?.assistant_id,
          files,
          urls,
        });

        const jobId = uploadResponse?.job_id;
        if (jobId) {
          await streamMediaJobProgress(jobId, (progressEvent) => {
            if (progressEvent.type === 'media_progress') {
              setProgressMessage(
                progressEvent.message ??
                  progressEvent.stage ??
                  'Processing media…'
              );
            } else if (progressEvent.type === 'done') {
              if (progressEvent.error) {
                setError(String(progressEvent.error));
              }
            }
          });
        }

        setDocuments((previousDocuments) => [
          ...previousDocuments,
          ...files.map((uploadedFile) => ({
            type: uploadedFile.type || 'file',
            filename: uploadedFile.name,
            source: 'upload',
          })),
          ...urls.map((uploadedUrl) => ({
            type: 'url',
            url: uploadedUrl,
            source: 'url',
          })),
        ]);
        setProgressMessage(null);
      } catch (uploadError) {
        setError(
          uploadError instanceof Error ? uploadError.message : 'Upload failed'
        );
        setProgressMessage(null);
      } finally {
        setIsLoading(false);
      }
    },
    [activeAvatar, setIsLoading]
  );

  const handleDrop = useCallback(
    async (dropEvent) => {
      dropEvent.preventDefault();
      setIsDragging(false);
      setError(null);

      const files = Array.from(dropEvent.dataTransfer.files ?? []);
      const urls = [];

      const text = dropEvent.dataTransfer.getData('text/plain');
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        urls.push(text);
      }

      if (files.length === 0 && urls.length === 0) {
        setError('No valid files or URLs dropped');
        return;
      }

      await uploadAndTrack(files, urls);
    },
    [uploadAndTrack]
  );

  const handleDragOver = (dragEvent) => {
    dragEvent.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handlePaste = async (pasteEvent) => {
    const text = pasteEvent.clipboardData.getData('text/plain');
    if (text.startsWith('http://') || text.startsWith('https://')) {
      pasteEvent.preventDefault();
      await uploadAndTrack([], [text]);
    }
  };

  return (
    <div className="w-full">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onPaste={handlePaste}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
          isDragging
            ? 'border-amber-400 bg-amber-400/10'
            : 'border-neutral-300 hover:border-neutral-400'
        } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
      >
        <div className="space-y-2">
          <p className="text-lg font-semibold">Drag & drop documents here</p>
          <p className="text-sm text-neutral-600">
            Supports: Text files, PDFs, Images, Audio, Video, URLs, and Web URLs
          </p>
          <p className="text-xs text-neutral-500">
            Or paste a URL (Ctrl+V / Cmd+V)
          </p>
          {isLoading && (
            <p className="text-amber-300">{progressMessage ?? 'Loading…'}</p>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      {documents.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Loaded Documents</h3>
          <div className="space-y-2">
            {documents.map((documentEntry, documentIndex) => (
              <div
                key={documentIndex}
                className="p-3 bg-neutral-50 border border-neutral-200 rounded flex items-start space-x-3"
              >
                <span className="inline-block px-2 py-1 text-xs font-semibold text-neutral-200 rounded bg-blue-600">
                  {documentEntry.type.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {documentEntry.filename || documentEntry.url || 'Document'}
                  </p>
                  <p className="text-sm text-neutral-600">
                    Source: {documentEntry.source}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
