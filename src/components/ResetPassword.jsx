// src/components/ResetPassword.jsx
//
// Password changes are owned by Auth0: the API's POST /forgot_password sends
// an Auth0 change-password email, and the new password is set on Auth0's own
// page from the link inside. So this screen only requests that email — there
// is no in-application new-password form.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { SendIcon } from 'lucide-react';

const ResetPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetLinkSent, setResetLinkSent] = useState(false);
  const { requestPasswordReset } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await requestPasswordReset(email);
      setResetLinkSent(true);
      toast.success('Password reset email sent! Check your inbox.');
    } catch (resetError) {
      toast.error(resetError.message || 'Failed to send the reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8">
          <h2 className="text-3xl font-bold text-white mb-2">Reset Password</h2>

          {resetLinkSent ? (
            <div className="space-y-4">
              <p className="text-white/80">
                A password reset email is on the way to{' '}
                <span className="font-semibold text-white">{email}</span>.
                Follow the link inside to choose a new password, then log in.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 rounded-lg text-white font-semibold transition"
              >
                Back to Login
              </button>
            </div>
          ) : (
            <>
              <p className="text-white/60 mb-6">
                Enter your account email and a password reset link will be sent
                to it.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
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

                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-600/50 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition flex items-center justify-center gap-2"
                >
                  <SendIcon size={20} />
                  {isLoading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}

          {/* Cancel Link */}
          {!resetLinkSent && (
            <button
              onClick={() => navigate('/')}
              className="w-full mt-4 text-white/60 hover:text-white text-sm transition"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
