import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import CreateAvatarModal from './components/CreateAvatarModal';
import VantaBackground from './components/VantaBackground';
import { useAuth } from './context/AuthContext';
import { useMedia } from './context/MediaContext';
import { Toaster } from 'react-hot-toast';
import LiveChat from './components/LiveChat';

import { Routes, Route, Navigate, Outlet } from 'react-router-dom';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-green-900 text-white relative overflow-hidden">
      <VantaBackground />

      <Toaster
        position="top-center"
        containerStyle={{ zIndex: 99999 }}
        toastOptions={{
          style: { boxShadow: 'none', zIndex: 99999 },
          className: 'z-[99999]',
        }}
      />

      <div className="relative z-10 flex flex-col h-screen">
        <main className="flex-grow overflow-hidden flex items-center justify-center">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
