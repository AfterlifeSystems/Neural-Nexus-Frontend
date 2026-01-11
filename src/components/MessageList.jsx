// src/components/MessageList.jsx
import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDbHttpsUrl, getNgrokHttpsUrl } from '../context/NgrokAPIStore';
import { useMedia } from '../context/MediaContext';
import SecureImage from './SecureImage';

const MessageList = ({ messages, messagesEndRef }) => {
  const { accessToken } = useAuth();
  const { getMediaUrl } = useMedia();
  const ngrokHttpsUrl = getNgrokHttpsUrl();
  const dbHttpsUrl = getDbHttpsUrl();

  useEffect(() => {
    console.log(ngrokHttpsUrl);
    if (messagesEndRef?.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, messagesEndRef, ngrokHttpsUrl]);

  // Debug: Log message count and timestamp info
  useEffect(() => {
    const validMessages = messages.filter((msg) => msg?.sender);
    if (validMessages.length > 0) {
      const timestamps = validMessages
        .map((m) => (m.timestamp ? new Date(m.timestamp).getTime() : null))
        .filter((t) => t !== null)
        .sort((a, b) => a - b);

      if (timestamps.length > 0) {
        const oldest = new Date(timestamps[0]);
        const newest = new Date(timestamps[timestamps.length - 1]);
        console.log(
          `MessageList: Rendering ${validMessages.length} of ${messages.length} total messages | ` +
            `Time range: ${oldest.toLocaleString()} to ${newest.toLocaleString()}`
        );
      } else {
        console.log(
          `MessageList: Rendering ${validMessages.length} of ${messages.length} total messages`
        );
      }
    } else {
      console.log(
        `MessageList: Rendering ${validMessages.length} of ${messages.length} total messages`
      );
    }
  }, [messages]);

  return (
    <div className="flex-grow mb-4 space-y-2 px-2 flex flex-col">
      {messages
        .filter((msg) => msg?.sender) // Filter out messages without sender before mapping
        .map((msg) => {
          const isLoading = msg.isLoading || msg.isPending;
          // Generate a unique key - use _id, id, or fallback to index-based key
          const messageKey =
            msg._id || msg.id || `msg-${msg.timestamp}-${Math.random()}`;

          return (
            <div
              key={messageKey}
              className={`max-w-[70%] p-2 rounded-lg break-words transition-all duration-150 ${
                msg.sender === 'user'
                  ? 'bg-teal-600 self-end text-white'
                  : msg.sender === 'avatar'
                  ? 'bg-indigo-700 self-start text-white'
                  : 'bg-indigo-700 self-center italic text-gray-300'
              }`}
            >
              {/* LOADING INDICATOR */}
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div
                      className="w-2 h-2 bg-white rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-white rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-white rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    ></div>
                  </div>
                </div>
              ) : (
                <>
                  {/* TEXT CONTENT */}
                  {(msg.content || msg.message) && (
                    <div className="whitespace-pre-wrap">
                      {msg.content || msg.message}
                    </div>
                  )}

                  {/* MEDIA CONTENT */}
                  {msg.media &&
                    Array.isArray(msg.media) &&
                    msg.media.map((media, index) => (
                      <div
                        key={media.media_id || media.filename || index}
                        className="mt-2"
                      >
                        {media.content_type?.startsWith('image/') ? (
                          <SecureImage
                            mediaId={media.media_id}
                            filename={media.filename}
                            accessToken={accessToken}
                          />
                        ) : media.content_type?.startsWith('audio/') ? (
                          <audio
                            controls
                            src={
                              media.url ||
                              `${dbHttpsUrl}/media/${media.media_id}?token=${accessToken}`
                            }
                          />
                        ) : media.content_type?.startsWith('video/') ? (
                          <video
                            controls
                            className="max-w-full max-h-64"
                            src={
                              media.url ||
                              `${dbHttpsUrl}/media/${media.media_id}?token=${accessToken}`
                            }
                          />
                        ) : (
                          <a
                            href={
                              media.url ||
                              `${dbHttpsUrl}/media/${media.media_id}?token=${accessToken}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-blue-300"
                          >
                            {media.filename || 'Download file'}
                          </a>
                        )}
                      </div>
                    ))}

                  {/* TIMESTAMP */}
                  <div className="text-xs text-white-400 mt-1 text-right select-none">
                    {msg.timestamp &&
                      new Date(msg.timestamp).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
