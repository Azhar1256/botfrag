import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Avatar, ErrorBox, Spinner } from '../components/ui.jsx';
import { api, uploadFile } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const PLATFORMS = ['PC', 'PlayStation', 'Xbox', 'Switch', 'Mobile', 'Other'];

export default function Settings() {
  const { user, ready, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

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

      <ErrorBox error={error} />
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={() => navigate(-1)}>Cancel</button>
        <button className="btn btn--primary" disabled={saving || uploading}>{saving ? 'Saving…' : 'Save profile'}</button>
      </div>
    </form>
  );
}
