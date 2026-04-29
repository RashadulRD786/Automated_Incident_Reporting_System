import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../utils/api';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      navigate('/login', { state: { message: 'Password reset successfully. Please log in.' } });
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired reset link');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#FFCC00] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
          <p className="text-red-600 font-medium mb-4">Invalid reset link.</p>
          <Link to="/forgot-password" className="text-dhl-red hover:underline text-sm">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
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
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Set New Password</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-dhl-red text-white font-semibold py-2.5 rounded-md hover:bg-dhl-red-dark disabled:opacity-60 transition-colors"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link to="/login" className="text-sm text-dhl-red hover:underline">
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
