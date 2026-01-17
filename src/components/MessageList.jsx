// src/components/MessageList.jsx
import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import SecureImage from './SecureImage';

const MessageList = ({ messages, messagesEndRef }) => {
  const { accessToken } = useAuth();

  useEffect(() => {
    if (messagesEndRef?.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, messagesEndRef]);

  // Debug: Log message count and timestamp info
  useEffect(() => {
    const validMessages = messages.filter((msg) => msg?.role);
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
        .filter((msg) => msg?.role) // Filter out messages without role
        .map((msg) => {
          const isLoading = msg.isLoading || msg.isPending;
          // Use id field for key
          const messageKey = msg.id || `msg-${msg.timestamp}-${Math.random()}`;

          return (
            <div
              key={messageKey}
              className={`max-w-[70%] p-2 rounded-lg break-words transition-all duration-150 ${
                msg.role === 'user'
                  ? 'bg-teal-600 self-end text-white'
                  : msg.role === 'assistant'
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
                  {msg.content && (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}

                  {/* MEDIA CONTENT */}
                  {msg.media &&
                    Array.isArray(msg.media) &&
                    msg.media.map((media, index) => (
                      <div
                        key={media.id || media.filename || index}
                        className="mt-2"
                      >
                        {media.type === 'image' ||
                        media.content_type?.startsWith('image/') ? (
                          <SecureImage
                            mediaUrl={media.url}
                            filename={media.filename || media.name}
                          />
                        ) : media.type === 'audio' ||
                          media.content_type?.startsWith('audio/') ? (
                          <audio controls src={media.url} />
                        ) : media.type === 'video' ||
                          media.content_type?.startsWith('video/') ? (
                          <video
                            controls
                            className="max-w-full max-h-64"
                            src={media.url}
                          />
                        ) : (
                          <a
                            href={media.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-blue-300"
                          >
                            {media.filename || media.name || 'Download file'}
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
