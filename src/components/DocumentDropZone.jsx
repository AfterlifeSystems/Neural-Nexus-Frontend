// DocumentDropZone.jsx

'use client';
import React, { useCallback, useState } from 'react';
import useAuth from '../context/AuthContext';

export default function DocumentDropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState(null);

  const { isLoading, setIsLoading } = useAuth();

  const determineContentType = (file) => {
    const type = file.type;
    if (type.startsWith('text/') || type === 'application/json') return 'text';
    if (type.startsWith('audio/')) return 'audio';
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type === 'application/pdf') return 'file';

    const filename = file.name.toLowerCase();
    if (filename.endsWith('.pdf')) return 'file';
    if (filename.endsWith('.txt') || filename.endsWith('.md')) return 'text';
    return 'file';
  };

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const items = e.dataTransfer.items;
    const formData = new FormData();
    let hasFiles = false;
    let hasUrls = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          formData.append('files', file);
          hasFiles = true;
        }
      } else if (item.kind === 'string') {
        item.getAsString((url) => {
          if (url.startsWith('http://') || url.startsWith('https://')) {
            formData.append('urls', url);
            hasUrls = true;
          }
        });
      }
    }

    const text = e.dataTransfer.getData('text/plain');
    if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
      formData.append('urls', text);
      hasUrls = true;
    }

    if (!hasFiles && !hasUrls) {
      setError('No valid files or URLs dropped');
      return;
    }
    console.log(
      `CHANGING THE VALUE OF SET LOADING TO TRUE: CURRENT LOADING VALUE: ${isLoading}`
    );
    setIsLoading(true);
    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      setDocuments((prev) => [...prev, ...(data.documents || [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      console.log(
        `CHANGING THE VALUE OF SET LOADING TO FALSE: CURRENT LOADING VALUE: ${isLoading}`
      );
      setIsLoading(false);
    }
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handlePaste = async (e) => {
    const text = e.clipboardData.getData('text/plain');
    if (text.startsWith('http://') || text.startsWith('https://')) {
      e.preventDefault();
      console.log(
        `CHANGING THE VALUE OF SET LOADING TO TRUE: CURRENT LOADING VALUE: ${isLoading}`
      );
      setIsLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('urls', text);

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Upload failed');
        }

        setDocuments((prev) => [...prev, ...(data.documents || [])]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Paste failed');
      } finally {
        setIsLoading(false);
      }
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
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
      >
        <div className="space-y-2">
          <p className="text-lg font-semibold">Drag & drop documents here</p>
          <p className="text-sm text-gray-600">
            Supports: Text files, PDFs, Images, Audio, Video, URLs, and Web URLs
          </p>
          <p className="text-xs text-gray-500">
            Or paste a URL (Ctrl+V / Cmd+V)
          </p>
          {isLoading && (
            <p className="text-blue-600 animate-spin">Loading...</p>
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
            {documents.map((doc, idx) => (
              <div
                key={idx}
                className="p-3 bg-gray-50 border border-gray-200 rounded flex items-start space-x-3"
              >
                <span className="inline-block px-2 py-1 text-xs font-semibold text-white rounded bg-blue-600">
                  {doc.type.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {doc.filename || doc.url || 'Document'}
                  </p>
                  <p className="text-sm text-gray-600">Source: {doc.source}</p>
                  {doc.content && (
                    <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                      {doc.content.substring(0, 100)}...
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
