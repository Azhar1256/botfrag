import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ErrorBox } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';

export default function Auth({ mode }) {
  const { user, login, signup } = useAuth();
  const navigate = useNavigate();
  const from = useLocation().state?.from || '/';
  const [form, setForm] = useState({ login: '', username: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const isSignup = mode === 'signup';

  if (user) return <Navigate to={from} replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isSignup) await signup({ username: form.username, email: form.email, password: form.password });
      else await login(form.login, form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <form className="card auth__card" onSubmit={submit}>
        <img src="/logo.png" alt="" width="64" height="64" />
        <h1>{isSignup ? 'Join Botfrag' : 'Welcome back'}</h1>
        <p className="muted">{isSignup ? 'Share your plays and reviews with other players.' : 'Sign in to post, like and comment.'}</p>

        {isSignup ? (
          <>
            <label className="field">
              <span className="label">Username</span>
              <input
                className="input"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                required
                minLength={3}
                maxLength={20}
                autoComplete="username"
                placeholder="letters, numbers, _"
              />
            </label>
            <label className="field">
              <span className="label">Email</span>
              <input className="input" type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
            </label>
          </>
        ) : (
          <label className="field">
            <span className="label">Username or email</span>
            <input className="input" value={form.login} onChange={set('login')} required autoComplete="username" />
          </label>
        )}
        <label className="field">
          <span className="label">Password</span>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={set('password')}
            required
            minLength={isSignup ? 8 : undefined}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            placeholder={isSignup ? 'At least 8 characters' : undefined}
          />
        </label>

        <ErrorBox error={error} />
        <button className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'One sec…' : isSignup ? 'Create account' : 'Sign in'}
        </button>
        <p className="muted small">
          {isSignup ? (
            <>Already have an account? <Link to="/login" state={{ from }}>Sign in</Link></>
          ) : (
            <>New here? <Link to="/signup" state={{ from }}>Create an account</Link></>
          )}
        </p>
      </form>
    </div>
  );
}
