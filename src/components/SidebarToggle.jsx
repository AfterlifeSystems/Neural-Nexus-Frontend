import React from 'react';
import { User, Trash2, Sidebar } from 'lucide-react';

export default function SidebarToggle({
  avatars,
  activeAvatar,
  setActiveAvatar,
  deleteAvatar,
}) {
  return (
    <div className="w-80 bg-black/50 backdrop-blur-lg rounded-2xl p-6 border border-white/10 ">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <User size={20} />
        Your Avatars
      </h2>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {avatars.map((avatar) => (
          <div
            key={avatar.id}
            className={`p-4 rounded-xl cursor-pointer transition-all duration-300 ${
              activeAvatar?.id === avatar.id
                ? 'bg-gradient-to-r from-neutral-100/15 to-neutral-100/5 border border-neutral-400/50'
                : 'bg-black/60 hover:bg-white/10 border border-transparent'
            }`}
            onClick={() => setActiveAvatar(avatar)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{avatar.name}</h3>
                <p className="text-sm text-neutral-300 mt-1">
                  {avatar.description || 'No description'}
                </p>
                <div className="flex gap-4 mt-2 text-xs text-neutral-400">
                  <span>{avatar.documents.length} docs</span>
                  <span>{avatar.images.length} images</span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteAvatar(avatar.id);
                }}
                className="text-red-400 hover:text-red-300 p-1 rounded transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
