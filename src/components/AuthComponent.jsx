import React, { useState, useEffect } from 'react';
import { LogIn, UserPlus, SendIcon } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

import { useNavigate } from 'react-router-dom';

import { listUserAvatars } from '../services/avatarService.jsx';

const AuthComponent = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  // const [showModal, setShowModal] = useState(true);
  const [modalView, setModalView] = useState('login'); // 'login', 'signup', 'forgotPassword', 'verifyEmail'

  // Rotating avatar index
  const [rotatingIndex, setRotatingIndex] = useState(0);

  const {
    isLoading,
    setIsLoading,
    signUp,
    logIn,
    requestPasswordReset,
    userAvatars: avatars,
    setUserAvatars,
  } = useAuth();

  const validIcons = Array.isArray(avatars)
    ? avatars
        .map((a) => a.icon)
        .filter((icon) => typeof icon === 'string' && icon.startsWith('https'))
    : [];

  // Intermittently rotate avatar images

  // This returns the exact image or fallback you should render.
  // const getRotatingAvatarIcon = (avatars, rotatingIndex, user) => {
  //   // Filter only valid URLs
  //   const validIcons = avatars
  //     .map((a) => a.icon)
  //     .filter((icon) => typeof icon === 'string' && icon.startsWith('https'));
  //   // Case 1: No avatars at all → show User icon
  //   if (!Array.isArray(avatars) || avatars.length === 0) {
  //     return null; // This signals: "render <User />"
  //   }

  //   // Case 2: Exactly one avatar → show that one avatar
  //   if (validIcons.length === 1) {
  //     return avatars[0].icon || null;
  //   }

  //   // Case 3: Multiple avatars → rotate through them
  //   return avatars[rotatingIndex]?.icon || null;
  // };

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

  const handleAuth = async (e) => {
    e.preventDefault();

    try {
      if (modalView === 'signup') {
        setIsLoading(true);
        // The API sends a verification email and refuses to authenticate the
        // account until the address is verified, so signup deliberately does
        // NOT sign the user in or navigate to /avatars.
        const signupResponse = await signUp(email, password, username);
        toast.success(
          signupResponse?.verification ??
            'A verification email has been sent. Verify your address, then log in.',
          { duration: 8000 }
        );
        setModalView('verifyEmail');
      } else if (modalView === 'login') {
        setIsLoading(true);
        await logIn(email, password);

        const avatars = await listUserAvatars();
        setUserAvatars(avatars ?? []);

        navigate('/avatars');
      } else if (modalView === 'forgotPassword') {
        await requestPasswordReset(email);
        toast.success('Password reset email sent! Check your inbox.', {
          duration: 8000,
        });
        setModalView('login');
      }
    } catch (authError) {
      console.error('Authentication error:', authError);
      toast.error(authError.message || 'Authentication failed', {
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
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
              {import.meta.env.VITE_TESTING === 'true' && (
                <button
                  onClick={() => {
                    console.log(import.meta.env.VITE_TESTING);
                    toast.dismiss();

                    toast.promise(
                      new Promise((resolve, reject) => {
                        setTimeout(() => {
                          // Change to reject() to test error path`[9]
                          // resolve('fake upload result');
                          reject();
                          // reject(new Error("fake upload error"));
                        }, 2400);
                      }),
                      {
                        loading: 'Uploading document...',
                        success: 'Document uploaded',
                        error: 'Upload failed',
                      }
                    );
                    toast.success('success works');
                    toast.error('error works');
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded"
                >
                  Test Promise Toast
                </button>
              )}
            </div>
            {validIcons?.length > 0 && (
              <div className="flex justify-center items-center pb-6">
                <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center">
                  <img
                    src={validIcons[rotatingIndex] ?? validIcons[0]}
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
              {modalView === 'verifyEmail' && 'Verify Your Email'}
            </h2>
          </div>

          {/* Email-verification notice shown after signup */}
          {modalView === 'verifyEmail' && (
            <div className="space-y-4 text-white/80">
              <p>
                A verification email is on the way to{' '}
                <span className="font-semibold text-white">{email}</span>.
                Follow the link inside, then log in.
              </p>
              <button
                onClick={() => setModalView('login')}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 rounded-lg text-white font-semibold transition flex items-center justify-center gap-2"
              >
                <LogIn size={20} />
                Back to Login
              </button>
            </div>
          )}

          {/* Form */}
          {modalView !== 'verifyEmail' && (
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
          )}

          {/* Toggle between Login/Signup */}
          {modalView !== 'forgotPassword' && modalView !== 'verifyEmail' && (
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
