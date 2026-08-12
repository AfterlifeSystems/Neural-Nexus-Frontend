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
import BillingManagement from './components/BillingManagement';
import { useAuth } from './context/AuthContext';
import VantaBackground from './components/VantaBackground.jsx';
import QrBadge from './components/QrBadge';

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
          {/* Outside the routes: the code belongs to the product, not to any
              one screen, so it is present wherever the user is. */}
          <QrBadge />
          <Routes>
            {/* Public landing pages */}
            <Route path="/welcome" element={<LandingPage />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />

            {/* Login and signup are public. They are one component: /signup
                only opens it on the account-creation view, which is otherwise
                reached by the "Sign up" toggle inside it. Without this route
                /signup falls through to the catch-all below and renders the
                landing page. */}
            <Route path="/login" element={<AuthComponent />} />
            <Route
              path="/signup"
              element={<AuthComponent initialView="signup" />}
            />
            <Route path="/*" element={<LandingPage />} />

            {/* All protected routes under one layout. ProtectedRoute renders
                the application sidebar around them, so account settings and
                billing are reachable from every page rather than only from
                whichever screen happens to link to them. */}
            <Route element={<ProtectedRoute />}>
              <Route path="/avatars" element={<AvatarSelectionComponent />} />
              <Route path="/chat/:avatarId" element={<ChatArea />} />
              <Route path="/account" element={<AccountSettings />} />
              <Route path="/billing" element={<BillingManagement />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </MediaProvider>
    </AuthProvider>
  </>
);
