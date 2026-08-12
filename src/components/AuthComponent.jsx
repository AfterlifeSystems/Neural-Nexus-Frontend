import React, { useState, useEffect } from 'react';
import {
  LogIn,
  UserPlus,
  SendIcon,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  Check,
  KeyRound,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

import { useNavigate } from 'react-router-dom';

import { listUserAvatars } from '../services/avatarService.jsx';

// How often the sign-up screen asks the API whether the verification email has
// been acted on. Each poll costs the API two upstream calls (it may not cache an
// unverified account), so this is a compromise between that cost and how long a
// user stares at the screen after clicking the link.
const EMAIL_VERIFICATION_POLL_INTERVAL_MILLISECONDS = 5000;

/**
 * Present an API key for the user to save.
 *
 * The API generates a key once and stores only its hash, so a key that leaves
 * this screen unsaved cannot be recovered — it can only be replaced, which stops
 * the old one working everywhere else. Hence the key is shown in full (never
 * masked), with a one-press copy, and the warning is stated plainly.
 */
const ApiKeyPresentation = ({ apiKey }) => {
  const [wasCopied, setWasCopied] = useState(false);

  const copyApiKeyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setWasCopied(true);
      toast.success('API key copied to clipboard.');
      setTimeout(() => setWasCopied(false), 3000);
    } catch (copyError) {
      // Clipboard access can be refused (permissions, a non-secure origin). The
      // key is on screen and selectable, so this is a nuisance, not a loss.
      console.error('Clipboard write failed:', copyError);
      toast.error('Could not copy automatically — select the key and copy it.');
    }
  };

  return (
    <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 space-y-3">
      <div className="flex items-center gap-2 text-amber-200">
        <KeyRound size={18} />
        <span className="font-semibold">Your API key</span>
      </div>
      <p className="text-sm text-amber-100/90">
        Save this key now. It is shown only once and cannot be shown again. You
        do not need it to use this site — it is what connects your account to
        integrations like the Discord bot or your own scripts.
      </p>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 select-all break-all rounded-md bg-black/40 px-3 py-2 font-mono text-sm text-white">
          {apiKey}
        </code>
        <button
          type="button"
          onClick={copyApiKeyToClipboard}
          className="shrink-0 px-3 rounded-md bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-1"
          aria-label="Copy API key"
        >
          {wasCopied ? <Check size={18} /> : <Copy size={18} />}
        </button>
      </div>
    </div>
  );
};

const AuthComponent = ({ initialView = 'login' }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  // The key from the signup response, held only for as long as this screen is
  // showing it. It is never persisted: the user saves it, this application does
  // not need it, and the session runs on the refresh token instead.
  const [apiKeyToPresent, setApiKeyToPresent] = useState('');
  // const [showModal, setShowModal] = useState(true);
  // 'login', 'signup', 'forgotPassword', 'verifyEmail'
  const [modalView, setModalView] = useState(initialView);

  // Rotating avatar index
  const [rotatingIndex, setRotatingIndex] = useState(0);
  // What the application is doing between pressing the button and the screen
  // changing. Signing in is several round trips — authenticate, identify the
  // user, load their avatars — and any of them can take a moment. A button that
  // merely greys out gives no reason to keep waiting rather than press again.
  const [authProgressMessage, setAuthProgressMessage] = useState(null);

  const {
    isLoading,
    setIsLoading,
    signUp,
    logIn,
    startSession,
    completeSignIn,
    checkEmailVerified,
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

  /**
   * Load what a signed-in user needs and land them on their avatars.
   */
  const enterTheApplication = async () => {
    setAuthProgressMessage('Loading your avatars…');
    const userAvatars = await listUserAvatars();
    setUserAvatars(userAvatars ?? []);
    navigate('/avatars');
  };

  /**
   * Finish the sign-in that signup started, once the email has been verified.
   *
   * @returns {Promise<boolean>} Whether the account was verified yet.
   */
  const enterIfEmailIsVerified = async () => {
    if (!(await checkEmailVerified())) {
      return false;
    }
    await completeSignIn(email);
    toast.success('Email verified. Welcome to Neural Nexus.');
    await enterTheApplication();
    return true;
  };

  // Watch for the verification while the user is away in their email client.
  //
  // The verification link opens the identity provider in another tab, so this
  // application is never told directly. Three things can notice instead: a poll,
  // the tab regaining focus (the common case — the user comes straight back),
  // and the button on the screen. Whichever notices first signs the user in.
  useEffect(() => {
    if (modalView !== 'verifyEmail') {
      return undefined;
    }

    let hasEntered = false;
    const checkOnce = async () => {
      if (hasEntered) {
        return;
      }
      try {
        hasEntered = await enterIfEmailIsVerified();
      } catch (verificationError) {
        // Still unverified is the expected answer here, not a fault worth
        // interrupting the user over; anything else is equally not actionable
        // by them mid-wait. The next tick tries again.
        console.debug('Waiting on email verification:', verificationError);
      }
    };

    const pollTimer = setInterval(
      checkOnce,
      EMAIL_VERIFICATION_POLL_INTERVAL_MILLISECONDS
    );
    const checkOnReturningToTab = () => {
      if (document.visibilityState === 'visible') {
        checkOnce();
      }
    };
    document.addEventListener('visibilitychange', checkOnReturningToTab);

    return () => {
      clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', checkOnReturningToTab);
    };
  }, [modalView, email]);

  const handleAuth = async (e) => {
    e.preventDefault();

    try {
      if (modalView === 'signup') {
        setIsLoading(true);
        setAuthProgressMessage('Creating your account…');
        // The API refuses every endpoint that needs a verified email until the
        // address is verified, so signup cannot land the user in the
        // application. What it CAN do is show the API key — this response is the
        // only time it exists in readable form — and open a session so the next
        // screen can watch for the verification without asking for the password
        // again. Auth0 issues tokens to an unverified account, which is what
        // makes that possible.
        const signupResponse = await signUp(email, password, username);
        setApiKeyToPresent(signupResponse?.api_key ?? '');
        setModalView('verifyEmail');
        toast.success(
          signupResponse?.verification ??
            'A verification email has been sent. Verify your address to continue.',
          { duration: 8000 }
        );

        // A failure here must not read as a failed signup: the account exists,
        // the key is on screen, and the only thing lost is the automatic entry
        // once the email is verified. Say exactly that and leave the user on
        // this screen rather than throwing to the shared handler below.
        try {
          await startSession(email, password);
        } catch (sessionError) {
          console.error('Post-signup session failed:', sessionError);
          toast(
            'Account created. Verify your email, then log in with your password.',
            { duration: 8000 }
          );
        }
      } else if (modalView === 'login') {
        setIsLoading(true);
        setAuthProgressMessage('Signing in…');
        await logIn(email, password);
        await enterTheApplication();
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
      setAuthProgressMessage(null);
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
              {modalView === 'verifyEmail' && 'Save Your API Key'}
            </h2>
          </div>

          {/* Post-signup: the one and only presentation of the API key, plus the
              wait for the verification email to be acted on. */}
          {modalView === 'verifyEmail' && (
            <div className="space-y-4 text-white/80">
              {apiKeyToPresent && (
                <ApiKeyPresentation apiKey={apiKeyToPresent} />
              )}
              <p>
                A verification email is on the way to{' '}
                <span className="font-semibold text-white">{email}</span>.
                Follow the link inside and this page will take you straight in —
                no need to log in again.
              </p>
              <button
                onClick={async () => {
                  try {
                    setIsLoading(true);
                    if (!(await enterIfEmailIsVerified())) {
                      toast(
                        'Not verified yet. Follow the link in the email, then try again.',
                        { duration: 6000 }
                      );
                    }
                  } catch (verificationError) {
                    console.error('Verification check failed:', verificationError);
                    toast.error(
                      verificationError.message || 'Could not check verification.'
                    );
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-600/50 rounded-lg text-white font-semibold transition flex items-center justify-center gap-2"
              >
                <Check size={20} />
                I've verified — continue
              </button>
              <button
                onClick={() => setModalView('login')}
                className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white font-semibold transition flex items-center justify-center gap-2"
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
                {/* The eye control switches the input between `password` and
                    `text` so a typed password can be read back before it is
                    submitted — a mistyped password is the most common reason a
                    sign-in or a signup fails. */}
                <div className="relative">
                  <input
                    type={isPasswordVisible ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-white/40"
                    placeholder="Enter your password"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                    className="absolute inset-y-0 right-0 px-4 flex items-center text-white/60 hover:text-white transition"
                    aria-label={
                      isPasswordVisible ? 'Hide password' : 'Show password'
                    }
                    title={isPasswordVisible ? 'Hide password' : 'Show password'}
                  >
                    {isPasswordVisible ? (
                      <EyeOff size={20} />
                    ) : (
                      <Eye size={20} />
                    )}
                  </button>
                </div>
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
              {authProgressMessage ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  {authProgressMessage}
                </>
              ) : null}
              {!authProgressMessage && modalView === 'signup' && (
                <>
                  <UserPlus size={20} />
                  Sign Up
                </>
              )}
              {!authProgressMessage && modalView === 'login' && (
                <>
                  <LogIn size={20} />
                  Log In
                </>
              )}
              {!authProgressMessage && modalView === 'forgotPassword' && (
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
