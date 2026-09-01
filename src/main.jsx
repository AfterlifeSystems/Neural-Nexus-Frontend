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
import SharedAvatarLayout from './components/SharedAvatarLayout';
import SharedAvatarChat from './components/SharedAvatarChat';
import { useAuth } from './context/AuthContext';
import VantaBackground from './components/VantaBackground.jsx';
import QrBadge from './components/QrBadge';

import { toast, Toaster, ToastBar } from 'react-hot-toast';

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
    >
      {/* Press a notice to dismiss it, rather than waiting out its five
          seconds. Two kinds are deliberately left alone:

          * A progress toast (`toast.loading`, used by the media uploads in
            AvatarSettings) reports work that is still running and is closed by
            the code that finishes it. Letting a press remove it would take away
            the only sign that an upload is under way.
          * A notice that never times out (`duration: Infinity`) is one the
            reader has to answer rather than read — the billing refusal in
            requestFailureToast.jsx is the case: it offers to open billing and
            is closed by its own Close button. Dismissing it with a stray press
            would take away a decision the reader has not made yet.

          The billing card is doubly protected: it is a `toast.custom`, and
          react-hot-toast never routes those through this function at all. The
          duration test is what keeps the exclusion true if that card is ever
          rebuilt as an ordinary toast, when the custom-toast accident would
          quietly stop covering it. */}
      {(activeToast) =>
        activeToast.type === 'loading' ||
        activeToast.duration === Infinity ? (
          <ToastBar toast={activeToast} />
        ) : (
          <div
            role="button"
            tabIndex={0}
            aria-label="Dismiss notification"
            title="Click to dismiss"
            style={{ cursor: 'pointer' }}
            onClick={() => toast.dismiss(activeToast.id)}
            onKeyDown={(keyboardEvent) => {
              if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                keyboardEvent.preventDefault();
                toast.dismiss(activeToast.id);
              }
            }}
          >
            <ToastBar toast={activeToast} />
          </div>
        )
      }
    </Toaster>
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
            {/* A shared avatar link. Public by design: the person following it
                has no account, chats as the anonymous identity the API resolves
                for a caller with no credential, and sees one avatar and nothing
                else of the application. The avatar is served only while it is
                shared, so withdrawing it closes this door. */}
            <Route path="/share/:avatarId" element={<SharedAvatarLayout />}>
              <Route index element={<SharedAvatarChat />} />
              {/* Billing is offered to visitors too — the customer portal has
                  its own sign-in — so it cannot live behind the guard that
                  /billing sits behind. */}
              <Route
                path="billing"
                element={<BillingManagement showAccountMenu={false} />}
              />
            </Route>

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
