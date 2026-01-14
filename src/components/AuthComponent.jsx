import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  LogIn,
  LogOutIcon,
  UserPlus,
  X,
  SendIcon,
  Github,
  Mail,
  User,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import VantaBackground from './VantaBackground';
import LoadingSpinner from './LoadingSpinner';
import { toast, Toaster } from 'react-hot-toast';
import { signup, login, logout } from '../services/authService';

import { useNavigate } from 'react-router-dom';

const modalRoot =
  document.getElementById('modal-root') ||
  (() => {
    const el = document.createElement('div');
    el.id = 'modal-root';
    document.body.appendChild(el);
    return el;
  })();

const AuthComponent = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  // const [showModal, setShowModal] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [modalView, setModalView] = useState('login'); // 'login', 'signup', 'forgotPassword'

  // Rotating avatar index
  const [rotatingIndex, setRotatingIndex] = useState(0);

  const {
    user,
    // isLoggedIn,
    // login,
    // signup,
    // logout,
    resendVerification,
    forgotPassword,
    signInWithProvider,
    accessToken,
    avatars,
    lastUsedAvatar,
    setActiveAvatar,
  } = useAuth();
  const { setMessages } = useMedia();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Inside AuthComponent.jsx
  useEffect(() => {
    // If the context says we are logged in and have a user profile, go to avatars
    if (user) {
      navigate('/avatars');
    }
  }, [user, navigate]);

  const validIcons = Array.isArray(avatars)
    ? avatars
        .map((a) => a.icon)
        .filter((icon) => typeof icon === 'string' && icon.startsWith('https'))
    : [];

  // Intermittently rotate avatar images

  // This returns the exact image or fallback you should render.
  const getRotatingAvatarIcon = (avatars, rotatingIndex, user) => {
    // Filter only valid URLs
    const validIcons = avatars
      .map((a) => a.icon)
      .filter((icon) => typeof icon === 'string' && icon.startsWith('https'));
    // Case 1: No avatars at all → show User icon
    if (!Array.isArray(avatars) || avatars.length === 0) {
      return null; // This signals: "render <User />"
    }

    // Case 2: Exactly one avatar → show that one avatar
    if (validIcons.length === 1) {
      return avatars[0].icon || null;
    }

    // Case 3: Multiple avatars → rotate through them
    return avatars[rotatingIndex]?.icon || null;
  };

  // Rotation effect (only when there are 2+ avatars)
  useEffect(() => {
    if (!Array.isArray(avatars)) return;

    if (validIcons.length < 2) {
      setRotatingIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setRotatingIndex((prev) => (prev + 1) % validIcons.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [avatars]);

  const avatarToRender = getRotatingAvatarIcon(avatars, rotatingIndex, user);

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (modalView === 'signup') {
        await signup(username, email, password);
        // const res = await signup(username, email, password);
        // Success handled in AuthContext
      } else if (modalView === 'login') {
        await login(email, password);
        // Success handled in AuthContext
      } else if (modalView === 'forgotPassword') {
        await forgotPassword(email);
        // toast.success(
        //   (t) => (
        //     <div className="relative flex flex-col gap-2 p-4 ">
        //       {/* Text + X button in one row */}
        //       <div className="flex justify-between items-start">
        //         {/* Message */}
        //         <p className="pr-4">
        //           Password reset email sent! Check your inbox.
        //         </p>

        //         {/* X button top-right */}
        //         <button
        //           onClick={() => toast.dismiss(t.id)}
        //           className="p-1 bg-red-600 hover:bg-red-500 rounded text-sm"
        //         >
        //           <X size={16} />
        //         </button>
        //       </div>
        //     </div>
        //   ),
        //   { duration: Infinity }
        // );
        setModalView('login');
      }
    } catch (error) {
      // Handle specific error cases
      const errorMsg = error.message || 'Authentication failed';

      if (
        errorMsg.includes('Email not confirmed') ||
        errorMsg.includes('verify your email')
      ) {
        // Email not verified
        // toast.error(
        //   (t) => (
        //     <div className="flex flex-col gap-3">
        //       <p className="font-medium">Please verify your email first</p>
        //       <div className="flex gap-2">
        //         <button
        //           onClick={() => {
        //             resendVerification(email);
        //             toast.dismiss(t.id);
        //           }}
        //           className="px-3 py-1 bg-teal-600 hover:bg-teal-700 rounded text-sm flex items-center gap-1"
        //         >
        //           <SendIcon size={14} />
        //           Resend Email
        //         </button>
        //         <button
        //           onClick={() => toast.dismiss(t.id)}
        //           className="px-3 py-1 bg-red-500 hover:bg-red-500 rounded text-sm"
        //         >
        //           Dismiss
        //         </button>
        //       </div>
        //     </div>
        //   ),
        //   { duration: 10000 }
        // );
      } else if (
        errorMsg.includes('Invalid login credentials') ||
        errorMsg.includes('Invalid email or password')
      ) {
        // Wrong password
        // toast.error(
        //   (t) => (
        //     <div className="flex flex-col gap-3">
        //       <p className="font-medium">Invalid email or password</p>
        //       <div className="flex gap-2">
        //         <button
        //           onClick={() => {
        //             setModalView('forgotPassword');
        //             toast.dismiss(t.id);
        //           }}
        //           className="px-3 py-1 bg-teal-600 hover:bg-teal-700 rounded text-sm"
        //         >
        //           Forgot Password?
        //         </button>
        //         <button
        //           onClick={() => toast.dismiss(t.id)}
        //           className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm"
        //         >
        //           Try Again
        //         </button>
        //       </div>
        //     </div>
        //   ),
        //   { duration: 10000 }
        // );
      } else if (errorMsg.includes('User already registered')) {
        // Already registered
        toast.error(
          (t) => (
            <div className="flex flex-col gap-3">
              <p className="font-medium">Email already registered</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setModalView('login');
                    toast.dismiss(t.id);
                  }}
                  className="px-3 py-1 bg-teal-600 hover:bg-teal-700 rounded text-sm flex items-center gap-1"
                >
                  <LogIn size={14} />
                  Login Instead
                </button>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ),
          { duration: 10000 }
        );
      } else {
        // Generic error
        toast.error(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    try {
      await signInWithProvider(provider);
    } catch (error) {
      toast.error(`${provider} login failed`);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setUsername('');
    setModalView('login');
  };

  return (
    <>
      <Toaster position="top-center" />
      <div className="fixed inset-0 flex items-center justify-center z-[999]">
        {/* <VantaBackground /> */}

        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/0" />

        {/* Modal */}
        <div
          className="relative z-10 p-8 rounded-xl shadow-2xl w-full max-w-md bg-white/5 backdrop-blur-lg border border-white/20"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <>
            {/* relative flex items-center justify-center space-x-4 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 p-16 text-center cursor-pointer hover:bg-white/10 transition-all duration-300 min-h-screen w-full flex flex-col justify-evenly items-center  */}
            <div className="flex jusify-center items-center justify-evenly ">
              <h2 className="text-5xl font-bold text-white mb-6">
                Neural Nexus
              </h2>
            </div>
            {validIcons?.length > 0 && (
              <div className="flex justify-center items-center pb-6">
                <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center">
                  <img
                    src={avatarToRender}
                    alt="Avatar"
                    className="w-32 h-32 rounded-full object-cover transition-opacity duration-500"
                    onError={(e) => {
                      console.error('Avatar failed to load:', e.target.src);
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}
          </>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-white">
              {modalView === 'signup' && 'Create Account'}
              {modalView === 'login' && 'Login'}
              {modalView === 'forgotPassword' && 'Reset Password'}
            </h2>
            {/* <button
            type="button"
            onClick={closeModal}
            className="p-2 hover:bg-red-500/20 rounded-lg text-white transition"
          >
            <X size={24} />
          </button> */}
          </div>

          {isLoading && (
            <div className="flex justify-center mb-4">
              <LoadingSpinner />
            </div>
          )}

          {/* Social Login Buttons (not for password reset) */}
          {/* {modalView !== 'forgotPassword' && (
          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleSocialLogin('google')}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-gray-800 rounded-lg hover:bg-gray-100 transition font-medium"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>

            <button
              onClick={() => handleSocialLogin('github')}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-800 text-white rounded-lg hover:bg-red-500 transition font-medium"
            >
              <Github size={20} />
              Continue with GitHub
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center pt-6">
                <div className="w-full border-t border-white/20"></div>
              </div>
            </div>

            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-transparent text-white/60">
                Or continue with email
              </span>
            </div>
          </div>
        )} */}

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-4">
            {modalView === 'signup' && (
              <div>
                <label className="block text-white/80 mb-2 text-sm font-medium">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-white/40"
                  placeholder="Enter your username"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-white/80 mb-2 text-sm font-medium">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-white/40"
                placeholder="Enter your email"
                required
              />
            </div>

            {modalView !== 'forgotPassword' && (
              <div>
                <label className="block text-white/80 mb-2 text-sm font-medium">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-white/40"
                  placeholder="Enter your password"
                  required
                  minLength={6}
                />
              </div>
            )}

            {/* Forgot Password Link */}
            {modalView === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setModalView('forgotPassword')}
                  className="text-teal-400 hover:text-teal-300 text-sm transition"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-600/50 rounded-lg text-white font-semibold transition flex items-center justify-center gap-2"
            >
              {modalView === 'signup' && (
                <>
                  <UserPlus size={20} />
                  Sign Up
                </>
              )}
              {modalView === 'login' && (
                <>
                  <LogIn size={20} />
                  Log In
                </>
              )}
              {modalView === 'forgotPassword' && (
                <>
                  <SendIcon size={20} />
                  Send Reset Link
                </>
              )}
            </button>
          </form>

          {/* Toggle between Login/Signup */}
          {modalView !== 'forgotPassword' && (
            <div className="mt-6 text-center text-white/60 text-sm">
              {modalView === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <button
                    onClick={() => {
                      setModalView('signup');
                      setPassword('');
                    }}
                    className="text-teal-400 hover:text-teal-300 font-medium transition"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    onClick={() => {
                      setModalView('login');
                      setUsername('');
                    }}
                    className="text-teal-400 hover:text-teal-300 font-medium transition"
                  >
                    Log in
                  </button>
                </>
              )}
            </div>
          )}

          {/* Back to login from forgot password */}
          {modalView === 'forgotPassword' && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setModalView('login')}
                className="text-teal-400 hover:text-teal-300 text-sm transition"
              >
                ← Back to login
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AuthComponent;
