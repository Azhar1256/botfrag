import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import BrandIcon from '../components/BrandIcon.jsx';
import Icon from '../components/Icon.jsx';
import { Avatar, ErrorBox, Spinner } from '../components/ui.jsx';
import { api, uploadFile } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import useFetch from '../lib/useFetch.js';
import { PROVIDERS } from './Auth.jsx';

function Connections({ user, setUser }) {
  const { data: enabled } = useFetch('/auth/providers');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const shown = PROVIDERS.filter(([key]) => enabled?.[key] || user.connections?.[key]);
  if (!shown.length) return null;

  const connect = async (key) => {
    setBusy(key);
    setError(null);
    try {
      const { ticket } = await api('/auth/link-ticket', { method: 'POST' });
      window.location.assign(`/api/auth/${key}/start?link=${encodeURIComponent(ticket)}`);
    } catch (err) {
      setError(err);
      setBusy(null);
    }
  };

  const disconnect = async (key, label) => {
    if (!window.confirm(`Disconnect ${label}?`)) return;
    setBusy(key);
    setError(null);
    try {
      const { user: updated } = await api(`/auth/connections/${key}`, { method: 'DELETE' });
      setUser(updated);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="field">
      <span className="label">Connected accounts</span>
      <ul className="connection-list">
        {shown.map(([key, label]) => (
          <li key={key} className={`connection connection--${key}`}>
            <BrandIcon name={key} size={18} />
            <span className="connection__text">
              <strong>{label}</strong>
              <small className="muted">
                {user.connections?.[key] ?? 'Not connected'}
                {key === 'steam' && !user.connections?.steam && ' · shows your playtime on posts'}
              </small>
            </span>
            {user.connections?.[key] ? (
              <button type="button" className="btn btn--text btn--sm" disabled={busy === key} onClick={() => disconnect(key, label)}>Disconnect</button>
            ) : (
              <button type="button" className="btn btn--ghost btn--sm" disabled={busy === key} onClick={() => connect(key)}>Connect</button>
            )}
          </li>
        ))}
      </ul>
      <ErrorBox error={error} />
    </div>
  );
}

const PLATFORMS = ['PC', 'PlayStation', 'Xbox', 'Switch', 'Mobile', 'Other'];

export default function Settings() {
  const { user, ready, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [params] = useSearchParams();
  const [error, setError] = useState(() => (params.get('error') ? new Error(params.get('error')) : null));

  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: '/settings' }} />;

  const f = form ?? {
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    platforms: user.platforms,
    favoriteGames: user.favoriteGames.join(', '),
  };
  const set = (k, v) => setForm({ ...f, [k]: v });

  const pickAvatar = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await uploadFile(file);
      if (res.kind !== 'image') throw new Error('Avatar must be an image');
      set('avatarUrl', res.url);
    } catch (err) {
      setError(err);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { user: updated } = await api('/users/me', {
        method: 'PATCH',
        body: { ...f, favoriteGames: f.favoriteGames.split(',').map((g) => g.trim()).filter(Boolean) },
      });
      setUser(updated);
      navigate(`/u/${updated.username}`);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <form className="card compose" onSubmit={submit}>
      <h1>Edit profile</h1>

      <div className="avatar-edit">
        <Avatar user={{ ...user, avatarUrl: f.avatarUrl }} size={88} />
        <div>
          <label className="btn btn--ghost btn--sm">
            <Icon name="upload" size={16} />
            {uploading ? 'Uploading…' : 'Upload avatar'}
            <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden onChange={(e) => pickAvatar(e.target.files[0])} />
          </label>
          {f.avatarUrl && (
            <button type="button" className="btn btn--text btn--sm" onClick={() => set('avatarUrl', '')}>Remove</button>
          )}
        </div>
      </div>

      <label className="field">
        <span className="label">Display name</span>
        <input className="input" value={f.displayName} onChange={(e) => set('displayName', e.target.value)} maxLength={40} />
      </label>

      <label className="field">
        <span className="label">Bio <span className="muted">({280 - f.bio.length} left)</span></span>
        <textarea className="input" rows={3} value={f.bio} onChange={(e) => set('bio', e.target.value)} maxLength={280} placeholder="Mains, ranks, the games you can't put down" />
      </label>

      <fieldset className="field">
        <legend className="label">Platforms you play on</legend>
        <div className="check-row">
          {PLATFORMS.map((p) => (
            <label key={p} className={`check-chip ${f.platforms.includes(p) ? 'is-active' : ''}`}>
              <input
                type="checkbox"
                checked={f.platforms.includes(p)}
                onChange={(e) => set('platforms', e.target.checked ? [...f.platforms, p] : f.platforms.filter((x) => x !== p))}
              />
              {p}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span className="label">Favourite games <span className="muted">(comma separated, up to 8)</span></span>
        <input className="input" value={f.favoriteGames} onChange={(e) => set('favoriteGames', e.target.value)} placeholder="Valorant, Elden Ring" />
      </label>

      <Connections user={user} setUser={setUser} />

      <ErrorBox error={error} />
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={() => navigate(-1)}>Cancel</button>
        <button className="btn btn--primary" disabled={saving || uploading}>{saving ? 'Saving…' : 'Save profile'}</button>
      </div>
    </form>
  );
}
