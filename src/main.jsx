// main.jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { MediaProvider } from './context/MediaContext.jsx';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import 'react-toastify/dist/ReactToastify.css';
import LandingPage from './components/Landing/LandingPage.jsx';
import PrivacyPolicy from './components/Landing/PrivacyPolicy.jsx';
import TermsOfService from './components/Landing/TermsOfService.jsx';
import ProtectedRoute from './components/ProtectedRoute';
import AvatarSelectionComponent from './components/AvatarSelectionComponent';
import AuthComponent from './components/AuthComponent';
import ChatArea from './components/ChatArea';

import AccountSettings from './components/AccountSettings';
import { useAuth } from './context/AuthContext';
import VantaBackground from './components/VantaBackground.jsx';

import { toast, Toaster } from 'react-hot-toast';

createRoot(document.getElementById('root')).render(
  <>
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 5000,
        style: {
          background: 'rgba(30,30,40,0.95)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.12)',
        },
      }}
    />
    <VantaBackground />
    <AuthProvider>
      <MediaProvider>
        <BrowserRouter>
          <Routes>
            {/* Public landing pages */}
            <Route path="/welcome" element={<LandingPage />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />

            {/* Login is public */}
            {/* <Route path="/login" element={<AuthComponent />} /> */}
            <Route path="/*" element={<LandingPage />} />

            {/* All protected routes under one layout */}
            <Route element={<ProtectedRoute />}>
              <Route path="/avatars" element={<AvatarSelectionComponent />} />
              <Route path="/chat/:avatarId" element={<ChatArea />} />
              {/* <Route path="/account" element={<AccountSettings />} /> */}
            </Route>
          </Routes>
        </BrowserRouter>
      </MediaProvider>
    </AuthProvider>
  </>
);
