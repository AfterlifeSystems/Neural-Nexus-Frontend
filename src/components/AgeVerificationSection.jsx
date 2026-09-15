// Age verification in account settings: the date of birth that unlocks
// adult-only avatars in search. The date itself stays on the server.

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { ShieldCheck } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { setAgeVerification } from '../services/ageVerification';
import { listUserAvatars } from '../services/avatarService';

const AgeVerificationSection = () => {
  const { ageVerified, refreshAgeVerification, setUserAvatars } = useAuth();
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!dateOfBirth) {
      toast.error('Enter your date of birth.');
      return;
    }
    setIsSaving(true);
    try {
      const status = await setAgeVerification(dateOfBirth, 'account_settings');
      await refreshAgeVerification();
      try {
        setUserAvatars((await listUserAvatars()) ?? []);
      } catch (listError) {
        console.debug('Refreshing avatars after age verification failed:', listError);
      }
      toast.success(
        status?.verified
          ? 'Age confirmed. Adult-only avatars can appear in search.'
          : 'Age recorded.'
      );
    } catch (verificationError) {
      toast.error(
        verificationError?.message || 'Could not verify your age.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
      <div className="flex items-start gap-3 mb-4">
        <ShieldCheck size={20} className="text-amber-400/80 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-neutral-100">
            Age verification
          </h3>
          <p className="text-white/60 text-sm mt-1">
            Adult-only avatars stay out of search until you confirm you are 18
            or older. Enter your date of birth. Neural Nexus uses it only to
            confirm your age and never shows it back.
          </p>
        </div>
      </div>
      {ageVerified ? (
        <p className="text-sm text-amber-200/80">
          You have confirmed you are 18 or older. Adult-only avatars can appear
          in search.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row sm:items-end gap-3"
        >
          <label className="flex flex-col gap-1 min-w-0 flex-1">
            <span className="text-xs text-white/70">Date of birth</span>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(changeEvent) => setDateOfBirth(changeEvent.target.value)}
              className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-neutral-200"
              required
            />
          </label>
          <button
            type="submit"
            disabled={isSaving}
            className="self-start sm:self-auto rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-900 font-semibold px-4 py-2 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Confirm age'}
          </button>
        </form>
      )}
    </div>
  );
};

export default AgeVerificationSection;
