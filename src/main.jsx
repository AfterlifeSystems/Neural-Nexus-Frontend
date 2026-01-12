// main.jsx

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import { MediaProvider } from './context/MediaContext.jsx';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './components/Landing/LandingPage.jsx';
import PrivacyPolicy from './components/Landing/PrivacyPolicy.jsx';
import TermsOfService from './components/Landing/TermsOfService.jsx';
import { ToastContainer, Zoom } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AuthCallback from './components/AuthCallback.jsx';
import ResetPassword from './components/ResetPassword.jsx';

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
            {/* Home/Landing Page */}
            <Route path="/" element={<LandingPage />} />

            {/* Main App: All /app routes handled inside App.jsx */}
            <Route path="/app/*" element={<App />} />

            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />

            {/* Auth Callback - handles email verification, OAuth returns, etc. */}
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Password Reset Page */}
            <Route path="/auth/reset-password" element={<ResetPassword />} />
          </Routes>
        </BrowserRouter>
      </MediaProvider>
    </AuthProvider>
  </StrictMode>
);
