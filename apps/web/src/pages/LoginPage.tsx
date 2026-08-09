import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/types';
import { BrandMark } from '../components/BrandMark';
import { Loading } from '../components/Loading';

export function LoginPage() {
  const { user, loading, needsSignup, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading || needsSignup === null) return <Loading />;
  if (user) return <Navigate to="/" replace />;
  if (needsSignup) return <Navigate to="/signup" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-atmosphere" aria-hidden>
        <img
          className="login-hero"
          src="/brand/harbor-login-hero.png"
          alt=""
          decoding="async"
          draggable={false}
        />
      </div>
      <section className="login-card">
        <div className="login-brand">
          <BrandMark size="lg" />
          <h1 className="brand-name">Harbor</h1>
          <p>Sign in to your local Kanban board.</p>
        </div>
        <form className="stack-form" onSubmit={(e) => void onSubmit(e)}>
          <label>
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </div>
  );
}
