// /components/AccountSettings.jsx
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

import UserSettingsMenu from './UserSettingsMenu';

const AccountSettings = ({ activeTab }) => {
  const { user, requestPasswordReset, rotateApiKey, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [newApiKey, setNewApiKey] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  /**
   * Replace the account's API key.
   *
   * The password is asked for here rather than assumed: this is the one call
   * that cannot be authorized by the credential it is about to invalidate, and
   * it is destructive to every other client holding the old key — so it is
   * confirmed first and the consequence stated.
   */
  const handleRotateApiKey = async () => {
    if (
      !window.confirm(
        'Rotating your API key immediately stops the old one working. Anything using it — the Discord bot, your scripts — will need the new key. Continue?'
      )
    ) {
      return;
    }
    const password = window.prompt(
      'Confirm your password to mint a new API key:'
    );
    if (!password) return;

    setIsWorking(true);
    try {
      const rotatedKey = await rotateApiKey(user?.email, password);
      setNewApiKey(rotatedKey);
      toast.success('New API key minted. Save it — it is shown only once.', {
        duration: 9000,
      });
    } catch (rotationError) {
      console.error('Rotating the API key failed:', rotationError);
      toast.error(rotationError.message || 'Could not rotate the API key.');
    } finally {
      setIsWorking(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!user?.email) {
      toast.error('No email address on this account.');
      return;
    }
    setIsWorking(true);
    try {
      await requestPasswordReset(user.email);
      toast.success(`Password reset link sent to ${user.email}.`, {
        duration: 8000,
      });
    } catch (resetError) {
      console.error('Requesting a password reset failed:', resetError);
      toast.error(resetError.message || 'Could not send the reset link.');
    } finally {
      setIsWorking(false);
    }
  };

  /**
   * Delete the account. Confirmed twice — once for the decision, once by typing
   * the word — because it takes the avatars and everything uploaded with them,
   * and nothing brings that back.
   */
  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        'This deletes your account, your avatars, and everything uploaded to them. It cannot be undone. Continue?'
      )
    ) {
      return;
    }
    const typedConfirmation = window.prompt('Type DELETE to confirm:');
    if (typedConfirmation !== 'DELETE') {
      toast('Account deletion cancelled.');
      return;
    }

    setIsWorking(true);
    try {
      await deleteAccount();
      toast.success('Your account has been deleted.');
      navigate('/welcome');
    } catch (deletionError) {
      console.error('Deleting the account failed:', deletionError);
      toast.error(deletionError.message || 'Could not delete the account.');
    } finally {
      setIsWorking(false);
    }
  };

  const [username, setUsername] = useState('');
  const [personalImage, setPersonalImage] = useState(null);
  const [neuralNexusKey, setNeuralNexusKey] = useState('');
  const [grokKey, setGrokKey] = useState('');
  const [grokEnabled, setGrokEnabled] = useState(false);
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [elevenLabsEnabled, setElevenLabsEnabled] = useState(false);
  const [customLLMKey, setCustomLLMKey] = useState('');
  const [customLLMEnabled, setCustomLLMEnabled] = useState(false);

  const handleUsernameChange = () => toast.success('Username updated');
  const handleImageUpload = (e) => {
    setPersonalImage(URL.createObjectURL(e.target.files[0]));
    toast.success('Image uploaded');
  };
  const handleDeleteImage = () => {
    setPersonalImage(null);
    toast.success('Image deleted');
  };
  const handleApiKeyUpdate = (service) =>
    toast.success(`${service} API key updated`);

  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      <h1 className="text-3xl font-bold mb-4">Account Settings</h1>

      {/* Username */}
      {/* <div className="flex flex-col gap-2">
        <label>Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="p-2 rounded bg-gray-700 text-white"
        />
        <button
          onClick={handleUsernameChange}
          className="bg-teal-600 px-4 py-2 rounded"
        >
          Change Username
        </button>
      </div> */}

      {/* API Keys */}
      {/* <div className="flex flex-col gap-2">
        <label>Neural Nexus API Key</label>
        <input
          type="text"
          value={neuralNexusKey}
          onChange={(e) => setNeuralNexusKey(e.target.value)}
          className="p-2 rounded bg-gray-700 text-white"
        />
        <button
          onClick={() => handleApiKeyUpdate('Neural Nexus')}
          className="bg-teal-600 px-4 py-2 rounded"
        >
          Update
        </button>

        <label>Grok API Key</label>
        <input
          type="text"
          value={grokKey}
          onChange={(e) => setGrokKey(e.target.value)}
          className="p-2 rounded bg-gray-700 text-white"
        />
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={grokEnabled}
            onChange={() => setGrokEnabled(!grokEnabled)}
          />
          <span>Enable Grok Imagine</span>
        </div>
        <button
          onClick={() => handleApiKeyUpdate('Grok')}
          className="bg-teal-600 px-4 py-2 rounded"
        >
          Update
        </button>

        <label>ElevenLabs API Key</label>
        <input
          type="text"
          value={elevenLabsKey}
          onChange={(e) => setElevenLabsKey(e.target.value)}
          className="p-2 rounded bg-gray-700 text-white"
        />
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={elevenLabsEnabled}
            onChange={() => setElevenLabsEnabled(!elevenLabsEnabled)}
          />
          <span>Enable ElevenLabs</span>
        </div>
        <button
          onClick={() => handleApiKeyUpdate('ElevenLabs')}
          className="bg-teal-600 px-4 py-2 rounded"
        >
          Update
        </button>
      </div> */}

      {/* Managing the account itself: the credential, the password, and
          leaving. These are the three operations the API supports on an
          account, and each one is destructive in its own way, so each says
          what it will do before it does it. */}
      <div className="flex flex-col gap-4 bg-white/5 border border-white/20 rounded-2xl p-6">
        <h2 className="text-xl font-semibold">Manage your account</h2>

        {newApiKey && (
          <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 space-y-2">
            <p className="text-sm text-amber-100/90">
              Your new API key. It is shown only once, and the previous key has
              already stopped working — give this to anything that used it.
            </p>
            <code className="block select-all break-all rounded-md bg-black/40 px-3 py-2 font-mono text-sm">
              {newApiKey}
            </code>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-white/60 text-sm">
            Replace your API key. Anything still using the old key — the Discord
            bot, your own scripts — stops working until you give it the new one.
          </p>
          <button
            onClick={handleRotateApiKey}
            disabled={isWorking}
            className="self-start bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-lg disabled:opacity-50"
          >
            Rotate API key
          </button>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
          <p className="text-white/60 text-sm">
            Send a password reset link to {user?.email ?? 'your email address'}.
          </p>
          <button
            onClick={handleForgotPassword}
            disabled={isWorking}
            className="self-start bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-lg disabled:opacity-50"
          >
            Email a password reset link
          </button>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
          <p className="text-white/60 text-sm">
            Delete your account, your avatars, and everything uploaded to them.
            This cannot be undone.
          </p>
          <button
            onClick={handleDeleteAccount}
            disabled={isWorking}
            className="self-start bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 px-4 py-2 rounded-lg disabled:opacity-50"
          >
            Delete account
          </button>
        </div>
      </div>

      {/* The control this page is usually reached from. Without it the menu
          vanished on arrival, leaving no way back except the sidebar. */}
      <UserSettingsMenu className="mt-2" />
    </div>
  );
};

export default AccountSettings;
