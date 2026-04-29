import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      setSent(true); // Always show success for security
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FFCC00] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-dhl-red px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded px-2 py-0.5">
              <span className="text-dhl-red font-black text-xl">DHL</span>
            </div>
            <h1 className="text-white font-semibold text-lg">Incident Management System</h1>
          </div>
        </div>

        <div className="px-8 py-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Reset Password</h2>
          <p className="text-gray-500 text-sm mb-6">
            Enter your email and we'll send a reset link.
          </p>

          {sent ? (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-800 text-sm">
              If this email exists, a reset link has been sent. Check your inbox.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="you@dhl.com"
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-dhl-red text-white font-semibold py-2.5 rounded-md hover:bg-dhl-red-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-dhl-red hover:underline">
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
