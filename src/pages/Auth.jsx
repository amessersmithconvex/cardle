import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Auth({ mode }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isLogin = mode === 'login';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(form.email, form.password);
      } else {
        await register(form.username, form.email, form.password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🚗</div>
        <h1 className="text-3xl font-black">
          {isLogin ? 'Welcome Back' : 'Join Cardle'}
        </h1>
        <p className="text-white/50 mt-2">
          {isLogin
            ? 'Sign in to track your stats and scores.'
            : 'Create an account to save your progress.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {!isLogin && (
          <div>
            <label className="block text-sm font-semibold text-white/70 mb-1">Username</label>
            <input
              type="text"
              className="input-field"
              placeholder="gearhead42"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              minLength={3}
              maxLength={20}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-white/70 mb-1">Email</label>
          <input
            type="email"
            className="input-field"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-white/70 mb-1">Password</label>
          <input
            type="password"
            className="input-field"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={6}
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-sm text-white/40 mt-6">
        {isLogin ? (
          <>
            Don't have an account?{' '}
            <Link to="/register" className="text-accent-400 hover:underline">Sign up</Link>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link to="/login" className="text-accent-400 hover:underline">Sign in</Link>
          </>
        )}
      </p>
    </div>
  );
}
