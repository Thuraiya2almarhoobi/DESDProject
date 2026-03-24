import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { MarketingAuthNav } from '../components/MarketingAuthNav';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardPathForRole } from '../lib/roleRouting';
import '../../styles/marketing-auth.css';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password, rememberMe);

    if (result.success) {
      navigate(getDashboardPathForRole(result.user.role));
    } else {
      setError(result.error || 'Login failed');
    }

    setLoading(false);
  };

  return (
    <div className="lfm-auth-page">
      <MarketingAuthNav active="login" />

      <main className="lfm-auth-main">
        <section className="lfm-modal-panel" aria-labelledby="login-title">
          <h1 id="login-title" className="lfm-modal-title">
            Welcome Back
          </h1>
          <p className="lfm-modal-subtitle">Sign in to your account.</p>

          {error && <div className="lfm-alert lfm-alert-error">{error}</div>}

          <form className="lfm-login-form" onSubmit={handleSubmit}>
            <div className="lfm-form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="lfm-form-group">
              <label htmlFor="password">Password</label>
              <div className="lfm-password-field">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="lfm-password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="lfm-form-options">
              <label className="lfm-checkbox" htmlFor="rememberMe">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span>Remember me</span>
              </label>

              <Link to="/forgot-password">Forgot password?</Link>
            </div>

            <button type="submit" className="lfm-btn-submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <Link to="/select-portal?mode=register" className="lfm-btn lfm-btn-secondary" style={{ width: '100%' }}>
              Create Account
            </Link>

            <Link to="/browse" className="lfm-btn" style={{ width: '100%', border: '1px solid var(--lfm-border)' }}>
              Browse Marketplace First
            </Link>
          </form>

          <p className="lfm-auth-switch">
            Don&apos;t have an account? <Link to="/select-portal?mode=register">Sign up instead</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
