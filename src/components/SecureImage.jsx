import { useEffect, useState } from 'react';

const SecureImage = ({ mediaUrl, filename }) => {
  const [imageSrc, setImageSrc] = useState(null);

  useEffect(() => {
    if (mediaUrl) {
      setImageSrc(mediaUrl);
    } else {
      console.warn('SecureImage: no mediaUrl provided.');
    }
  }, [mediaUrl]);

  if (!imageSrc)
    return <div className="text-xs text-gray-400 italic">Loading image...</div>;

  return (
    <img
      src={imageSrc}
      alt={filename}
      className="max-w-full max-h-64 object-contain rounded border border-white"
    />
  );
};

export default SecureImage;
