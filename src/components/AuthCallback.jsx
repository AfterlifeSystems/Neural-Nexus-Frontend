// src/components/AuthCallback.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRedirectResult, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase/config.js';
import LoadingSpinner from './LoadingSpinner';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Handle OAuth redirect result (e.g., Google sign-in)
        const result = await getRedirectResult(auth);

        if (result) {
          // User successfully signed in via OAuth redirect
          console.log('✅ OAuth callback successful');
          navigate('/app', { replace: true });
        } else {
          // Check if user is already signed in (e.g., email verification link)
          if (auth.currentUser) {
            console.log('✅ User already authenticated');
            navigate('/app', { replace: true });
          } else {
            // No authentication result, redirect to home
            console.log('No auth result, redirecting to home');
            navigate('/', { replace: true });
          }
        }
      } catch (err) {
        console.error('Unexpected error in auth callback:', err);
        setError(err.message || 'Authentication failed');
        setTimeout(() => navigate('/'), 3000);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">
            ❌ Authentication Error
          </div>
          <p className="text-white/60 mb-4">{error}</p>
          <p className="text-white/40 text-sm">Redirecting to home...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <LoadingSpinner />
        <p className="text-white/60 mt-4">Completing authentication...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
