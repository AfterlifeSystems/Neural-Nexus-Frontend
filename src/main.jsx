// main.jsx

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import { MediaProvider } from './context/MediaContext.jsx';
import ReactDOM from 'react-dom/client';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import LandingPage from './components/Landing/LandingPage.jsx';
import PrivacyPolicy from './components/Landing/PrivacyPolicy.jsx';
import TermsOfService from './components/Landing/TermsOfService.jsx';
import { ToastContainer, Zoom } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AuthCallback from './components/AuthCallback.jsx';
import ResetPassword from './components/ResetPassword.jsx';

import { useAuth } from './context/AuthContext';

import ProtectedRoute from './components/ProtectedRoute';
import ChatArea from './components/ChatArea';
import BillingDashboard from './components/BillingDashboard';
import AvatarSelectionComponent from './components/AvatarSelectionComponent';
import AuthComponent from './components/AuthComponent';

import AccountSettings from './components/AccountSettings';

// Add this component helper at the bottom of main.jsx or in a new file
const RootRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  // If logged in, let the App.jsx handle the root (it will redirect to /avatars)
  // If not logged in, send to welcome
  return user ? (
    <Navigate to="/avatars" replace />
  ) : (
    <Navigate to="/welcome" replace />
  );
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <MediaProvider>
        <BrowserRouter>
          <ToastContainer
            position="top-center"
            autoClose={false}
            closeOnClick={true}
            transition={Zoom}
          />
          <Routes>
            <Route path="/" element={<RootRedirect />} />

            {/* Main App: All /app routes handled inside App.jsx */}
            {/* <Route path="/*" element={<App />} /> */}

            {/* Home/Landing Page */}
            <Route path="/welcome" element={<LandingPage />} />

            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            {/* 2. Wrap everything else in the App Layout */}
            <Route element={<App />}>
              {/* Auth Callback - handles email verification, OAuth returns, etc. */}
              {/* <Route path="/auth/callback" element={<AuthCallback />} /> */}

              {/* Password Reset Page */}
              {/* <Route path="/auth/reset-password" element={<ResetPassword />} /> */}

              {/* Public inside the app */}
              <Route path="login" element={<AuthComponent />} />

              {/* Protected by the gatekeeper */}
              <Route
                path="avatars"
                element={
                  <ProtectedRoute>
                    <AvatarSelectionComponent />
                  </ProtectedRoute>
                }
              />

              <Route
                path="chat/:avatarId"
                element={
                  <ProtectedRoute>
                    <ChatArea />
                  </ProtectedRoute>
                }
              />

              <Route
                path="billing"
                element={
                  <ProtectedRoute>
                    <BillingDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="account"
                element={
                  <ProtectedRoute>
                    <AccountSettings />
                  </ProtectedRoute>
                }
              />
            </Route>
            {/* Default behavior: redirect / */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </MediaProvider>
    </AuthProvider>
  </StrictMode>
);
