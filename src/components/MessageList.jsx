// src/components/MessageList.jsx
import React, { useEffect } from 'react';
import { User } from 'lucide-react';
import SecureImage from './SecureImage';
import InterruptPanel from './InterruptPanel';
import { useMedia } from '../context/MediaContext';
import { useAuth } from '../context/AuthContext';
import { isValidImageUrl } from './utils';

/**
 * The face beside a message: whoever said it.
 *
 * Both sides get one so a long conversation stays readable at a glance without
 * relying on which edge a bubble is stuck to. A portrait is often absent — a
 * new avatar has none until one is uploaded — so the placeholder is the normal
 * case rather than an error state.
 */
const MessageAuthorIcon = ({ portrait, name }) => (
  <div className="w-8 h-8 shrink-0 rounded-full bg-white/10 border border-white/20 overflow-hidden flex items-center justify-center">
    {portrait && isValidImageUrl(portrait) ? (
      <img src={portrait} alt={name} className="w-full h-full object-cover" />
    ) : (
      <User className="w-4 h-4 text-white/40" />
    )}
  </div>
);

const MessageList = ({
  messages,
  messagesEndRef,
  avatarPortrait,
  avatarName,
  onInterruptDecision,
}) => {
  const { assistantActivity } = useMedia();
  const { userPortrait } = useAuth();

  useEffect(() => {
    if (messagesEndRef?.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, messagesEndRef]);

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
          const isFromUser = type === 'user' || type === 'human';
          const isFromAvatar =
            type === 'ai' || type === 'assistant' || type === 'avatar';

          return (
            <React.Fragment key={messageKey}>
              <div
                className={`flex items-end gap-2 max-w-[85%] ${
                  isFromUser ? 'self-end flex-row-reverse' : 'self-start'
                }`}
              >
                {(isFromUser || isFromAvatar) && (
                  <MessageAuthorIcon
                    portrait={isFromUser ? userPortrait : avatarPortrait}
                    name={isFromUser ? 'You' : (avatarName ?? 'Avatar')}
                  />
                )}
                <div
                  className={`p-2 rounded-lg break-words transition-all duration-150 ${
                    isFromUser
                      ? 'bg-teal-600 text-white'
                      : isFromAvatar
                        ? 'bg-indigo-700 text-white'
                        : 'bg-indigo-700 italic text-gray-300'
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
                                {media.filename ||
                                  media.name ||
                                  'Download file'}
                              </a>
                            )}
                          </div>
                        ))}

                      <div className="text-xs text-gray-400 mt-1 text-right select-none">
                        {msg.timestamp &&
                          new Date(msg.timestamp).toLocaleTimeString(
                            undefined,
                            {
                              hour: '2-digit',
                              minute: '2-digit',
                            }
                          )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* A paused turn renders its card beneath the message that raised
                it, rather than in a modal: the question belongs to this point
                in the conversation, and it stays readable once the turn
                resumes and later messages arrive. Dispatching on `kind` is
                what lets other interrupt types render here later without
                touching this component. */}
              {msg.interrupt?.kind === 'connect_account' && (
                <ConnectAccountCard
                  interrupt={msg.interrupt}
                  onDecision={(decision) =>
                    onInterruptDecision?.({
                      decision,
                      threadId: msg.interruptThreadId,
                      assistantId: msg.interruptAssistantId,
                    })
                  }
                />
              )}
            </React.Fragment>
          );
        })}

      {/* The question a paused turn is asking, if one is. This sits where the
          assistant's next message would have gone, because that is what it
          stands in for: the turn produced this instead of a reply, and cannot
          continue until it is answered. */}
      <InterruptPanel />

      {/* What the avatar is doing, for as long as it is doing it.
          This sits outside the message bubbles on purpose. The bouncing-dots
          indicator lives inside the pending message and vanishes the moment the
          first token lands — but the longest silence of a turn comes AFTER the
          text, while the reply is analysed. Tying the status to the dots would
          hide it during exactly the pause that makes a working avatar look
          stuck. */}
      {assistantActivity && (
        <div className="self-start flex items-center gap-2 px-2 py-1 text-xs text-white/70 italic">
          <span className="w-1.5 h-1.5 bg-teal-300 rounded-full animate-pulse" />
          {assistantActivity}…
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
