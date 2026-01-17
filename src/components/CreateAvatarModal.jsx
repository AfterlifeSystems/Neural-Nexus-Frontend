import React, { useState, useEffect } from 'react';
import { UserPenIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { createAvatar } from '../services/avatarService';
import { useAuth } from '../context/AuthContext';

const CreateAvatarModal = ({ setShowCreateModal }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newAvatarName, setNewAvatarName] = useState('');
  const [newAvatarDescription, setNewAvatarDescription] = useState('');
  const { user } = useAuth();

  const handleCreate = async () => {
    if (!newAvatarName.trim()) {
      setError('Avatar name is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const created = await createAvatar(
        user,
        newAvatarName,
        newAvatarDescription,
        null
      );
      if (created) {
        setShowCreateModal(false);
        setNewAvatarName('');
        setNewAvatarDescription('');
        // toast.success('Avatar created successfully');
      } else {
        setError('Failed to create avatar');
        toast.error('Failed to create avatar');
      }
    } catch (err) {
      const errorMessage = err.message.includes('detail')
        ? JSON.parse(err.message).detail
        : err.message || 'Failed to create avatar';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Create avatar error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowCreateModal]);

  return (
    <div
      className="fixed inset-0 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 bg-opacity-75 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-avatar-title"
    >
      <div className="bg-gray/20 p-4 sm:p-6 rounded-lg w-[90vw] sm:w-96 max-w-full">
        <h2
          id="create-avatar-title"
          className="text-xl font-semibold mb-4 text-white"
        >
          <div className="flex items-center gap-2">
            <UserPenIcon className="w-6 h-6" />
            <span className="portrait:hidden">Create Avatar</span>
          </div>
        </h2>
        {error && (
          <div className="mb-4 text-red-500 text-sm" role="alert">
            {error}
          </div>
        )}
        <label className="block mb-2 text-xl sm:text-2xl text-gray-300">
          Name
          <input
            type="text"
            value={newAvatarName}
            onChange={(e) => setNewAvatarName(e.target.value)}
            placeholder="Name the Avatar"
            className="w-full p-2 mt-1 rounded bg-black/35 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all duration-300"
            autoFocus
            aria-required="true"
            disabled={loading}
          />
        </label>
        <label className="block mb-4 text-xl sm:text-2xl text-gray-300">
          Description
          <textarea
            value={newAvatarDescription}
            onChange={(e) => setNewAvatarDescription(e.target.value)}
            placeholder="Describe your avatar in 50 characters or less (Optional)"
            className="w-full p-2 mt-1 rounded bg-black/35 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all duration-300"
            rows={3}
            aria-multiline="true"
            disabled={loading}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowCreateModal(false)}
            className="px-4 py-2 rounded bg-black/35 text-white border border-gray-700 hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all duration-300 transform hover:scale-105"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded bg-black/35 text-white border border-gray-700 hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
            disabled={loading || !newAvatarName.trim()}
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateAvatarModal;
