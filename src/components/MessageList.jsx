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

  // Debug log – shows what actually reaches the component
  useEffect(() => {
    // Get all the conversations for the current avatarconsole.log(`messages list breakpoint`);

    messages.map((m) => ({
      id: m.id,
      type: m.type,
      contentPreview: m.content?.slice(0, 50) || '(no content)',
      isLoading: m.isLoading,
    }));

    console.log('MessageList received messages:', messages);
    // console.log('MessageList received messages:', messages[0].type);
    // console.log('MessageList received messages:', messages[1].type);

    // console.log('MessageList received messages:', messages[0].type);
    // console.log('MessageList received messages:', messages[1].type);

    const valid = messages.filter((msg) => msg?.type);

    console.log(
      `Rendering ${valid.length} / ${messages.length} messages (after type filter)`
    );
  }, [messages]);

  return (
    <div className="flex-grow mb-4 space-y-2 px-2 flex flex-col">
      {messages
        // Temporary relaxed filter – helps debug missing assistant messages
        // .filter((msg) => msg?.type || msg?.sender || msg?.isLoading)
        .map((msg) => {
          const isLoading = msg.isLoading || msg.isPending;

          // Prefer type, fall back to sender (old field name safety)
          const type = msg.type || 'user';

          const messageKey = msg.id || `temp-${msg.timestamp || Date.now()}`;

          return (
            <div
              key={messageKey}
              className={`max-w-[70%] p-2 rounded-lg break-words transition-all duration-150 ${
                type === 'user' || type === 'human'
                  ? 'bg-teal-600 self-end text-white'
                  : type === 'ai' || type === 'assistant' || type === 'avatar'
                    ? 'bg-indigo-700 self-start text-white'
                    : 'bg-indigo-700 self-center italic text-gray-300'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div
                      className="w-2 h-2 bg-white rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className="w-2 h-2 bg-white rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <div
                      className="w-2 h-2 bg-white rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  {msg.content && (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}

                  {msg.media?.length > 0 &&
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

                  <div className="text-xs text-gray-400 mt-1 text-right select-none">
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
