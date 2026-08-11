// src/context/AuthContext.jsx
//
// Session state for the whole application, backed by the Neural Nexus API.
// Components call signUp / logIn / logOut / requestPasswordReset from here;
// the credential itself lives inside neuralNexusApiClient and is never
// exposed through this context.

import React, { createContext, useContext, useState, useEffect } from 'react';

import {
  requestJson,
  getSessionCredential,
  setSessionCredential,
  clearSessionCredential,
  extractSessionCredentialFromLoginResponse,
} from '../services/neuralNexusApiClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // current user auth object
  const [profile, setProfile] = useState(null); // the user with metadata included

  const [userAvatars, setUserAvatars] = useState([]); // avatars of the user
  const [communityAvatars, setCommunityAvatars] = useState([]); // avatars shared by the community
  const [proprietaryAvatars, setProprietaryAvatars] = useState([]); // avatars created by Afterlife Systems Inc. (businesses, bibles, restaurants, etc.)

  const [activeAvatar, setActiveAvatar] = useState(null);
  const [context, setContext] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  // True until the mount-time session restore has decided whether a stored
  // credential still authenticates. ProtectedRoute waits on this flag so a
  // page refresh does not bounce a signed-in user to /login while the check
  // is in flight.
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  /**
   * Create an account. The API sends a verification email and will not
   * authenticate the account until the email is verified, so this does NOT
   * sign the user in — the caller should route to a "check your email" state.
   *
   * @returns {Promise<Object>} The /signup response ({api_key, message, verification}).
   */
  const signUp = async (email, password, name) => {
    return requestJson('/signup', {
      method: 'POST',
      body: { email, password, name },
    });
  };

  /**
   * Authenticate with email + password, store the session credential, and
   * populate the user state.
   *
   * @returns {Promise<Object>} The user object now held in context.
   */
  const logIn = async (email, password) => {
    const loginResponse = await requestJson('/login', {
      method: 'POST',
      body: { email, password },
    });
    setSessionCredential(
      extractSessionCredentialFromLoginResponse(loginResponse)
    );

    // The login response is an Auth0 token set, not a user record; fetch the
    // user identity the rest of the application keys on.
    const currentUserIdResponse = await requestJson('/get_current_user_id');
    const authenticatedUser = {
      id: currentUserIdResponse?.user_id ?? currentUserIdResponse,
      email,
    };
    setUser(authenticatedUser);
    setProfile(authenticatedUser);
    localStorage.setItem('user', JSON.stringify(authenticatedUser));
    return authenticatedUser;
  };

  /**
   * Revoke the session at the API and clear all local session state. The
   * request body is empty on purpose: the API reads the refresh token from
   * its httpOnly cookie first, and the bearer header identifies the user for
   * the app_metadata update either way.
   */
  const logOut = async () => {
    try {
      await requestJson('/logout', { method: 'POST', body: {} });
    } finally {
      // Local sign-out must succeed even when the network call does not —
      // otherwise a user with a dead connection could never leave.
      clearSessionCredential();
      localStorage.removeItem('user');
      setUser(null);
      setProfile(null);
      setUserAvatars([]);
      setActiveAvatar(null);
    }
  };

  const requestPasswordReset = async (email) => {
    return requestJson('/forgot_password', {
      method: 'POST',
      query: { email },
    });
  };

  // On mount, decide whether the stored credential still authenticates.
  //
  // The check is GET /verify_login_status rather than /get_current_user_id
  // because /get_current_user_id resolves an ANONYMOUS identity when the
  // credential does not authenticate — a restore against that endpoint would
  // "succeed" as an anonymous visitor and render a half-signed-in page.
  // /verify_login_status rejects a bad credential with a 401, and requestJson
  // clears the stored credential on that 401, so a failed check leaves the
  // application cleanly signed out.
  useEffect(() => {
    const restoreSession = async () => {
      if (!getSessionCredential()) {
        localStorage.removeItem('user');
        setIsRestoringSession(false);
        return;
      }
      try {
        const loginStatus = await requestJson('/verify_login_status');
        const storedUser = JSON.parse(localStorage.getItem('user') ?? 'null');
        if (loginStatus?.logged_in && storedUser?.id) {
          setUser(storedUser);
          setProfile(storedUser);
        } else {
          // The credential still parses but the session was ended elsewhere
          // (logout in another tab revokes it server-side), or the stored
          // user record is gone. Treat both as signed out.
          clearSessionCredential();
          localStorage.removeItem('user');
        }
      } catch (restoreError) {
        // 401 already cleared the credential; anything else (network down)
        // also falls back to signed-out rather than blocking the application.
        console.error('Session restore failed:', restoreError);
        localStorage.removeItem('user');
      } finally {
        setIsRestoringSession(false);
      }
    };
    restoreSession();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        userAvatars,
        setUserAvatars,
        communityAvatars,
        setCommunityAvatars,
        proprietaryAvatars,
        setProprietaryAvatars,
        profile,
        setProfile,
        activeAvatar,
        setActiveAvatar,
        isLoading,
        setIsLoading,
        isRestoringSession,
        context,
        setContext,
        signUp,
        logIn,
        logOut,
        requestPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
