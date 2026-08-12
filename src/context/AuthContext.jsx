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
  // The signed-in person's own portrait, used wherever the user is depicted.
  // It is the reference image of their personal avatar — the avatar that
  // depicts them — so there is one picture of a person, not two.
  const [userPortrait, setUserPortrait] = useState(null);
  const [context, setContext] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  // True until the mount-time session restore has decided whether a stored
  // credential still authenticates. ProtectedRoute waits on this flag so a
  // page refresh does not bounce a signed-in user to /login while the check
  // is in flight.
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  /**
   * Create an account. The API sends a verification email and will not authorize
   * the account until the email is verified, so this does NOT complete a sign-in
   * — the caller should route to a "check your email" state.
   *
   * The response carries the account's API key, generated during this call. The
   * API stores only its hash, so this response is the one and only time that key
   * can ever be read: the caller MUST show it to the user.
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
   * Report whether this session's account has verified its email yet.
   *
   * GET /verify_login_status is the only endpoint an unverified account can
   * reach, which makes it the one way to watch for the verification to land. The
   * API never serves a cached answer to an unverified caller, so the flag flips
   * on the first poll after the user follows the link in the email.
   *
   * @returns {Promise<boolean>}
   */
  const checkEmailVerified = async () => {
    const loginStatus = await requestJson('/verify_login_status');
    return loginStatus?.email_verified === true;
  };

  /**
   * Exchange email + password for a session credential and store it.
   *
   * Split out from `logIn` because it is the only half an unverified account can
   * complete: Auth0 issues tokens to an account that has not verified its email,
   * but the API refuses to identify one. Signing up therefore establishes a
   * session here and finishes it with `completeSignIn` once the user has
   * verified, without ever asking for the password a second time.
   *
   * @returns {Promise<Object>} The Auth0 token set from POST /login.
   */
  const startSession = async (email, password) => {
    const loginResponse = await requestJson('/login', {
      method: 'POST',
      body: { email, password },
    });
    setSessionCredential(
      extractSessionCredentialFromLoginResponse(loginResponse)
    );
    return loginResponse;
  };

  /**
   * Resolve who the current session belongs to and populate the user state.
   *
   * Requires a verified account: GET /get_current_user_id is one of the
   * endpoints the API closes to an unverified caller.
   *
   * @returns {Promise<Object>} The user object now held in context.
   */
  const completeSignIn = async (email) => {
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
   * Authenticate with email + password, store the session credential, and
   * populate the user state.
   *
   * @returns {Promise<Object>} The user object now held in context.
   */
  const logIn = async (email, password) => {
    await startSession(email, password);
    return completeSignIn(email);
  };

  /**
   * Revoke the session at the API and clear all local session state. The request
   * body is empty on purpose: this session's credential IS the refresh token, so
   * the API reads it from the bearer header and revokes it there — repeating it
   * in the body would say nothing new.
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

  /**
   * Mint a replacement API key.
   *
   * The new key is shown once and the old one stops working immediately, so
   * anything else holding it — an integration, another browser, a script —
   * must be given the new one. Email and password are required because this is
   * the one credential operation that cannot be authorized by the credential it
   * is replacing.
   *
   * @returns {Promise<string>} The new key, to be shown to the user once.
   */
  const rotateApiKey = async (email, password) => {
    const rotationResponse = await requestJson('/rotate_api_key', {
      method: 'POST',
      query: { email, password },
    });
    return rotationResponse?.api_key ?? '';
  };

  /**
   * Delete the signed-in account and everything it created.
   *
   * Irreversible. The local session is cleared afterwards because the account
   * it referred to no longer exists.
   */
  const deleteAccount = async () => {
    await requestJson('/delete_user', { method: 'DELETE' });
    clearSessionCredential();
    localStorage.removeItem('user');
    setUser(null);
    setProfile(null);
    setUserAvatars([]);
    setActiveAvatar(null);
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
          // The credential authenticates, but this browser has no signed-in
          // session: the account signed up and has not verified yet, a logout
          // elsewhere cleared the flag, or the stored user record is gone. Sign
          // out locally and KEEP the credential — a user who signed up moments
          // ago and reloaded the page is still mid-verification, and discarding
          // their session here would strand them on the login screen.
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

  /**
   * Read the signed-in person's own portrait.
   *
   * The account's personal avatar is the avatar that depicts them, so its
   * reference image is their picture — the one shown beside everything they
   * say, in every conversation with any avatar. Held here rather than in a
   * screen because several screens depict the user and none of them should
   * each fetch it. Someone with no personal avatar, or one without a portrait,
   * simply has no picture and falls back to the placeholder everywhere.
   */
  const refreshUserPortrait = async () => {
    try {
      const { getPersonalAvatar, getAvatarReferenceImage } = await import(
        '../services/avatarService'
      );
      const personalAvatarResponse = await getPersonalAvatar();
      const personalAvatarId =
        personalAvatarResponse?.personal_avatar?.assistant_id;
      if (!personalAvatarId) {
        return null;
      }
      const portrait = await getAvatarReferenceImage(personalAvatarId);
      setUserPortrait(portrait);
      return portrait;
    } catch (portraitError) {
      console.debug('No personal portrait available:', portraitError);
      return null;
    }
  };

  useEffect(() => {
    if (!user) {
      setUserPortrait(null);
      return;
    }
    refreshUserPortrait();
  }, [user]);

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
        userPortrait,
        refreshUserPortrait,
        isLoading,
        setIsLoading,
        isRestoringSession,
        context,
        setContext,
        signUp,
        logIn,
        startSession,
        completeSignIn,
        logOut,
        checkEmailVerified,
        requestPasswordReset,
        rotateApiKey,
        deleteAccount,
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
