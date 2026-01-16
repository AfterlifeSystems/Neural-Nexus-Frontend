// main.jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { MediaProvider } from './context/MediaContext.jsx';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer, Zoom } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import LandingPage from './components/Landing/LandingPage.jsx';
import PrivacyPolicy from './components/Landing/PrivacyPolicy.jsx';
import TermsOfService from './components/Landing/TermsOfService.jsx';
import ProtectedRoute from './components/ProtectedRoute';
import AvatarSelectionComponent from './components/AvatarSelectionComponent';
import AuthComponent from './components/AuthComponent';
import ChatArea from './components/ChatArea';
import BillingDashboard from './components/BillingDashboard';
import AccountSettings from './components/AccountSettings';
import { useAuth } from './context/AuthContext';
import VantaBackground from './components/VantaBackground.jsx';
import { getAuth } from 'firebase/auth';
// Root redirect component – decides where authenticated users land
const RootRedirect = () => {
  // const { user, loading, accessToken } = useAuth();
  const user = getAuth().currentUser;

  // if (loading) return null;

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
          <VantaBackground />
          <ToastContainer
            position="top-center"
            autoClose={false}
            closeOnClick
            transition={Zoom}
          />

          <Routes>
            {/* Public landing pages */}
            {/* <Route path="/" element={<RootRedirect />} /> */}
            <Route path="/welcome" element={<LandingPage />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />

            {/* Login is public */}
            <Route path="/login" element={<AuthComponent />} />

            {/* All protected routes under one layout */}
            <Route element={<ProtectedRoute />}>
              <Route path="/avatars" element={<AvatarSelectionComponent />} />
              <Route path="/chat/:avatarId" element={<ChatArea />} />
              <Route path="/billing" element={<BillingDashboard />} />
              <Route path="/account" element={<AccountSettings />} />
            </Route>

            {/* Catch-all redirect to root */}
            <Route path="/*" element={<Navigate to="/avatars" replace />} />
          </Routes>
        </BrowserRouter>
      </MediaProvider>
    </AuthProvider>
  </StrictMode>
);
