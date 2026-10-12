import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Empty, Spinner } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';

// Landing page after Discord/Twitch sign-in. The server puts the token in the URL
// fragment (#token=...), which never reaches any server; we store it and move on.
export default function AuthCallback() {
  const { adopt } = useAuth();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return; // StrictMode runs effects twice in development
    done.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    window.history.replaceState(null, '', window.location.pathname); // drop the token from the address bar
    const token = params.get('token');
    const next = params.get('next') || '/';
    if (!token) {
      setFailed(true);
      return;
    }
    adopt(token)
      .then(() => navigate(next.startsWith('/') && !next.startsWith('//') ? next : '/', { replace: true }))
      .catch(() => setFailed(true));
  }, [adopt, navigate]);

  if (!failed) return <div className="auth"><Spinner /></div>;
  return (
    <div className="auth">
      <Empty icon="x" title="Sign-in didn't complete">
        <Link to="/login" className="btn btn--primary">Try again</Link>
      </Empty>
    </div>
  );
}
