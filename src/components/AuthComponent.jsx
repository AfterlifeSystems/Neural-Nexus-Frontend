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

import {
  createUserWithEmailAndPassword,
  indexedDBLocalPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, storage } from '../firebase/config.js';

import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import VantaBackground from './VantaBackground';
import LoadingSpinner from './LoadingSpinner';
import { toast, Toaster } from 'react-hot-toast';

import { useNavigate } from 'react-router-dom';

import { createClient } from '@supabase/supabase-js';

import { getAvatars } from '../services/avatarService.jsx';

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
  const [modalView, setModalView] = useState('login'); // 'login', 'signup', 'forgotPassword'

  // Rotating avatar index
  const [rotatingIndex, setRotatingIndex] = useState(0);

  const {
    user,
    isLoading,
    setIsLoading,
    profile,
    setProfile,
    forgotPassword,
    signInWithProvider,
    avatars,
    setUserAvatars,
    setAccessToken,
    setUser,
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

  useEffect(() => {
    console.log('AUTH COMPONENT ENTRYPOINT');
  });

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
    console.log(`ENTRYPOINT HANDLE AUTH: isLoading ${isLoading}`);
    e.preventDefault();
    if (!isLoading) {
      console.log(`is loading is false: ${isLoading}`);
    }

    try {
      if (modalView === 'signup') {
        // await signup(username, email, password);
        try {
          console.log(email);

          console.log('signup breakpoint');
          // SUPABASE POSTGRES_DB_STORE
          const supabaseClient = createClient(
            `${import.meta.env.VITE_SUPABASE_URL}`,
            `${import.meta.env.VITE_SUPABASE_PUBLISHABLE_AUTH_KEY}`
          );

          const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
              data: {
                display_name: username,
              },
            },
          });
          if (error) {
            // Display user-friendly error messages
            let errorMessage = 'Signup failed. Please try again.';
            if (error.code === 'auth/email-already-in-use') {
              errorMessage = 'This email is already registered';
              toast.error(errorMessage);
              navigate('/login');
            } else if (error.code === 'auth/invalid-email') {
              errorMessage = 'Please provide a valid email address';
            } else if (error.code === 'auth/weak-password') {
              errorMessage = 'Password must be at least 6 characters';
            } else if (error.message) {
              errorMessage = error.message;
            }
            console.error('Signup error:', error);
            toast.error(error.message);
          } else {
            // This gives you everything at once
            console.log('Signup data:', { data });
            console.log('Signup error:', { error });

            console.log(`user: ${user}`);

            // Send email verification
            // await sendEmailVerification(userCredential.user);

            // set the current profile to the newly created profile
            console.log(
              '// set profile of user IN SIGNUP OF  AUTH COMPONENT XXXXXXXXXXXXX'
            );

            setUser(data.user);
            setProfile(data.user);
            setAccessToken(data.session.access_token);
            setIsLoading(false);

            localStorage.setItem('user', JSON.stringify(data.user));

            navigate('/avatars');
          }
        } catch (error) {
          console.error('Signup error:', error);
          toast.error(error.message);
          throw error;
        }
      } else if (modalView === 'login') {
        console.log('signInWithPassword BREAKPOINT');
        try {
          const supabase = await createClient(
            `${import.meta.env.VITE_SUPABASE_URL}`,
            `${import.meta.env.VITE_SUPABASE_PUBLISHABLE_AUTH_KEY}`
          );

          const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
          });

          if (error) {
            let errorMessage = 'Login failed. Please try again.';
          }

          console.log(
            'XXXXXXXXXXXXXXXXXXXXXX   HANDLE AUTH SERVICE XXXXXXXXXXXXXXXXXXXXXXXXXXX'
          );
          console.log(JSON.stringify(data));
          localStorage.setItem('user', JSON.stringify(data.user));

          // set the current user profile
          console.log('// set profile of user IN AUTH COMPONENT XXXXXXXXXXXXX');

          console.log(`handle Auth Error handleAuthError`);

          setProfile(data.user);
          setAccessToken(data.session.access_token);

          console.log(
            'XXXXXXXXXXXXXXXXXXXXXXXXX userCredential: ' + JSON.stringify(data)
          );
          console.log(
            'XXXXXXXXXXXXXXXXXXXXXXXXX userCredential.user: ' +
              JSON.stringify(data.user)
          );

          // GET AVATARS
          console.log('USER HAS LOGGED IN; GETING AVATARS FOR USER');
          console.log(`user.id: ${data.user.id}`);
          const avatars = await getAvatars(data.user.id);

          console.log('AVATARS LIST SHOULD BE RETRIEVED');
          console.log(`avatars: ${avatars}`);

          console.log('SETTING AVATARS FOR USER');
          if (avatars) {
            console.log(`avatars: ${avatars}`);
            setUserAvatars(avatars);
          } else {
            setUserAvatars([]);
          }

          setIsLoading(false);
          // return data.user;
          console.log('navigate / avatars breakpoint');
          navigate('/avatars');
        } catch (error) {
          // if (error.code === 'auth/user-not-found')
          //       return = 'No account found with this email';
          //     if (error.code === 'auth/wrong-password')
          //       return 'Incorrect password';
          //     if (error.code === 'auth/invalid-email')
          //       return 'Invalid email address';
          //     if (error.code === 'auth/too-many-requests')
          //       return 'Too many attempts — try again later';
          // return error.message || 'Login failed';
          toast.error({
            message: error.message,
            options: {
              duration: 5000,
            },
          });
          setIsLoading(false);
        }

        // toast
        //   .promise(
        //     (async () => {
        // const supabase = await createClient(
        //   `${import.meta.env.VITE_SUPABASE_URL}`,
        //   `${import.meta.env.VITE_SUPABASE_PUBLISHABLE_AUTH_KEY}`
        // );
        // console.log('signInWithPassword BREAKPOINT');
        // const { data, error } = await supabase.auth.signInWithPassword({
        //   email: email,
        //   password: password,
        // });
        // if (error) {
        //   throw error;
        // }
        // console.log(
        //   'XXXXXXXXXXXXXXXXXXXXXX   HANDLE AUTH SERVICE XXXXXXXXXXXXXXXXXXXXXXXXXXX'
        // );
        // console.log(JSON.stringify(data));
        // localStorage.setItem('user', JSON.stringify(data.user));
        // // set the current user profile
        // console.log(
        //   '// set profile of user IN AUTH COMPONENT XXXXXXXXXXXXX'
        // );
        // console.log(`handle Auth Error handleAuthError`);
        // setProfile(data.user);
        // setAccessToken(data.session.access_token);
        // console.log(
        //   'XXXXXXXXXXXXXXXXXXXXXXXXX userCredential: ' +
        //     JSON.stringify(data)
        // );
        // console.log(
        //   'XXXXXXXXXXXXXXXXXXXXXXXXX userCredential.user: ' +
        //     JSON.stringify(data.user)
        // );
        // // GET AVATARS
        // console.log('USER HAS LOGGED IN; GETING AVATARS FOR USER');
        // console.log(`user.id: ${data.user.id}`);
        // const avatars = await getAvatars(data.user.id);
        // console.log('AVATARS LIST SHOULD BE RETRIEVED');
        // console.log(`avatars: ${avatars}`);
        // setUserAvatars(avatars);
        // console.log('SETTING AVATARS FOR USER');
        // console.log(`avatars: ${avatars}`);
        // setIsLoading(false);
        // return data.user;
        // })(),
        // {
        // toast promise return values (catches errors)
        //   loading: 'Logging in...',
        //   success: 'Login successful!',
        //   error: (error) => {
        //     if (error.code === 'auth/user-not-found')
        //       return 'No account found with this email';
        //     if (error.code === 'auth/wrong-password')
        //       return 'Incorrect password';
        //     if (error.code === 'auth/invalid-email')
        //       return 'Invalid email address';
        //     if (error.code === 'auth/too-many-requests')
        //       return 'Too many attempts — try again later';
        //     return error.message || 'Login failed';
        //   },
        //   duration: 5000,
        // }
        // )
        // .then(() => {
        //   console.log('navigate / avatars breakpoint');
        //   navigate('/avatars');
        // })
        // .catch((error) => {
        //   console.log('catching error: ' + error.message);
        // });
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
      console.log(error);
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
                          // Change to reject() to test error path
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
          </div>

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
