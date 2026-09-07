import SecureImage from './SecureImage';

/**
 * The attachments on a sent message: image, audio, video, or a download link.
 * Message mode and voice-mode captions share this so a file looks the same
 * in both places.
 *
 * @param {Object} props
 * @param {Array<{id?: string, filename?: string, name?: string, type?: string, content_type?: string, url?: string}>} [props.media]
 */
const MessageMedia = ({ media }) => {
  if (!media?.length) return null;
  return media.map((item, index) => (
    <div key={item.id || item.filename || index} className="mt-2">
      {item.type === 'image' || item.content_type?.startsWith('image/') ? (
        <SecureImage
          mediaUrl={item.url}
          filename={item.filename || item.name}
        />
      ) : item.type === 'audio' || item.content_type?.startsWith('audio/') ? (
        <audio controls src={item.url} />
      ) : item.type === 'video' || item.content_type?.startsWith('video/') ? (
        <video controls className="max-w-full max-h-64" src={item.url} />
      ) : (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-amber-300"
        >
          {item.filename || item.name || 'Download file'}
        </a>
      )}
    </div>
  ));
};

export default MessageMedia;
