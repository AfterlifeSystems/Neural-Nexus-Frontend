import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import Dropzone from 'react-dropzone';
import {
  ExternalLink,
  Trash2,
  Edit3,
  Upload,
  Link,
  File,
  Image,
  Video,
  Music,
  FileText,
  Globe,
  Youtube,
  Facebook,
  Instagram,
  Twitter,
  Twitch,
  X,
  Camera,
  Mic,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../context/AuthContext';
import {
  // uploadUrl,
  // connectSocial,
  // disconnectSocial,
  deleteDocument,
  // uploadDocuments,
  updateAvatarWithIcon,
  selectAvatar,
  deleteAvatar,
  updateAvatar,
  uploadToDataLoadingApi,
} from '../services/avatarService';
import { useNavigate } from 'react-router-dom';

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db, storage } from '../firebase/config';

// Social Media Platform Configuration
const SOCIAL_PLATFORMS = [
  { id: 'youtube', name: 'YouTube', icon: Youtube, color: '#FF0000' },
  { id: 'google', name: 'Google', icon: Globe, color: '#4285F4' },
  { id: 'apple', name: 'Apple', icon: Globe, color: '#000000' },
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: '#1877F2' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: '#E4405F' },
  { id: 'twitch', name: 'Twitch', icon: Twitch, color: '#9146FF' },
  { id: 'twitter', name: 'X.com', icon: Twitter, color: '#000000' },
  { id: 'grok', name: 'Grok', icon: Globe, color: '#1DA1F2' },
  { id: 'claude', name: 'Claude', icon: Globe, color: '#8B4513' },
  { id: 'chatgpt', name: 'ChatGPT', icon: Globe, color: '#10A37F' },
  { id: 'microsoft', name: 'Microsoft', icon: Globe, color: '#00A4EF' },
  { id: 'reddit', name: 'Reddit', icon: Globe, color: '#FF4500' },
];
const AvatarSettings = ({ avatarId, accessToken }) => {
  const [links, setLinks] = useState([]);
  const [newLink, setNewLink] = useState('');
  const [files, setFiles] = useState([]);
  const [editingDesc, setEditingDesc] = useState(false);
  const [updatedDesc, setUpdatedDesc] = useState('');
  const [updatedAvatarName, setUpdatedAvatarName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // New state for document management
  const [isDragging, setIsDragging] = useState(false);
  const [socialLogins, setSocialLogins] = useState([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [loginCredentials, setLoginCredentials] = useState({
    username: '',
    password: '',
  });
  const [manualUrl, setManualUrl] = useState('');
  const { user, profile, activeAvatar, isLoading, setIsLoading } = useAuth();
  const navigate = useNavigate();

  // Global drag and drop handlers
  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault();
      if (
        e.dataTransfer.types.includes('Files') ||
        e.dataTransfer.types.includes('text/uri-list')
      ) {
        setIsDragging(true);
      }
    };
    const handleDragOver = (e) => {
      e.preventDefault();
    };
    const handleDragLeave = (e) => {
      if (
        e.target === document.body ||
        !document.body.contains(e.relatedTarget)
      ) {
        setIsDragging(false);
      }
    };
    const handleDrop = async (e) => {
      e.preventDefault();
      setIsDragging(false);
      await handleFileUpload(e);
    };
    const handlePaste = async (e) => {
      const text = e.clipboardData.getData('text/plain');
      if (text.startsWith('http://') || text.startsWith('https://')) {
        await handleUrlUpload(text);
      }
    };
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
      document.removeEventListener('paste', handlePaste);
    };
  }, []);

  const determineContentType = (file) => {
    const type = file.type;
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('audio/')) return 'audio';
    if (type.startsWith('video/')) return 'video';
    if (type === 'application/pdf') return 'pdf';
    if (type.startsWith('text/') || type === 'application/json') return 'text';
    const filename = file.name.toLowerCase();
    if (filename.endsWith('.pdf')) return 'pdf';
    if (
      filename.endsWith('.txt') ||
      filename.endsWith('.md') ||
      filename.endsWith('.json')
    )
      return 'text';
    return 'file';
  };
  const handleFileUpload = async (e) => {
    console.log('ENTRYPOINT HANDLE FILE UPLOAD');
    const filesList = e.dataTransfer?.files || e.target?.files || [];
    if (filesList.length === 0) return;
    try {
      if (!user) throw new Error('Not logged in');
      if (!activeAvatar) throw new Error('No active avatar');

      const newPending = Array.from(filesList).map((file) => ({
        id: uuidv4(),
        name: file.name,
        type: determineContentType(file),
        loading: true,
        previewUrl: URL.createObjectURL(file),
        file, // keep file ref for upload
      }));

      for (const pending of newPending) {
        const loadingToastId = toast.loading(`Uploading ${pending.name}...`, {
          position: 'bottom-left',
        });
        const file = pending.file;
        console.log(`activeAvatar: ${activeAvatar}`);
        try {
          const uploadResults = await uploadToDataLoadingApi(
            user.id,
            activeAvatar.assistant_id,
            activeAvatar.name,
            [file]
          );

          console.log(`uploadResults: ${JSON.stringify(uploadResults)}`);

          if (!uploadResults[0].success) {
            throw new Error(uploadResults[0].error);
          }
          toast.dismiss(loadingToastId);
          // toast.message(`${pending.name} uploaded successfully`);
          // toast.message(`Successful Upload Results: ${uploadResults}`);
          toast.success(`${pending.name} uploaded successfully`, {
            position: 'bottom-left',
          });
        } catch (error) {
          toast.dismiss(loadingToastId);
          toast.error(`Failed to upload ${file.name}: ${error.message}`, {
            position: 'bottom-left',
          });
        }
      }
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
      console.error('Upload error:', err);
    }
  };
  const handleUrlUpload = async (url) => {
    const tempId = uuidv4();
    const tempDoc = {
      id: tempId,
      name: url,
      type: 'web',
      loading: true,
    };
    try {
      if (!user) throw new Error('Not logged in');
      if (!activeAvatar) throw new Error('No active avatar');
      const docMeta = await uploadUrl(
        user.id,
        activeAvatar.avatar_id,
        url,
        activeAvatar.name
      );
      const avatarRef = doc(
        db,
        'users',
        user.id,
        'avatars',
        activeAvatar.avatar_id
      );
      await updateDoc(avatarRef, {
        files: arrayUnion(docMeta),
      });
      toast.success('URL added successfully');
    } catch (err) {
      toast.error('URL upload failed: ' + err.message);
    }
  };
  const handleSocialLogin = (platform) => {
    setSelectedPlatform(platform);
    setShowLoginModal(true);
  };
  const submitSocialLogin = async () => {
    if (!loginCredentials.username || !loginCredentials.password) return;
    try {
      if (!user) throw new Error('Not logged in');
      const login = await connectSocial(
        user.id,
        activeAvatar.avatar_id,
        selectedPlatform,
        loginCredentials.username,
        loginCredentials.password
      );
      setSocialLogins((prev) => [...prev, login]);
      toast.success(
        `Connected to ${
          SOCIAL_PLATFORMS.find((p) => p.id === selectedPlatform)?.name
        }`
      );
      setShowLoginModal(false);
      setLoginCredentials({ username: '', password: '' });
      setSelectedPlatform(null);
    } catch (err) {
      toast.error('Social login failed: ' + err.message);
    }
  };
  const removeSocialLogin = async (id) => {
    try {
      if (!user) throw new Error('Not logged in');
      await disconnectSocial(user.id, activeAvatar.avatar_id, id);
      setSocialLogins((prev) => prev.filter((login) => login.id !== id));
      toast.success('Social account disconnected');
    } catch (err) {
      toast.error('Failed to disconnect: ' + err.message);
    }
  };
  const getSocialUrl = (platform, username) => {
    const urls = {
      youtube: `https://youtube.com/@${username}`,
      google: `https://myaccount.google.com/`,
      apple: `https://appleid.apple.com/`,
      facebook: `https://facebook.com/${username}`,
      instagram: `https://instagram.com/${username}`,
      twitch: `https://twitch.tv/${username}`,
      twitter: `https://x.com/${username}`,
      grok: `https://x.com/i/grok`,
      claude: `https://claude.ai/`,
      chatgpt: `https://chat.openai.com/`,
      microsoft: `https://account.microsoft.com/`,
      reddit: `https://reddit.com/user/${username}`,
    };
    return urls[platform] || '#';
  };
  const deleteDocument = async (id) => {
    try {
      if (!user) throw new Error('Not logged in');
      await deleteDocument(user.id, activeAvatar.avatar_id, id);
      toast.success('Document deleted');
    } catch (err) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  const renderDocumentPreview = (doc) => {
    if (doc.loading) {
      return (
        <div className="flex items-center justify-center h-48 bg-white/5 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
        </div>
      );
    }
    const src = doc.previewUrl || doc.url;
    switch (doc.type) {
      case 'image':
        return (
          <div className="relative w-full h-48 bg-white/5 rounded-lg overflow-hidden">
            <img
              src={src}
              alt={doc.name}
              className="w-full h-full object-cover"
            />
          </div>
        );
      case 'video':
        return (
          <div className="relative w-full h-48 bg-white/5 rounded-lg overflow-hidden">
            <video src={src} controls className="w-full h-full object-cover" />
          </div>
        );
      case 'audio':
        return (
          <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
            <Music className="text-blue-400" size={32} />
            <audio src={src} controls className="flex-1" />
          </div>
        );
      case 'pdf':
      case 'text':
        return (
          <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
            <FileText className="text-red-400" size={32} />
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline flex items-center gap-2"
            >
              Open File <ExternalLink size={16} />
            </a>
          </div>
        );
      case 'youtube':
      case 'twitter':
      case 'web':
        return (
          <div className="p-4 bg-white/5 rounded-lg">
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline flex items-center gap-2"
            >
              <Globe size={20} />
              {doc.url}
              <ExternalLink size={16} />
            </a>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
            <File className="text-white/50" size={32} />
            <span className="text-white">{doc.name}</span>
          </div>
        );
    }
  };
  const getTypeIcon = (type) => {
    switch (type) {
      case 'image':
        return <Image className="text-green-400" />;
      case 'video':
        return <Video className="text-purple-400" />;
      case 'audio':
        return <Music className="text-blue-400" />;
      case 'pdf':
        return <FileText className="text-red-400" />;
      case 'text':
        return <FileText className="text-yellow-400" />;
      default:
        return <Globe className="text-cyan-400" />;
    }
  };
  // Camera capture handler
  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      mediaStreamRef.current = stream;
      setCaptureMode('camera');
      setShowCaptureModal(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      toast.error('Camera access denied or unavailable');
    }
  };
  const capturePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.95)
    );
    const file = new File([blob], 'avatar-photo.jpg', { type: 'image/jpeg' });
    try {
      // if (!user) throw new Error('Not logged in');
      // const uploaded = await uploadDocuments(user.id, activeAvatar.avatar_id, [
      //   file,
      // ]);
      // if (uploaded && uploaded.length > 0)
      //   setDocuments((prev) => [...prev, ...uploaded]);
      // cleanupMedia();
      toast.success('Photo captured successfully');
    } catch (err) {
      toast.error('Photo upload failed: ' + err.message);
      cleanupMedia();
    }
  };
  const VOICE_SCRIPT = `
  Please read the following naturally.
  1. Today is a beautiful day, and I am speaking clearly and comfortably.
  2. The quick brown fox jumps over the lazy dog.
  3. I enjoy learning new things and explaining ideas calmly.
  4. Sometimes I speak softly, and sometimes I speak with confidence.
  5. Numbers: zero, one, two, three, four, five, six, seven, eight, nine.
  6. Emotions: I am happy. I am curious. I am thoughtful. I am focused.
  7. Finally, describe something you enjoy doing in your free time.
  `;
  // Audio recording handler
  const handleAudioRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
      });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = uploadAudioRecording;
      mediaRecorderRef.current = recorder;
      setCaptureMode('audio');
      setShowCaptureModal(true);
    } catch (err) {
      toast.error('Microphone access denied or unavailable');
    }
  };
  const handleIconUpload = async (acceptedFiles) => {
    const formData = new FormData();
    formData.append('icon', acceptedFiles[0]);
    formData.append('avatar_id', activeAvatar.avatar_id);
    try {
      if (!user) throw new Error('Not logged in');
      await updateAvatarWithIcon(
        user.id,
        activeAvatar.avatar_id,
        acceptedFiles[0]
      );
      toast.success('Avatar icon updated');
    } catch (err) {
      toast.error(err.message);
    }
  };
  const handleDescSave = async (updatedDesc) => {
    try {
      if (!user) throw new Error('Not logged in');
      await updateAvatar(user.id, activeAvatar.avatar_id, {
        description: updatedDesc,
      });
      const avatarProfileData = await selectAvatar(
        user,
        user.id,
        activeAvatar.avatar_id
      );
      setUpdatedDesc(avatarProfileData.description || '');
      toast.success('Description updated');
    } catch (err) {
      toast.error(err.message);
    }
  };
  const handleUpdateName = async (updatedAvatarName) => {
    try {
      if (!user) throw new Error('Not logged in');
      await updateAvatar(user.id, activeAvatar.avatar_id, {
        name: updatedAvatarName,
      });
      const avatarProfileData = await selectAvatar(
        user,
        user.id,
        activeAvatar.avatar_id
      );
      setUpdatedAvatarName(avatarProfileData.name || '');
      toast.success('Name updated');
    } catch (err) {
      toast.error(err.message);
    }
  };
  const handleDeleteAvatar = async () => {
    if (
      !window.confirm(
        'Are you sure you want to delete this avatar? This action cannot be undone.'
      )
    ) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteAvatar(user.id, activeAvatar.avatar_id);
      toast.success('Avatar deleted successfully');
      navigate('/avatars');
    } catch (err) {
      console.error('Delete avatar error:', err);
      toast.error(err.message || 'Failed to delete avatar');
    } finally {
      setIsDeleting(false);
    }
  };
  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      {/* Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <Upload
              className="mx-auto mb-4 text-white animate-bounce"
              size={80}
            />
            <h2 className="text-3xl font-bold text-white mb-4">
              Drop to Upload
            </h2>
            <p className="text-white/80 text-lg mb-2">
              Supported: Images, Videos, Audio, PDFs, Text Files, URLs
            </p>
            <p className="text-white/60">
              YouTube • Twitter • Wikipedia • Twitch • Web Pages
            </p>
          </div>
        </div>
      )}
      {/* Social Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 max-w-md w-full border border-white/20">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">
                Connect{' '}
                {SOCIAL_PLATFORMS.find((p) => p.id === selectedPlatform)?.name}
              </h3>
              <button
                onClick={() => setShowLoginModal(false)}
                className="text-white/60 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Username"
                value={loginCredentials.username}
                onChange={(e) =>
                  setLoginCredentials((prev) => ({
                    ...prev,
                    username: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                placeholder="Password"
                value={loginCredentials.password}
                onChange={(e) =>
                  setLoginCredentials((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={submitSocialLogin}
                className="w-full px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-semibold rounded-lg transition-all duration-300 border border-blue-500/30"
              >
                Connect Account
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header with Delete Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Avatar Settings</h2>
        <button
          onClick={handleDeleteAvatar}
          disabled={isDeleting}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 rounded-lg transition-all duration-300 border border-red-500/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 size={16} />
          {isDeleting ? 'Deleting...' : 'Delete Avatar'}
        </button>
      </div>
      {/* Avatar Profile Section */}
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Profile Information
        </h3>
        <div className="flex gap-6 items-start">
          {/* Icon Upload */}
          <div className="flex flex-col gap-3">
            {activeAvatar?.icon ? (
              <Dropzone
                onDrop={handleIconUpload}
                multiple={false}
                accept={{ 'image/*': [] }}
                noClick
              >
                {({ getRootProps, getInputProps, open }) => (
                  <div className="relative w-32 h-32 rounded-2xl overflow-hidden cursor-pointer group">
                    <img
                      src={activeAvatar.icon.url}
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                    <div
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
                      onClick={open}
                    >
                      <Edit3 size={24} color="white" />
                    </div>
                    <input {...getInputProps()} />
                  </div>
                )}
              </Dropzone>
            ) : (
              <Dropzone onDrop={handleIconUpload} multiple={false}>
                {({ getRootProps, getInputProps }) => (
                  <div
                    {...getRootProps()}
                    className="w-32 h-32 border-2 border-dashed border-white/30 hover:border-white/50 flex items-center justify-center cursor-pointer rounded-2xl bg-white/5 transition-all duration-300"
                  >
                    <input {...getInputProps()} />
                    <Upload size={32} className="text-white/50" />
                  </div>
                )}
              </Dropzone>
            )}
            {/* Horizontal Button Group */}
            <div className="flex gap-2">
              <button
                onClick={handleCameraCapture}
                className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all duration-300 border border-blue-500/30 flex items-center justify-center"
              >
                <Camera size={16} />
              </button>
              <button
                onClick={handleAudioRecord}
                className="flex-1 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-all duration-300 border border-purple-500/30 flex items-center justify-center"
              >
                <Mic size={16} />
              </button>
            </div>
          </div>
          {/* Name and Description */}
          <div className="flex-grow space-y-4">
            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Name
              </label>
              {editingName ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={updatedAvatarName}
                    onChange={(e) => setUpdatedAvatarName(e.target.value)}
                    placeholder="Enter avatar name"
                    className="flex-grow px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <button
                    onClick={() => {
                      handleUpdateName(updatedAvatarName);
                      setEditingName(false);
                    }}
                    className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all duration-300 border border-blue-500/30"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-300 border border-white/20"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-center px-4 py-2 bg-white/5 border border-white/10 rounded-lg">
                  <span className="text-white font-medium">
                    {activeAvatar?.name}
                  </span>
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-blue-400 hover:text-blue-300 transition-colors duration-300"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
            {/* Description Field */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Description
              </label>
              {editingDesc ? (
                <div className="space-y-2">
                  <textarea
                    value={updatedDesc}
                    onChange={(e) => setUpdatedDesc(e.target.value)}
                    placeholder="Enter description"
                    rows="3"
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        handleDescSave(updatedDesc);
                        setEditingDesc(false);
                      }}
                      className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all duration-300 border border-blue-500/30"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingDesc(false)}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-300 border border-white/20"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-start px-4 py-2 bg-white/5 border border-white/10 rounded-lg min-h-[80px]">
                  <p className="text-white/80 flex-grow">
                    {activeAvatar?.description}
                  </p>
                  <button
                    onClick={() => setEditingDesc(true)}
                    className="text-blue-400 hover:text-blue-300 transition-colors duration-300 ml-4"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Social Media Section */}
      {/* <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
        <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
          <Link size={24} />
          Social Media Accounts
        </h2>
        {socialLogins.length > 0 && (
          <div className="space-y-3 mb-4">
            {socialLogins.map((login) => {
              const platform = SOCIAL_PLATFORMS.find(
                (p) => p.id === login.platform
              );
              const Icon = platform?.icon;
              return (
                <div
                  key={login.id}
                  className="bg-white/10 border border-white/20 rounded-lg p-4 flex items-center justify-between hover:bg-white/15 transition-all duration-300"
                >
                  <a
                    href={getSocialUrl(login.platform, login.username)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 flex-1"
                  >
                    {Icon && (
                      <Icon size={32} style={{ color: platform.color }} />
                    )}
                    <div>
                      <p className="text-white font-semibold">
                        {platform?.name}
                      </p>
                      <p className="text-white/60 text-sm">@{login.username}</p>
                      <p className="text-white/40 text-xs">
                        Connected{' '}
                        {new Date(login.connectedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <ExternalLink size={16} className="text-white/40 ml-auto" />
                  </a>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      removeSocialLogin(login.id);
                    }}
                    className="text-red-400 hover:text-red-300 ml-4 p-2 hover:bg-red-500/20 rounded-lg transition-all duration-300"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {SOCIAL_PLATFORMS.map((platform) => {
            const Icon = platform.icon;
            const isConnected = socialLogins.some(
              (login) => login.platform === platform.id
            );
            return (
              <button
                key={platform.id}
                onClick={() => !isConnected && handleSocialLogin(platform.id)}
                disabled={isConnected}
                className={`p-3 rounded-lg border transition-all duration-300 flex flex-col items-center gap-2 ${
                  isConnected
                    ? 'bg-green-500/20 border-green-500/50 cursor-not-allowed'
                    : 'bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/40'
                }`}
              >
                <Icon size={24} style={{ color: platform.color }} />
                <span className="text-white text-xs">{platform.name}</span>
                {isConnected && (
                  <span className="text-xs text-green-400">Connected</span>
                )}
              </button>
            );
          })}
        </div>
      </div> */}
      {/* Upload Section */}
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
        <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
          <Upload size={24} />
          Upload
        </h2>
        {/* Manual URL Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-white/70 mb-2">
            Add URL
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://example.com or paste any URL"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && manualUrl) {
                  handleUrlUpload(manualUrl);
                  setManualUrl('');
                }
              }}
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => {
                if (manualUrl) {
                  handleUrlUpload(manualUrl);
                  setManualUrl('');
                }
              }}
              disabled={!manualUrl || isLoading}
              className="px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-semibold rounded-lg transition-all duration-300 flex items-center gap-2 border border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload size={20} />
              Add
            </button>
          </div>
        </div>
        <div className="border-2 border-dashed border-white/30 rounded-xl p-8 text-center hover:border-white/50 transition-all duration-300 bg-white/5">
          <Upload className="mx-auto mb-4 text-white/60" size={48} />
          <p className="text-white text-lg mb-2">
            Drag & drop anywhere on the page
          </p>
          <p className="text-white/60 text-sm mb-4">
            or paste URLs with Ctrl+V / Cmd+V
          </p>
          <label className="inline-block px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-semibold rounded-lg cursor-pointer transition-all duration-300 border border-blue-500/30">
            Choose Files
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFileUpload({ target: e.target });
              }}
            />
          </label>
          <p className="text-white/40 text-xs mt-3">
            Images • Videos • Audio • PDFs • Text • URLs
          </p>
        </div>
      </div>
      {/* Documents Section */}

      <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <File size={20} />
          Data Uploaded for {activeAvatar?.name}
        </h3>

        <div className="space-y-2">
          {activeAvatar?.files && activeAvatar?.files.length > 0 ? (
            activeAvatar?.files.map((file, index) => (
              <div
                key={file.id || index}
                className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Determine icon based on file type if available */}
                  <FileText size={18} className="text-blue-400" />
                  <span className="text-white text-sm font-medium">
                    {typeof file === 'string' ? file : file?.name}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">
                    {file.created_at
                      ? new Date(file.created_at).toLocaleDateString()
                      : ''}
                  </span>
                  {/* Add a delete or view button here if needed */}
                  <button
                    onClick={() => deleteDocument(doc.id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-white/40 text-sm italic">
              No files attached to this avatar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
export default AvatarSettings;
